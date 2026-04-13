import React, { useEffect, useState } from 'react';
import { XPProgressBar } from '../components/XPProgressBar';
import { ChallengeCard } from '../components/ChallengeCard';
import { useGamificationStore } from '../store/gamificationStore';
import { useSessionStore } from '../store/sessionStore';
import { api, UserFullProfile } from '../api/pythonApi';

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

export function Gamification() {
  const { profile, challenges, setProfile, setChallenges } = useGamificationStore();
  const userId = useSessionStore((s) => s.userId);
  const [fullProfile, setFullProfile] = useState<UserFullProfile | null>(null);

  async function load() {
    try {
      const [p, c, fp] = await Promise.all([
        api.getProfile(userId),
        api.getChallenges(userId),
        api.userProfile(userId),
      ]);
      setProfile(p);
      setChallenges(c);
      setFullProfile(fp);
    } catch (e) {
      console.error('Failed to load gamification data', e);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [userId]);

  const stats = fullProfile?.stats;
  const membership = fullProfile?.membership;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Gamification</h1>

      {/* Stats overview row */}
      {stats && (
        <div style={styles.statsRow}>
          <StatCard value={stats.session_count.toString()} label="Sessions" color="#22c55e" />
          <StatCard value={stats.total_frames.toLocaleString()} label="Total Frames" color="#3b82f6" />
          <StatCard value={formatDuration(stats.total_duration_ms)} label="Total Playtime" color="#a78bfa" />
          <StatCard value={`$${stats.estimated_value_usd.toFixed(2)}`} label="Data Value (Est.)" color="#f59e0b" />
          <StatCard value={stats.challenges_completed.toString()} label="Challenges Done" color="#ec4899" />
          {stats.dominant_emotion && (
            <StatCard value={stats.dominant_emotion.toUpperCase()} label="Dominant Emotion" color="#06b6d4" />
          )}
        </div>
      )}

      {/* Membership badge */}
      {membership && (
        <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', marginBottom: 16 }}>
          <div style={{
            background: membership.color, borderRadius: 8,
            padding: '4px 14px', fontWeight: 700, fontSize: 14, color: '#0f172a',
          }}>
            {membership.name.toUpperCase()}
          </div>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>
            {membership.name === 'Diamond' ? 'Max tier unlocked!' :
              `Next tier at ${['Bronze', 'Silver', 'Gold'].includes(membership.name) ?
                { Bronze: 10, Silver: 50, Gold: 200 }[membership.name] : '—'} sessions`}
          </span>
          <span style={{ color: '#4b5563', fontSize: 12, marginLeft: 'auto' }}>
            {fullProfile?.username}
          </span>
        </div>
      )}

      {profile && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Your Progress</h2>
          <XPProgressBar level={profile.level} xp={profile.xp} xpToNext={profile.xp_to_next} xpFloor={profile.xp_floor} />
        </div>
      )}

      {/* Emotion distribution */}
      {stats?.emotion_distribution && Object.keys(stats.emotion_distribution).length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Emotion Distribution</h2>
          <EmotionBar distribution={stats.emotion_distribution} />
        </div>
      )}

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Challenges</h2>
        {challenges.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No challenges found. Start a session to earn XP.</p>
        ) : (
          <div style={styles.grid}>
            {challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{
      background: '#16161f', borderRadius: 10, padding: '14px 18px',
      border: '1px solid #1f2937', flex: '1 1 120px', minWidth: 110,
    }}>
      <div style={{ color, fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: 11, marginTop: 3 }}>{label}</div>
    </div>
  );
}

const EMOTION_COLORS: Record<string, string> = {
  hype: '#f59e0b', focused: '#3b82f6', frustrated: '#ef4444',
  tilted: '#8b5cf6', anxious: '#f97316', neutral: '#6b7280',
};

function EmotionBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map(([label, count]) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ color: '#9ca3af', fontSize: 12, width: 80, textTransform: 'capitalize' }}>{label}</div>
            <div style={{ flex: 1, background: '#1f2937', borderRadius: 4, height: 8 }}>
              <div style={{
                width: `${pct.toFixed(1)}%`, height: '100%',
                background: EMOTION_COLORS[label] ?? '#4b5563', borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, width: 36, textAlign: 'right' }}>
              {pct.toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px' },
  title: { color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 20 },
  statsRow: {
    display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16,
  },
  card: {
    background: '#16161f', borderRadius: 12, padding: '20px 24px',
    border: '1px solid #374151', marginBottom: 16,
  },
  cardTitle: { color: '#a78bfa', fontSize: 16, fontWeight: 700, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 },
};
