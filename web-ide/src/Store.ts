import { create } from 'zustand';

interface AppState {
    initialized: boolean;
    setInitialized: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
    initialized: false,
    setInitialized: (value: boolean) => set({ initialized: value }),
}));