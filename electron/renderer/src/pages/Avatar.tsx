import React, { useState } from 'react';
import { AvatarCanvas } from '../components/AvatarCanvas';
import { useStreamStore } from '../store/streamStore';
import { api } from '../api/pythonApi';

declare global {
  interface Window {
    api: Window['api'] & {
      dialogOpenVrm: () => Promise<string | null>;
    };
  }
}

export function Avatar() {
  const { obsConnected, twitchConnected, isStreaming, setObsConnected, setTwitchConnected, setStreaming } = useStreamStore();
  const [obsAddress, setObsAddress] = useState('ws://localhost:4455');
  const [obsPassword, setObsPassword] = useState('');
  const [twitchChannel, setTwitchChannel] = useState('');
  const [twitchUsername, setTwitchUsername] = useState('');
  const [twitchToken, setTwitchToken] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [vrmUrl, setVrmUrl] = useState<string | null>(null);
  const [ttsApiKey, setTtsApiKey] = useState('');
  const [ttsVoiceId, setTtsVoiceId] = useState('EXAVITQu4vr4xnSDxMaL');
  const [ttsText, setTtsText] = useState('');
  const [ttsPlaying, setTtsPlaying] = useState(false);

  async function pickVrm() {
    try {
      const filePath = await api.dialogOpenVrm();
      if (filePath) setVrmUrl(`file://${filePath}`);
    } catch (e: unknown) {
      alert(`VRM yüklenemedi: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleTtsSpeak() {
    if (!ttsText.trim() || !ttsApiKey) return alert('API key ve metin gerekli');
    setTtsPlaying(true);
    try {
      const base64Audio = await api.ttsSpeak({ text: ttsText, apiKey: ttsApiKey, voiceId: ttsVoiceId });
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      audio.onended = () => setTtsPlaying(false);
      audio.onerror = () => setTtsPlaying(false);
      await audio.play();
    } catch (e: unknown) {
      setTtsPlaying(false);
      alert(`TTS hatası: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function connectObs() {
    setLoading('obs');
    try {
      await api.obsConnect({ address: obsAddress, password: obsPassword || undefined });
      setObsConnected(true);
    } catch (e: unknown) {
      alert(`OBS connect failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(null); }
  }

  async function connectTwitch() {
    setLoading('twitch');
    try {
      await api.twitchConnect({ channel: twitchChannel, username: twitchUsername, oauthToken: twitchToken });
      setTwitchConnected(true);
    } catch (e: unknown) {
      alert(`Twitch connect failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(null); }
  }

  async function toggleStream() {
    setLoading('stream');
    try {
      if (isStreaming) {
        await api.obsStopStream();
        setStreaming(false);
      } else {
        await api.obsStartStream();
        setStreaming(true);
      }
    } catch (e: unknown) {
      alert(`Stream toggle failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(null); }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Avatar & Streaming</h1>

      <div style={styles.grid}>
        <div>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Avatar Preview</h2>
            <AvatarCanvas vrmUrl={vrmUrl ?? undefined} />
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={pickVrm} style={styles.btn}>
                {vrmUrl ? 'VRM Değiştir' : 'VRM Yükle (.vrm)'}
              </button>
              {vrmUrl && (
                <span style={{ color: '#22c55e', fontSize: 12 }}>
                  {vrmUrl.split('/').pop()}
                </span>
              )}
            </div>
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
              Avatar duygu tespitine göre gerçek zamanlı tepki verir.
              OBS'de Window Capture kaynağı olarak ekle.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>
              OBS Connection {obsConnected && <span style={{ color: '#22c55e', fontSize: 12 }}>Connected</span>}
            </h2>
            <Field label="WebSocket Address" value={obsAddress} onChange={setObsAddress} />
            <Field label="Password" value={obsPassword} onChange={setObsPassword} type="password" />
            <button onClick={connectObs} disabled={!!loading || obsConnected} style={styles.btn}>
              {loading === 'obs' ? 'Connecting...' : obsConnected ? 'Connected' : 'Connect OBS'}
            </button>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>
              Twitch {twitchConnected && <span style={{ color: '#22c55e', fontSize: 12 }}>Connected</span>}
            </h2>
            <Field label="Channel" value={twitchChannel} onChange={setTwitchChannel} placeholder="your_channel" />
            <Field label="Username" value={twitchUsername} onChange={setTwitchUsername} />
            <Field label="OAuth Token" value={twitchToken} onChange={setTwitchToken} type="password" placeholder="oauth:..." />
            <button onClick={connectTwitch} disabled={!!loading || twitchConnected} style={styles.btn}>
              {loading === 'twitch' ? 'Connecting...' : twitchConnected ? 'Connected' : 'Connect Twitch'}
            </button>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>AI Ses (ElevenLabs TTS)</h2>
            <Field label="API Key" value={ttsApiKey} onChange={setTtsApiKey} type="password" placeholder="sk-..." />
            <Field label="Voice ID" value={ttsVoiceId} onChange={setTtsVoiceId} placeholder="EXAVITQu4vr4xnSDxMaL" />
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>Metin</label>
              <textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="Söylenecek metin..."
                rows={2}
                style={{
                  width: '100%', background: '#1e1e2a', color: '#e5e7eb',
                  border: '1px solid #374151', borderRadius: 6, padding: '6px 10px',
                  fontSize: 13, resize: 'none',
                }}
              />
            </div>
            <button
              onClick={handleTtsSpeak}
              disabled={ttsPlaying || !ttsApiKey || !ttsText.trim()}
              style={styles.btn}
            >
              {ttsPlaying ? 'Oynatılıyor...' : 'Konuştur'}
            </button>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Stream Control</h2>
            <button
              onClick={toggleStream}
              disabled={!obsConnected || !!loading}
              style={{ ...styles.btn, background: isStreaming ? '#ef4444' : '#22c55e' }}
            >
              {loading === 'stream' ? '...' : isStreaming ? 'Stop Stream' : 'Go Live'}
            </button>
            {!obsConnected && <p style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>Connect OBS first</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: '#1e1e2a', color: '#e5e7eb',
          border: '1px solid #374151', borderRadius: 6, padding: '6px 10px', fontSize: 13,
        }}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px' },
  title: { color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  card: {
    background: '#16161f', borderRadius: 12, padding: '20px 24px',
    border: '1px solid #374151',
  },
  cardTitle: { color: '#a78bfa', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' },
  btn: {
    padding: '8px 18px', background: '#7c3aed', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  },
};
