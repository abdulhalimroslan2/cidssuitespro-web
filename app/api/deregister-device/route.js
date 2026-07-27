import { supabase } from '../../../lib/supabase.js';

// POST /api/deregister-device
// Untuk admin reset device (atau user deregister sendiri)
// Body: { key, machineId, adminSecret }
export async function POST(request) {
    try {
        const body = await request.json();
        const { key, machineId, adminSecret } = body;

        // Simple admin auth - semak secret
        const validSecret = process.env.LICENSE_API_SECRET;
        if (adminSecret !== validSecret) {
            return Response.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        if (!key || !machineId) {
            return Response.json(
                { success: false, message: 'Key dan machineId diperlukan.' },
                { status: 400 }
            );
        }

        const normalizedKey = key.trim().toUpperCase();

        const { error } = await supabase
            .from('license_devices')
            .delete()
            .eq('key', normalizedKey)
            .eq('machine_id', machineId);

        if (error) {
            return Response.json({ success: false, message: 'Ralat semasa deregister.' }, { status: 500 });
        }

        return Response.json({
            success: true,
            message: `Device berjaya dideregistrasikan dari key ${normalizedKey}.`
        });

    } catch (error) {
        return Response.json({ success: false, message: 'Ralat server.' }, { status: 500 });
    }
}

// GET /api/deregister-device?key=CIDS-XXXX-XXXX-XXXX&adminSecret=xxx
// Lihat semua device untuk satu key
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        const adminSecret = searchParams.get('adminSecret');

        const validSecret = process.env.LICENSE_API_SECRET;
        if (adminSecret !== validSecret) {
            return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        if (!key) {
            return Response.json({ success: false, message: 'Key diperlukan.' }, { status: 400 });
        }

        const normalizedKey = key.trim().toUpperCase();

        const { data: devices, error } = await supabase
            .from('license_devices')
            .select('*')
            .eq('key', normalizedKey);

        if (error) {
            return Response.json({ success: false, message: 'Ralat mendapatkan data.' }, { status: 500 });
        }

        return Response.json({
            success: true,
            key: normalizedKey,
            devices: devices || [],
            deviceCount: devices ? devices.length : 0
        });

    } catch (error) {
        return Response.json({ success: false, message: 'Ralat server.' }, { status: 500 });
    }
}
