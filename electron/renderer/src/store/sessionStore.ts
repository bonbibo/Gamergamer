import { create } from 'zustand';

export interface SessionState {
  sessionId: string | null;
  isRecording: boolean;
  frameCount: number;
  currentEmotion: string | null;
  emotionConfidence: number | null;
  userId: string;
  game: string;
  startTime: number | null;

  setSessionId: (id: string | null) => void;
  setRecording: (v: boolean) => void;
  setFrameCount: (n: number) => void;
  setEmotion: (label: string | null, confidence: number | null) => void;
  setGame: (game: string) => void;
  reset: () => void;
}

// Seed immediately with localStorage UUID (sync); main process overrides it
// with the stable file-based ID as soon as IPC resolves (~few ms).
function getLocalUserId(): string {
  const stored = localStorage.getItem('gamergamer_user_id');
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem('gamergamer_user_id', id);
  return id;
}

export const useSessionStore = create<SessionState>((set) => {
  // Fetch stable userId from main process and sync localStorage + store
  window.api?.getUserId?.().then((id: string) => {
    if (id) {
      localStorage.setItem('gamergamer_user_id', id);
      set({ userId: id });
    }
  }).catch(() => {});

  return {
    sessionId: null,
    isRecording: false,
    frameCount: 0,
    currentEmotion: null,
    emotionConfidence: null,
    userId: getLocalUserId(),
    game: 'valorant',
    startTime: null,

    setSessionId: (id) => set({ sessionId: id, startTime: id ? Date.now() : null }),
    setRecording: (v) => set({ isRecording: v }),
    setFrameCount: (n) => set({ frameCount: n }),
    setEmotion: (label, confidence) => set({ currentEmotion: label, emotionConfidence: confidence }),
    setGame: (game) => set({ game }),
    reset: () => set({ sessionId: null, isRecording: false, frameCount: 0, currentEmotion: null, emotionConfidence: null }),
  };
});
