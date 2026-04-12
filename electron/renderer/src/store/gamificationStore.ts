import { create } from 'zustand';
import type { Challenge, GamificationProfile } from '../api/pythonApi';

interface GamificationState {
  profile: GamificationProfile | null;
  challenges: Challenge[];
  setProfile: (p: GamificationProfile) => void;
  setChallenges: (c: Challenge[]) => void;
  applyXpEvent: (newTotal: number, level: number) => void;
}

export const useGamificationStore = create<GamificationState>((set) => ({
  profile: null,
  challenges: [],
  setProfile: (profile) => set({ profile }),
  setChallenges: (challenges) => set({ challenges }),
  applyXpEvent: (newTotal, level) =>
    set((state) => ({
      profile: state.profile
        ? { ...state.profile, xp: newTotal, level }
        : { xp: newTotal, level, xp_to_next: 0 },
    })),
}));
