import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Session
  sessionStart: (body: unknown) => ipcRenderer.invoke('session:start', body),
  sessionStop: (body: unknown) => ipcRenderer.invoke('session:stop', body),
  sessionStats: (sessionId: string) => ipcRenderer.invoke('session:stats', sessionId),
  sessionEvent: (body: unknown) => ipcRenderer.invoke('session:event', body),
  sessionList: (userId: string) => ipcRenderer.invoke('session:list', userId),

  // User / Membership
  userRegister: (body: unknown) => ipcRenderer.invoke('user:register', body),
  userProfile: (userId: string) => ipcRenderer.invoke('user:profile', userId),
  userUpdateProfile: (body: unknown) => ipcRenderer.invoke('user:updateProfile', body),
  userUpdateSettings: (body: unknown) => ipcRenderer.invoke('user:updateSettings', body),

  // Gamification
  getProfile: (userId: string) => ipcRenderer.invoke('gamification:profile', userId),
  getChallenges: (userId: string) => ipcRenderer.invoke('gamification:challenges', userId),

  // Training
  trainingStart: (body: unknown) => ipcRenderer.invoke('training:start', body),
  trainingStatus: (jobId: string) => ipcRenderer.invoke('training:status', jobId),

  // Marketplace
  marketplaceClips: (opts: { userId: string; tier: string }) =>
    ipcRenderer.invoke('marketplace:clips', opts),
  marketplaceExport: (body: unknown) => ipcRenderer.invoke('marketplace:export', body),
  marketplaceExportStatus: (exportId: string) =>
    ipcRenderer.invoke('marketplace:exportStatus', exportId),

  // OBS
  obsConnect: (opts: { address: string; password?: string }) =>
    ipcRenderer.invoke('obs:connect', opts),
  obsStartStream: () => ipcRenderer.invoke('obs:startStream'),
  obsStopStream: () => ipcRenderer.invoke('obs:stopStream'),
  obsStartRecord: () => ipcRenderer.invoke('obs:startRecord'),
  obsStopRecord: () => ipcRenderer.invoke('obs:stopRecord'),
  obsSetScene: (name: string) => ipcRenderer.invoke('obs:setScene', name),
  obsIsConnected: () => ipcRenderer.invoke('obs:isConnected'),

  // Twitch
  twitchConnect: (config: unknown) => ipcRenderer.invoke('twitch:connect', config),
  twitchDisconnect: () => ipcRenderer.invoke('twitch:disconnect'),
  twitchIsConnected: () => ipcRenderer.invoke('twitch:isConnected'),

  // Shell
  openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),

  // TTS
  ttsSpeak: (opts: { text: string; apiKey: string; voiceId: string }) =>
    ipcRenderer.invoke('tts:speak', opts),

  // File dialogs
  dialogOpenVrm: () => ipcRenderer.invoke('dialog:openVrm'),
});
