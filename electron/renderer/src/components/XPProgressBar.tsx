import React from 'react';

interface Props {
  level: number;
  xp: number;
  xpToNext: number;
  xpFloor?: number;
}

export function XPProgressBar({ level, xp, xpToNext, xpFloor = 0 }: Props) {
  // Progress within the current level: from xpFloor (level start) to xpFloor+xpInLevel+xpToNext (level end)
  const levelEnd = xp + xpToNext;
  const range = levelEnd - xpFloor;
  const gained = xp - xpFloor;
  const pct = range > 0 ? Math.min(100, Math.max(0, (gained / range) * 100)) : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.level}>Level {level}</span>
        <span style={styles.xpText}>{xp.toLocaleString()} XP</span>
      </div>
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${pct}%` }} />
      </div>
      <div style={styles.footer}>
        <span style={styles.sub}>{xpToNext.toLocaleString()} XP to Level {level + 1}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  level: { color: '#a78bfa', fontWeight: 700, fontSize: 16 },
  xpText: { color: '#e5e7eb', fontSize: 14 },
  track: {
    height: 12, borderRadius: 6, background: '#1e1e2a',
    overflow: 'hidden', border: '1px solid #374151',
  },
  fill: {
    height: '100%', borderRadius: 6,
    background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    transition: 'width 0.4s ease',
  },
  footer: { marginTop: 4 },
  sub: { color: '#6b7280', fontSize: 12 },
};
