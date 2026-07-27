'use client';
import { useState, useRef } from 'react';

export default function RphAssistPage() {
  const [step, setStep] = useState('upload'); // upload | schedule | generate | submitting
  const [scheduleImage, setScheduleImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [miwDate, setMiwDate] = useState('');
  const [bbm, setBbm] = useState([]);
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
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      setScheduleImage(base64);
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleExtractAI() {
    const { apiKey } = getSettings();
    if (!apiKey) { addLog('❌ Sila masukkan API Key di Setting.', 'error'); return; }
    if (!scheduleImage) { addLog('❌ Sila upload gambar jadual.', 'error'); return; }

    setGenerating(true);
    addLog('🤖 Menganalisis gambar jadual menggunakan AI...');
    try {
      const res = await fetch('/api/extract-schedule-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, imageBase64: scheduleImage }),
      });
      const data = await res.json();
      if (data.success && data.lessons) {
        setSchedule(data.lessons);
        addLog(`✅ Berjaya mengekstrak ${data.lessons.length} kelas dari jadual!`, 'success');
        setStep('schedule');
      } else {
        addLog(`❌ AI gagal: ${data.error || 'Unknown'}`, 'error');
      }
    } catch (e) {
      addLog(`❌ Ralat: ${e.message}`, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleFetchFromAsie() {
    const { username, password } = getSettings();
    if (!username) { addLog('❌ Sila masukkan kredensial ASIE di Setting.', 'error'); return; }

    setGenerating(true);
    addLog('⏳ Mendapatkan jadual dari ASIE Model...');
    try {
      const res = await fetch('/api/get-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: { username, password } }),
      });
      const data = await res.json();
      if (data.success && data.schedule) {
        // Convert schedule format to lessons format
        const lessons = data.schedule.map(s => ({
          subject_text: s.subject,
          session_text: s.className || s.class,
          sessions: 1,
          day: s.day,
          time: s.time,
        }));
        setSchedule(lessons);
        addLog(`✅ Berjaya mendapatkan ${lessons.length} slot jadual dari ASIE!`, 'success');
        if (data.fallback) addLog('⚠️ Mod sandbox — jadual mungkin dummy.', 'info');
        setStep('schedule');
      } else {
        addLog(`❌ Gagal: ${data.error || 'Unknown'}`, 'error');
      }
    } catch (e) {
      addLog(`❌ Ralat: ${e.message}`, 'error');
    } finally {
      setGenerating(false);
    }
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
        // Step 1: Generate RPH content via AI
        const genRes = await fetch('/api/generate-rph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            lessonDetails: lesson,
            sessionIndex: i,
            bbm,
          }),
        });
        const genData = await genRes.json();
        if (!genData.success) {
          addLog(`❌ Gagal jana RPH: ${genData.error}`, 'error');
          continue;
        }
        addLog(`✅ RPH dijana! Menghantar ke ASIE Model...`, 'success');

        // Step 2: Submit RPH to ASIE
        const subRes = await fetch('/api/submit-rph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentials: { username, password },
            lesson,
            rphContent: genData.rphContent,
            miwDate,
          }),
        });
        const subData = await subRes.json();
        if (subData.success) {
          addLog(`✅ [${i + 1}/${schedule.length}] RPH berjaya dihantar ke ASIE!`, 'success');
        } else {
          addLog(`⚠️ [${i + 1}/${schedule.length}] ${subData.error || 'Gagal hantar'}`, 'error');
        }
      } catch (e) {
        addLog(`❌ Ralat [${i + 1}]: ${e.message}`, 'error');
      }
    }

    addLog('🎉 Proses automasi RPH selesai!', 'success');
    setSubmitting(false);
  }

  const bbmOptions = ['Kertas A4', 'Projektor LCD', 'Komputer Riba Guru', 'Kalkulator', 'Nota CHEATNOTE', 'Buku Teks', 'Lembaran Kerja'];

  return (
    <div>
      <div className="page-header">
        <h1>📝 RPH Assist</h1>
        <p>Automasi penulisan RPH 5E Bybee menggunakan AI dan hantar ke ASIE Model.</p>
      </div>

      <img src="/assets/RPH AI ASSIST BANNER.png" alt="RPH Banner" className="module-banner" />

      {step === 'upload' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="icon">📷</span>
              <h2>Upload Jadual Waktu</h2>
            </div>
            <p className="text-sm text-muted mb-4">Upload gambar jadual waktu untuk dianalisis oleh AI.</p>
            <div
              className={`upload-zone ${imagePreview ? '' : ''}`}
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
              ) : (
                <>
                  <div className="upload-icon">📸</div>
                  <div className="upload-text">Klik untuk memuat naik gambar jadual waktu<br /><span className="text-xs">(JPG, PNG)</span></div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
            <button className="btn btn-primary btn-block mt-4" onClick={handleExtractAI} disabled={!scheduleImage || generating}>
              {generating ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Menganalisis...</> : '🤖 Analisis dengan AI'}
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="icon">🌐</span>
              <h2>Import dari ASIE Model</h2>
            </div>
            <p className="text-sm text-muted mb-4">Atau dapatkan jadual terus dari akaun ASIE Model anda.</p>
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏫</div>
              <p className="text-sm text-muted mb-4">Klik butang di bawah untuk import jadual dari ASIE secara automatik.</p>
            </div>
            <button className="btn btn-success btn-block" onClick={handleFetchFromAsie} disabled={generating}>
              {generating ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Memuat...</> : '📥 Import dari ASIE Model'}
            </button>

            <div className="form-group mt-4">
              <label>Tarikh MIW (Pilihan)</label>
              <input type="date" className="form-input" value={miwDate} onChange={e => setMiwDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {step === 'schedule' && (
        <div>
          <div className="card mb-4">
            <div className="card-header" style={{ justifyContent: 'space-between' }}>
              <div className="flex items-center gap-2">
                <span className="icon">📋</span>
                <h2>Jadual Diekstrak ({schedule.length} kelas)</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep('upload')}>← Kembali</button>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {schedule.map((s, i) => (
                <div key={i} className="list-item">
                  <span style={{ fontSize: '18px' }}>📘</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{s.subject_text}</div>
                    <div className="text-xs text-muted">{s.session_text} {s.day ? `• ${s.day}` : ''} {s.sessions ? `• ${s.sessions} sesi` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <span className="icon">🎒</span>
              <h2>Bahan Bantu Mengajar (BBM)</h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {bbmOptions.map(b => (
                <button
                  key={b}
                  className={`btn btn-sm ${bbm.includes(b) ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setBbm(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])}
                  type="button"
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-orange btn-lg btn-block" onClick={handleSubmitRPH} disabled={submitting}>
            {submitting ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sedang memproses...</> : `🚀 Jana & Hantar ${schedule.length} RPH ke ASIE Model`}
          </button>
        </div>
      )}

      {logs.length > 0 && (
        <div className="card mt-6">
          <div className="card-header">
            <span className="icon">📟</span>
            <h2>Log Aktiviti</h2>
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
