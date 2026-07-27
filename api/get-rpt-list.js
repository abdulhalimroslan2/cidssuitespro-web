const { launchBrowser } = require('../modules/playwright-launcher');

async function getRptList(username, password) {
    let browser = null;
    try {
        console.log('Launching browser...');
        browser = await launchBrowser({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Block images, fonts, and css to save memory
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        console.log('Navigating to login page...');
        await page.goto('https://asiemodel.net/model/main.php?cb=ms', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log('Filling credentials...');
        const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="login"], input[placeholder="Login"], input[placeholder="Username"], input[placeholder*="E-mel"]').first();
        await emailInput.fill(username);
        const pwdInput = page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
        await pwdInput.fill(password);
        
        console.log('Waiting for login to complete...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
            page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Log Masuk")').first().click()
        ]);

        console.log('Navigating to RPT page (search9.php)...');
        await page.goto('https://asiemodel.net/model/search9.php?action=search_yearly', { waitUntil: 'domcontentloaded', timeout: 30000 });

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
        if (browser && e.message.includes('Timeout')) {
            try {
                const pages = await browser.contexts()[0].pages();
                if (pages.length > 0) {
                    const html = await pages[0].content();
                    console.log("PAGE HTML AT TIMEOUT:", html.substring(0, 500));
                    throw new Error(e.message + "\nPage HTML snippet: " + html.substring(0, 200));
                }
            } catch (innerErr) {
                console.error("Could not extract HTML:", innerErr);
            }
        }
        throw e;
    } finally {
        if (browser) await browser.close();
    }
}

// Simple test wrapper
if (require.main === module) {
    (async () => {
        try {
            // Testing with real credentials as requested by user
            const rpts = await getRptList('Roslan2', '@reeZ860');
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
