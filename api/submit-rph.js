const { submitRPH } = require('../modules/rph-assist/rph-submitter.js');

module.exports = exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { lessons, miwDate, credentials, apiKey, bbm } = req.body;
        
        if (!credentials || !credentials.username || !credentials.password) {
            return res.status(400).json({ success: false, error: 'Credentials (username/password) are required' });
        }
        if (!lessons || !Array.isArray(lessons)) {
            return res.status(400).json({ success: false, error: 'Lessons array is required' });
        }

        console.log(`[Vercel API] Menerima arahan submitRPH untuk ${lessons.length} kelas pada tarikh ${miwDate}`);
        
        // Let it run in the background if possible, or await it
        // Vercel will terminate background processes when the response is sent, so we MUST await it.
        // It's recommended to configure maxDuration: 60 in vercel.json.
        await submitRPH(lessons, miwDate, credentials, apiKey, bbm);
        
        res.status(200).json({ success: true, message: 'Automasi RPH selesai dengan jayanya.' });
    } catch (error) {
        console.error('[Vercel API] Error in submit-rph:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
