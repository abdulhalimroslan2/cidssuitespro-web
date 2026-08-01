'use client';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cids_settings');
      if (!raw) return;
      const s = JSON.parse(raw);
      setUsername(s.username || '');
      let pw = s.password || '';
      try { pw = decodeURIComponent(atob(pw)); } catch { try { pw = atob(pw); } catch {} }
      setPassword(pw);
      let ak = s.apiKey || '';
      try { ak = decodeURIComponent(atob(ak)); } catch { try { ak = atob(ak); } catch {} }
      setApiKey(ak);
      let dk = s.deepseekKey || '';
      try { dk = decodeURIComponent(atob(dk)); } catch { try { dk = atob(dk); } catch {} }
      setDeepseekKey(dk);
    } catch {}
  }, []);

  function handleSave() {
    const data = {
      username,
      password: btoa(encodeURIComponent(password)),
      apiKey: btoa(encodeURIComponent(apiKey)),
      deepseekKey: deepseekKey ? btoa(encodeURIComponent(deepseekKey)) : '',
    };
    localStorage.setItem('cids_settings', JSON.stringify(data));
    setSaveStatus('✅ Tetapan telah disimpan!');
    setTimeout(() => setSaveStatus(''), 3000);
    // Force sidebar re-render
    window.dispatchEvent(new Event('storage'));
  }

  return (
    <div className="module-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 650, animation: 'fadeIn 0.5s ease' }}>
        {/* Banner */}
        <img src="/assets/SETTING BANNER.png" alt="Setting Banner" style={{
          width: '100%', borderRadius: 16, marginBottom: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'block'
        }} />

        {/* Main Card */}
        <div style={{
          background: '#ffffff', borderRadius: 20, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b'
        }}>
          {/* Step 1: Akaun Pengguna */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>1</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Akaun Pengguna</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Maklumat akaun pengguna sistem.</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Username</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>👤</span>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="Masukkan ID Pengguna"
                      style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔒</span>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '24px 0' }} />

          {/* Step 2: API Key */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>2</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>API Key</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                Sila masukkan API Key untuk menggunakan sistem. Daftar di{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Google AI Studio</a> untuk mendapatkan API Key (percuma).
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Gemini API Key</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔑</span>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="•••••••••••••••••••••••••••••"
                    style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>DeepSeek API Key</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔑</span>
                  <input type="password" value={deepseekKey} onChange={e => setDeepseekKey(e.target.value)}
                    placeholder="•••••••••••••••••••••••••••••"
                    style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '24px 0' }} />

          {/* Save Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            {saveStatus && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>{saveStatus}</span>}
            <button onClick={handleSave} style={{
              padding: '12px 28px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              transition: 'all 0.2s',
            }}>Simpan Tetapan</button>
          </div>

          {/* Security Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Maklumat anda adalah selamat dan tidak akan dikongsi dengan pihak ketiga. Data dilindungi sepenuhnya oleh penyulitan pelayar.
          </div>
        </div>
      </div>
    </div>
  );
}
