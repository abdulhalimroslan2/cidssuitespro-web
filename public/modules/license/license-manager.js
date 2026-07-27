'use strict';

/**
 * CIDS Suites Pro - License Manager
 * Menguruskan trial, aktivasi, dan pengesahan lesen online via Vercel API
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// =========================================================
// KONFIGURASI - Tukar URL ini selepas deploy ke Vercel
// =========================================================
const LICENSE_API_URL = 'https://cids-license-api.vercel.app';
const TRIAL_DAYS = 14;

// Path fail lesen tempatan dalam userData
const getLicensePath = () => path.join(app.getPath('userData'), 'suites_license.json');

// =========================================================
// FUNGSI MACHINE ID
// cuba guna node-machine-id, fallback ke crypto hash
// =========================================================
function getMachineId() {
    // Gunakan maklumat sistem sebagai ID unik - 100% stabil dalam Electron
    // dan tidak menyebabkan EPIPE crash berbanding node-machine-id
    const info = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0]?.model || 'unknown',
        os.totalmem().toString()
    ].join('|');
    
    return crypto.createHash('sha256').update(info).digest('hex');
}

function getDeviceName() {
    return `${os.hostname()} (${os.platform()} ${os.arch()})`;
}

// =========================================================
// ENKRIPSI LESEN (AES-256-GCM)
// =========================================================
const APP_SECRET = 'cids_suites_pro_v2_very_secret_key_2026';

function getEncryptionKey(machineId) {
    return crypto.createHash('sha256').update(APP_SECRET + machineId).digest();
}

function encryptLicense(data, machineId) {
    const iv = crypto.randomBytes(16);
    const key = getEncryptionKey(machineId);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted,
        tag: authTag
    });
}

function decryptLicense(encryptedJson, machineId) {
    try {
        // Fallback backward compatibility for plain JSON (optional, we can remove this if we want strict)
        if (encryptedJson.includes('"mode"')) {
            return JSON.parse(encryptedJson);
        }

        const { iv, data, tag } = JSON.parse(encryptedJson);
        if (!iv || !data || !tag) return null;

        const key = getEncryptionKey(machineId);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        
        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (e) {
        console.error('[License] Decryption failed (Tampered or wrong machine):', e.message);
        return null;
    }
}

// =========================================================
// FAIL LESEN TEMPATAN
// =========================================================
function loadLocalLicense() {
    try {
        const licensePath = getLicensePath();
        if (fs.existsSync(licensePath)) {
            const rawContent = fs.readFileSync(licensePath, 'utf8');
            const machineId = getMachineId();
            return decryptLicense(rawContent, machineId);
        }
    } catch (e) {
        console.error('[License] Error loading license file:', e.message);
    }
    return null;
}

function saveLocalLicense(data) {
    try {
        const licensePath = getLicensePath();
        const machineId = getMachineId();
        const encryptedContent = encryptLicense(data, machineId);
        fs.writeFileSync(licensePath, encryptedContent, 'utf8');
        return true;
    } catch (e) {
        console.error('[License] Error saving license file:', e.message);
        return false;
    }
}

// =========================================================
// SEMAK STATUS LESEN
// Returns: { mode, daysLeft, expiryDate, activatedKey, machineId }
// mode: 'trial' | 'trial_expired' | 'active' | 'verifying'
// =========================================================
async function checkLicenseStatus() {
    const machineId = getMachineId();
    let localLicense = loadLocalLicense();

    // Ada key yang diaktifkan - verify dengan server
    if (localLicense && localLicense.mode === 'active' && localLicense.activatedKey) {
        try {
            const result = await verifyOnlineKey(localLicense.activatedKey, machineId);
            
            if (result.valid) {
                localLicense.lastVerified = new Date().toISOString();
                localLicense.machineId = machineId;
                saveLocalLicense(localLicense);
                
                return {
                    mode: 'active',
                    daysLeft: null,
                    activatedKey: localLicense.activatedKey,
                    machineId
                };
            } else {
                console.warn('[License] Online verification gagal:', result.message);
                if (result.code === 'SERVER_ERROR' || result.code === 'NETWORK_ERROR') {
                    return {
                        mode: 'active',
                        daysLeft: null,
                        activatedKey: localLicense.activatedKey,
                        machineId,
                        offline: true
                    };
                }
                return {
                    mode: 'key_invalid',
                    message: result.message,
                    code: result.code,
                    machineId
                };
            }
        } catch (e) {
            return {
                mode: 'active',
                daysLeft: null,
                activatedKey: localLicense.activatedKey,
                machineId,
                offline: true
            };
        }
    }

    // Trial mode - sentiasa berikan 14 hari penuh
    const now = new Date();
    const expiryDate = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    localLicense = {
        installDate: now.toISOString(),
        expiryDate,
        mode: 'trial',
        activatedKey: null,
        machineId
    };
    saveLocalLicense(localLicense);
    return {
        mode: 'trial',
        daysLeft: TRIAL_DAYS,
        expiryDate,
        machineId
    };
}

// =========================================================
// VERIFY KEY ONLINE
// =========================================================
async function verifyOnlineKey(key, machineId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saat timeout
    
    try {
        const response = await fetch(`${LICENSE_API_URL}/api/verify-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: key.trim().toUpperCase(),
                machineId,
                deviceName: getDeviceName()
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return { valid: false, code: 'SERVER_ERROR', message: 'Ralat server.' };
        }
        
        return await response.json();
    } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
            return { valid: false, code: 'NETWORK_ERROR', message: 'Timeout - semak sambungan internet.' };
        }
        return { valid: false, code: 'NETWORK_ERROR', message: 'Gagal sambung ke server lesen.' };
    }
}

// =========================================================
// AKTIFKAN KEY BARU
// =========================================================
async function activateLicense(key) {
    const machineId = getMachineId();
    const normalizedKey = key.trim().toUpperCase();
    
    // Validate format dulu
    const keyRegex = /^CIDS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyRegex.test(normalizedKey)) {
        return {
            success: false,
            code: 'INVALID_FORMAT',
            message: 'Format key tidak sah. Contoh: CIDS-ABCD-1234-EFGH'
        };
    }
    
    // Verify dengan server
    const result = await verifyOnlineKey(normalizedKey, machineId);
    
    if (result.valid) {
        // Simpan ke fail tempatan
        const licenseData = {
            installDate: loadLocalLicense()?.installDate || new Date().toISOString(),
            expiryDate: null,
            mode: 'active',
            activatedKey: normalizedKey,
            machineId,
            activationDate: new Date().toISOString(),
            lastVerified: new Date().toISOString()
        };
        
        saveLocalLicense(licenseData);
        
        return {
            success: true,
            code: result.code,
            message: result.message || 'Lesen berjaya diaktifkan!'
        };
    }
    
    return {
        success: false,
        code: result.code,
        message: result.message
    };
}

// =========================================================
// EXPORT
// =========================================================
module.exports = {
    checkLicenseStatus,
    activateLicense,
    getMachineId,
    TRIAL_DAYS,
    LICENSE_API_URL
};
