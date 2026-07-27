'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const features = [
  {
    module: 'rpt',
    title: 'RPT Assist',
    desc: 'Jana Rancangan Pengajaran Tahunan (RPT) secara automatik dengan bantuan AI dan hantar terus ke ASIE Model.',
    icon: '/assets/RPT AI ASSIST ICON.png',
    href: '/rpt-assist',
    color: '#7c3aed'
  },
  {
    module: 'schedule',
    title: 'Schedule Assist',
    desc: 'Import jadual waktu dari ASIE Model atau upload gambar jadual untuk dianalisis oleh AI.',
    icon: '/assets/SCHEDULE AI ASSIST ICON.png',
    href: '/schedule-assist',
    color: '#16a34a'
  },
  {
    module: 'rph',
    title: 'RPH Assist',
    desc: 'Automasi penulisan Rancangan Pengajaran Harian (RPH) 5E Bybee menggunakan AI dan submit ke ASIE.',
    icon: '/assets/RPH AI ASSIST ICON.png',
    href: '/rph-assist',
    color: '#ea580c'
  },
  {
    module: 'deleter',
    title: 'RPH Deleter',
    desc: 'Padam semua rekod RPH di bawah MIW aktif secara automatik dan serentak.',
    icon: '/assets/RPH DELETER ICON.png',
    href: '/rph-deleter',
    color: '#dc2626'
  },
];

export default function DashboardPage() {
  const [hasSettings, setHasSettings] = useState(false);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Selamat Pagi');
    else if (h < 17) setGreeting('Selamat Petang');
    else setGreeting('Selamat Malam');

    try {
      const raw = localStorage.getItem('cids_settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.username) setHasSettings(true);
      }
    } catch (e) { /* ignore */ }
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>{greeting}, Cikgu! 👋</h1>
        <p>Selamat datang ke CIDS Suites Pro — versi web app.</p>
      </div>

      {!hasSettings && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,88,12,0.05))',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>⚙️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#fcd34d', marginBottom: '4px' }}>
              Tetapan Belum Lengkap
            </div>
            <div style={{ fontSize: '12px', color: '#d1d5db' }}>
              Sila masukkan kredensial ASIE Model dan API Key di bahagian <strong>Setting</strong> terlebih dahulu.
            </div>
          </div>
          <Link href="/settings" className="btn btn-sm btn-ghost" style={{ whiteSpace: 'nowrap' }}>
            Buka Setting →
          </Link>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '28px' }}>
        {features.map((f) => (
          <Link key={f.module} href={f.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="feature-card" data-module={f.module}>
              <img src={f.icon} alt={f.title} className="card-icon" />
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <div style={{ marginTop: '12px' }}>
                <span className="badge badge-info">Buka →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌐</div>
        <h3 style={{ marginBottom: '8px' }}>Versi Web App</h3>
        <p className="text-muted text-sm" style={{ maxWidth: '500px', margin: '0 auto', lineHeight: '1.7' }}>
          Anda sedang menggunakan versi web CIDS Suites Pro. Semua fungsi berjalan melalui pelayan (server-side) —
          tiada pemasangan diperlukan. Boleh diakses dari mana-mana peranti termasuk telefon bimbit.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
          <span className="badge badge-success">✓ Cross-platform</span>
          <span className="badge badge-success">✓ Tiada Install</span>
          <span className="badge badge-success">✓ Auto-update</span>
          <span className="badge badge-success">✓ Mobile-friendly</span>
        </div>
      </div>
    </div>
  );
}
