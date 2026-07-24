const express = require('express');
const cors = require('cors');
const { submitRPH } = require('./modules/rph-assist/rph-submitter.js');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large JSON if necessary

app.get('/', (req, res) => {
    res.send('CIDS Backend is running.');
});

app.post('/api/submit-rph', async (req, res) => {
    try {
        const { lessons, miwDate, credentials, apiKey, bbm } = req.body;
        
        if (!credentials || !credentials.username || !credentials.password) {
            return res.status(400).json({ success: false, error: 'Credentials (username/password) are required' });
        }
        if (!lessons || !Array.isArray(lessons)) {
            return res.status(400).json({ success: false, error: 'Lessons array is required' });
        }

        console.log(`[API] Menerima arahan submitRPH untuk ${lessons.length} kelas pada tarikh ${miwDate}`);
        
        // Let it run in the background (fire and forget for now, or await depending on timeout)
        // Since Vercel or Render might timeout if we wait too long, we can send a success response immediately
        // But for a true API, we wait for the result
        
        // Note: submitRPH doesn't explicitly return a success state, but we await it
        await submitRPH(lessons, miwDate, credentials, apiKey, bbm);
        
        res.json({ success: true, message: 'Automasi RPH selesai dengan jayanya.' });
    } catch (error) {
        console.error('[API] Error in submit-rph:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`CIDS Backend listening at http://localhost:${port}`);
});
