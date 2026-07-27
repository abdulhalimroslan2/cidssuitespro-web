import { supabase } from '../../../lib/supabase.js';

// POST /api/verify-license
// Web / Mobile / Electron app hantar: { key, machineId, fingerprint, deviceName }
// Returns: { valid, message, code, keyInfo }
export async function POST(request) {
    try {
        const body = await request.json();
        const { key, machineId, fingerprint, deviceName } = body;

        const effectiveMachineId = fingerprint || machineId;

        // Validate input
        if (!key || !effectiveMachineId) {
            return Response.json(
                { valid: false, code: 'INVALID_INPUT', message: 'Key dan Device Fingerprint diperlukan.' },
                { status: 400 }
            );
        }

        // Normalize key (uppercase, trim)
        const normalizedKey = key.trim().toUpperCase();

        // Semak format key: CIDS-XXXX-XXXX-XXXX
        const keyRegex = /^CIDS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        if (!keyRegex.test(normalizedKey)) {
            return Response.json(
                { valid: false, code: 'INVALID_FORMAT', message: 'Format key tidak sah. Contoh: CIDS-ABCD-1234-EFGH' },
                { status: 200 }
            );
        }

        // Semak key dalam database
        const { data: licenseKey, error: keyError } = await supabase
            .from('license_keys')
            .select('*')
            .eq('key', normalizedKey)
            .single();

        if (keyError || !licenseKey) {
            return Response.json(
                { valid: false, code: 'INVALID_KEY', message: 'Key tidak dijumpai atau tidak sah.' },
                { status: 200 }
            );
        }

        // Semak sama ada key aktif
        if (!licenseKey.is_active) {
            return Response.json(
                { valid: false, code: 'KEY_DISABLED', message: 'Key ini telah dinyahaktifkan. Hubungi admin.' },
                { status: 200 }
            );
        }

        // Semak sama ada device/fingerprint ini sudah terdaftar
        const { data: registeredDevices, count } = await supabase
            .from('license_devices')
            .select('*', { count: 'exact' })
            .eq('key', normalizedKey);

        const devices = registeredDevices || [];
        const deviceCount = count || devices.length;

        // Cari sama ada machineId / fingerprint sepadan dengan device sedia ada
        const existingDevice = devices.find(d => 
            d.machine_id === effectiveMachineId || 
            d.machine_id === machineId || 
            (fingerprint && d.machine_id === fingerprint)
        );

        if (existingDevice) {
            // Semak jika tempoh 1 tahun telah luput
            const activationDate = new Date(existingDevice.activated_at);
            const oneYearLater = new Date(activationDate);
            oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
            
            if (new Date() > oneYearLater) {
                return Response.json({
                    valid: false,
                    code: 'EXPIRED',
                    message: 'Lesen langganan 1 tahun anda telah tamat tempoh.'
                }, { status: 200 });
            }

            // Kemas kini last_seen dan machine_id (jika bertukar)
            await supabase
                .from('license_devices')
                .update({ 
                    machine_id: effectiveMachineId,
                    last_seen: new Date().toISOString() 
                })
                .eq('id', existingDevice.id);

            return Response.json({
                valid: true,
                code: 'VERIFIED',
                message: 'Lesen sah. Selamat datang!',
                keyInfo: {
                    key: normalizedKey,
                    maxDevices: licenseKey.max_devices,
                    registeredCount: deviceCount,
                    expiryDate: oneYearLater.toISOString()
                }
            });
        }

        // Device baharu - semak had peranti
        if (deviceCount >= licenseKey.max_devices) {
            const deviceList = devices
                .map(d => d.device_name || 'Peranti Tanpa Nama')
                .join(', ');

            return Response.json({
                valid: false,
                code: 'MAX_DEVICES',
                message: `Had ${licenseKey.max_devices} peranti telah dicapai. Peranti berdaftar: ${deviceList}. Hubungi admin jika perlu reset slot peranti.`,
                registeredDevices: devices.map(d => ({
                    deviceName: d.device_name,
                    activatedAt: d.activated_at
                }))
            });
        }

        // Daftar peranti baharu menggunakan effectiveMachineId (Fingerprint)
        const { error: insertError } = await supabase
            .from('license_devices')
            .insert({
                key: normalizedKey,
                machine_id: effectiveMachineId,
                device_name: deviceName || 'Web Device',
                activated_at: new Date().toISOString(),
                last_seen: new Date().toISOString()
            });

        if (insertError) {
            console.error('Insert device error:', insertError);
            return Response.json(
                { valid: false, code: 'SERVER_ERROR', message: 'Ralat server semasa mendaftar peranti.' },
                { status: 500 }
            );
        }

        return Response.json({
            valid: true,
            code: 'ACTIVATED',
            message: `Lesen berjaya diaktifkan! Peranti ${deviceCount + 1}/${licenseKey.max_devices} didaftarkan.`,
            keyInfo: {
                key: normalizedKey,
                maxDevices: licenseKey.max_devices,
                deviceSlot: deviceCount + 1
            }
        });

    } catch (error) {
        console.error('License verification error:', error);
        return Response.json(
            { valid: false, code: 'SERVER_ERROR', message: 'Ralat server. Sila cuba lagi.' },
            { status: 500 }
        );
    }
}

// GET Health Check
export async function GET() {
    return Response.json({ status: 'ok', service: 'CIDS License API', version: '2.0.0' });
}
