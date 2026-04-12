import React, { useEffect, useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Gamification } from './pages/Gamification';
import { Training } from './pages/Training';
import { Avatar } from './pages/Avatar';
import { Marketplace } from './pages/Marketplace';
import { UserProfile } from './pages/UserProfile';
import { useSessionStore } from './store/sessionStore';
import { api } from './api/pythonApi';

type Page = 'profile' | 'dashboard' | 'gamification' | 'training' | 'avatar' | 'marketplace';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'profile',      label: 'Profilim',       icon: '👤' },
  { id: 'dashboard',    label: 'Dashboard',      icon: '🎮' },
  { id: 'gamification', label: 'Gamification',   icon: '⭐' },
  { id: 'training',     label: 'AI Training',    icon: '🧠' },
  { id: 'avatar',       label: 'Avatar & Stream', icon: '📡' },
  { id: 'marketplace',  label: 'Marketplace',    icon: '💰' },
];

export function App() {
  const [page, setPage] = useState<Page>('profile');
  const userId = useSessionStore((s) => s.userId);
  const [username, setUsername] = useState<string | null>(null);
  const [isRecording] = [useSessionStore((s) => s.isRecording)];

  // Try to load the username for the sidebar display
  useEffect(() => {
    api.userProfile(userId)
      .then((p) => setUsername(p.username))
      .catch(() => setUsername(null));
  }, [userId]);

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        {/* User mini-card */}
        <div style={styles.userMini} onClick={() => setPage('profile')}>
          <div style={styles.avatarCircle}>
            {username ? username.slice(0, 2).toUpperCase() : '??'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {username ?? 'Hesap Oluştur'}
            </div>
            <div style={{ color: isRecording ? '#22c55e' : '#4b5563', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              {isRecording && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />}
              {isRecording ? 'Kayıt yapılıyor' : 'Çevrimiçi'}
            </div>
          </div>
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
        {page === 'profile'      && <UserProfile />}
        {page === 'dashboard'    && <Dashboard />}
        {page === 'gamification' && <Gamification />}
        {page === 'training'     && <Training />}
        {page === 'avatar'       && <Avatar />}
        {page === 'marketplace'  && <Marketplace />}
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
  userMini: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px', cursor: 'pointer',
    borderBottom: '1px solid #1f2937',
    transition: 'background 0.15s',
  },
  avatarCircle: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
  },
  nav: { flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 18px', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, transition: 'all 0.15s', textAlign: 'left',
    width: '100%',
  },
  navIcon: { fontSize: 15, width: 20, textAlign: 'center' },
  sidebarFooter: { padding: '14px 18px', borderTop: '1px solid #1f2937' },
  main: { flex: 1, overflowY: 'auto', background: '#0f0f13' },
};
