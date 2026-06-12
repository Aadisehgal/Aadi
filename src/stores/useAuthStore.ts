import { create } from 'zustand';
import EncryptedStorage from 'react-native-encrypted-storage';
import type { AuthMode, VoiceProfile } from '@apptypes/index';

interface AuthState {
  isAuthenticated: boolean;
  authMode: AuthMode;
  pin: string;
  voiceProfiles: VoiceProfile[];
  failedAttempts: number;
  lastFailedAttempt: number;
  cooldownActive: boolean;

  // Actions
  setAuthenticated: (value: boolean) => void;
  setAuthMode: (mode: AuthMode) => void;
  setPin: (pin: string) => void;
  addVoiceProfile: (profile: VoiceProfile) => void;
  removeVoiceProfile: (id: string) => void;
  incrementFailedAttempts: () => void;
  resetFailedAttempts: () => void;
  setCooldownActive: (active: boolean) => void;
  checkCooldown: () => boolean;
  loadAuthState: () => Promise<void>;
  saveAuthState: () => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'auth_state_v2';
const AUTH_PIN_KEY = 'auth_pin';

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  authMode: 'pin',
  pin: '0000',
  voiceProfiles: [],
  failedAttempts: 0,
  lastFailedAttempt: 0,
  cooldownActive: false,

  setAuthenticated: (value) => {
    set({ isAuthenticated: value });
    if (value) get().saveAuthState().catch(() => {});
  },

  setAuthMode: (mode) => {
    set({ authMode: mode });
    get().saveAuthState().catch(() => {});
  },

  setPin: (pin) => {
    set({ pin });
    EncryptedStorage.setItem(AUTH_PIN_KEY, pin).catch(() => {});
    get().saveAuthState().catch(() => {});
  },

  addVoiceProfile: (profile) => {
    set((state) => ({
      voiceProfiles: [
        ...state.voiceProfiles.filter((p) => p.id !== profile.id),
        profile,
      ],
    }));
    get().saveAuthState().catch(() => {});
  },

  removeVoiceProfile: (id) => {
    set((state) => ({
      voiceProfiles: state.voiceProfiles.filter((p) => p.id !== id),
    }));
    get().saveAuthState().catch(() => {});
  },

  incrementFailedAttempts: () => {
    set((state) => ({
      failedAttempts: state.failedAttempts + 1,
      lastFailedAttempt: Date.now(),
    }));
  },

  resetFailedAttempts: () => set({ failedAttempts: 0 }),

  setCooldownActive: (active) => set({ cooldownActive: active }),

  /** Returns true if currently in a cooldown period. */
  checkCooldown: () => {
    const { cooldownActive, lastFailedAttempt } = get();
    if (!cooldownActive) return false;
    const elapsed = Date.now() - lastFailedAttempt;
    if (elapsed >= 30_000) {
      set({ cooldownActive: false, failedAttempts: 0 });
      return false;
    }
    return true;
  },

  loadAuthState: async () => {
    try {
      const [raw, storedPin] = await Promise.all([
        EncryptedStorage.getItem(STORAGE_KEY),
        EncryptedStorage.getItem(AUTH_PIN_KEY).catch(() => null),
      ]);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<AuthState>;
      set({
        authMode: saved.authMode ?? 'pin',
        pin: storedPin ?? saved.pin ?? '0000',
        voiceProfiles: saved.voiceProfiles ?? [],
        // Never persist isAuthenticated — require fresh login
        isAuthenticated: false,
        failedAttempts: 0,
        cooldownActive: false,
      });
    } catch {
      // Corrupt storage — use defaults
    }
  },

  saveAuthState: async () => {
    const { authMode, pin, voiceProfiles } = get();
    try {
      await EncryptedStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ authMode, pin, voiceProfiles })
      );
    } catch {
      // Fail silently
    }
  },

  logout: () => {
    set({ isAuthenticated: false, failedAttempts: 0, cooldownActive: false });
  },
}));
