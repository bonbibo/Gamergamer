import React from 'react';
import type { Challenge } from '../api/pythonApi';

interface Props {
  challenge: Challenge;
}

export function ChallengeCard({ challenge }: Props) {
  const pct = Math.round(challenge.progress * 100);
  const done = challenge.complete;

  return (
    <div style={{ ...styles.card, opacity: done ? 0.7 : 1 }}>
      <div style={styles.header}>
        <span style={styles.name}>{challenge.name}</span>
        <span style={styles.xp}>+{challenge.xp_reward} XP</span>
      </div>
      <p style={styles.desc}>{challenge.description}</p>
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${pct}%`, background: done ? '#22c55e' : '#7c3aed' }} />
      </div>
      <div style={styles.footer}>
        {done ? (
          <span style={{ color: '#22c55e', fontSize: 12 }}>Completed {challenge.times_completed}x</span>
        ) : (
          <span style={styles.pctLabel}>{pct}%</span>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#1e1e2a', border: '1px solid #374151',
    borderRadius: 10, padding: '12px 16px',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { color: '#e5e7eb', fontWeight: 600, fontSize: 14 },
  xp: { color: '#a78bfa', fontWeight: 700, fontSize: 13 },
  desc: { color: '#9ca3af', fontSize: 12, margin: '4px 0 8px' },
  track: { height: 6, borderRadius: 3, background: '#374151', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, transition: 'width 0.4s ease' },
  footer: { marginTop: 4 },
  pctLabel: { color: '#6b7280', fontSize: 12 },
};
