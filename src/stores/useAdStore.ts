import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { AD_UNLOCK_TIMER_SECONDS } from '@utils/constants';
import type { AdFailureLog } from '@apptypes/index';

const mmkv = new MMKV({ id: 'ad-store' });
const PREMIUM_KEY = 'isPremiumUnlocked';
const AD_FAILURE_KEY = 'adFailureLog';

interface AdState {
  isPremiumUnlocked: boolean;
  adFailureLog: AdFailureLog[];
  adUnlockTimerActive: boolean;
  adUnlockSecondsLeft: number;

  setIsPremiumUnlocked: (v: boolean) => void;
  logAdFailure: (reason: string) => void;
  startUnlockTimer: (onComplete: () => void) => void;
  cancelUnlockTimer: () => void;
  loadFromMMKV: () => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;

export const useAdStore = create<AdState>((set, get) => ({
  isPremiumUnlocked: false,
  adFailureLog: [],
  adUnlockTimerActive: false,
  adUnlockSecondsLeft: AD_UNLOCK_TIMER_SECONDS,

  setIsPremiumUnlocked: (v) => {
    set({ isPremiumUnlocked: v });
    mmkv.set(PREMIUM_KEY, v ? 'true' : 'false');
  },

  logAdFailure: (reason) => {
    const entry: AdFailureLog = { reason, timestamp: Date.now() };
    const updated = [...get().adFailureLog, entry];
    set({ adFailureLog: updated });
    try {
      mmkv.set(AD_FAILURE_KEY, JSON.stringify(updated));
    } catch {
      // silent
    }
  },

  startUnlockTimer: (onComplete) => {
    if (timerInterval) clearInterval(timerInterval);
    set({ adUnlockTimerActive: true, adUnlockSecondsLeft: AD_UNLOCK_TIMER_SECONDS });

    timerInterval = setInterval(() => {
      const current = get().adUnlockSecondsLeft;
      if (current <= 1) {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        set({ adUnlockTimerActive: false, adUnlockSecondsLeft: 0 });
        onComplete();
      } else {
        set({ adUnlockSecondsLeft: current - 1 });
      }
    }, 1000);
  },

  cancelUnlockTimer: () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    set({ adUnlockTimerActive: false, adUnlockSecondsLeft: AD_UNLOCK_TIMER_SECONDS });
  },

  loadFromMMKV: () => {
    try {
      const premium = mmkv.getString(PREMIUM_KEY);
      const failLog = mmkv.getString(AD_FAILURE_KEY);
      set({
        isPremiumUnlocked: premium === 'true',
        adFailureLog: failLog ? (JSON.parse(failLog) as AdFailureLog[]) : [],
      });
    } catch {
      // silent
    }
  },
}));
