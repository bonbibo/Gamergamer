import tmi from 'tmi.js';

let client: tmi.Client | null = null;

export interface TwitchConfig {
  channel: string;
  username: string;
  oauthToken: string;
}

export async function connectTwitch(config: TwitchConfig): Promise<void> {
  client = new tmi.Client({
    identity: { username: config.username, password: config.oauthToken },
    channels: [config.channel],
  });
  await client.connect();
  console.log('[Twitch] Connected to channel:', config.channel);
}

export async function disconnectTwitch(): Promise<void> {
  if (client) {
    await client.disconnect();
    client = null;
  }
}

export function onChatMessage(handler: (channel: string, userstate: tmi.ChatUserstate, message: string, self: boolean) => void): void {
  client?.on('message', handler);
}

export function sendMessage(channel: string, message: string): void {
  client?.say(channel, message);
}

export function isConnected(): boolean {
  return client !== null;
}
