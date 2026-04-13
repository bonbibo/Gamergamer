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
    set((state) => {
      if (!state.profile) return {};
      // Recompute xp_floor for the new level using the same formula as the server
      const xpFloor = Math.floor(100 * Math.pow(level, 1.8));
      const xpCeil = Math.floor(100 * Math.pow(level + 1, 1.8));
      return {
        profile: {
          ...state.profile,
          xp: newTotal,
          level,
          xp_to_next: Math.max(0, xpCeil - newTotal),
          xp_floor: xpFloor,
        },
      };
    }),
}));
