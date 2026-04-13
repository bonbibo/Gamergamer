import React, { useEffect, useRef, useState } from 'react';
import { AvatarCanvas } from '../components/AvatarCanvas';
import { useStreamStore } from '../store/streamStore';
import { api, TwitchChatMessage } from '../api/pythonApi';


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
  const [chatMessages, setChatMessages] = useState<TwitchChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [obsScenes, setObsScenes] = useState<string[]>([]);
  const [obsCurrentScene, setObsCurrentScene] = useState<string | null>(null);

  async function pickVrm() {
    try {
      const filePath = await api.dialogOpenVrm();
      if (filePath) setVrmUrl(`file://${filePath}`);
    } catch (e: unknown) {
      alert(`VRM yüklenemedi: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Subscribe to Twitch chat messages pushed from main process
  useEffect(() => {
    const unsub = api.onTwitchChat((msg) => {
      setChatMessages((prev) => [...prev.slice(-99), msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return unsub;
  }, []);

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
      // Load scene list after connect
      const [scenes, current] = await Promise.all([
        api.obsGetSceneList(),
        api.obsGetCurrentScene(),
      ]);
      setObsScenes(scenes);
      setObsCurrentScene(current);
    } catch (e: unknown) {
      alert(`OBS connect failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(null); }
  }

  async function handleSetScene(sceneName: string) {
    try {
      await api.obsSetScene(sceneName);
      setObsCurrentScene(sceneName);
    } catch (e: unknown) {
      alert(`Sahne değiştirilemedi: ${e instanceof Error ? e.message : String(e)}`);
    }
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

          {/* Twitch Chat Feed */}
          {twitchConnected && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                Twitch Chat
                <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                  {chatMessages.length} mesaj
                </span>
              </h2>
              <div style={{
                height: 200, overflowY: 'auto', display: 'flex',
                flexDirection: 'column', gap: 6,
              }}>
                {chatMessages.length === 0
                  ? <p style={{ color: '#4b5563', fontSize: 13 }}>Henüz mesaj yok...</p>
                  : chatMessages.map((m, i) => (
                    <div key={i} style={{ fontSize: 13 }}>
                      <span style={{ color: m.color || '#9ca3af', fontWeight: 700 }}>
                        {m.username}:
                      </span>{' '}
                      <span style={{ color: '#e5e7eb' }}>{m.message}</span>
                    </div>
                  ))
                }
                <div ref={chatEndRef} />
              </div>
            </div>
          )}
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

            {obsConnected && obsScenes.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>
                  Aktif Sahne
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {obsScenes.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSetScene(s)}
                      style={{
                        padding: '4px 10px', fontSize: 12, borderRadius: 6, border: 'none',
                        cursor: 'pointer', fontWeight: obsCurrentScene === s ? 700 : 400,
                        background: obsCurrentScene === s ? '#7c3aed' : '#374151',
                        color: obsCurrentScene === s ? '#fff' : '#9ca3af',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
