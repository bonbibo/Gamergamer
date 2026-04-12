import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { api, Clip, ExportJob } from '../api/pythonApi';

const TIERS = ['basic', 'premium', 'elite'] as const;
type Tier = typeof TIERS[number];

const TIER_COLORS: Record<Tier, string> = {
  basic: '#6b7280',
  premium: '#3b82f6',
  elite: '#f59e0b',
};

const TIER_DESC: Record<Tier, string> = {
  basic: 'Screen + emotion labels • $0.10/clip',
  premium: 'Basic + input stream • $0.50/clip',
  elite: 'Premium + face landmarks + metadata • $2.00/clip',
};

export function Marketplace() {
  const userId = useSessionStore((s) => s.userId);
  const [tier, setTier] = useState<Tier>('basic');
  const [clips, setClips] = useState<Clip[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadClips() {
    try {
      const c = await api.marketplaceClips({ userId, tier });
      setClips(c);
    } catch { setClips([]); }
  }

  useEffect(() => { loadClips(); }, [tier, userId]);

  function toggleSelect(clipId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(clipId) ? next.delete(clipId) : next.add(clipId);
      return next;
    });
  }

  async function handleExport() {
    if (selected.size === 0) return alert('Select at least one clip');
    setLoading(true);
    try {
      const selectedClips = clips.filter((c) => selected.has(c.clip_id));
      const sessionClips = selectedClips.map((c) => ({
        clip_id: c.clip_id,
        session_id: c.session_id,
        start_frame: c.start_frame,
        end_frame: c.end_frame,
        tier,
      }));
      const result = await api.marketplaceExport({
        clip_ids: [...selected],
        tier,
        destination: 'local',
        session_clips: sessionClips,
      });
      setExportJob({ export_id: result.export_id, status: 'packaging', path: null });

      // Poll for status
      const interval = setInterval(async () => {
        try {
          const j = await api.marketplaceExportStatus(result.export_id);
          setExportJob(j);
          if (j.status === 'ready' || j.status === 'failed') clearInterval(interval);
        } catch {}
      }, 2000);
    } catch (e: unknown) {
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const totalValue = clips.filter((c) => selected.has(c.clip_id)).reduce((s, c) => s + c.price_usd, 0);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Dataset Marketplace</h1>
      <p style={styles.desc}>
        Package your gameplay data into clips and export them for AI companies.
        Select a tier below based on what data you want to include.
      </p>

      {/* Tier selector */}
      <div style={styles.tierRow}>
        {TIERS.map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            style={{
              ...styles.tierBtn,
              borderColor: tier === t ? TIER_COLORS[t] : '#374151',
              color: tier === t ? TIER_COLORS[t] : '#9ca3af',
              background: tier === t ? `${TIER_COLORS[t]}22` : '#16161f',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.toUpperCase()}</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>{TIER_DESC[t]}</div>
          </button>
        ))}
      </div>

      {/* Clips list */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Available Clips ({clips.length})</h2>
          <button onClick={loadClips} style={styles.refreshBtn}>Refresh</button>
        </div>
        {clips.length === 0 ? (
          <p style={{ color: '#6b7280' }}>
            No clips available. Complete a session of at least 30 seconds to generate clips.
          </p>
        ) : (
          <div style={styles.clipGrid}>
            {clips.map((clip) => (
              <div
                key={clip.clip_id}
                onClick={() => toggleSelect(clip.clip_id)}
                style={{
                  ...styles.clipCard,
                  borderColor: selected.has(clip.clip_id) ? TIER_COLORS[tier] : '#374151',
                  background: selected.has(clip.clip_id) ? `${TIER_COLORS[tier]}11` : '#1e1e2a',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>
                  {clip.clip_id}
                </div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                  {clip.game?.toUpperCase() ?? 'UNKNOWN'} • {clip.duration_s}s
                </div>
                <div style={{ color: TIER_COLORS[tier], fontWeight: 700, fontSize: 14, marginTop: 6 }}>
                  ${clip.price_usd.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export panel */}
      {selected.size > 0 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Export {selected.size} clips</h2>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>
            Estimated value: <strong style={{ color: '#e5e7eb' }}>${totalValue.toFixed(2)}</strong>
          </p>
          <button onClick={handleExport} disabled={loading} style={styles.exportBtn}>
            {loading ? 'Packaging...' : 'Export to Local'}
          </button>
        </div>
      )}

      {/* Export status */}
      {exportJob && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Export Status</h2>
          <div style={{ color: exportJob.status === 'ready' ? '#22c55e' : exportJob.status === 'failed' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
            {exportJob.status.toUpperCase()}
          </div>
          {exportJob.path && (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>{exportJob.path}</span>
              <button
                onClick={() => api.openPath(exportJob.path!)}
                style={{ ...styles.refreshBtn, marginLeft: 10 }}
              >
                Open Folder
              </button>
            </div>
          )}
          {exportJob.error && <div style={{ color: '#ef4444', fontSize: 13 }}>{exportJob.error}</div>}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px' },
  title: { color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 8 },
  desc: { color: '#9ca3af', fontSize: 14, marginBottom: 20 },
  tierRow: { display: 'flex', gap: 12, marginBottom: 20 },
  tierBtn: {
    flex: 1, padding: '12px 16px', borderRadius: 10, border: '2px solid',
    background: '#16161f', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
  },
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
  clipGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 },
  clipCard: { borderRadius: 8, border: '2px solid', padding: '10px 12px', transition: 'all 0.15s' },
  exportBtn: {
    padding: '10px 24px', background: '#7c3aed', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14, marginTop: 10,
  },
};
