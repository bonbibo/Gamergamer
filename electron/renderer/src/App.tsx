import React, { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Gamification } from './pages/Gamification';
import { Training } from './pages/Training';
import { Avatar } from './pages/Avatar';
import { Marketplace } from './pages/Marketplace';

type Page = 'dashboard' | 'gamification' | 'training' | 'avatar' | 'marketplace';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🎮' },
  { id: 'gamification', label: 'Gamification', icon: '⭐' },
  { id: 'training', label: 'AI Training', icon: '🧠' },
  { id: 'avatar', label: 'Avatar & Stream', icon: '📡' },
  { id: 'marketplace', label: 'Marketplace', icon: '💰' },
];

export function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🎮</span>
          <span style={styles.logoText}>Gamergamer</span>
        </div>
        <nav style={styles.nav}>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                ...styles.navItem,
                background: page === item.id ? '#7c3aed22' : 'transparent',
                color: page === item.id ? '#a78bfa' : '#9ca3af',
                borderLeft: page === item.id ? '3px solid #7c3aed' : '3px solid transparent',
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={{ color: '#4b5563', fontSize: 11 }}>v0.1.0 — Gamergamer</div>
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'gamification' && <Gamification />}
        {page === 'training' && <Training />}
        {page === 'avatar' && <Avatar />}
        {page === 'marketplace' && <Marketplace />}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', height: '100vh', background: '#0f0f13',
    fontFamily: "'Inter', system-ui, sans-serif", color: '#e5e7eb',
    overflow: 'hidden',
  },
  sidebar: {
    width: 220, background: '#16161f', borderRight: '1px solid #1f2937',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '20px 20px 16px',
    borderBottom: '1px solid #1f2937',
  },
  logoIcon: { fontSize: 24 },
  logoText: { fontSize: 17, fontWeight: 700, color: '#a78bfa' },
  nav: { flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 20px', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 500, transition: 'all 0.15s', textAlign: 'left',
    width: '100%',
  },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid #1f2937' },
  main: { flex: 1, overflowY: 'auto', background: '#0f0f13' },
};
