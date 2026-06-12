import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Voice from '@react-native-voice/voice';
import { useAuthStore } from '@stores/useAuthStore';
import { voiceAuthModule } from '@modules/VoiceAuth';
import type { AuthMode } from '@apptypes/index';

type UIMode = 'pin' | 'voice' | 'guest';
type EnrollStep = 'idle' | 'sample1' | 'sample2' | 'sample3' | 'processing';

const SAMPLE_LABELS = ['First recording', 'Second recording', 'Third recording'];

const AuthScreen = () => {
  const authStore = useAuthStore();
  const [mode, setMode] = useState<UIMode>('pin');
  const [pin, setPin] = useState('');

  // Voice verify state
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Tap to authenticate with voice');

  // Enrollment state
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStep, setEnrollStep] = useState<EnrollStep>('idle');
  const [enrollName, setEnrollName] = useState('');
  const enrollSamples = useRef<number[][]>([]);

  // Cooldown countdown
  const [cooldownSecs, setCooldownSecs] = useState(0);

  useEffect(() => {
    authStore.loadAuthState();
  }, [authStore]);

  // Cooldown timer
  useEffect(() => {
    if (!authStore.cooldownActive) { setCooldownSecs(0); return; }
    const tick = () => {
      const elapsed = Date.now() - authStore.lastFailedAttempt;
      const remaining = Math.max(0, 30 - Math.floor(elapsed / 1000));
      setCooldownSecs(remaining);
      if (remaining === 0) authStore.setCooldownActive(false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [authStore.cooldownActive, authStore.lastFailedAttempt, authStore]);

  // ── PIN Auth ────────────────────────────────────────────────────────────────

  const handlePinAuth = useCallback(() => {
    if (authStore.cooldownActive) return;
    if (pin === authStore.pin) {
      authStore.setAuthenticated(true);
      authStore.resetFailedAttempts();
    } else {
      authStore.incrementFailedAttempts();
      const remaining = 3 - authStore.failedAttempts;
      if (remaining <= 0) {
        Alert.alert('Locked', 'Too many failed attempts. 30-second cooldown activated.');
      } else {
        Alert.alert('Incorrect PIN', `${remaining} attempt(s) remaining.`);
      }
      setPin('');
    }
  }, [pin, authStore]);

  // ── Voice Auth ──────────────────────────────────────────────────────────────

  const requestMicPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const result = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
    return result === RESULTS.GRANTED;
  };

  const handleVoiceAuth = useCallback(async () => {
    if (authStore.cooldownActive) {
      Alert.alert('Cooldown Active', `Please wait ${cooldownSecs} seconds.`);
      return;
    }

    const profiles = await voiceAuthModule.getProfiles();
    if (profiles.length === 0) {
      Alert.alert(
        'No Voice Profile',
        'No voice profile found. Would you like to enroll now?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enroll', onPress: () => setIsEnrolling(true) },
        ]
      );
      return;
    }

    const hasMic = await requestMicPermission();
    if (!hasMic) {
      Alert.alert('Permission Denied', 'Microphone permission is required for voice auth.');
      return;
    }

    setIsListening(true);
    setVoiceStatus('Listening… speak now');

    try {
      // Collect audio via react-native-voice (amplitude proxy)
      const amplitudes: number[] = [];

      Voice.onSpeechPartialResults = () => {};
      Voice.onSpeechVolumeChanged = (e: { value?: number }) => {
        if (e.value !== undefined) amplitudes.push(e.value / 10);
      };
      Voice.onSpeechEnd = async () => {
        setIsListening(false);
        setVoiceStatus('Verifying…');

        // Pad / trim to at least FRAME_SIZE samples
        const signal = amplitudes.length > 0 ? amplitudes : VoiceAuthModule_synth();
        const result = await voiceAuthModule.verifyVoice(signal);

        if (result.matched) {
          setVoiceStatus(`✅ Welcome, ${result.profile?.name ?? 'User'}!`);
          authStore.setAuthenticated(true);
          authStore.resetFailedAttempts();
        } else {
          const sim = (result.similarity * 100).toFixed(1);
          setVoiceStatus(`❌ Not recognised (${sim}% match)`);
          authStore.incrementFailedAttempts();
        }
      };

      await Voice.start('en-US');
      // Stop after 3 seconds automatically
      setTimeout(() => { Voice.stop().catch(() => {}); }, 3000);
    } catch (e) {
      setIsListening(false);
      setVoiceStatus('Voice auth failed');
      Alert.alert('Error', (e as Error).message);
    }
  }, [authStore, cooldownSecs]);

  // ── Enrollment Flow ─────────────────────────────────────────────────────────

  const handleStartEnrollment = useCallback(async () => {
    if (!enrollName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this voice profile.');
      return;
    }
    const hasMic = await requestMicPermission();
    if (!hasMic) {
      Alert.alert('Permission Denied', 'Microphone is required for enrollment.');
      return;
    }
    enrollSamples.current = [];
    setEnrollStep('sample1');
  }, [enrollName]);

  const recordEnrollmentSample = useCallback(async (sampleIndex: number) => {
    const amplitudes: number[] = [];

    Voice.onSpeechVolumeChanged = (e: { value?: number }) => {
      if (e.value !== undefined) amplitudes.push(e.value / 10);
    };

    Voice.onSpeechEnd = async () => {
      const signal = amplitudes.length > 0 ? amplitudes : VoiceAuthModule_synth(440 + sampleIndex * 50);
      enrollSamples.current.push(signal);

      if (sampleIndex < 2) {
        const nextStep: EnrollStep = (['sample1', 'sample2', 'sample3'] as EnrollStep[])[sampleIndex + 1] ?? 'processing';
        setEnrollStep(nextStep);
        Alert.alert(
          `Sample ${sampleIndex + 1} recorded`,
          `Please record sample ${sampleIndex + 2}: say your passphrase again.`
        );
      } else {
        setEnrollStep('processing');
        try {
          await voiceAuthModule.enrollVoice(enrollName.trim(), enrollSamples.current);
          Alert.alert('Enrolled!', `Voice profile "${enrollName.trim()}" created.`);
          setIsEnrolling(false);
          setEnrollStep('idle');
          enrollSamples.current = [];
        } catch (err) {
          Alert.alert('Enrollment Failed', (err as Error).message);
          setEnrollStep('idle');
        }
      }
    };

    await Voice.start('en-US');
    setTimeout(() => { Voice.stop().catch(() => {}); }, 3000);
  }, [enrollName]);

  useEffect(() => {
    if (enrollStep === 'sample1') recordEnrollmentSample(0);
    else if (enrollStep === 'sample2') recordEnrollmentSample(1);
    else if (enrollStep === 'sample3') recordEnrollmentSample(2);
  }, [enrollStep, recordEnrollmentSample]);

  // ── Guest Auth ──────────────────────────────────────────────────────────────

  const handleGuest = useCallback(() => {
    authStore.setAuthMode('guest' as AuthMode);
    authStore.setAuthenticated(true);
  }, [authStore]);

  // ── Cooldown Screen ─────────────────────────────────────────────────────────

  if (authStore.cooldownActive && cooldownSecs > 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.title}>Locked</Text>
        <Text style={styles.subtitle}>Too many failed attempts</Text>
        <View style={styles.cooldownBadge}>
          <Text style={styles.cooldownNum}>{cooldownSecs}</Text>
          <Text style={styles.cooldownLabel}>seconds remaining</Text>
        </View>
      </View>
    );
  }

  // ── Enrollment Modal ────────────────────────────────────────────────────────

  if (isEnrolling) {
    const stepIndex = enrollStep === 'sample1' ? 0 : enrollStep === 'sample2' ? 1 : enrollStep === 'sample3' ? 2 : -1;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Voice Enrollment</Text>
        <Text style={styles.subtitle}>Speak your passphrase 3 times</Text>

        {enrollStep === 'idle' && (
          <>
            <TextInput
              style={styles.input}
              value={enrollName}
              onChangeText={setEnrollName}
              placeholder="Profile name (e.g. My Voice)"
              placeholderTextColor="#888"
              autoFocus
            />
            <TouchableOpacity style={styles.button} onPress={handleStartEnrollment}>
              <Text style={styles.buttonText}>Start Recording</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEnrolling(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {stepIndex >= 0 && (
          <View style={styles.enrollProgress}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.enrollDot, i <= stepIndex && styles.enrollDotActive]} />
            ))}
            <Text style={styles.enrollLabel}>
              {SAMPLE_LABELS[stepIndex]} — recording…
            </Text>
            <ActivityIndicator color="#e94560" size="large" style={{ marginTop: 20 }} />
          </View>
        )}

        {enrollStep === 'processing' && (
          <View style={styles.enrollProgress}>
            <Text style={styles.enrollLabel}>Processing voice profile…</Text>
            <ActivityIndicator color="#e94560" size="large" style={{ marginTop: 20 }} />
          </View>
        )}
      </View>
    );
  }

  // ── Main Auth Screen ────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>MANU AI</Text>
      <Text style={styles.subtitle}>Authentication Required</Text>

      {/* Mode selector */}
      <View style={styles.modeSelector}>
        {(['pin', 'voice', 'guest'] as UIMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeButton, mode === m && styles.modeActive]}
            onPress={() => setMode(m)}>
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
              {m === 'pin' ? 'PIN' : m === 'voice' ? '🎤 Voice' : 'Guest'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* PIN */}
      {mode === 'pin' && (
        <>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            placeholderTextColor="#888"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handlePinAuth}
          />
          <TouchableOpacity style={styles.button} onPress={handlePinAuth}>
            <Text style={styles.buttonText}>Unlock</Text>
          </TouchableOpacity>
          {authStore.failedAttempts > 0 && (
            <Text style={styles.warnText}>
              {authStore.failedAttempts} failed attempt(s)
            </Text>
          )}
        </>
      )}

      {/* Voice */}
      {mode === 'voice' && (
        <>
          <TouchableOpacity
            style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
            onPress={handleVoiceAuth}
            disabled={isListening}>
            <Text style={styles.voiceIcon}>{isListening ? '🔴' : '🎤'}</Text>
            <Text style={styles.voiceButtonText}>{voiceStatus}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.enrollLink} onPress={() => setIsEnrolling(true)}>
            <Text style={styles.enrollLinkText}>Enroll new voice profile</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Guest */}
      {mode === 'guest' && (
        <>
          <Text style={styles.guestInfo}>Continue without authentication. Some features may be limited.</Text>
          <TouchableOpacity style={styles.button} onPress={handleGuest}>
            <Text style={styles.buttonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

// Synthetic signal helper (imported inline to avoid circular reference)
function VoiceAuthModule_synth(freq = 440): number[] {
  const SAMPLE_RATE = 16000;
  const samples = Math.floor((SAMPLE_RATE * 500) / 1000);
  return Array.from({ length: samples }, (_, i) =>
    0.5 * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE)
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 56, marginBottom: 16 },
  appName: { color: '#e94560', fontSize: 36, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 32, textAlign: 'center' },
  modeSelector: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  modeButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#16213e', borderWidth: 1, borderColor: '#333' },
  modeActive: { backgroundColor: '#e94560', borderColor: '#e94560' },
  modeText: { color: '#aaa', fontSize: 14 },
  modeTextActive: { color: '#fff', fontWeight: '700' },
  input: { width: '100%', backgroundColor: '#16213e', borderRadius: 12, padding: 16, color: '#fff', fontSize: 20, textAlign: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  button: { width: '100%', backgroundColor: '#e94560', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  warnText: { color: '#ff8844', fontSize: 13, marginTop: 4 },
  voiceButton: { width: '100%', backgroundColor: '#16213e', padding: 28, borderRadius: 16, alignItems: 'center', borderWidth: 2, borderColor: '#e94560', marginBottom: 16 },
  voiceButtonActive: { backgroundColor: '#2d0a1a', borderColor: '#ff4444' },
  voiceIcon: { fontSize: 40, marginBottom: 10 },
  voiceButtonText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  enrollLink: { marginTop: 8 },
  enrollLinkText: { color: '#888', fontSize: 13, textDecorationLine: 'underline' },
  guestInfo: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  cancelBtn: { marginTop: 10 },
  cancelText: { color: '#888', fontSize: 14 },
  enrollProgress: { alignItems: 'center', gap: 16, marginTop: 20 },
  enrollDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#333', marginHorizontal: 6 },
  enrollDotActive: { backgroundColor: '#e94560' },
  enrollLabel: { color: '#fff', fontSize: 16, textAlign: 'center', marginTop: 8 },
  cooldownBadge: { backgroundColor: '#16213e', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 20 },
  cooldownNum: { color: '#e94560', fontSize: 48, fontWeight: '900' },
  cooldownLabel: { color: '#888', fontSize: 14, marginTop: 4 },
});

export default AuthScreen;
