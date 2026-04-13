import React, { useEffect, useState } from 'react';
import { api, UserFullProfile, UserAccountSettings } from '../api/pythonApi';
import { useSessionStore } from '../store/sessionStore';
import { XPProgressBar } from '../components/XPProgressBar';

const GAMES = ['valorant', 'cs2', 'fortnite', 'league_of_legends', 'minecraft', 'apex_legends', 'other'];
const TIERS = ['basic', 'premium', 'elite'] as const;
const TIER_DESC: Record<string, string> = {
  basic: '$0.10/klip — Ekran + duygu',
  premium: '$0.50/klip — + Input stream',
  elite: '$2.00/klip — + Yüz landmark',
};

const MEMBERSHIP_ICONS: Record<string, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold: '🥇',
  Diamond: '💎',
};

const NEXT_TIER_THRESHOLD: Record<string, number> = {
  Bronze: 10,
  Silver: 50,
  Gold: 200,
  Diamond: 200,
};

const EMOTION_EMOJI: Record<string, string> = {
  hype: '🔥', focused: '🎯', frustrated: '😤',
  tilted: '😢', anxious: '😰', neutral: '😐',
};

// ─── Onboarding ──────────────────────────────────────────────────────────────

function OnboardingScreen({ userId, onComplete }: { userId: string; onComplete: (name: string) => void }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    const name = username.trim();
    if (!name) { setError('Kullanıcı adı boş bırakılamaz.'); return; }
    if (name.length < 2) { setError('En az 2 karakter gir.'); return; }
    setLoading(true);
    try {
      await api.userRegister({ user_id: userId, username: name });
      onComplete(name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.onboardingWrap}>
      <div style={styles.onboardingCard}>
        <div style={styles.onboardingIcon}>🎮</div>
        <h1 style={styles.onboardingTitle}>Gamergamer'a Hoş Geldin</h1>
        <p style={styles.onboardingDesc}>
          Gameplay verinle AI modelleri eğit, XP kazan, AI avatar streamer ol.
          Başlamak için bir kullanıcı adı seç.
        </p>
        <div style={styles.onboardingField}>
          <input
            style={{ ...styles.input, fontSize: 18, textAlign: 'center' }}
            placeholder="Kullanıcı adın..."
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            autoFocus
            maxLength={32}
          />
          {error && <div style={styles.errorText}>{error}</div>}
        </div>
        <button
          onClick={handleRegister}
          disabled={loading || !username.trim()}
          style={styles.onboardingBtn}
        >
          {loading ? 'Oluşturuluyor...' : 'Hesap Oluştur'}
        </button>
        <p style={styles.onboardingHint}>
          Veriler yalnızca cihazında saklanır. Hiçbir veri izinsiz paylaşılmaz.
        </p>
      </div>
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────

export function UserProfile() {
  const userId = useSessionStore((s) => s.userId);
  const [profile, setProfile] = useState<UserFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [settings, setSettings] = useState<Partial<UserAccountSettings>>({});

  async function loadProfile() {
    setLoading(true);
    try {
      const p = await api.userProfile(userId);
      setProfile(p);
      setSettings(p.settings);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfile(); }, [userId]);

  function handleOnboardingComplete(name: string) {
    setNotFound(false);
    loadProfile();
  }

  async function handleSaveUsername() {
    if (!editUsername.trim()) return;
    setSaving(true);
    try {
      await api.userUpdateProfile({ user_id: userId, username: editUsername.trim() });
      setProfile((p) => p ? { ...p, username: editUsername.trim() } : p);
      setEditing(false);
      flash('Kullanıcı adı güncellendi.');
    } catch { flash('Güncelleme başarısız.', true); }
    finally { setSaving(false); }
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await api.userUpdateSettings({
        user_id: userId,
        ...settings,
        twitch_channel: settings.twitch_channel ?? undefined,
        twitch_username: settings.twitch_username ?? undefined,
      });
      flash('Ayarlar kaydedildi.');
      loadProfile();
    } catch { flash('Kayıt başarısız.', true); }
    finally { setSaving(false); }
  }

  function flash(msg: string, isError = false) {
    setSaveMsg((isError ? '❌ ' : '✅ ') + msg);
    setTimeout(() => setSaveMsg(''), 3000);
  }

  if (loading) return <div style={styles.center}><span style={{ color: '#6b7280' }}>Yükleniyor...</span></div>;
  if (notFound) return <OnboardingScreen userId={userId} onComplete={handleOnboardingComplete} />;
  if (!profile) return null;

  const { membership, stats, settings: s } = profile;
  const tierIcon = MEMBERSHIP_ICONS[membership.name] ?? '🎮';
  const nextThreshold = NEXT_TIER_THRESHOLD[membership.name] ?? 0;
  const tierProgress = membership.name === 'Diamond'
    ? 100
    : Math.min(100, (stats.session_count / nextThreshold) * 100);

  const totalHours = (stats.total_duration_ms / 1000 / 3600).toFixed(1);

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Üyelik Paneli</h1>

      {/* ── Profile Card ─────────────────────────────── */}
      <div style={styles.profileCard}>
        <div style={styles.avatarCircle}>
          {profile.username.slice(0, 2).toUpperCase()}
        </div>
        <div style={styles.profileInfo}>
          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...styles.input, width: 200 }}
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
                autoFocus
              />
              <button onClick={handleSaveUsername} disabled={saving} style={styles.btnSm}>Kaydet</button>
              <button onClick={() => setEditing(false)} style={{ ...styles.btnSm, background: '#374151' }}>İptal</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={styles.username}>{profile.username}</h2>
              <button onClick={() => { setEditing(true); setEditUsername(profile.username); }} style={styles.editBtn}>
                Düzenle
              </button>
            </div>
          )}
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
            ID: {userId.slice(0, 16)}...
          </div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>
            Üyelik: {new Date(profile.created_at).toLocaleDateString('tr-TR')}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 36 }}>{tierIcon}</div>
          <div style={{ color: membership.color, fontWeight: 700, fontSize: 15 }}>
            {membership.name}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>Üye Seviyesi</div>
        </div>
      </div>

      {saveMsg && (
        <div style={{ ...styles.flashMsg, color: saveMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
          {saveMsg}
        </div>
      )}

      <div style={styles.grid2}>
        {/* ── XP + Membership Tier Progress ────────── */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Seviye & XP</h3>
          <XPProgressBar level={profile.level} xp={profile.xp} xpToNext={profile.xp_to_next} xpFloor={profile.xp_floor} />

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>
                {membership.name} → {membership.name === 'Diamond' ? 'Max' : NEXT_TIER_THRESHOLD[membership.name] + ' oturum'}
              </span>
              <span style={{ color: membership.color, fontWeight: 700, fontSize: 13 }}>
                {membership.name === 'Diamond' ? 'MAX' : `${stats.session_count} / ${nextThreshold}`}
              </span>
            </div>
            <div style={styles.track}>
              <div style={{ ...styles.fill, width: `${tierProgress}%`, background: membership.color }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {['Bronze', 'Silver', 'Gold', 'Diamond'].map((t) => (
                <span key={t} style={{
                  fontSize: 11,
                  color: membership.name === t ? membership.color : '#4b5563',
                  fontWeight: membership.name === t ? 700 : 400,
                }}>
                  {MEMBERSHIP_ICONS[t]} {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────── */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>İstatistikler</h3>
          <div style={styles.statsGrid}>
            <StatBox label="Oturum" value={stats.session_count.toString()} icon="🎮" />
            <StatBox label="Toplam Saat" value={totalHours} icon="⏱️" />
            <StatBox label="Frame" value={stats.total_frames.toLocaleString()} icon="📸" />
            <StatBox label="Klip" value={stats.total_clips.toString()} icon="🎬" />
            <StatBox label="Challenge" value={stats.challenges_completed.toString()} icon="🏆" />
            <StatBox
              label="Tahmini Değer"
              value={`$${stats.estimated_value_usd.toFixed(2)}`}
              icon="💰"
              highlight
            />
          </div>
          {stats.dominant_emotion && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#6b7280', fontSize: 13 }}>Dominant Duygu:</span>
              <span style={{ fontSize: 18 }}>{EMOTION_EMOJI[stats.dominant_emotion] ?? '🎮'}</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>
                {stats.dominant_emotion.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Emotion Distribution ─────────────────────── */}
      {Object.keys(stats.emotion_distribution).length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Duygu Dağılımı</h3>
          <EmotionBar distribution={stats.emotion_distribution} />
        </div>
      )}

      {/* ── Settings ─────────────────────────────────── */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Ayarlar</h3>
        <div style={styles.settingsGrid}>
          <div style={styles.settingField}>
            <label style={styles.label}>Varsayılan Oyun</label>
            <select
              value={settings.default_game ?? 'valorant'}
              onChange={(e) => setSettings((p) => ({ ...p, default_game: e.target.value }))}
              style={styles.select}
            >
              {GAMES.map((g) => <option key={g} value={g}>{g.replace('_', ' ').toUpperCase()}</option>)}
            </select>
          </div>

          <div style={styles.settingField}>
            <label style={styles.label}>Tercih Edilen Veri Kademesi</label>
            <select
              value={settings.preferred_tier ?? 'basic'}
              onChange={(e) => setSettings((p) => ({ ...p, preferred_tier: e.target.value }))}
              style={styles.select}
            >
              {TIERS.map((t) => <option key={t} value={t}>{t.toUpperCase()} — {TIER_DESC[t]}</option>)}
            </select>
          </div>

          <div style={styles.settingField}>
            <label style={styles.label}>OBS WebSocket Adresi</label>
            <input
              style={styles.input}
              value={settings.obs_address ?? 'ws://localhost:4455'}
              onChange={(e) => setSettings((p) => ({ ...p, obs_address: e.target.value }))}
              placeholder="ws://localhost:4455"
            />
          </div>

          <div style={styles.settingField}>
            <label style={styles.label}>Twitch Kanal</label>
            <input
              style={styles.input}
              value={settings.twitch_channel ?? ''}
              onChange={(e) => setSettings((p) => ({ ...p, twitch_channel: e.target.value }))}
              placeholder="kanal_adi"
            />
          </div>

          <div style={styles.settingField}>
            <label style={styles.label}>Twitch Kullanıcı Adı</label>
            <input
              style={styles.input}
              value={settings.twitch_username ?? ''}
              onChange={(e) => setSettings((p) => ({ ...p, twitch_username: e.target.value }))}
              placeholder="kullanici_adi"
            />
          </div>

          <div style={styles.settingField}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={settings.enable_webcam ?? false}
                onChange={(e) => setSettings((p) => ({ ...p, enable_webcam: e.target.checked }))}
                style={{ marginRight: 8 }}
              />
              Webcam (Duygu Tespiti)
            </label>
          </div>
        </div>

        <button onClick={handleSaveSettings} disabled={saving} style={styles.saveBtn}>
          {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: boolean }) {
  return (
    <div style={styles.statBox}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ color: highlight ? '#22c55e' : '#e5e7eb', fontWeight: 700, fontSize: 18 }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: 11 }}>{label}</div>
    </div>
  );
}

function EmotionBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const BAR_COLORS: Record<string, string> = {
    hype: '#f59e0b', focused: '#3b82f6', frustrated: '#ef4444',
    tilted: '#8b5cf6', anxious: '#f97316', neutral: '#6b7280',
  };

  return (
    <div>
      <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
        {sorted.map(([emotion, count]) => (
          <div
            key={emotion}
            title={`${emotion}: ${Math.round((count / total) * 100)}%`}
            style={{
              width: `${(count / total) * 100}%`,
              background: BAR_COLORS[emotion] ?? '#374151',
              transition: 'width 0.4s',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {sorted.map(([emotion, count]) => (
          <div key={emotion} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: BAR_COLORS[emotion] ?? '#374151' }} />
            <span style={{ color: '#9ca3af', fontSize: 12 }}>
              {EMOTION_EMOJI[emotion] ?? ''} {emotion} ({Math.round((count / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px', maxWidth: 900 },
  pageTitle: { color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 20 },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },

  // Onboarding
  onboardingWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', padding: 24,
  },
  onboardingCard: {
    background: '#16161f', border: '1px solid #374151', borderRadius: 16,
    padding: '40px 48px', maxWidth: 480, width: '100%', textAlign: 'center',
  },
  onboardingIcon: { fontSize: 52, marginBottom: 12 },
  onboardingTitle: { color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 10 },
  onboardingDesc: { color: '#9ca3af', fontSize: 14, lineHeight: 1.6, marginBottom: 28 },
  onboardingField: { marginBottom: 20 },
  onboardingBtn: {
    width: '100%', padding: '12px 0', background: '#7c3aed', color: '#fff',
    border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 16,
  },
  onboardingHint: { color: '#4b5563', fontSize: 11, marginTop: 16 },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 6 },

  // Profile card
  profileCard: {
    background: '#16161f', border: '1px solid #374151', borderRadius: 14,
    padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20,
  },
  avatarCircle: {
    width: 60, height: 60, borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: 20, flexShrink: 0,
  },
  profileInfo: { flex: 1 },
  username: { color: '#e5e7eb', fontSize: 22, fontWeight: 700 },
  editBtn: {
    background: '#374151', color: '#9ca3af', border: 'none',
    borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
  },
  flashMsg: {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    marginBottom: 16, background: '#1e1e2a', border: '1px solid #374151',
  },

  // Layout
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  card: {
    background: '#16161f', border: '1px solid #374151', borderRadius: 12,
    padding: '20px 24px', marginBottom: 20,
  },
  cardTitle: { color: '#a78bfa', fontSize: 15, fontWeight: 700, marginBottom: 16 },

  // XP / tier progress bar
  track: { height: 8, borderRadius: 4, background: '#374151', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, transition: 'width 0.4s ease' },

  // Stats grid
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
  },
  statBox: {
    background: '#0f0f13', borderRadius: 10, padding: '12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    border: '1px solid #1f2937',
  },

  // Settings
  settingsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16,
  },
  settingField: {},
  label: { display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 5, cursor: 'pointer' },
  select: {
    width: '100%', background: '#1e1e2a', color: '#e5e7eb',
    border: '1px solid #374151', borderRadius: 6, padding: '7px 10px', fontSize: 13,
  },
  input: {
    width: '100%', background: '#1e1e2a', color: '#e5e7eb',
    border: '1px solid #374151', borderRadius: 6, padding: '7px 10px', fontSize: 13,
  },
  saveBtn: {
    padding: '9px 24px', background: '#7c3aed', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
  btnSm: {
    padding: '5px 14px', background: '#7c3aed', color: '#fff',
    border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13,
  },
};
