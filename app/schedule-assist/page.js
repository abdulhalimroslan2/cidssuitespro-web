'use client';
import { useState, useRef } from 'react';

export default function ScheduleAssistPage() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [scheduleImage, setScheduleImage] = useState(null);
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);
  const fileRef = useRef(null);

  function addLog(msg, type = '') {
    setLogs(prev => [...prev, { msg, type, ts: Date.now() }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }

  function getSettings() {
    try {
      const raw = localStorage.getItem('cids_settings');
      if (!raw) return {};
      const s = JSON.parse(raw);
      let pw = s.password || '';
      try { pw = decodeURIComponent(atob(pw)); } catch { try { pw = atob(pw); } catch {} }
      let apiKey = s.apiKey || '';
      try { apiKey = decodeURIComponent(atob(apiKey)); } catch { try { apiKey = atob(apiKey); } catch {} }
      return { username: s.username, password: pw, apiKey };
    } catch { return {}; }
  }

  async function handleFetchFromAsie() {
    const { username, password } = getSettings();
    if (!username) { addLog('❌ Sila masukkan kredensial ASIE di Setting.', 'error'); return; }
    setLoading(true);
    addLog('⏳ Mendapatkan jadual dari ASIE Model...');
    try {
      const res = await fetch('/api/get-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: { username, password } }) });
      const data = await res.json();
      if (data.success && data.schedule) {
        setSchedule(data.schedule);
        addLog(`✅ Berjaya mendapatkan ${data.schedule.length} slot jadual!`, 'success');
        if (data.fallback) addLog('⚠️ Mod sandbox — jadual mungkin dummy.', 'info');
      } else { addLog(`❌ Gagal: ${data.error || 'Unknown'}`, 'error'); }
    } catch (e) { addLog(`❌ Ralat: ${e.message}`, 'error'); }
    finally { setLoading(false); }
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setScheduleImage(ev.target.result.split(',')[1]); setImagePreview(ev.target.result); };
    reader.readAsDataURL(file);
  }

  async function handleExtractAI() {
    const { apiKey } = getSettings();
    if (!apiKey) { addLog('❌ Sila masukkan API Key di Setting.', 'error'); return; }
    if (!scheduleImage) { addLog('❌ Sila upload gambar jadual.', 'error'); return; }
    setExtracting(true);
    addLog('🤖 Menganalisis gambar jadual menggunakan AI...');
    try {
      const res = await fetch('/api/extract-schedule-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, imageBase64: scheduleImage }) });
      const data = await res.json();
      if (data.success && data.lessons) {
        const mapped = data.lessons.map((l, i) => ({ id: `ai-${i}`, day: l.day || '', className: l.session_text || l.class || '', subject: l.subject_text || l.subject || '', time: l.time || '', imported: true }));
        setSchedule(mapped);
        addLog(`✅ AI berjaya mengekstrak ${mapped.length} kelas!`, 'success');
      } else { addLog(`❌ AI gagal: ${data.error || 'Unknown'}`, 'error'); }
    } catch (e) { addLog(`❌ Ralat: ${e.message}`, 'error'); }
    finally { setExtracting(false); }
  }

  function handleSaveLocal() {
    localStorage.setItem('cids_schedule', JSON.stringify(schedule));
    addLog('💾 Jadual berjaya disimpan ke storan setempat!', 'success');
  }

  const inputStyle = { width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box', color: '#1e293b', fontFamily: 'Inter, sans-serif' };
  const btnPrimary = { padding: '12px 24px', borderRadius: 12, border: 'none', background: '#1ba549', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' };

  return (
    <div className="module-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <img src="/assets/SCHEDULE AI ASSIST BANNER.png" alt="Schedule Banner" style={{ width: '100%', borderRadius: 16, marginBottom: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'block' }} />

        {/* Import Card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1ba549', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>1</div>
            <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Import Jadual Waktu</h3><p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Pilih cara untuk mendapatkan jadual.</p></div>
          </div>

          <button onClick={handleFetchFromAsie} disabled={loading} style={{ ...btnPrimary, marginBottom: 12, opacity: loading ? 0.6 : 1 }}>
            {loading ? '⏳ Memuat...' : '📥 Import dari ASIE Model'}
          </button>

          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, margin: '8px 0' }}>— atau —</div>

          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ fontSize: 32 }}>📷</div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0' }}>Muat naik gambar jadual untuk AI ekstrak</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </div>

          {imagePreview && (
            <div style={{ marginTop: 12 }}>
              <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
              <button onClick={handleExtractAI} disabled={extracting} style={{ ...btnPrimary, marginTop: 12, opacity: extracting ? 0.6 : 1 }}>
                {extracting ? '🤖 Menganalisis...' : '🤖 Ekstrak menggunakan AI'}
              </button>
            </div>
          )}
        </div>

        {/* Schedule Table Card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1ba549', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>2</div>
              <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Jadual Waktu</h3><p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{schedule.length} slot dimuatkan.</p></div>
            </div>
            {schedule.length > 0 && <button onClick={handleSaveLocal} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1ba549', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>💾 Simpan</button>}
          </div>

          {schedule.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hari</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kelas</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>M. Pelajaran</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Masa</th>
              </tr></thead>
              <tbody>{schedule.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.day}</td>
                  <td style={{ padding: '10px 12px' }}>{s.className || s.class}</td>
                  <td style={{ padding: '10px 12px' }}>{s.subject}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{s.time}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📅</div>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Tiada jadual dimuatkan. Import dari ASIE atau muat naik gambar.</p>
            </div>
          )}
        </div>

        {/* Log */}
        {logs.length > 0 && (
          <div style={{ background: '#000', borderRadius: 16, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h3 style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>📟 Log Aktiviti</h3>
            <div ref={logRef} className="log-console">{logs.map((l, i) => <div key={i} className={`log-entry ${l.type}`}>{l.msg}</div>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
