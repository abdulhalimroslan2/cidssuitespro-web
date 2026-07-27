'use client';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showApi, setShowApi] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cids_settings');
      if (raw) {
        const s = JSON.parse(raw);
        setUsername(s.username || '');
        // Decrypt base64
        if (s.password) {
          try { setPassword(decodeURIComponent(atob(s.password))); } catch { try { setPassword(atob(s.password)); } catch { setPassword(s.password); } }
        }
        if (s.apiKey) {
          try { setApiKey(decodeURIComponent(atob(s.apiKey))); } catch { try { setApiKey(atob(s.apiKey)); } catch { setApiKey(s.apiKey); } }
        }
        if (s.deepseekApiKey) {
          try { setDeepseekKey(decodeURIComponent(atob(s.deepseekApiKey))); } catch { try { setDeepseekKey(atob(s.deepseekApiKey)); } catch { setDeepseekKey(s.deepseekApiKey); } }
        }
      }
    } catch (e) { /* ignore */ }
  }, []);

  function handleSave(e) {
    e.preventDefault();
    if (username && !password) {
      alert('⚠️ Sila masukkan Kata Laluan bersama Username anda.');
      return;
    }

    const settings = {
      username: username.trim(),
      password: password ? btoa(encodeURIComponent(password)) : '',
      apiKey: apiKey.trim() ? btoa(encodeURIComponent(apiKey.trim())) : '',
      deepseekApiKey: deepseekKey.trim() ? btoa(encodeURIComponent(deepseekKey.trim())) : '',
    };

    localStorage.setItem('cids_settings', JSON.stringify(settings));
    sessionStorage.setItem('cids_settings', JSON.stringify(settings));

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Tetapan</h1>
        <p>Konfigurasi akaun ASIE Model dan kunci API untuk automasi AI.</p>
      </div>

      <img src="/assets/SETTING BANNER.png" alt="Setting Banner" className="module-banner" />

      <form onSubmit={handleSave}>
        <div className="grid-2">
          {/* ASIE Model Credentials */}
          <div className="card">
            <div className="card-header">
              <span className="icon">🔑</span>
              <h2>Akaun ASIE Model</h2>
            </div>
            <div className="form-group">
              <label htmlFor="settings-username">Nama Pengguna (Username)</label>
              <input
                id="settings-username"
                type="text"
                className="form-input"
                placeholder="cth: cikgu_ali"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="settings-password">Kata Laluan (Password)</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="settings-password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted" style={{ lineHeight: '1.5' }}>
              Kredensial ini digunakan untuk log masuk ke <strong>asiemodel.net</strong> secara automatik bagi membolehkan modul RPT, RPH, dan Schedule berfungsi.
            </p>
          </div>

          {/* API Keys */}
          <div className="card">
            <div className="card-header">
              <span className="icon">🤖</span>
              <h2>Kunci API (AI)</h2>
            </div>
            <div className="form-group">
              <label htmlFor="settings-gemini">Gemini / OpenRouter API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="settings-gemini"
                  type={showApi ? 'text' : 'password'}
                  className="form-input"
                  placeholder="AIza... atau sk-or-v1-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowApi(!showApi)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  {showApi ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="settings-deepseek">DeepSeek API Key (Pilihan)</label>
              <input
                id="settings-deepseek"
                type="password"
                className="form-input"
                placeholder="sk-..."
                value={deepseekKey}
                onChange={(e) => setDeepseekKey(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted" style={{ lineHeight: '1.5' }}>
              API Key diperlukan untuk janaan RPH dan analisis jadual menggunakan AI. Sokong <strong>Google Gemini</strong> dan <strong>OpenRouter</strong>.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button type="submit" className="btn btn-primary btn-lg">
            💾 Simpan Tetapan
          </button>
          {saved && (
            <span className="badge badge-success" style={{ fontSize: '13px', padding: '8px 16px' }}>
              ✓ Tetapan berjaya disimpan!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
