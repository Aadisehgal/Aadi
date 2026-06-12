import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import type { AssistantProfile, UserProfile, CuteMode } from '@apptypes/index';

const mmkv = new MMKV({ id: 'settings' });
const SETTINGS_KEY = 'app_settings_v3';

interface SettingsState {
  assistantProfile: AssistantProfile;
  userProfile: UserProfile;
  groqModel: string;
  analyticsEnabled: boolean;
  darkMode: boolean;
  alwaysSpeakResponses: boolean;
  avatarCuteMode: CuteMode;

  setAssistantProfile: (profile: Partial<AssistantProfile>) => void;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  setGroqModel: (model: string) => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setAlwaysSpeakResponses: (v: boolean) => void;
  setAvatarCuteMode: (mode: CuteMode) => void;
  loadSettings: () => void;
  saveSettings: () => void;
  resetSettings: () => void;
}

const DEFAULT_ASSISTANT: AssistantProfile = {
  name: 'MANU',
  personality: 'Jarvis',
  voice: 'nova',
  greeting: 'Hello, how can I assist you?',
  avatar: '',
  voiceEnabled: true,
  avatarEnabled: true,
  streamingEnabled: true,
};

const DEFAULT_USER: UserProfile = {
  name: 'User',
  nickname: '',
  language: 'en-US',
  tone: 'professional',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  assistantProfile: { ...DEFAULT_ASSISTANT },
  userProfile: { ...DEFAULT_USER },
  groqModel: 'llama-3.3-70b-versatile',
  analyticsEnabled: true,
  darkMode: true,
  alwaysSpeakResponses: false,
  avatarCuteMode: 'mild',

  setAssistantProfile: (profile) => {
    set((state) => ({
      assistantProfile: { ...state.assistantProfile, ...profile },
    }));
    get().saveSettings();
  },

  setUserProfile: (profile) => {
    set((state) => ({
      userProfile: { ...state.userProfile, ...profile },
    }));
    get().saveSettings();
  },

  setGroqModel: (model) => {
    set({ groqModel: model });
    // FIX: sync runtime groqService immediately on model change
    import('@services/groqService').then(({ groqService }) => {
      groqService.setModel(model);
    }).catch(() => {});
    get().saveSettings();
  },

  setAnalyticsEnabled: (enabled) => {
    set({ analyticsEnabled: enabled });
    // FIX: actually toggle analyticsService, not just cosmetic
    import('@services/analyticsService').then(({ analyticsService }) => {
      analyticsService.setEnabled(enabled);
    }).catch(() => {});
    get().saveSettings();
  },

  setAlwaysSpeakResponses: (v) => {
    set({ alwaysSpeakResponses: v });
    mmkv.set('alwaysSpeakResponses', v ? 'true' : 'false');
    get().saveSettings();
  },

  setAvatarCuteMode: (mode) => {
    set({ avatarCuteMode: mode });
    mmkv.set('avatarCuteMode', mode);
    get().saveSettings();
  },

  loadSettings: () => {
    try {
      const raw = mmkv.getString(SETTINGS_KEY);
      const alwaysSpeak = mmkv.getString('alwaysSpeakResponses');
      const cuteMode = mmkv.getString('avatarCuteMode') as CuteMode | undefined;

      if (raw) {
        const saved = JSON.parse(raw) as Partial<SettingsState>;
        set({
          assistantProfile: { ...DEFAULT_ASSISTANT, ...(saved.assistantProfile ?? {}) },
          userProfile: { ...DEFAULT_USER, ...(saved.userProfile ?? {}) },
          groqModel: saved.groqModel ?? 'llama-3.3-70b-versatile',
          analyticsEnabled: saved.analyticsEnabled ?? true,
          darkMode: saved.darkMode ?? true,
        });
      }
      if (alwaysSpeak !== undefined) {
        set({ alwaysSpeakResponses: alwaysSpeak === 'true' });
      }
      if (cuteMode) {
        set({ avatarCuteMode: cuteMode });
      }
    } catch {
      // Use defaults
    }
  },

  saveSettings: () => {
    const { assistantProfile, userProfile, groqModel, analyticsEnabled, darkMode } = get();
    try {
      mmkv.set(
        SETTINGS_KEY,
        JSON.stringify({ assistantProfile, userProfile, groqModel, analyticsEnabled, darkMode }),
      );
    } catch {
      // silent
    }
  },

  resetSettings: () => {
    set({
      assistantProfile: { ...DEFAULT_ASSISTANT },
      userProfile: { ...DEFAULT_USER },
      groqModel: 'llama-3.3-70b-versatile',
      analyticsEnabled: true,
      darkMode: true,
      alwaysSpeakResponses: false,
      avatarCuteMode: 'mild',
    });
    mmkv.delete(SETTINGS_KEY);
    mmkv.delete('alwaysSpeakResponses');
    mmkv.delete('avatarCuteMode');
  },
}));
