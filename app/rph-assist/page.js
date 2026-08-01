'use client';
import { useState, useRef } from 'react';

export default function RphAssistPage() {
  const [step, setStep] = useState('upload');
  const [scheduleImage, setScheduleImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [miwDate, setMiwDate] = useState('');
  const [bbm, setBbm] = useState([]);
  const [bbmInput, setBbmInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    setGenerating(true);
    addLog('🤖 Menganalisis gambar jadual menggunakan AI...');
    try {
      const res = await fetch('/api/extract-schedule-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, imageBase64: scheduleImage }) });
      const data = await res.json();
      if (data.success && data.lessons) { setSchedule(data.lessons); addLog(`✅ Berjaya mengekstrak ${data.lessons.length} kelas!`, 'success'); setStep('schedule'); }
      else { addLog(`❌ AI gagal: ${data.error || 'Unknown'}`, 'error'); }
    } catch (e) { addLog(`❌ Ralat: ${e.message}`, 'error'); }
    finally { setGenerating(false); }
  }

  async function handleFetchFromAsie() {
    const { username, password } = getSettings();
    if (!username) { addLog('❌ Sila masukkan kredensial ASIE di Setting.', 'error'); return; }
    setGenerating(true);
    addLog('⏳ Mendapatkan jadual dari ASIE Model...');
    try {
      const res = await fetch('/api/get-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: { username, password } }) });
      const data = await res.json();
      if (data.success && data.schedule) {
        const lessons = data.schedule.map(s => ({ subject_text: s.subject, session_text: s.className || s.class, sessions: 1, day: s.day, time: s.time }));
        setSchedule(lessons);
        addLog(`✅ Berjaya mendapatkan ${lessons.length} slot jadual!`, 'success');
        if (data.fallback) addLog('⚠️ Mod sandbox — jadual mungkin dummy.', 'info');
        setStep('schedule');
      } else { addLog(`❌ Gagal: ${data.error || 'Unknown'}`, 'error'); }
    } catch (e) { addLog(`❌ Ralat: ${e.message}`, 'error'); }
    finally { setGenerating(false); }
  }

  function addBbm() {
    if (bbmInput.trim()) { setBbm(prev => [...prev, bbmInput.trim()]); setBbmInput(''); }
  }

  async function handleSubmitRPH() {
    const { username, password, apiKey } = getSettings();
    if (!username) { addLog('❌ Sila masukkan kredensial ASIE di Setting.', 'error'); return; }
    if (!apiKey) { addLog('❌ Sila masukkan API Key di Setting.', 'error'); return; }
    setSubmitting(true);
    addLog('🚀 Memulakan proses automasi RPH...');
    addLog(`📋 ${schedule.length} kelas akan diproses...`);
    for (let i = 0; i < schedule.length; i++) {
      const lesson = schedule[i];
      addLog(`⏳ [${i + 1}/${schedule.length}] Menjana RPH untuk ${lesson.subject_text} - ${lesson.session_text}...`);
      try {
        const genRes = await fetch('/api/generate-rph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, lessonDetails: lesson, sessionIndex: i, bbm }) });
        const genData = await genRes.json();
        if (!genData.success) { addLog(`❌ Gagal jana RPH: ${genData.error}`, 'error'); continue; }
        addLog(`✅ RPH dijana! Menghantar ke ASIE...`, 'success');
        const subRes = await fetch('/api/submit-rph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: { username, password }, lessonDetails: lesson, rphContent: genData.rphContent, miwDate }) });
        const subData = await subRes.json();
        if (subData.success) { addLog(`✅ [${i + 1}] RPH berjaya dihantar ke ASIE Model!`, 'success'); }
        else { addLog(`❌ Gagal hantar: ${subData.error}`, 'error'); }
      } catch (e) { addLog(`❌ Ralat: ${e.message}`, 'error'); }
    }
    addLog('🎉 Proses automasi RPH selesai!', 'success');
    setSubmitting(false);
  }

  const inputStyle = { width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box', color: '#1e293b', fontFamily: 'Inter, sans-serif' };
  const btnPrimary = { padding: '12px 24px', borderRadius: 12, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' };

  return (
    <div className="module-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 1050 }}>
        <img src="/assets/RPH AI ASSIST BANNER.png" alt="RPH Banner" style={{ width: '100%', borderRadius: 16, marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'block' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left Column */}
          <div>
            {/* Source Selection */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ea580c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>1</div>
                <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Sumber Jadual</h3><p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Pilih cara import jadual anda.</p></div>
              </div>
              <button onClick={handleFetchFromAsie} disabled={generating} style={{ ...btnPrimary, marginBottom: 12 }}>
                {generating ? '⏳ Memuat...' : '📥 Import dari ASIE Model'}
              </button>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, margin: '8px 0' }}>— atau —</div>
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 32 }}>📷</div>
                <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0' }}>Muat naik gambar jadual</p>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </div>
              {imagePreview && (
                <div style={{ marginTop: 12 }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: 10, maxHeight: 150, objectFit: 'cover' }} />
                  <button onClick={handleExtractAI} disabled={generating} style={{ ...btnPrimary, marginTop: 12 }}>
                    {generating ? '🤖 Menganalisis...' : '🤖 Ekstrak menggunakan AI'}
                  </button>
                </div>
              )}
            </div>

            {/* BBM */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ea580c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>2</div>
                <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>BBM & Tarikh</h3><p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Bahan bantu mengajar & tarikh MIW.</p></div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Tarikh MIW</label>
                <input type="date" style={inputStyle} value={miwDate} onChange={e => setMiwDate(e.target.value)} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Tambah BBM</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="cth: Buku Teks" value={bbmInput} onChange={e => setBbmInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBbm()} />
                  <button onClick={addBbm} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                </div>
              </div>
              {bbm.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{bbm.map((b, i) => <span key={i} style={{ fontSize: 12, background: '#fff7ed', color: '#ea580c', padding: '4px 10px', borderRadius: 6, fontWeight: 600, border: '1px solid #fed7aa' }}>{b} <span onClick={() => setBbm(bbm.filter((_, j) => j !== i))} style={{ cursor: 'pointer', marginLeft: 4 }}>×</span></span>)}</div>}
            </div>
          </div>

          {/* Right Column: Schedule & Submit */}
          <div>
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ea580c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>3</div>
                <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Jadual & Jana RPH</h3><p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{schedule.length} kelas dimuatkan.</p></div>
              </div>

              {schedule.length > 0 ? (
                <div>
                  <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr style={{ borderBottom: '1px solid #e2e8f0' }}><th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Hari</th><th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Kelas</th><th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>M.Pelajaran</th><th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Masa</th></tr></thead>
                      <tbody>{schedule.map((s, i) => <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px 10px' }}>{s.day}</td><td style={{ padding: '8px 10px' }}>{s.session_text}</td><td style={{ padding: '8px 10px' }}>{s.subject_text}</td><td style={{ padding: '8px 10px' }}>{s.time}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <button onClick={handleSubmitRPH} disabled={submitting} style={{ ...btnPrimary, fontSize: 15, padding: '14px 24px' }}>
                    {submitting ? '⏳ Memproses...' : `🚀 Jana & Hantar ${schedule.length} RPH`}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📝</div>
                  <p style={{ color: '#94a3b8', fontSize: 13 }}>Sila import jadual terlebih dahulu.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Log */}
        {logs.length > 0 && (
          <div style={{ marginTop: 24, background: '#000', borderRadius: 16, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h3 style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>📟 Log Aktiviti</h3>
            <div ref={logRef} className="log-console">{logs.map((l, i) => <div key={i} className={`log-entry ${l.type}`}>{l.msg}</div>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
