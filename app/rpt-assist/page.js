'use client';
import { useState, useEffect, useRef } from 'react';

export default function RptAssistPage() {
  const [rptList, setRptList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRpt, setSelectedRpt] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filling, setFilling] = useState(false);
  const [formData, setFormData] = useState({
    namaRekodForm: '',
    tarikhDari: '',
    tarikhHingga: '',
    mingguKalendar: '',
    bidangPembelajaran: '',
    tajukPembelajaran: '',
    standardKandungan: '',
    standardPembelajaran: '',
    objektifPembelajaran: '',
  });
  const logRef = useRef(null);

  function addLog(msg, type = '') {
    setLogs(prev => [...prev, { msg, type, ts: Date.now() }]);
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 50);
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
    if (!creds || !creds.username) {
      addLog('❌ Sila masukkan kredensial ASIE Model di Setting terlebih dahulu.', 'error');
      return;
    }
    setLoading(true);
    addLog('⏳ Mendapatkan senarai RPT dari ASIE Model...');
    try {
      const res = await fetch('/api/get-rpt-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: creds }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setRptList(data.data);
        addLog(`✅ Berjaya mendapatkan ${data.data.length} RPT.`, 'success');
        if (data.fallback) addLog('⚠️ Mod sandbox — senarai mungkin dummy kerana Cloudflare block.', 'info');
      } else {
        addLog(`❌ Gagal: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (e) {
      addLog(`❌ Ralat rangkaian: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleFillRpt() {
    if (!selectedRpt) {
      addLog('❌ Sila pilih RPT terlebih dahulu.', 'error');
      return;
    }
    if (!formData.namaRekodForm) {
      addLog('❌ Sila isi sekurang-kurangnya "Nama Rekod".', 'error');
      return;
    }

    const creds = getCredentials();
    if (!creds) return;

    setFilling(true);
    addLog(`⏳ Mengisi RPT: ${formData.namaRekodForm}...`);

    try {
      const res = await fetch('/api/fill-rpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials: creds,
          rptUrl: selectedRpt.url,
          formData: formData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`✅ RPT berjaya diisi dan disimpan ke ASIE Model!`, 'success');
      } else {
        addLog(`❌ Gagal: ${data.error || 'Unknown'}`, 'error');
      }
    } catch (e) {
      addLog(`❌ Ralat: ${e.message}`, 'error');
    } finally {
      setFilling(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>📋 RPT Assist</h1>
        <p>Pilih RPT dari ASIE Model, isikan data, dan hantar secara automatik.</p>
      </div>

      <img src="/assets/RPT AI ASSIST BANNER.png" alt="RPT Banner" className="module-banner" />

      <div className="grid-2">
        {/* Left: RPT List */}
        <div className="card">
          <div className="card-header">
            <span className="icon">📄</span>
            <h2>Senarai RPT</h2>
          </div>

          <button
            className="btn btn-primary btn-block mb-4"
            onClick={fetchRptList}
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Memuat...</>
            ) : (
              '🔄 Muat Senarai RPT dari ASIE'
            )}
          </button>

          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rptList.length === 0 && !loading && (
              <p className="text-muted text-sm text-center" style={{ padding: '20px' }}>
                Tiada RPT dimuatkan. Klik butang di atas untuk memuat.
              </p>
            )}
            {rptList.map((rpt, i) => (
              <div
                key={i}
                className={`list-item ${selectedRpt?.url === rpt.url ? 'active' : ''}`}
                onClick={() => setSelectedRpt(rpt)}
              >
                <span style={{ fontSize: '20px' }}>📘</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{rpt.title}</div>
                </div>
                {selectedRpt?.url === rpt.url && <span className="badge badge-info">Dipilih</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div className="card">
          <div className="card-header">
            <span className="icon">✍️</span>
            <h2>Maklumat RPT</h2>
          </div>

          {selectedRpt ? (
            <div>
              <div className="badge badge-success mb-4">RPT: {selectedRpt.title}</div>

              <div className="form-group">
                <label>Nama Rekod</label>
                <input className="form-input" placeholder="cth: RPT Matematik T2 2026"
                  value={formData.namaRekodForm}
                  onChange={e => setFormData({ ...formData, namaRekodForm: e.target.value })}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label>Tarikh Dari</label>
                  <input type="date" className="form-input" value={formData.tarikhDari}
                    onChange={e => setFormData({ ...formData, tarikhDari: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Tarikh Hingga</label>
                  <input type="date" className="form-input" value={formData.tarikhHingga}
                    onChange={e => setFormData({ ...formData, tarikhHingga: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Minggu Kalendar</label>
                <input className="form-input" placeholder="cth: 1" value={formData.mingguKalendar}
                  onChange={e => setFormData({ ...formData, mingguKalendar: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Bidang / Tema Pembelajaran</label>
                <input className="form-input" placeholder="cth: Nombor dan Operasi"
                  value={formData.bidangPembelajaran}
                  onChange={e => setFormData({ ...formData, bidangPembelajaran: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Tajuk Pembelajaran</label>
                <input className="form-input" placeholder="cth: Nombor Bulat"
                  value={formData.tajukPembelajaran}
                  onChange={e => setFormData({ ...formData, tajukPembelajaran: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Standard Kandungan</label>
                <textarea className="form-input" rows={2} placeholder="cth: 1.1 Nombor bulat hingga 1000"
                  value={formData.standardKandungan}
                  onChange={e => setFormData({ ...formData, standardKandungan: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Standard Pembelajaran</label>
                <textarea className="form-input" rows={2}
                  value={formData.standardPembelajaran}
                  onChange={e => setFormData({ ...formData, standardPembelajaran: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Objektif Pembelajaran</label>
                <textarea className="form-input" rows={2}
                  value={formData.objektifPembelajaran}
                  onChange={e => setFormData({ ...formData, objektifPembelajaran: e.target.value })} />
              </div>

              <button className="btn btn-success btn-block btn-lg" onClick={handleFillRpt} disabled={filling}>
                {filling ? (
                  <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Mengisi...</>
                ) : (
                  '🚀 Hantar ke ASIE Model'
                )}
              </button>
            </div>
          ) : (
            <div className="text-center" style={{ padding: '40px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>📋</div>
              <p className="text-muted text-sm">Sila pilih RPT dari senarai di sebelah kiri.</p>
            </div>
          )}
        </div>
      </div>

      {/* Log Console */}
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
