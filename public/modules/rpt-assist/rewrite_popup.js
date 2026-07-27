const fs = require('fs');

const path = '../CIDS_RPT_AI_Assist (2)/popup.html';
let html = fs.readFileSync(path, 'utf8');

// The new CSS to inject
const newCss = `
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif; 
            padding: 16px; 
            width: 320px; 
            margin: 0; 
            min-height: 450px;
            background: linear-gradient(135deg, #2a0845 0%, #6441A5 100%); 
            color: #f8fafc; 
        }
        
        /* Dashboard Styles */
        #dashboardView {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding-top: 10px;
        }
        .dashboard-header {
            text-align: center;
            margin-bottom: 10px;
        }
        .dashboard-header h1 {
            margin: 0;
            font-size: 26px;
            color: #FFD700;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        .dashboard-header h2 {
            margin: 0;
            font-size: 22px;
            color: #ffffff;
            font-weight: 800;
            line-height: 1;
        }
        .dashboard-header p {
            margin: 8px 0 0 0;
            font-size: 10px;
            color: #cbd5e1;
            font-weight: 500;
        }
        
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        .dash-card {
            border-radius: 12px;
            padding: 16px 10px;
            text-align: center;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            min-height: 120px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .dash-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        }
        .dash-card.purple { background: linear-gradient(135deg, #4c1d95, #6d28d9); }
        .dash-card.orange { background: linear-gradient(135deg, #ea580c, #f97316); }
        .dash-card.green { background: linear-gradient(135deg, #047857, #10b981); }
        .dash-card.blue { background: linear-gradient(135deg, #1d4ed8, #2563eb); }
        
        .dash-icon {
            font-size: 32px;
            margin-bottom: 8px;
            color: white;
        }
        .dash-title {
            font-size: 13px;
            font-weight: 700;
            color: white;
            margin-bottom: 4px;
        }
        .dash-desc {
            font-size: 9px;
            color: rgba(255,255,255,0.8);
            line-height: 1.3;
        }
        .dash-arrow {
            margin-top: 8px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
        }

        .footer-icons {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 12px;
        }
        .footer-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            width: 25%;
        }
        .footer-item svg {
            width: 16px;
            height: 16px;
            color: #94a3b8;
        }
        .footer-item span {
            font-size: 7px;
            color: #94a3b8;
            text-align: center;
            font-weight: 600;
        }
        
        /* RPT Assist Form Styles */
        .header-container {
            position: sticky; 
            top: 12px; 
            margin: -4px 0 20px 0;
            padding: 12px 16px; 
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(24px) saturate(200%); 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
            z-index: 50;
            border-radius: 20px;
        }
        .header-content {
            display: flex;
            flex-direction: column;
            gap: 12px;
            flex-grow: 1;
        }
        .header-row {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .logo-placeholder {
            width: 38px;
            height: 38px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 16px;
        }
        .header-text-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .title-main {
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
            line-height: 1.2;
        }
        .title-sub {
            font-size: 11px;
            margin-top: 2px;
            color: #94a3b8;
            font-weight: 500;
        }
        
        /* Inputs */
        label { 
            display: block; 
            font-size: 13px; 
            font-weight: 600; 
            margin-bottom: 4px; 
            color: #e2e8f0; 
        }
        .help-text { 
            font-size: 11px; 
            color: #94a3b8; 
            margin-top: 4px; 
        }
        input[type="text"], input[type="password"], input[type="number"], textarea { 
            width: 100%; 
            box-sizing: border-box; 
            padding: 8px; 
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2); 
            border-radius: 8px; 
            font-size: 14px; 
            color: #f8fafc;
            transition: all 0.2s ease;
        }
        input[type="text"]:focus, input[type="password"]:focus, input[type="number"]:focus, textarea:focus {
            outline: none;
            background: rgba(0, 0, 0, 0.5);
            border-color: #a855f7;
            box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.4);
        }
        
        button { 
            width: 100%; 
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #ffffff; 
            padding: 10px; 
            border-radius: 8px; 
            font-size: 14px; 
            font-weight: 600; 
            cursor: pointer; 
            margin-top: 8px; 
            transition: all 0.2s; 
        }
        button:hover { 
            background: rgba(255, 255, 255, 0.2); 
        }
        #processBtn {
            background: linear-gradient(135deg, #4c1d95, #6d28d9);
            border: 1px solid #7c3aed;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(76, 29, 149, 0.4);
        }
        #processBtn:hover:not(:disabled) {
            background: linear-gradient(135deg, #5b21b6, #7c3aed);
        }
        #processBtn:disabled {
            background: rgba(255, 255, 255, 0.1);
            color: #94a3b8;
            border-color: rgba(255, 255, 255, 0.2);
            box-shadow: none;
        }
        
        .status { 
            margin-top: 12px; 
            font-size: 13px; 
            color: #f8fafc; 
            padding: 10px; 
            border-radius: 8px; 
            background: rgba(0, 0, 0, 0.4); 
            border: 1px solid rgba(255, 255, 255, 0.2);
            display: none; 
        }
        hr {
            border: 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            margin: 16px 0;
        }
        
        /* Back Button */
        .back-btn {
            background: transparent;
            border: none;
            color: #cbd5e1;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 0;
            margin-bottom: 12px;
            cursor: pointer;
            box-shadow: none;
            width: auto;
        }
        .back-btn:hover {
            color: #ffffff;
            background: transparent;
            box-shadow: none;
        }
`;

// Extract styles
html = html.replace(/<style>[\s\S]*?<\/style>/, '<style>\n' + newCss + '\n    </style>');

// Extract body contents
let bodyMatch = html.match(/<body>([\s\S]*?)<script src="mammoth\.browser\.min\.js"><\/script>/);
let oldBody = bodyMatch[1];

let newDashboardHTML = `
    <div id="dashboardView">
        <div class="dashboard-header">
            <h2>CIDS</h2>
            <h1>SUITES PRO</h1>
            <p>AI Assist. Minimalist. Smart.<br>RPH AUTOMATION THAT EMPOWERS EDUCATORS</p>
        </div>
        
        <div class="dashboard-grid">
            <div class="dash-card purple" id="btnGoRpt">
                <div class="dash-icon">🤖</div>
                <div class="dash-title">RPT ASSIST</div>
                <div class="dash-desc">Jana RPT secara automatik berdasarkan standard.</div>
                <div class="dash-arrow">➔</div>
            </div>
            
            <div class="dash-card orange" onclick="alert('RPH ASSIST akan datang!')">
                <div class="dash-icon">📄</div>
                <div class="dash-title">RPH ASSIST</div>
                <div class="dash-desc">Jana RPH harian berkualiti tinggi.</div>
                <div class="dash-arrow">➔</div>
            </div>
            
            <div class="dash-card green" onclick="alert('RPH DELETER akan datang!')">
                <div class="dash-icon">🗑️</div>
                <div class="dash-title">RPH DELETER</div>
                <div class="dash-desc">Padam RPH tidak diperlukan dengan selamat.</div>
                <div class="dash-arrow">➔</div>
            </div>
            
            <div class="dash-card blue" onclick="alert('SETTING akan datang!')">
                <div class="dash-icon">⚙️</div>
                <div class="dash-title">SETTING</div>
                <div class="dash-desc">Sesuaikan tetapan dan profil pengguna.</div>
                <div class="dash-arrow">➔</div>
            </div>
        </div>
        
        <div class="footer-icons">
            <div class="footer-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                <span>AI-POWERED</span>
            </div>
            <div class="footer-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span>SECURE</span>
            </div>
            <div class="footer-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                <span>SCALABLE</span>
            </div>
            <div class="footer-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span>EDUCATOR</span>
            </div>
        </div>
    </div>

    <div id="rptAssistView" style="display: none;">
        <button class="back-btn" id="btnBackDash">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Kembali ke Suites Pro
        </button>
        ${oldBody}
    </div>
`;

// Fix hardcoded inline styles in the old body that clash with dark mode
let modifiedOldBody = oldBody
    .replace(/background: rgba\(255, 255, 255, 0\.4\)/g, 'background: rgba(0, 0, 0, 0.4)')
    .replace(/color: #0f172a/g, 'color: #ffffff')
    .replace(/color: #334155/g, 'color: #e2e8f0')
    .replace(/color: #1e293b/g, 'color: #f8fafc')
    .replace(/background: white/g, 'background: rgba(255,255,255,0.1)')
    .replace(/background: rgba\(255, 255, 255, 0\.3\)/g, 'background: rgba(0, 0, 0, 0.3)');

html = html.replace(/<body>[\s\S]*?<script src="mammoth\.browser\.min\.js"><\/script>/, '<body>\n' + newDashboardHTML.replace('${oldBody}', modifiedOldBody) + '\n    <script src="mammoth.browser.min.js"></script>');

fs.writeFileSync(path, html);
console.log('popup.html modified successfully.');

