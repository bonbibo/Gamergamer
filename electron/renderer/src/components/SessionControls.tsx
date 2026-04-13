import React, { useEffect, useState } from 'react';
import { api } from '../api/pythonApi';
import { useSessionStore } from '../store/sessionStore';
import { wsClient } from '../api/wsClient';

const GAMES = ['valorant', 'cs2', 'fortnite', 'league_of_legends', 'minecraft', 'apex_legends', 'other'];

export function SessionControls() {
  const { sessionId, isRecording, userId, game, setSessionId, setRecording, setGame, reset } = useSessionStore();
  const [loading, setLoading] = useState(false);
  const [enableWebcam, setEnableWebcam] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    api.userProfile(userId).then((profile) => {
      if (profile.settings.default_game) setGame(profile.settings.default_game);
      if (profile.settings.enable_webcam != null) setEnableWebcam(profile.settings.enable_webcam);
    }).catch(() => {});
  }, [userId]);

  async function handleStart() {
    setLoading(true);
    try {
      // Persist current game + webcam preference before starting
      api.userUpdateSettings({ user_id: userId, default_game: game, enable_webcam: enableWebcam }).catch(() => {});
      const result = await api.sessionStart({ user_id: userId, game, enable_webcam: enableWebcam });
      setSessionId(result.session_id);
      setRecording(true);
      wsClient.connect();
    } catch (e: unknown) {
      alert(`Failed to start session: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!sessionId) return;
    setLoading(true);
    try {
      await api.sessionStop({ session_id: sessionId });
      wsClient.disconnect();
      reset();
    } catch (e: unknown) {
      alert(`Failed to stop session: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogEvent(event: 'kill' | 'death') {
    if (!sessionId) return;
    await api.sessionEvent({ session_id: sessionId, event });
  }

  return (
    <div style={styles.container}>
      {!isRecording ? (
        <>
          <div style={styles.row}>
            <label style={styles.label}>Game</label>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              style={styles.select}
            >
              {GAMES.map((g) => (
                <option key={g} value={g}>{g.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div style={styles.row}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={enableWebcam}
                onChange={(e) => setEnableWebcam(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Enable Webcam (emotion detection)
            </label>
          </div>
          <button
            onClick={handleStart}
            disabled={loading}
            style={{ ...styles.btn, background: '#22c55e' }}
          >
            {loading ? 'Starting...' : 'Start Session'}
          </button>
        </>
      ) : (
        <>
          <div style={styles.badge}>
            <span style={styles.dot} /> RECORDING — {game.toUpperCase()}
          </div>
          <div style={styles.eventRow}>
            <button onClick={() => handleLogEvent('kill')} style={{ ...styles.btn, background: '#f59e0b' }}>
              Log Kill +50 XP
            </button>
            <button onClick={() => handleLogEvent('death')} style={{ ...styles.btn, background: '#6b7280' }}>
              Log Death -10 XP
            </button>
          </div>
          <button
            onClick={handleStop}
            disabled={loading}
            style={{ ...styles.btn, background: '#ef4444' }}
          >
            {loading ? 'Stopping...' : 'Stop Session'}
          </button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  eventRow: { display: 'flex', gap: 8 },
  label: { color: '#9ca3af', fontSize: 14, cursor: 'pointer' },
  select: {
    background: '#1e1e2a', color: '#e5e7eb', border: '1px solid #374151',
    borderRadius: 6, padding: '6px 10px', fontSize: 14,
  },
  btn: {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
  badge: {
    display: 'flex', alignItems: 'center', gap: 8,
    color: '#22c55e', fontWeight: 700, fontSize: 15,
  },
  dot: {
    width: 10, height: 10, borderRadius: '50%',
    background: '#ef4444', display: 'inline-block',
    animation: 'pulse 1s infinite',
  },
};
