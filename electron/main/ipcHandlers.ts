import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'path';
import * as obsController from './obsController';
import * as twitchClient from './twitchClient';

const API_BASE = 'http://localhost:8765';

async function apiPost(endpoint: string, body: unknown) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiGet(endpoint: string) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPut(endpoint: string, body: unknown) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiDelete(endpoint: string) {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function registerIpcHandlers(): void {
  // ── Health ────────────────────────────────────────────────────────────────
  ipcMain.handle('health', () => apiGet('/health'));

  // ── Session ────────────────────────────────────────────────────────────────
  ipcMain.handle('session:start', (_e, body) => apiPost('/session/start', body));
  ipcMain.handle('session:stop', (_e, body) => apiPost('/session/stop', body));
  ipcMain.handle('session:stats', (_e, sessionId) => apiGet(`/session/${sessionId}/stats`));
  ipcMain.handle('session:event', (_e, body) => apiPost('/session/event', body));
  ipcMain.handle('session:list', (_e, userId) => apiGet(`/session/list?user_id=${userId}`));
  ipcMain.handle('session:delete', (_e, { sessionId, userId }: { sessionId: string; userId: string }) =>
    apiDelete(`/session/${sessionId}?user_id=${userId}`),
  );

  // ── User / Membership ─────────────────────────────────────────────────────
  ipcMain.handle('user:register', (_e, body) => apiPost('/user/register', body));
  ipcMain.handle('user:profile', (_e, userId) => apiGet(`/user/profile?user_id=${userId}`));
  ipcMain.handle('user:updateProfile', (_e, body) => apiPut('/user/profile', body));
  ipcMain.handle('user:settings', (_e, userId) => apiGet(`/user/settings?user_id=${userId}`));
  ipcMain.handle('user:updateSettings', (_e, body) => apiPut('/user/settings', body));

  // ── Gamification ───────────────────────────────────────────────────────────
  ipcMain.handle('gamification:profile', (_e, userId) => apiGet(`/gamification/profile?user_id=${userId}`));
  ipcMain.handle('gamification:challenges', (_e, userId) => apiGet(`/gamification/challenges?user_id=${userId}`));

  // ── Training ───────────────────────────────────────────────────────────────
  ipcMain.handle('training:start', (_e, body) => apiPost('/training/start', body));
  ipcMain.handle('training:status', (_e, jobId) => apiGet(`/training/status/${jobId}`));

  // ── Marketplace ────────────────────────────────────────────────────────────
  ipcMain.handle('marketplace:clips', (_e, { userId, tier }) =>
    apiGet(`/marketplace/clips?user_id=${userId}&tier=${tier}`),
  );
  ipcMain.handle('marketplace:export', (_e, body) => apiPost('/marketplace/export', body));
  ipcMain.handle('marketplace:exportStatus', (_e, exportId) =>
    apiGet(`/marketplace/export/${exportId}/status`),
  );

  // ── OBS ───────────────────────────────────────────────────────────────────
  ipcMain.handle('obs:connect', (_e, { address, password }) =>
    obsController.connectOBS(address, password),
  );
  ipcMain.handle('obs:startStream', () => obsController.startStreaming());
  ipcMain.handle('obs:stopStream', () => obsController.stopStreaming());
  ipcMain.handle('obs:startRecord', () => obsController.startRecording());
  ipcMain.handle('obs:stopRecord', () => obsController.stopRecording());
  ipcMain.handle('obs:setScene', (_e, sceneName) => obsController.setScene(sceneName));
  ipcMain.handle('obs:getSceneList', () => obsController.getSceneList());
  ipcMain.handle('obs:getCurrentScene', () => obsController.getCurrentScene());
  ipcMain.handle('obs:isConnected', () => obsController.isConnected());

  // ── Twitch ────────────────────────────────────────────────────────────────
  ipcMain.handle('twitch:connect', async (_e, config) => {
    await twitchClient.connectTwitch(config);
    // Forward chat messages to the renderer as IPC push events
    twitchClient.onChatMessage((channel, userstate, message, self) => {
      if (self) return;
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('twitch:chat', {
        channel,
        username: userstate['display-name'] || userstate.username || 'viewer',
        message,
        color: userstate.color ?? '#9ca3af',
        timestamp: Date.now(),
      });
    });
  });
  ipcMain.handle('twitch:disconnect', () => twitchClient.disconnectTwitch());
  ipcMain.handle('twitch:isConnected', () => twitchClient.isConnected());

  // ── Shell utils ───────────────────────────────────────────────────────────
  ipcMain.handle('shell:openPath', (_e, filePath) => shell.openPath(filePath));

  // ── ElevenLabs TTS ────────────────────────────────────────────────────────
  ipcMain.handle('tts:speak', async (_e, { text, apiKey, voiceId }: { text: string; apiKey: string; voiceId: string }) => {
    if (!text.trim() || !apiKey) throw new Error('text and apiKey required');
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId ?? 'EXAVITQu4vr4xnSDxMaL'}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs error ${res.status}: ${errText}`);
    }
    // Return audio as base64 so renderer can play it via Audio API
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString('base64');
  });

  // ── File dialogs ──────────────────────────────────────────────────────────
  ipcMain.handle('dialog:openVrm', async () => {
    const result = await dialog.showOpenDialog({
      title: 'VRM Avatar Seç',
      filters: [{ name: 'VRM Avatar', extensions: ['vrm'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
