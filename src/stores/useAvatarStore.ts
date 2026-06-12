import { create } from 'zustand';

type AnimationState = 'idle' | 'talking' | 'blinking';

interface AvatarState {
  modelPath: string;
  animationState: AnimationState;
  lipSyncValue: number;
  isTalking: boolean;
  useFallback: boolean;
  glbError: boolean;

  setModelPath: (path: string) => void;
  setAnimationState: (state: AnimationState) => void;
  setLipSyncValue: (value: number) => void;
  setIsTalking: (talking: boolean) => void;
  setUseFallback: (use: boolean) => void;
  setGlbError: (error: boolean) => void;
}

export const useAvatarStore = create<AvatarState>((set) => ({
  modelPath: '',
  animationState: 'idle',
  lipSyncValue: 0,
  isTalking: false,
  // Default to SVG fallback — no GLB files bundled in this build
  useFallback: true,
  glbError: false,

  setModelPath: (path) => set({ modelPath: path }),
  setAnimationState: (state) => set({ animationState: state }),
  setLipSyncValue: (value) =>
    set({ lipSyncValue: Math.max(0, Math.min(1, value)) }),
  setIsTalking: (talking) =>
    set({ isTalking: talking, animationState: talking ? 'talking' : 'idle' }),
  setUseFallback: (use) => set({ useFallback: use }),
  setGlbError: (error) => set({ glbError: error, useFallback: error }),
}));
