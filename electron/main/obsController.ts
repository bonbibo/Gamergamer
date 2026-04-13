import OBSWebSocket from 'obs-websocket-js';

const obs = new OBSWebSocket();
let connected = false;

export async function getSceneList(): Promise<string[]> {
  if (!connected) return [];
  const { scenes } = await obs.call('GetSceneList') as unknown as { scenes: Array<{ sceneName: string }> };
  return scenes.map((s) => s.sceneName);
}

export async function getCurrentScene(): Promise<string | null> {
  if (!connected) return null;
  const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene') as { currentProgramSceneName: string };
  return currentProgramSceneName;
}

export async function connectOBS(address: string, password?: string): Promise<void> {
  await obs.connect(address, password);
  connected = true;
  console.log('[OBS] Connected.');
}

export async function disconnectOBS(): Promise<void> {
  if (connected) {
    await obs.disconnect();
    connected = false;
  }
}

export async function startStreaming(): Promise<void> {
  await obs.call('StartStream');
}

export async function stopStreaming(): Promise<void> {
  await obs.call('StopStream');
}

export async function startRecording(): Promise<void> {
  await obs.call('StartRecord');
}

export async function stopRecording(): Promise<void> {
  await obs.call('StopRecord');
}

export async function setScene(sceneName: string): Promise<void> {
  await obs.call('SetCurrentProgramScene', { sceneName });
}

export function isConnected(): boolean {
  return connected;
}
