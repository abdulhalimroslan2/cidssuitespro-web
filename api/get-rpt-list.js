const { launchBrowser } = require('../modules/playwright-launcher');

async function getRptList(username, password) {
    let browser = null;
    try {
        console.log('Launching browser...');
        browser = await launchBrowser({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        console.log('Navigating to login page...');
        await page.goto('https://asiemodel.net/login.php', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log('Filling credentials...');
        await page.fill('input[name="user_id"]', username);
        await page.fill('input[name="user_password"]', password);
        await page.click('button[type="submit"]');

        console.log('Waiting for login to complete...');
        // Wait for the main dashboard to load
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log('Extracting RPT links...');
        const rpts = await page.evaluate(() => {
            let links = Array.from(document.querySelectorAll('.row_content table tbody tr td a[href^="rpt9.php?action=create_rpt"]'));
            
            if (links.length === 0) {
                 let all = Array.from(document.querySelectorAll('a'));
                 links = all.filter(a => a.href.includes('rpt9.php?action=create_rpt') || a.href.includes('rpt.php?action=create_rpt'));
            }
            
            if(links.length > 0) {
                let results = links.map(a => {
                    let title = a.innerText.trim();
                    if(!title) title = a.href;
                    return { title: title, url: a.href };
                });
                
                // Remove duplicates
                let unique = [];
                let urls = new Set();
                for(let r of results) {
                    if(!urls.has(r.url)) {
                        unique.push(r);
                        urls.add(r.url);
                    }
                }
                return unique;
            }
            return [];
        });

        return rpts;
    } catch (e) {
        console.error('Error fetching RPT list:', e);
        throw e;
    } finally {
        if (browser) await browser.close();
    }
}

// Simple test wrapper
if (require.main === module) {
    (async () => {
        try {
            // WE NEED CREDENTIALS TO TEST THIS!
            // Without valid credentials, it won't be able to log in.
            // But we can check if it compiles and runs.
            const rpts = await getRptList('dummy', 'dummy');
            console.log('RPTs:', rpts);
        } catch (e) {
            console.error('Test failed:', e);
        }
    })();
}

module.exports = async (req, res) => {
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
        const { credentials } = req.body;
        
        if (!credentials || !credentials.username || !credentials.password) {
            return res.status(400).json({ success: false, error: 'Credentials (username/password) are required' });
        }

        const rpts = await getRptList(credentials.username, credentials.password);
        res.status(200).json({ success: true, data: rpts });
    } catch (error) {
        console.error('[Vercel API] Error in get-rpt-list:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ralat pelayan Vercel: ' + error.message 
        });
    }
};
