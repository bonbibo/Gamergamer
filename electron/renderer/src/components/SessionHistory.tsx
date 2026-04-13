import React, { useEffect, useState } from 'react';
import { api, SessionListItem } from '../api/pythonApi';
import { useSessionStore } from '../store/sessionStore';

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_COLOR: Record<string, string> = {
  complete: '#22c55e',
  recording: '#f59e0b',
  error: '#ef4444',
};

export function SessionHistory() {
  const userId = useSessionStore((s) => s.userId);
  const isRecording = useSessionStore((s) => s.isRecording);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await api.sessionList(userId);
      setSessions(list.slice(0, 20)); // Show last 20
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId]);

  // Reload when recording stops (new session completed)
  useEffect(() => {
    if (!isRecording) load();
  }, [isRecording]);

  if (loading && sessions.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor...</p>;
  }

  if (sessions.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>Henüz oturum yok. İlk kayda başla!</p>;
  }

  return (
    <div>
      <div style={styles.header}>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>{sessions.length} oturum</span>
        <button onClick={load} style={styles.refreshBtn}>Yenile</button>
      </div>
      <div style={styles.list}>
        {sessions.map((s) => (
          <div key={s.id} style={styles.row}>
            <div style={styles.rowLeft}>
              <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>
                {s.game?.replace(/_/g, ' ').toUpperCase() ?? 'UNKNOWN'}
              </div>
              <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                {formatDate(s.started_at)}
              </div>
            </div>
            <div style={styles.rowRight}>
              <div style={{ color: '#9ca3af', fontSize: 12 }}>
                {s.frame_count.toLocaleString()} frame • {formatDuration(s.duration_ms)}
              </div>
              <div style={{
                color: STATUS_COLOR[s.status] ?? '#9ca3af',
                fontSize: 11, fontWeight: 700, marginTop: 2,
              }}>
                {s.status.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  refreshBtn: {
    background: '#374151', color: '#e5e7eb', border: 'none',
    borderRadius: 5, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#1e1e2a', borderRadius: 8, padding: '8px 12px',
    border: '1px solid #1f2937',
  },
  rowLeft: {},
  rowRight: { textAlign: 'right' },
};
