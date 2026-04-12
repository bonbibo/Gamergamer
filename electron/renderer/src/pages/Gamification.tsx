import React, { useEffect } from 'react';
import { XPProgressBar } from '../components/XPProgressBar';
import { ChallengeCard } from '../components/ChallengeCard';
import { useGamificationStore } from '../store/gamificationStore';
import { useSessionStore } from '../store/sessionStore';
import { api } from '../api/pythonApi';

export function Gamification() {
  const { profile, challenges, setProfile, setChallenges } = useGamificationStore();
  const userId = useSessionStore((s) => s.userId);

  async function load() {
    try {
      const [p, c] = await Promise.all([api.getProfile(userId), api.getChallenges(userId)]);
      setProfile(p);
      setChallenges(c);
    } catch (e) {
      console.error('Failed to load gamification data', e);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Gamification</h1>

      {profile && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Your Progress</h2>
          <XPProgressBar level={profile.level} xp={profile.xp} xpToNext={profile.xp_to_next} />
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

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px' },
  title: { color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 20 },
  card: {
    background: '#16161f', borderRadius: 12, padding: '20px 24px',
    border: '1px solid #374151', marginBottom: 20,
  },
  cardTitle: { color: '#a78bfa', fontSize: 16, fontWeight: 700, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 },
};
