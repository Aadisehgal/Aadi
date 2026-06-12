/**
 * STT Service — wraps react-native-voice with a clean async API.
 * Handles permission check, locale config, and event forwarding.
 */
import Voice, {
  type SpeechResultsEvent,
  type SpeechErrorEvent,
  type SpeechVolumeChangeEvent,
} from '@react-native-voice/voice';
import { PermissionsAndroid, Platform } from 'react-native';

type STTCallbacks = {
  onResult: (text: string) => void;
  onVolumeChange: (amplitude: number) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

class STTService {
  private callbacks: STTCallbacks | null = null;
  private listening = false;

  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'MANU AI needs microphone access to hear your voice commands.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  async start(locale: string, callbacks: STTCallbacks): Promise<void> {
    if (this.listening) return;

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      callbacks.onError('Microphone permission denied.');
      return;
    }

    this.callbacks = callbacks;

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0];
      if (text && text.trim()) {
        this.callbacks?.onResult(text.trim());
      }
    };

    Voice.onSpeechVolumeChanged = (e: SpeechVolumeChangeEvent) => {
      this.callbacks?.onVolumeChange(e.value ?? 0);
    };

    Voice.onSpeechEnd = () => {
      this.listening = false;
      this.callbacks?.onEnd();
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      this.listening = false;
      this.callbacks?.onError(e.error?.message ?? 'Speech recognition error');
    };

    try {
      await Voice.start(locale);
      this.listening = true;
    } catch (e) {
      this.listening = false;
      callbacks.onError(e instanceof Error ? e.message : 'Failed to start STT');
    }
  }

  async stop(): Promise<void> {
    try {
      await Voice.stop();
    } catch {
      // ignore
    }
    this.listening = false;
  }

  async destroy(): Promise<void> {
    try {
      await Voice.destroy();
      Voice.removeAllListeners();
    } catch {
      // ignore
    }
    this.listening = false;
    this.callbacks = null;
  }

  isListening(): boolean {
    return this.listening;
  }
}

export const sttService = new STTService();
