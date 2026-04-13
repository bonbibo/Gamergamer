import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { api, SessionListItem, TrainingJob } from '../api/pythonApi';
import { wsClient, WsMessage } from '../api/wsClient';

export function Training() {
  const userId = useSessionStore((s) => s.userId);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [epochs, setEpochs] = useState(10);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSessions() {
    try {
      const list = await api.sessionList(userId);
      // Only show completed sessions with enough frames to train on
      setSessions(list.filter((s) => s.status === 'complete' && s.frame_count > 10));
    } catch { setSessions([]); }
  }

  useEffect(() => { loadSessions(); }, [userId]);

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

  function toggleSession(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleStart() {
    if (selected.size === 0) return alert('En az bir oturum seç');
    setLoading(true);
    try {
      const result = await api.trainingStart({ user_id: userId, session_ids: [...selected], epochs });
      setJobId(result.job_id);
      setJob({ job_id: result.job_id, status: 'running', epoch: 0, total_epochs: epochs, loss: null, val_loss: null });
    } catch (e: unknown) {
      alert(`Eğitim başlatılamadı: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const progress = job ? (job.epoch / job.total_epochs) * 100 : 0;

  function fmtDuration(ms: number | null) {
    if (!ms) return '—';
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function fmtDate(ms: number) {
    return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>AI Training</h1>
      <p style={styles.desc}>
        Gameplay oturumlarından behavioral clone modeli eğit.
        Model, klavye/mouse örüntülerini öğrenerek AI streamer persona'nı güçlendirir.
      </p>

      {/* Session picker */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Oturum Seç</h2>
          <button onClick={loadSessions} style={styles.refreshBtn}>Yenile</button>
        </div>
        {sessions.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            Henüz tamamlanmış oturum yok. En az birkaç dakika kayıt yap.
          </p>
        ) : (
          <div style={styles.sessionGrid}>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => toggleSession(s.id)}
                style={{
                  ...styles.sessionCard,
                  borderColor: selected.has(s.id) ? '#7c3aed' : '#374151',
                  background: selected.has(s.id) ? '#7c3aed22' : '#1e1e2a',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 3,
                    border: `2px solid ${selected.has(s.id) ? '#7c3aed' : '#4b5563'}`,
                    background: selected.has(s.id) ? '#7c3aed' : 'transparent',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected.has(s.id) && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                  </div>
                  <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>
                    {s.game?.replace(/_/g, ' ').toUpperCase() ?? 'UNKNOWN'}
                  </span>
                </div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>
                  {fmtDate(s.started_at)} • {s.frame_count.toLocaleString()} frame • {fmtDuration(s.duration_ms)}
                </div>
                <div style={{ color: '#4b5563', fontSize: 10, marginTop: 2 }}>
                  {s.id.slice(0, 12)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training config */}
      {sessions.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Eğitim Ayarları</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
            <div style={{ color: '#6b7280', fontSize: 13, paddingTop: 20 }}>
              {selected.size} oturum seçildi
            </div>
          </div>
          <button
            onClick={handleStart}
            disabled={loading || selected.size === 0}
            style={{ ...styles.btn, opacity: selected.size === 0 ? 0.5 : 1 }}
          >
            {loading ? 'Başlatılıyor...' : 'Eğitimi Başlat'}
          </button>
        </div>
      )}

      {/* Job progress */}
      {job && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>İş: {job.job_id.slice(0, 8)}...</h2>
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
              Checkpoint kaydedildi: {job.checkpoint}
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
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { color: '#a78bfa', fontSize: 16, fontWeight: 700 },
  refreshBtn: {
    background: '#374151', color: '#e5e7eb', border: 'none',
    borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: 'pointer',
  },
  sessionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 },
  sessionCard: {
    borderRadius: 8, border: '2px solid', padding: '10px 12px',
    transition: 'all 0.15s',
  },
  field: { marginBottom: 12 },
  label: { display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 6 },
  input: {
    background: '#1e1e2a', color: '#e5e7eb',
    border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', fontSize: 14,
  },
  btn: {
    marginTop: 4,
    padding: '8px 20px', background: '#7c3aed', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  track: { height: 10, borderRadius: 5, background: '#374151', overflow: 'hidden', marginBottom: 12 },
  fill: { height: '100%', borderRadius: 5, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', transition: 'width 0.5s' },
  lossRow: { display: 'flex', gap: 24 },
};
