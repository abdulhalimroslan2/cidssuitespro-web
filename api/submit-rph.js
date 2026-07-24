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

    // Tangkap sebarang ralat semasa memuatkan pustaka
    let submitRPH;
    try {
        const rphSubmitter = require('../modules/rph-assist/rph-submitter.js');
        submitRPH = rphSubmitter.submitRPH;
    } catch (initErr) {
        return res.status(500).json({ 
            success: false, 
            error: 'Gagal memuatkan komponen utama', 
            details: initErr.message,
            stack: initErr.stack 
        });
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
        
        await submitRPH(lessons, miwDate, credentials, apiKey, bbm);
        
        res.status(200).json({ success: true, message: 'Automasi RPH selesai dengan jayanya.' });
    } catch (error) {
        console.error('[Vercel API] Error in submit-rph:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
