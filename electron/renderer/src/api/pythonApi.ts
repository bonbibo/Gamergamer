// All calls go through the Electron preload IPC bridge (window.api)
// This file wraps each call with typed signatures.

declare global {
  interface Window {
    api: {
      sessionStart: (body: SessionStartBody) => Promise<SessionStartResult>;
      sessionStop: (body: { session_id: string }) => Promise<SessionStopResult>;
      sessionStats: (sessionId: string) => Promise<SessionStats>;
      sessionEvent: (body: SessionEventBody) => Promise<{ ok: boolean }>;
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
      openPath: (filePath: string) => Promise<void>;
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

export const api = window.api;
