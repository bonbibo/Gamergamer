import React, { useEffect, useRef, useState } from 'react';
import { SessionControls } from '../components/SessionControls';
import { EmotionBadge } from '../components/EmotionBadge';
import { SessionHistory } from '../components/SessionHistory';
import { useSessionStore } from '../store/sessionStore';
import { wsClient, WsMessage } from '../api/wsClient';
import { useGamificationStore } from '../store/gamificationStore';
import { api, HealthInfo } from '../api/pythonApi';

export function Dashboard() {
  const { sessionId, isRecording, frameCount, currentEmotion, emotionConfidence, userId, startTime, setEmotion, setFrameCount } = useSessionStore();
  const { profile, setProfile, applyXpEvent } = useGamificationStore();
  const [latestInput, setLatestInput] = useState<{ pressed: string[]; mouse_x: number; mouse_y: number } | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: number; text: string }>>([]);
  const [elapsed, setElapsed] = useState(0);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const notifCounter = useRef(0);

  // Load gamification profile on mount
  useEffect(() => {
    api.getProfile(userId).then(setProfile).catch(() => {});
  }, [userId]);

  // Poll health / disk info every 30s
  useEffect(() => {
    function checkHealth() {
      api.health().then(setHealth).catch(() => {});
    }
    checkHealth();
    const id = setInterval(checkHealth, 30_000);
    return () => clearInterval(id);
  }, []);

  // Elapsed timer — updates every second while recording
  useEffect(() => {
    if (!isRecording || !startTime) {
      setElapsed(0);
      return;
    }
    setElapsed(Math.floor((Date.now() - startTime) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording, startTime]);

  // WebSocket listener
  useEffect(() => {
    const unsub = wsClient.onMessage((msg: WsMessage) => {
      if (msg.type === 'frame') {
        const frame = msg as {
          frame_id: number;
          keyboard_state: { pressed: string[] };
          mouse_state: { x: number; y: number };
          emotion?: { label: string; confidence: number };
        };
        setFrameCount(frame.frame_id);
        if (frame.emotion?.label) {
          setEmotion(frame.emotion.label, frame.emotion.confidence);
        }
        setLatestInput({
          pressed: frame.keyboard_state.pressed,
          mouse_x: frame.mouse_state.x,
          mouse_y: frame.mouse_state.y,
        });
      } else if (msg.type === 'xp_awarded') {
        const e = msg as { reason: string; amount: number; new_total: number; level: number };
        applyXpEvent(e.new_total, e.level);
        addNotification(`+${e.amount} XP — ${e.reason.replace(/_/g, ' ')}`);
      } else if (msg.type === 'level_up') {
        const e = msg as { new_level: number };
        addNotification(`LEVEL UP! Level ${e.new_level} 🎉`);
      } else if (msg.type === 'challenge_complete') {
        const e = msg as { name: string; xp_bonus: number };
        addNotification(`Challenge: ${e.name} +${e.xp_bonus} XP 🏆`);
      }
    });
    return unsub;
  }, []);

  function addNotification(text: string) {
    const id = ++notifCounter.current;
    setNotifications((prev) => [...prev.slice(-4), { id, text }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Dashboard</h1>

      {/* Disk warning banner */}
      {health?.disk.warn && (
        <div style={styles.diskWarn}>
          ⚠️ Disk kullanımı yüksek: veri dizini {health.disk.data_gb.toFixed(1)} GB.
          Eski oturum dosyalarını temizlemeyi düşün. ({health.disk.free_gb} GB boş)
        </div>
      )}
      {health && !health.disk.warn && (
        <div style={styles.diskInfo}>
          Veri: {health.disk.data_gb.toFixed(2)} GB &nbsp;•&nbsp;
          Boş alan: {health.disk.free_gb} GB
        </div>
      )}

      <div style={styles.grid}>
        {/* Left column */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Session Controls</h2>
          <SessionControls />
        </div>

        {/* Right column */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Live Stats</h2>
          {isRecording ? (
            <div style={styles.stats}>
              <Stat label="Duration" value={formatElapsed(elapsed)} />
              <Stat label="Frames Captured" value={frameCount.toLocaleString()} />
              <Stat label="~Storage Used" value={`${(frameCount * 0.04).toFixed(1)} MB`} />
              <Stat label="Session ID" value={sessionId ? sessionId.slice(0, 8) + '...' : '—'} />
            </div>
          ) : (
            <p style={{ color: '#6b7280' }}>Start a session to see live stats.</p>
          )}
          <div style={{ marginTop: 16 }}>
            <h3 style={styles.subTitle}>Current Emotion</h3>
            <EmotionBadge label={currentEmotion} confidence={emotionConfidence} />
          </div>
          {latestInput && (
            <div style={{ marginTop: 16 }}>
              <h3 style={styles.subTitle}>Input State</h3>
              <div style={styles.inputRow}>
                {latestInput.pressed.length > 0
                  ? latestInput.pressed.map((k) => <KeyBadge key={k} k={k} />)
                  : <span style={{ color: '#6b7280', fontSize: 13 }}>No keys pressed</span>}
              </div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                Mouse: ({latestInput.mouse_x}, {latestInput.mouse_y})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session history */}
      <div style={{ ...styles.card, marginTop: 20 }}>
        <h2 style={styles.cardTitle}>Oturum Geçmişi</h2>
        <SessionHistory />
      </div>

      {/* Toast notifications */}
      <div style={styles.notifications}>
        {notifications.map((n) => (
          <div key={n.id} style={styles.notif}>{n.text}</div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: '#6b7280', fontSize: 12 }}>{label}</div>
      <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function KeyBadge({ k }: { k: string }) {
  return (
    <span style={{
      background: '#374151', color: '#e5e7eb', borderRadius: 4,
      padding: '2px 7px', fontSize: 12, fontFamily: 'monospace',
    }}>
      {k}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px' },
  title: { color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  card: {
    background: '#16161f', borderRadius: 12, padding: '20px 24px',
    border: '1px solid #374151',
  },
  cardTitle: { color: '#a78bfa', fontSize: 16, fontWeight: 700, marginBottom: 16 },
  subTitle: { color: '#9ca3af', fontSize: 13, fontWeight: 600, marginBottom: 8 },
  stats: { display: 'flex', flexDirection: 'column', gap: 4 },
  inputRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  diskWarn: {
    background: '#78350f', border: '1px solid #b45309', borderRadius: 8,
    padding: '8px 16px', fontSize: 13, color: '#fde68a',
    marginBottom: 16,
  },
  diskInfo: {
    color: '#4b5563', fontSize: 12, marginBottom: 12,
  },
  notifications: {
    position: 'fixed', bottom: 24, right: 24,
    display: 'flex', flexDirection: 'column', gap: 8, zIndex: 100,
  },
  notif: {
    background: '#7c3aed', color: '#fff', borderRadius: 8,
    padding: '8px 16px', fontSize: 14, fontWeight: 600,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    animation: 'fadeIn 0.2s ease',
  },
};
