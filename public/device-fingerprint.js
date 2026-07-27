/**
 * CIDS SUITES PRO - Advanced Browser & Hardware Device Fingerprinter
 * Generates a deterministic device fingerprint hash that remains consistent
 * even if browser cache/cookies are cleared or user switches browsers on the same device.
 */

(function (global) {
    'use strict';

    // Fast cyrb53 hash function (produces 64-bit hash as 16-char hex)
    function cyrb53(str, seed = 0) {
        let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
        h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
        h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
    }

    // Canvas 2D Signature
    function getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 240;
            canvas.height = 60;
            const ctx = canvas.getContext('2d');
            if (!ctx) return 'no-canvas-ctx';

            // Text with different fonts and baseline
            ctx.textBaseline = 'top';
            ctx.font = "14px 'Arial', sans-serif";
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);

            ctx.fillStyle = '#069';
            ctx.fillText('CIDS Pro Suites 🔒', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('CIDS Pro Suites 🔒', 4, 17);

            // Canvas blending & shapes
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgb(255,0,255)';
            ctx.beginPath();
            ctx.arc(50, 40, 15, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgb(0,255,255)';
            ctx.beginPath();
            ctx.arc(65, 40, 15, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();

            return cyrb53(canvas.toDataURL());
        } catch (e) {
            return 'canvas-error';
        }
    }

    // WebGL Hardware Renderer Signature
    function getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return 'no-webgl';

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
            const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

            return cyrb53(`${vendor}~${renderer}`);
        } catch (e) {
            return 'webgl-error';
        }
    }

    // Screen & Perkakasan (Hardware) Signature
    function getHardwareTraits() {
        const screenStr = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
        const ratio = window.devicePixelRatio || 1;
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4;
        const touchPoints = navigator.maxTouchPoints || 0;
        const timezone = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) 
            ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' 
            : '';
        const platform = navigator.platform || '';

        return `${screenStr}|r:${ratio}|c:${cores}|m:${memory}|t:${touchPoints}|tz:${timezone}|p:${platform}`;
    }

    // Redundant Multi-Storage Management
    const STORAGE_KEY = 'cids_device_fp_hash';

    function getStoredFP() {
        try {
            // 1. Check LocalStorage
            let fp = localStorage.getItem(STORAGE_KEY);
            if (fp) return fp;

            // 2. Check SessionStorage
            fp = sessionStorage.getItem(STORAGE_KEY);
            if (fp) return fp;

            // 3. Check Cookie
            const match = document.cookie.match(new RegExp('(^| )' + STORAGE_KEY + '=([^;]+)'));
            if (match) return match[2];
        } catch (e) {}
        return null;
    }

    function saveFPToStorage(fp) {
        try {
            localStorage.setItem(STORAGE_KEY, fp);
            sessionStorage.setItem(STORAGE_KEY, fp);
            document.cookie = `${STORAGE_KEY}=${fp}; max-age=31536000; path=/; SameSite=Lax`;
        } catch (e) {}
    }

    // Main Function to generate Device Fingerprint
    function generateDeviceFingerprint() {
        // 1. Try to read existing stored fingerprint first
        const stored = getStoredFP();
        if (stored && stored.startsWith('CIDS-FP-')) {
            return stored;
        }

        // 2. Compute hardware & canvas deterministic hash
        const canvasHash = getCanvasFingerprint();
        const webglHash = getWebGLFingerprint();
        const hardwareTraits = getHardwareTraits();

        const combinedRaw = `HW:[${hardwareTraits}]|CV:[${canvasHash}]|GL:[${webglHash}]`;
        const fpHash = 'CIDS-FP-' + cyrb53(combinedRaw).toUpperCase();

        // 3. Persist to redundant stores
        saveFPToStorage(fpHash);

        return fpHash;
    }

    // Function to get Device Display Name
    function getDeviceDisplayName() {
        let os = 'Web Device';
        const ua = navigator.userAgent || '';
        if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS Mobile Device';
        else if (/Android/i.test(ua)) os = 'Android Mobile Device';
        else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac Desktop/Laptop';
        else if (/Windows/i.test(ua)) os = 'Windows PC';
        else if (/Linux/i.test(ua)) os = 'Linux PC';

        const screenInfo = `${window.screen.width}x${window.screen.height}`;
        return `${os} (${screenInfo})`;
    }

    // Export to global scope
    global.CIDSFingerprint = {
        getFingerprint: generateDeviceFingerprint,
        getDeviceName: getDeviceDisplayName
    };

})(typeof window !== 'undefined' ? window : this);
