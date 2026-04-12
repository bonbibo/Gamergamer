import { create } from 'zustand';

interface StreamState {
  obsConnected: boolean;
  twitchConnected: boolean;
  isStreaming: boolean;
  setObsConnected: (v: boolean) => void;
  setTwitchConnected: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  obsConnected: false,
  twitchConnected: false,
  isStreaming: false,
  setObsConnected: (v) => set({ obsConnected: v }),
  setTwitchConnected: (v) => set({ twitchConnected: v }),
  setStreaming: (v) => set({ isStreaming: v }),
}));
