const submitRphApi = require('./api/submit-rph.js');

async function test() {
    console.log("Starting local test of Vercel Serverless Function...");
    
    // Set env var to trigger local chromium branch
    process.env.VERCEL = '';
    
    const req = {
        method: 'POST',
        body: {
            lessons: [{ class_id: 'test', subject_id: 'test', session_text: 'Test Class' }],
            miwDate: '01-01-2024',
            credentials: { username: 'testuser', password: 'password123' }
        }
    };
    
    const res = {
        setHeader: () => {},
        status: function(code) {
            console.log("Status Code:", code);
            return this;
        },
        json: function(data) {
            console.log("Response JSON:", data);
        },
        end: function() {
            console.log("Response ended");
        }
    };

    try {
        await submitRphApi(req, res);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
