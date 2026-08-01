import './globals.css';
import Sidebar from './components/Sidebar';

export const metadata = {
  title: 'CIDS Suites Pro',
  description: 'AI Assists. Less Admin. More Teaching. — Automasi RPT, RPH, Jadual Waktu untuk guru Malaysia.',
  icons: { icon: '/assets/CIDS-NEW-GEN ICON.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ms">
      <body>
        <div className="app-container">
          <Sidebar />
          <main className="content-area">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
