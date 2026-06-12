import { useEffect, useRef, useCallback } from 'react';
import { useVoiceStore } from '@stores/useVoiceStore';
import { useSettingsStore } from '@stores/useSettingsStore';
import { useChat } from '@hooks/useChat';
import { sttService } from '@services/sttService';
import {
  MAX_AUTO_RESTARTS,
  VAD_AMPLITUDE_THRESHOLD,
  VAD_SILENCE_TIMEOUT,
} from '@utils/constants';

export function useVoice() {
  const voiceStore = useVoiceStore();
  const settingsStore = useSettingsStore();
  const { sendMessage } = useChat();
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAmplitudeRef = useRef<number>(0);

  // Ref-based stable references to avoid stale closures in sttService callbacks
  const sendMessageRef = useRef(sendMessage);
  const voiceStoreRef = useRef(voiceStore);
  const settingsStoreRef = useRef(settingsStore);
  // startListening ref — set after definition to break circular dep
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);

  // Keep refs in sync every render
  sendMessageRef.current = sendMessage;
  voiceStoreRef.current = voiceStore;
  settingsStoreRef.current = settingsStore;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(async () => {
    clearSilenceTimer();
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }
    await sttService.stop();
    voiceStoreRef.current.setListening(false);
    voiceStoreRef.current.setWaveformData([]);
  }, [clearSilenceTimer]);

  const startListening = useCallback(async () => {
    const vs = voiceStoreRef.current;
    const ss = settingsStoreRef.current;

    if (vs.isSpeaking) return;
    if (vs.isListening) return;

    const locale = ss.userProfile.language ?? 'en-US';

    vs.setInputMode('voice');
    vs.setListening(true);

    // Waveform sampling every 100ms
    waveformIntervalRef.current = setInterval(() => {
      const amp = lastAmplitudeRef.current;
      voiceStoreRef.current.setWaveformData(
        Array.from({ length: 20 }, (_, i) =>
          Math.max(0, amp + (Math.random() - 0.5) * 0.05 * (i % 3 === 0 ? 2 : 1)),
        ),
      );
    }, 100);

    await sttService.start(locale, {
      onResult: (text) => {
        clearSilenceTimer();
        stopListening().then(() => {
          sendMessageRef.current(text, 'voice').catch(() => {});
        });
      },
      onVolumeChange: (amp) => {
        lastAmplitudeRef.current = amp;
        if (amp < VAD_AMPLITUDE_THRESHOLD) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              sttService.stop().catch(() => {});
              voiceStoreRef.current.setListening(false);
            }, VAD_SILENCE_TIMEOUT);
          }
        } else {
          clearSilenceTimer();
        }
      },
      onEnd: () => {
        clearSilenceTimer();
        if (waveformIntervalRef.current) {
          clearInterval(waveformIntervalRef.current);
          waveformIntervalRef.current = null;
        }
        const currentVs = voiceStoreRef.current;
        currentVs.setListening(false);

        // Auto-restart: use ref to avoid circular dependency
        if (
          currentVs.continuousMode &&
          currentVs.autoRestartCount < MAX_AUTO_RESTARTS &&
          !currentVs.isSpeaking
        ) {
          currentVs.incrementAutoRestart();
          setTimeout(() => {
            startListeningRef.current?.();
          }, 300);
        }
      },
      onError: () => {
        clearSilenceTimer();
        if (waveformIntervalRef.current) {
          clearInterval(waveformIntervalRef.current);
          waveformIntervalRef.current = null;
        }
        voiceStoreRef.current.setListening(false);
      },
    });
  }, [clearSilenceTimer, stopListening]);

  // Keep startListeningRef in sync
  startListeningRef.current = startListening;

  // Pause STT during TTS
  useEffect(() => {
    if (voiceStore.isSpeaking && voiceStore.isListening) {
      stopListening().catch(() => {});
    }
  }, [voiceStore.isSpeaking, voiceStore.isListening, stopListening]);

  // Reset auto-restart counter when TTS ends
  useEffect(() => {
    if (!voiceStore.isSpeaking) {
      voiceStore.resetAutoRestart();
    }
  }, [voiceStore.isSpeaking, voiceStore]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
      sttService.destroy().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isListening: voiceStore.isListening,
    isSpeaking: voiceStore.isSpeaking,
    waveformData: voiceStore.waveformData,
    voiceMode: voiceStore.voiceMode,
    startListening,
    stopListening,
  };
}
