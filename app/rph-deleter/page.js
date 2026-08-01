'use client';
import { useState, useRef } from 'react';

export default function RphDeleterPage() {
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [logs, setLogs] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, deleted: 0, failed: 0 });
  const logRef = useRef(null);

  function addLog(msg, type = '') {
    setLogs(prev => [...prev, { msg, type, ts: Date.now() }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }

  function getCredentials() {
    try {
      const raw = localStorage.getItem('cids_settings');
      if (!raw) return null;
      const s = JSON.parse(raw);
      let pw = s.password || '';
      try { pw = decodeURIComponent(atob(pw)); } catch { try { pw = atob(pw); } catch {} }
      return { username: s.username, password: pw };
    } catch { return null; }
  }

  function handleDeleteClick() {
    const creds = getCredentials();
    if (!creds || !creds.username) { addLog('❌ Sila masukkan kredensial ASIE Model di Setting.', 'error'); return; }
    if (!month) { addLog('❌ Sila pilih bulan.', 'error'); return; }
    setShowModal(true);
    setConfirmText('');
  }

  async function handleConfirmDelete() {
    if (confirmText !== 'saya ingin delete RPH') return;
    setShowModal(false);
    setDeleting(true);
    setStats({ total: 0, deleted: 0, failed: 0 });
    const creds = getCredentials();
    addLog(`🗑️ Memulakan pemadaman RPH untuk bulan ${month}/${year}...`);

    try {
      const res = await fetch('/api/delete-rph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: creds, month: parseInt(month), year: parseInt(year) }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.replace('data: ', ''));
            if (ev.type === 'log') addLog(ev.message, ev.level || '');
            if (ev.type === 'progress') setStats({ total: ev.total || 0, deleted: ev.deleted || 0, failed: ev.failed || 0 });
            if (ev.type === 'complete') { addLog(`🎉 Selesai! ${ev.deleted} RPH dipadam, ${ev.failed} gagal.`, 'success'); setStats({ total: ev.total || 0, deleted: ev.deleted || 0, failed: ev.failed || 0 }); }
            if (ev.type === 'error') addLog(`❌ ${ev.message}`, 'error');
          } catch {}
        }
      }
    } catch (e) { addLog(`❌ Ralat rangkaian: ${e.message}`, 'error'); }
    finally { setDeleting(false); }
  }

  const months = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
  const inputStyle = { width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box', color: '#1e293b', fontFamily: 'Inter, sans-serif' };

  return (
    <div className="module-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <img src="/assets/RPH DELETER BANNER.png" alt="Deleter Banner" style={{ width: '100%', borderRadius: 16, marginBottom: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'block' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left: Controls */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>1</div>
              <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Pilih Tempoh</h3><p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Pilih bulan dan tahun untuk padam RPH.</p></div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Bulan</label>
              <select style={inputStyle} value={month} onChange={e => setMonth(e.target.value)}>
                <option value="">-- Pilih Bulan --</option>
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Tahun</label>
              <input style={inputStyle} value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <button onClick={handleDeleteClick} disabled={deleting} style={{ width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: deleting ? 0.6 : 1, boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
              {deleting ? '⏳ Memadam...' : '🗑️ Padam RPH'}
            </button>

            {/* Stats */}
            {stats.total > 0 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ textAlign: 'center', padding: '10px', background: '#f1f5f9', borderRadius: 10 }}><div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{stats.total}</div><div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>TOTAL</div></div>
                <div style={{ textAlign: 'center', padding: '10px', background: '#ecfdf5', borderRadius: 10 }}><div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{stats.deleted}</div><div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>DIPADAM</div></div>
                <div style={{ textAlign: 'center', padding: '10px', background: '#fef2f2', borderRadius: 10 }}><div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{stats.failed}</div><div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>GAGAL</div></div>
              </div>
            )}
          </div>

          {/* Right: Log */}
          <div style={{ background: '#000', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h3 style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>📟 Log Aktiviti</h3>
            <div ref={logRef} className="log-console" style={{ maxHeight: 400 }}>
              {logs.length === 0 && <div className="log-entry">Tiada aktiviti lagi. Klik "Padam RPH" untuk mulakan.</div>}
              {logs.map((l, i) => <div key={i} className={`log-entry ${l.type}`}>{l.msg}</div>)}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="modal-overlay show">
          <div className="modal-box">
            <div style={{ marginBottom: 15 }}>
              <svg viewBox="0 0 24 24" width="56" height="56" stroke="#ff4757" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Adakah anda benar ingin "delete" RPH?</h3>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20, lineHeight: 1.5 }}>Sila taipkan "<strong>saya ingin delete RPH</strong>" untuk meneruskan operasi.</p>
            <input
              type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder="saya ingin delete RPH" autoComplete="off"
              style={{ width: '100%', padding: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', marginBottom: 16, boxSizing: 'border-box', outline: 'none', fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleConfirmDelete} disabled={confirmText !== 'saya ingin delete RPH'} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#ff4757', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: confirmText === 'saya ingin delete RPH' ? 1 : 0.4 }}>Padam RPH</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
