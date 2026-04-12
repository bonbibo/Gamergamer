import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { api, TrainingJob } from '../api/pythonApi';
import { wsClient, WsMessage } from '../api/wsClient';

export function Training() {
  const userId = useSessionStore((s) => s.userId);
  const [sessionIds, setSessionIds] = useState<string>('');
  const [epochs, setEpochs] = useState(10);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = wsClient.onMessage((msg: WsMessage) => {
      if (msg.type === 'training_progress' && msg.job_id === jobId) {
        setJob((prev) => prev ? {
          ...prev,
          epoch: msg.epoch as number,
          loss: msg.loss as number,
          val_loss: msg.val_loss as number,
          status: 'running',
        } : null);
      }
    });
    return unsub;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const j = await api.trainingStatus(jobId);
        setJob(j);
        if (j.status === 'done' || j.status === 'failed') clearInterval(interval);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  async function handleStart() {
    const ids = sessionIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return alert('Enter at least one session ID');
    setLoading(true);
    try {
      const result = await api.trainingStart({ user_id: userId, session_ids: ids, epochs });
      setJobId(result.job_id);
      setJob({ job_id: result.job_id, status: 'running', epoch: 0, total_epochs: epochs, loss: null, val_loss: null });
    } catch (e: unknown) {
      alert(`Training failed to start: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const progress = job ? (job.epoch / job.total_epochs) * 100 : 0;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>AI Training</h1>
      <p style={styles.desc}>
        Train a behavioral clone model from your gameplay sessions.
        The model learns your keyboard/mouse patterns and can later power your AI streamer persona.
      </p>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Start Training Job</h2>
        <div style={styles.field}>
          <label style={styles.label}>Session IDs (comma-separated)</label>
          <input
            style={styles.input}
            value={sessionIds}
            onChange={(e) => setSessionIds(e.target.value)}
            placeholder="abc123, def456, ..."
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Epochs</label>
          <input
            style={{ ...styles.input, width: 80 }}
            type="number"
            min={1}
            max={100}
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
          />
        </div>
        <button onClick={handleStart} disabled={loading} style={styles.btn}>
          {loading ? 'Starting...' : 'Start Training'}
        </button>
      </div>

      {job && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Job: {job.job_id.slice(0, 8)}...</h2>
          <div style={styles.statusRow}>
            <StatusBadge status={job.status} />
            <span style={{ color: '#9ca3af', fontSize: 13 }}>
              Epoch {job.epoch} / {job.total_epochs}
            </span>
          </div>
          <div style={styles.track}>
            <div style={{ ...styles.fill, width: `${progress}%` }} />
          </div>
          {job.loss !== null && (
            <div style={styles.lossRow}>
              <LossStat label="Train Loss" value={job.loss} />
              <LossStat label="Val Loss" value={job.val_loss} />
            </div>
          )}
          {job.status === 'done' && job.checkpoint && (
            <div style={{ color: '#22c55e', marginTop: 10, fontSize: 13 }}>
              Checkpoint saved: {job.checkpoint}
            </div>
          )}
          {job.error && (
            <div style={{ color: '#ef4444', marginTop: 10, fontSize: 13 }}>{job.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'done' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#f59e0b';
  return <span style={{ color, fontWeight: 700, fontSize: 13 }}>{status.toUpperCase()}</span>;
}

function LossStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div style={{ color: '#6b7280', fontSize: 12 }}>{label}</div>
      <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 18 }}>
        {value !== null ? value.toFixed(4) : '—'}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px' },
  title: { color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 8 },
  desc: { color: '#9ca3af', fontSize: 14, marginBottom: 20 },
  card: {
    background: '#16161f', borderRadius: 12, padding: '20px 24px',
    border: '1px solid #374151', marginBottom: 20,
  },
  cardTitle: { color: '#a78bfa', fontSize: 16, fontWeight: 700, marginBottom: 16 },
  field: { marginBottom: 12 },
  label: { display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 6 },
  input: {
    width: '100%', background: '#1e1e2a', color: '#e5e7eb',
    border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', fontSize: 14,
  },
  btn: {
    padding: '8px 20px', background: '#7c3aed', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  track: { height: 10, borderRadius: 5, background: '#374151', overflow: 'hidden', marginBottom: 12 },
  fill: { height: '100%', borderRadius: 5, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', transition: 'width 0.5s' },
  lossRow: { display: 'flex', gap: 24 },
};
