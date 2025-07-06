import { create } from "zustand";

interface AppState {
    initialized: boolean;
    clangdEnabled: boolean;
    setInitialized: (value: boolean) => void;
    setClangdEnabled: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
    initialized: false,
    setInitialized: (value: boolean) => set({ initialized: value }),
    clangdEnabled: false,
    setClangdEnabled: (value: boolean) => set({ clangdEnabled: value }),
}));
