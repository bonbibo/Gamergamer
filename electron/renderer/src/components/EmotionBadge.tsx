import React from 'react';

const EMOTION_COLORS: Record<string, string> = {
  hype: '#f59e0b',
  focused: '#3b82f6',
  frustrated: '#ef4444',
  tilted: '#8b5cf6',
  anxious: '#f97316',
  neutral: '#6b7280',
};

const EMOTION_EMOJI: Record<string, string> = {
  hype: '🔥',
  focused: '🎯',
  frustrated: '😤',
  tilted: '😢',
  anxious: '😰',
  neutral: '😐',
};

interface Props {
  label: string | null;
  confidence: number | null;
}

export function EmotionBadge({ label, confidence }: Props) {
  if (!label) {
    return (
      <div style={styles.container}>
        <span style={{ color: '#6b7280', fontSize: 13 }}>No emotion data</span>
      </div>
    );
  }

  const color = EMOTION_COLORS[label] ?? '#9ca3af';
  const emoji = EMOTION_EMOJI[label] ?? '🎮';

  return (
    <div style={{ ...styles.container, borderColor: color }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <div>
        <div style={{ ...styles.label, color }}>{label.toUpperCase()}</div>
        {confidence !== null && (
          <div style={styles.confidence}>{Math.round(confidence * 100)}% confidence</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 14px', borderRadius: 10,
    border: '1px solid #374151', background: '#1e1e2a',
    minWidth: 160,
  },
  label: { fontWeight: 700, fontSize: 15 },
  confidence: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
};
