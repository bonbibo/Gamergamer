import { ipcMain, shell } from 'electron';
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

export function registerIpcHandlers(): void {
  // ── Session ────────────────────────────────────────────────────────────────
  ipcMain.handle('session:start', (_e, body) => apiPost('/session/start', body));
  ipcMain.handle('session:stop', (_e, body) => apiPost('/session/stop', body));
  ipcMain.handle('session:stats', (_e, sessionId) => apiGet(`/session/${sessionId}/stats`));
  ipcMain.handle('session:event', (_e, body) => apiPost('/session/event', body));

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
  ipcMain.handle('obs:isConnected', () => obsController.isConnected());

  // ── Twitch ────────────────────────────────────────────────────────────────
  ipcMain.handle('twitch:connect', (_e, config) => twitchClient.connectTwitch(config));
  ipcMain.handle('twitch:disconnect', () => twitchClient.disconnectTwitch());
  ipcMain.handle('twitch:isConnected', () => twitchClient.isConnected());

  // ── Shell utils ───────────────────────────────────────────────────────────
  ipcMain.handle('shell:openPath', (_e, filePath) => shell.openPath(filePath));
}
