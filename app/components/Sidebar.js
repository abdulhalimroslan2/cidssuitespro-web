'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const menuItems = [
  { id: 'rpt', label: 'RPT ASSIST', href: '/rpt-assist', icon: '/assets/RPT AI ASSIST ICON.png' },
  { id: 'schedule', label: 'SCHEDULE ASSIST', href: '/schedule-assist', icon: '/assets/SCHEDULE AI ASSIST ICON.png' },
  { id: 'rph', label: 'RPH ASSIST', href: '/rph-assist', icon: '/assets/RPH AI ASSIST ICON.png' },
  { id: 'deleter', label: 'RPH DELETER', href: '/rph-deleter', icon: '/assets/RPH DELETER ICON.png' },
  { id: 'setting', label: 'SETTING', href: '/settings', icon: '/assets/SETTING ICON.png' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [asieStatus, setAsieStatus] = useState(false);
  const [apiStatus, setApiStatus] = useState(false);
  const [apiLabel, setApiLabel] = useState('Belum Disediakan');

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  function checkStatus() {
    try {
      const raw = localStorage.getItem('cids_settings');
      if (raw) {
        const s = JSON.parse(raw);
        setAsieStatus(!!(s.username && s.password));
        if (s.apiKey) {
          setApiStatus(true);
          setApiLabel('API Key Tersedia');
        } else {
          setApiStatus(false);
          setApiLabel('Tiada API Key');
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  // Close mobile menu when navigating
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="mobile-overlay show" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <Link href="/" className="sidebar-header" style={{ textDecoration: 'none' }}>
          <img src="/assets/CIDS-NEW-GEN ICON.png" alt="CIDS Logo" className="sidebar-logo" />
          <div>
            <img src="/assets/BRANDING.png" alt="CIDS SUITES PRO" className="sidebar-branding" />
            <p className="sidebar-tagline">AI Assists. Less Admin. More Teaching.</p>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                data-id={item.id}
              >
                <img src={item.icon} alt={item.label} className="nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="status-card">
            <div className="shield">⚡</div>
            <div style={{ flex: 1 }}>
              <h4>SYSTEM STATUS</h4>
              <ul className="status-list">
                <li>
                  <div className={`led ${asieStatus ? 'led-green' : 'led-red'}`} />
                  <div>
                    <div>asiemodel.net</div>
                    <div className={`status-label ${asieStatus ? 'ok' : 'err'}`}>
                      {asieStatus ? 'Kredensial Tersedia' : 'Belum Disediakan'}
                    </div>
                  </div>
                </li>
                <li>
                  <div className={`led ${apiStatus ? 'led-green' : 'led-red'}`} />
                  <div>
                    <div>API Key (AI)</div>
                    <div className={`status-label ${apiStatus ? 'ok' : 'err'}`}>
                      {apiLabel}
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
