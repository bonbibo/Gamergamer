// All calls go through the Electron preload IPC bridge (window.api)
// This file wraps each call with typed signatures.

declare global {
  interface Window {
    api: {
      // User / Membership
      userRegister: (body: { user_id: string; username: string }) => Promise<{ ok: boolean }>;
      userProfile: (userId: string) => Promise<UserFullProfile>;
      userUpdateProfile: (body: { user_id: string; username: string }) => Promise<{ ok: boolean }>;
      userUpdateSettings: (body: UserSettingsUpdate) => Promise<{ ok: boolean }>;
      // Session
      sessionStart: (body: SessionStartBody) => Promise<SessionStartResult>;
      sessionStop: (body: { session_id: string }) => Promise<SessionStopResult>;
      sessionStats: (sessionId: string) => Promise<SessionStats>;
      sessionEvent: (body: SessionEventBody) => Promise<{ ok: boolean }>;
      sessionList: (userId: string) => Promise<SessionListItem[]>;
      getProfile: (userId: string) => Promise<GamificationProfile>;
      getChallenges: (userId: string) => Promise<Challenge[]>;
      trainingStart: (body: TrainingStartBody) => Promise<{ job_id: string }>;
      trainingStatus: (jobId: string) => Promise<TrainingJob>;
      marketplaceClips: (opts: { userId: string; tier: string }) => Promise<Clip[]>;
      marketplaceExport: (body: ExportBody) => Promise<{ export_id: string }>;
      marketplaceExportStatus: (exportId: string) => Promise<ExportJob>;
      obsConnect: (opts: { address: string; password?: string }) => Promise<void>;
      obsStartStream: () => Promise<void>;
      obsStopStream: () => Promise<void>;
      obsStartRecord: () => Promise<void>;
      obsStopRecord: () => Promise<void>;
      obsSetScene: (name: string) => Promise<void>;
      obsIsConnected: () => Promise<boolean>;
      twitchConnect: (config: TwitchConfig) => Promise<void>;
      twitchDisconnect: () => Promise<void>;
      twitchIsConnected: () => Promise<boolean>;
      onTwitchChat: (handler: (msg: TwitchChatMessage) => void) => () => void;
      health: () => Promise<HealthInfo>;
      openPath: (filePath: string) => Promise<void>;
      // TTS
      ttsSpeak: (opts: { text: string; apiKey: string; voiceId: string }) => Promise<string>;
      // File dialogs
      dialogOpenVrm: () => Promise<string | null>;
    };
  }
}

export interface SessionStartBody {
  user_id: string;
  game: string;
  enable_webcam: boolean;
  username?: string;
}

export interface SessionStartResult {
  session_id: string;
  started_at: number;
}

export interface SessionStopResult {
  session_id: string;
  frames_captured: number;
  duration_ms: number;
}

export interface HealthInfo {
  status: string;
  version: string;
  disk: { data_gb: number; free_gb: number; warn: boolean };
}

export interface SessionListItem {
  id: string;
  game: string;
  status: string;
  frame_count: number;
  duration_ms: number | null;
  started_at: number;
}

export interface SessionStats {
  session_id: string;
  game: string;
  status: string;
  frames: number;
  duration_ms: number | null;
  emotions: Record<string, number>;
}

export interface SessionEventBody {
  session_id: string;
  event: 'kill' | 'death';
  health?: number;
  ammo?: number;
}

export interface GamificationProfile {
  level: number;
  xp: number;
  xp_to_next: number;
  xp_floor: number;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  xp_reward: number;
  condition_type: string;
  condition_threshold: number;
  is_repeatable: boolean;
  progress: number;
  complete: boolean;
  times_completed: number;
}

export interface TrainingStartBody {
  user_id: string;
  session_ids: string[];
  epochs: number;
}

export interface TrainingJob {
  job_id: string;
  status: 'running' | 'done' | 'failed';
  epoch: number;
  total_epochs: number;
  loss: number | null;
  val_loss: number | null;
  error?: string;
  checkpoint?: string;
}

export interface Clip {
  clip_id: string;
  session_id: string;
  game: string;
  start_frame: number;
  end_frame: number;
  duration_s: number;
  tier: string;
  price_usd: number;
}

export interface ExportBody {
  clip_ids: string[];
  tier: string;
  destination: string;
  session_clips: Array<{
    clip_id: string;
    session_id: string;
    start_frame: number;
    end_frame: number;
    tier: string;
  }>;
}

export interface ExportJob {
  export_id: string;
  status: 'packaging' | 'ready' | 'failed';
  path: string | null;
  error?: string;
}

export interface TwitchConfig {
  channel: string;
  username: string;
  oauthToken: string;
}

export interface TwitchChatMessage {
  channel: string;
  username: string;
  message: string;
  color: string;
  timestamp: number;
}

// ─── User / Membership ────────────────────────────────────────────────────────

export interface MembershipTier {
  name: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  color: string;
  threshold: number;
}

export interface UserStats {
  session_count: number;
  total_frames: number;
  total_duration_ms: number;
  total_clips: number;
  estimated_value_usd: number;
  challenges_completed: number;
  dominant_emotion: string | null;
  emotion_distribution: Record<string, number>;
}

export interface UserAccountSettings {
  default_game: string;
  enable_webcam: boolean;
  preferred_tier: string;
  twitch_channel: string | null;
  twitch_username: string | null;
  obs_address: string;
}

export interface UserFullProfile {
  user_id: string;
  username: string;
  created_at: number;
  level: number;
  xp: number;
  xp_to_next: number;
  xp_floor: number;
  membership: MembershipTier;
  stats: UserStats;
  settings: UserAccountSettings;
}

export interface UserSettingsUpdate {
  user_id: string;
  default_game?: string;
  enable_webcam?: boolean;
  preferred_tier?: string;
  twitch_channel?: string;
  twitch_username?: string;
  obs_address?: string;
}

export const api = window.api;
