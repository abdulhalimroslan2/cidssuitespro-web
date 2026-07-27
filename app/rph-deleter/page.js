'use client';
import { useState, useRef } from 'react';

export default function RphDeleterPage() {
  const [logs, setLogs] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);
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

  async function handleDelete() {
    const creds = getCredentials();
    if (!creds || !creds.username) {
      addLog('❌ Sila masukkan kredensial ASIE Model di Setting.', 'error');
      return;
    }

    if (!confirm('⚠️ AMARAN: Ini akan memadam SEMUA RPH di bawah MIW aktif anda. Adakah anda pasti?')) {
      return;
    }

    setDeleting(true);
    setDone(false);
    setLogs([]);
    addLog('🔗 Menghubungi pelayan...');

    try {
      const res = await fetch('/api/delete-rph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        addLog('❌ Tiada respons dari pelayan.', 'error');
        setDeleting(false);
        return;
      }

      let buffer = '';
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.log) {
                const type = data.log.includes('✓') || data.log.includes('Berjaya') ? 'success' :
                             data.log.includes('✖') || data.log.includes('Ralat') ? 'error' : 'info';
                addLog(data.log, type);
              }
              if (data.error) {
                addLog(`❌ ${data.error}`, 'error');
                setDone(true);
              }
              if (data.done) {
                setDone(true);
              }
            } catch (e) { /* skip bad json */ }
          }
        }
      }
    } catch (e) {
      addLog(`❌ Ralat sambungan: ${e.message}`, 'error');
    } finally {
      setDeleting(false);
      setDone(true);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>🗑️ RPH Deleter</h1>
        <p>Padam semua RPH di bawah MIW aktif secara automatik.</p>
      </div>

      <img src="/assets/RPH DELETER BANNER.png" alt="Deleter Banner" className="module-banner" />

      <div className="card mb-6">
        <div className="card-header">
          <span className="icon">⚠️</span>
          <h2>Padam RPH Automatik</h2>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.1), rgba(239,68,68,0.05))',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <p style={{ fontSize: '14px', color: '#fca5a5', fontWeight: 600, marginBottom: '8px' }}>
            ⚠️ AMARAN
          </p>
          <p className="text-sm" style={{ color: '#d1d5db', lineHeight: 1.7 }}>
            Fungsi ini akan <strong>memadam semua RPH</strong> yang tersimpan di bawah MIW (Maklumat Induk Warga) aktif dalam akaun ASIE Model anda.
            Tindakan ini <strong>tidak boleh diundur</strong>. Sila pastikan anda benar-benar ingin memadam sebelum meneruskan.
          </p>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '64px', marginBottom: '12px' }}>{done ? '✅' : deleting ? '⏳' : '🗑️'}</div>
          <p className="text-muted text-sm">
            {done ? 'Proses pemadaman telah selesai.' :
             deleting ? 'Sedang memadam RPH...' :
             'Klik butang di bawah untuk memulakan pemadaman.'}
          </p>
        </div>

        <button
          className="btn btn-danger btn-lg btn-block"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff' }} /> Sedang memadam...</>
          ) : (
            '🗑️ Padam Semua RPH'
          )}
        </button>
      </div>

      {logs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="icon">📟</span>
            <h2>Log Pemadaman</h2>
          </div>
          <div className="log-console" ref={logRef}>
            {logs.map((l, i) => (
              <div key={i} className={`log-entry ${l.type}`}>{l.msg}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
