'use client';
import { useState, useRef } from 'react';

export default function RptAssistPage() {
  const [rptList, setRptList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRpt, setSelectedRpt] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filling, setFilling] = useState(false);
  const [formData, setFormData] = useState({
    namaRekodForm: '', tarikhDari: '', tarikhHingga: '', mingguKalendar: '',
    bidangPembelajaran: '', tajukPembelajaran: '', standardKandungan: '',
    standardPembelajaran: '', objektifPembelajaran: '',
  });
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

  async function fetchRptList() {
    const creds = getCredentials();
    if (!creds || !creds.username) { addLog('❌ Sila masukkan kredensial ASIE Model di Setting terlebih dahulu.', 'error'); return; }
    setLoading(true);
    addLog('⏳ Mendapatkan senarai RPT dari ASIE Model...');
    try {
      const res = await fetch('/api/get-rpt-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: creds }) });
      const data = await res.json();
      if (data.success && data.data) {
        setRptList(data.data);
        addLog(`✅ Berjaya mendapatkan ${data.data.length} RPT.`, 'success');
        if (data.fallback) addLog('⚠️ Mod sandbox — senarai mungkin dummy kerana Cloudflare block.', 'info');
      } else { addLog(`❌ Gagal: ${data.error || 'Unknown error'}`, 'error'); }
    } catch (e) { addLog(`❌ Ralat rangkaian: ${e.message}`, 'error'); }
    finally { setLoading(false); }
  }

  async function handleFillRpt() {
    if (!selectedRpt) { addLog('❌ Sila pilih RPT terlebih dahulu.', 'error'); return; }
    if (!formData.namaRekodForm) { addLog('❌ Sila isi sekurang-kurangnya "Nama Rekod".', 'error'); return; }
    const creds = getCredentials();
    if (!creds) return;
    setFilling(true);
    addLog(`⏳ Mengisi RPT: ${formData.namaRekodForm}...`);
    try {
      const res = await fetch('/api/fill-rpt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: creds, rptUrl: selectedRpt.url, formData }) });
      const data = await res.json();
      if (data.success) { addLog(`✅ RPT berjaya diisi dan disimpan ke ASIE Model!`, 'success'); }
      else { addLog(`❌ Gagal: ${data.error || 'Unknown'}`, 'error'); }
    } catch (e) { addLog(`❌ Ralat: ${e.message}`, 'error'); }
    finally { setFilling(false); }
  }

  const inputStyle = { width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box', color: '#1e293b', fontFamily: 'Inter, sans-serif' };

  return (
    <div className="module-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        {/* Banner */}
        <img src="/assets/RPT AI ASSIST BANNER.png" alt="RPT Banner" style={{ width: '100%', borderRadius: 16, marginBottom: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'block' }} />

        {/* Status Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 13 }}>
          <span>📋</span>
          <span>{rptList.length > 0 ? `${rptList.length} RPT dimuatkan` : 'Tiada RPT dimuat'}</span>
          {selectedRpt && <><span style={{ margin: '0 4px' }}>•</span><span style={{ color: '#4ade80' }}>Dipilih: {selectedRpt.title}</span></>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: RPT List */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>1</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Senarai RPT</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Pilih RPT dari senarai ASIE Model.</p>
              </div>
            </div>

            <button onClick={fetchRptList} disabled={loading} style={{ width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 16, opacity: loading ? 0.6 : 1 }}>
              {loading ? '⏳ Memuat...' : '🔄 Muat Senarai RPT dari ASIE'}
            </button>

            <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rptList.length === 0 && !loading && <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 20 }}>Tiada RPT dimuatkan. Klik butang di atas.</p>}
              {rptList.map((rpt, i) => (
                <div key={i} onClick={() => setSelectedRpt(rpt)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: selectedRpt?.url === rpt.url ? 'rgba(124,58,237,0.1)' : '#f8fafc', border: `1px solid ${selectedRpt?.url === rpt.url ? 'rgba(124,58,237,0.4)' : '#e2e8f0'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: 20 }}>📘</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{rpt.title}</span>
                  {selectedRpt?.url === rpt.url && <span style={{ fontSize: 11, background: 'rgba(124,58,237,0.15)', color: '#7c3aed', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>Dipilih</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: '#1e293b' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>2</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Maklumat RPT</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Isikan maklumat untuk RPT.</p>
              </div>
            </div>

            {selectedRpt ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Nama Rekod</label>
                  <input style={inputStyle} placeholder="cth: RPT Matematik T2 2026" value={formData.namaRekodForm} onChange={e => setFormData({ ...formData, namaRekodForm: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Tarikh Dari</label>
                    <input type="date" style={inputStyle} value={formData.tarikhDari} onChange={e => setFormData({ ...formData, tarikhDari: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Tarikh Hingga</label>
                    <input type="date" style={inputStyle} value={formData.tarikhHingga} onChange={e => setFormData({ ...formData, tarikhHingga: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Minggu Kalendar</label>
                  <input style={inputStyle} placeholder="cth: 1" value={formData.mingguKalendar} onChange={e => setFormData({ ...formData, mingguKalendar: e.target.value })} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Bidang / Tema Pembelajaran</label>
                  <input style={inputStyle} placeholder="cth: Nombor dan Operasi" value={formData.bidangPembelajaran} onChange={e => setFormData({ ...formData, bidangPembelajaran: e.target.value })} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Tajuk Pembelajaran</label>
                  <input style={inputStyle} placeholder="cth: Nombor Bulat" value={formData.tajukPembelajaran} onChange={e => setFormData({ ...formData, tajukPembelajaran: e.target.value })} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Standard Kandungan</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} rows={2} placeholder="cth: 1.1 Nombor bulat hingga 1000" value={formData.standardKandungan} onChange={e => setFormData({ ...formData, standardKandungan: e.target.value })} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Standard Pembelajaran</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} rows={2} value={formData.standardPembelajaran} onChange={e => setFormData({ ...formData, standardPembelajaran: e.target.value })} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Objektif Pembelajaran</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} rows={2} value={formData.objektifPembelajaran} onChange={e => setFormData({ ...formData, objektifPembelajaran: e.target.value })} />
                </div>
                <button onClick={handleFillRpt} disabled={filling} style={{ width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: filling ? 0.6 : 1 }}>
                  {filling ? '⏳ Mengisi...' : '🚀 Hantar ke ASIE Model'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📋</div>
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Sila pilih RPT dari senarai di sebelah kiri.</p>
              </div>
            )}
          </div>
        </div>

        {/* Log Console */}
        {logs.length > 0 && (
          <div style={{ marginTop: 24, background: '#000', borderRadius: 16, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h3 style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>📟 Log Aktiviti</h3>
            <div ref={logRef} className="log-console">
              {logs.map((l, i) => <div key={i} className={`log-entry ${l.type}`}>{l.msg}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
