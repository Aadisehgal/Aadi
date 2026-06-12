import Tts from 'react-native-tts';

type TTSEvent = { utteranceId?: string | number };

class TTSService {
  private speaking = false;
  private amplitude = 0;
  private amplitudeTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await Tts.getInitStatus();
      Tts.setDefaultRate(0.52);
      Tts.setDefaultPitch(1.0);
      Tts.setDefaultLanguage('en-US');
      Tts.addEventListener('tts-start', (_e: TTSEvent) => this.onStart());
      Tts.addEventListener('tts-finish', (_e: TTSEvent) => this.onFinish());
      Tts.addEventListener('tts-cancel', (_e: TTSEvent) => this.onFinish());
      this.initialized = true;
    } catch {
      // TTS not available on this device — degrade gracefully
    }
  }

  private onStart() {
    this.speaking = true;
    this.startAmplitudeSimulation();
    // Sync Zustand store so isSpeaking is always accurate even on Android TTS events
    try {
      const { useVoiceStore } = require('@stores/useVoiceStore') as { useVoiceStore: { getState: () => { setSpeaking: (v: boolean) => void } } };
      useVoiceStore.getState().setSpeaking(true);
    } catch { /* store not ready */ }
  }

  private onFinish() {
    this.speaking = false;
    this.amplitude = 0;
    // Sync Zustand store — handles case where Android interrupts TTS externally
    try {
      const { useVoiceStore } = require('@stores/useVoiceStore') as { useVoiceStore: { getState: () => { setSpeaking: (v: boolean) => void } } };
      useVoiceStore.getState().setSpeaking(false);
    } catch { /* store not ready */ }
    this.stopAmplitudeSimulation();
  }

  /**
   * Simulate amplitude via a sine wave while TTS is active.
   * Real amplitude requires a native audio callback; this gives
   * realistic lip-sync behaviour without native bridge changes.
   */
  private startAmplitudeSimulation() {
    this.stopAmplitudeSimulation();
    let t = 0;
    this.amplitudeTimer = setInterval(() => {
      if (!this.speaking) { this.amplitude = 0; return; }
      // Modulated sine: fast vibration + slow envelope
      const envelope = 0.5 + 0.5 * Math.sin(t * 0.8);
      const vibration = 0.5 + 0.5 * Math.sin(t * 12);
      this.amplitude = envelope * vibration * 0.9;
      t += 0.15;
    }, 50);
  }

  private stopAmplitudeSimulation() {
    if (this.amplitudeTimer) {
      clearInterval(this.amplitudeTimer);
      this.amplitudeTimer = null;
    }
  }

  async speak(text: string): Promise<void> {
    await this.init();
    try {
      await Tts.stop();
      await Tts.speak(text);
    } catch {
      // Degrade silently
    }
  }

  async stop(): Promise<void> {
    try {
      await Tts.stop();
    } catch {
      // ignore
    }
    this.onFinish();
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  getCurrentAmplitude(): number {
    return this.speaking ? this.amplitude : 0;
  }

  async setRate(rate: number): Promise<void> {
    try { Tts.setDefaultRate(rate); } catch { /* ignore */ }
  }

  async setPitch(pitch: number): Promise<void> {
    try { Tts.setDefaultPitch(pitch); } catch { /* ignore */ }
  }
}

export const ttsService = new TTSService();
