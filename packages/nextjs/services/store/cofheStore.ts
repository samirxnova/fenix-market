import { create } from "zustand";

interface CofheState {
  isInitialized: boolean;
  setIsInitialized: (v: boolean) => void;
}

export const useCofheStore = create<CofheState>((set) => ({
  isInitialized: false,
  setIsInitialized: (v) => set({ isInitialized: v }),
}));
