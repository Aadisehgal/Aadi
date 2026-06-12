import { create } from 'zustand';
import type { InputMode, VoiceMode } from '@apptypes/index';

interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  waveformData: number[];
  inputMode: InputMode;
  voiceMode: VoiceMode;
  autoRestartCount: number;
  continuousMode: boolean;

  setListening: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
  setWaveformData: (data: number[]) => void;
  setInputMode: (mode: InputMode) => void;
  setVoiceMode: (mode: VoiceMode) => void;
  incrementAutoRestart: () => void;
  resetAutoRestart: () => void;
  setContinuousMode: (v: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isListening: false,
  isSpeaking: false,
  waveformData: [],
  inputMode: 'text',
  voiceMode: 'tap',
  autoRestartCount: 0,
  continuousMode: false,

  setListening: (v) => set({ isListening: v }),
  setSpeaking: (v) => set({ isSpeaking: v }),
  setWaveformData: (data) => set({ waveformData: data }),
  setInputMode: (mode) => set({ inputMode: mode }),
  setVoiceMode: (mode) => set({ voiceMode: mode }),
  incrementAutoRestart: () =>
    set((s) => ({ autoRestartCount: s.autoRestartCount + 1 })),
  resetAutoRestart: () => set({ autoRestartCount: 0 }),
  setContinuousMode: (v) => set({ continuousMode: v }),
}));
