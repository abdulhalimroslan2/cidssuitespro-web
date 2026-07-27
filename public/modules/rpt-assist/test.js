const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('dummy.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;

function getAllLinks(win) {
    let links = Array.from(win.document.querySelectorAll('a'));
    for (let i = 0; i < win.frames.length; i++) {
        try {
            links = links.concat(getAllLinks(win.frames[i]));
        } catch(e) {}
    }
    return links;
}

const allLinks = getAllLinks(window);
const rptLinks = allLinks.filter(a => a.href.toLowerCase().includes('rpt9.php') || a.href.toLowerCase().includes('rpt.php'));

console.log(rptLinks.map(a => ({ title: a.textContent.trim(), url: a.href })));
