import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Ellipse, Circle, Path, Line } from 'react-native-svg';
import Avatar3D from '@components/Avatar3D';
import { useAvatarStore } from '@stores/useAvatarStore';
import { useAdStore } from '@stores/useAdStore';
import { useSettingsStore } from '@stores/useSettingsStore';
import { adService } from '@services/adService';
import { runAdGate } from '@modules/AdGate';
import { ttsService } from '@services/ttsService';
import { CuteLanguageModule } from '@modules/CuteLanguageModule';

const LIP_SYNC_INTERVAL_MS = 100;

const GITHUB_RAW = 'https://raw.githubusercontent.com/Aadisehgal/Aadi/main/assets/avatars';
const AVATAR_MODELS = ['aria.glb', 'luna.glb', 'nova.glb', 'vega.glb', 'zara.glb'];

// ─── SVG Fallback Avatar ──────────────────────────────────────────────────────

const SVGAvatar: React.FC<{ lipSyncValue: number; animationState: string }> = ({
  lipSyncValue,
  animationState,
}) => {
  const mouthOpen = Math.max(0, Math.min(20, lipSyncValue * 20));
  const isTalking = animationState === 'talking';

  return (
    <Svg width={200} height={240} viewBox="0 0 200 240">
      {/* Neck */}
      <Path d="M88 155 Q100 165 112 155 L115 185 Q100 195 85 185 Z" fill="#f0c8a0" />
      {/* Head */}
      <Ellipse cx="100" cy="100" rx="62" ry="72" fill="#f0c8a0" />
      {/* Ears */}
      <Ellipse cx="38" cy="105" rx="10" ry="14" fill="#e8b896" />
      <Ellipse cx="162" cy="105" rx="10" ry="14" fill="#e8b896" />
      {/* Hair */}
      <Path d="M38 72 Q50 28 100 24 Q150 28 162 72 Q158 48 100 44 Q42 48 38 72 Z" fill="#3d2b1a" />
      {/* Eyes */}
      <Ellipse cx="76" cy="90" rx="12" ry="14" fill="#fff" />
      <Ellipse cx="124" cy="90" rx="12" ry="14" fill="#fff" />
      <Circle cx="78" cy="91" r="7" fill="#4a3728" />
      <Circle cx="126" cy="91" r="7" fill="#4a3728" />
      <Circle cx="80" cy="89" r="2.5" fill="#111" />
      <Circle cx="128" cy="89" r="2.5" fill="#111" />
      <Circle cx="81" cy="88" r="1" fill="#fff" />
      <Circle cx="129" cy="88" r="1" fill="#fff" />
      {/* Eyebrows */}
      <Path d="M62 74 Q76 68 88 72" stroke="#3d2b1a" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M112 72 Q124 68 138 74" stroke="#3d2b1a" strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* Nose */}
      <Path d="M96 108 Q100 118 104 108" stroke="#d4956a" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* Mouth */}
      {isTalking ? (
        <>
          <Ellipse cx="100" cy={138 + mouthOpen * 0.3} rx={18} ry={4 + mouthOpen * 0.5} fill="#c0392b" />
          <Path
            d={`M82 134 Q100 ${132 - mouthOpen * 0.2} 118 134`}
            stroke="#e74c3c"
            strokeWidth={2}
            fill="none"
          />
          {mouthOpen > 5 && (
            <Ellipse cx="100" cy={138 + mouthOpen * 0.3} rx={12} ry={mouthOpen * 0.4} fill="#8b0000" />
          )}
        </>
      ) : (
        <Path d="M82 136 Q100 148 118 136" stroke="#c0392b" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      )}
      {/* Cheeks */}
      <Ellipse cx="62" cy="120" rx="12" ry="7" fill="rgba(255,150,120,0.25)" />
      <Ellipse cx="138" cy="120" rx="12" ry="7" fill="rgba(255,150,120,0.25)" />
      {/* Talking indicator */}
      {isTalking && (
        <>
          <Line x1="140" y1="155" x2="148" y2="165" stroke="#e94560" strokeWidth={2} />
          <Line x1="150" y1="150" x2="162" y2="155" stroke="#e94560" strokeWidth={2} />
          <Line x1="148" y1="140" x2="162" y2="138" stroke="#e94560" strokeWidth={2} />
        </>
      )}
    </Svg>
  );
};

// ─── AvatarScreen ─────────────────────────────────────────────────────────────

const AvatarScreen = () => {
  const avatarStore = useAvatarStore();
  const settingsStore = useSettingsStore();
  const lipSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const amplitudeHistoryRef = useRef<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── TTS Amplitude → Lip Sync ──────────────────────────────────────────────

  const startLipSync = useCallback(() => {
    if (lipSyncTimerRef.current) return;
    lipSyncTimerRef.current = setInterval(() => {
      const amp = ttsService.getCurrentAmplitude();
      amplitudeHistoryRef.current.push(amp);
      if (amplitudeHistoryRef.current.length > 5) amplitudeHistoryRef.current.shift();

      // Smooth via moving average
      const avg =
        amplitudeHistoryRef.current.reduce((a, b) => a + b, 0) /
        amplitudeHistoryRef.current.length;

      avatarStore.setLipSyncValue(avg);

      // Close mouth on sustained silence
      if (avg < 0.02) {
        avatarStore.setLipSyncValue(0);
      }
    }, LIP_SYNC_INTERVAL_MS);
  }, [avatarStore]);

  const stopLipSync = useCallback(() => {
    if (lipSyncTimerRef.current) {
      clearInterval(lipSyncTimerRef.current);
      lipSyncTimerRef.current = null;
    }
    amplitudeHistoryRef.current = [];
    avatarStore.setLipSyncValue(0);
  }, [avatarStore]);

  // Watch ttsService isSpeaking
  useEffect(() => {
    if (!avatarStore.modelPath) {
      avatarStore.setModelPath(`${GITHUB_RAW}/aria.glb`);
    }
  }, []);

  useEffect(() => {
    let prevSpeaking = false;
    const poll = setInterval(() => {
      const now = ttsService.isSpeaking();
      if (now !== prevSpeaking) {
        prevSpeaking = now;
        if (now) {
          avatarStore.setIsTalking(true);
          startLipSync();
        } else {
          stopLipSync();
          avatarStore.setIsTalking(false);
        }
      }
    }, 100);
    return () => {
      clearInterval(poll);
      stopLipSync();
    };
  }, [avatarStore, startLipSync, stopLipSync]);

  // Simulate loading
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // ── Test TTS ───────────────────────────────────────────────────────────────

  const handleTestSpeak = useCallback(async () => {
    try {
      await ttsService.speak("Hello! I am MANU, your AI assistant. I'm ready to help you.");
    } catch (e) {
      Alert.alert('TTS Error', (e as Error).message);
    }
  }, []);

  const handleGlbError = useCallback(() => {
    avatarStore.setGlbError(true);
  }, [avatarStore]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading Avatar…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🤖 {settingsStore.assistantProfile.name} Avatar</Text>

      <View style={styles.avatarContainer}>
        {avatarStore.useFallback || avatarStore.glbError || !avatarStore.modelPath ? (
          <SVGAvatar
            lipSyncValue={avatarStore.lipSyncValue}
            animationState={avatarStore.animationState}
          />
        ) : (
          <Avatar3D
            modelPath={avatarStore.modelPath}
            animationState={avatarStore.animationState}
            lipSyncValue={avatarStore.lipSyncValue}
            onError={handleGlbError}
          />
        )}
      </View>

      {/* Status indicator */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, avatarStore.isTalking && styles.statusDotActive]} />
        <Text style={styles.statusText}>
          {avatarStore.isTalking ? 'Speaking…' : 'Idle'}
        </Text>
      </View>

      {/* Lip sync bar */}
      <View style={styles.lipSyncBar}>
        <View style={[styles.lipSyncFill, { width: `${avatarStore.lipSyncValue * 100}%` }]} />
      </View>
      <Text style={styles.lipSyncLabel}>
        Amplitude: {(avatarStore.lipSyncValue * 100).toFixed(0)}%
      </Text>

      {/* Controls */}
      <TouchableOpacity style={styles.testBtn} onPress={handleTestSpeak}>
        <Text style={styles.testBtnText}>▶ Test Lip Sync</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fallbackToggle}
        onPress={() => avatarStore.setUseFallback(!avatarStore.useFallback)}>
        <Text style={styles.fallbackToggleText}>
          {avatarStore.useFallback ? '🔲 Use 3D Avatar' : '🖼 Use SVG Fallback'}
        </Text>
      </TouchableOpacity>

      {/* Change Avatar — Ad Gate */}
      <ChangeAvatarButton />
    </View>
  );
};

// ─── Change Avatar Button with Ad Gate ───────────────────────────────────────


const ChangeAvatarButton: React.FC = () => {
  const adStore = useAdStore();
  const avatarStore = useAvatarStore();
  const settingsStore = useSettingsStore();
  const [showPicker, setShowPicker] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState<string | null>(null);

  const applyAvatar = React.useCallback(
    (model: string) => {
      avatarStore.setModelPath(`${GITHUB_RAW}/${model}`);
      avatarStore.setIsTalking(true);
      const greeting = settingsStore.assistantProfile.greeting ?? 'Hello, how can I assist you?';
      const cuteMode = settingsStore.avatarCuteMode ?? 'mild';
      const ttsText = CuteLanguageModule.transformForTTS(greeting, cuteMode);
      ttsService.speak(ttsText).finally(() => {
        avatarStore.setIsTalking(false);
      });
      setShowPicker(false);
    },
    [avatarStore, settingsStore],
  );

  const handleChangeAvatar = React.useCallback(async () => {
    if (!selectedModel) {
      setShowPicker(true);
      return;
    }

    const gateResult = await runAdGate(() => {
      // Called when 30s timer expires (ad failed to load)
      Alert.alert(
        'Avatar Unlocked Temporarily',
        'Ad unavailable. Avatar unlocked for this session!',
      );
      applyAvatar(selectedModel!);
    });

    switch (gateResult.outcome) {
      case 'allowed':
        applyAvatar(selectedModel);
        break;
      case 'blocked':
        Alert.alert('Watch Full Ad', 'Watch the full ad to unlock avatar change.');
        break;
      case 'pending':
        // Timer started — UI will update via useAdStore reactive state
        break;
    }
  }, [selectedModel, applyAvatar]);

  return (
    <>
      {/* Model picker */}
      {showPicker && (
        <View style={adGateStyles.pickerContainer}>
          <Text style={adGateStyles.pickerTitle}>Choose Avatar</Text>
          {AVATAR_MODELS.map((model) => (
            <TouchableOpacity
              key={model}
              onPress={() => { setSelectedModel(model); setShowPicker(false); }}
              style={adGateStyles.pickerItem}
            >
              <Text style={adGateStyles.pickerItemText}>
                {model.replace('.glb', '').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowPicker(false)} style={adGateStyles.cancelBtn}>
            <Text style={adGateStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ad unlock countdown */}
      {adStore.adUnlockTimerActive && (
        <View style={adGateStyles.timerContainer}>
          <Text style={adGateStyles.timerText}>
            Unlocking in {adStore.adUnlockSecondsLeft}s...
          </Text>
          <View style={adGateStyles.progressBar}>
            <View
              style={[
                adGateStyles.progressFill,
                { width: `${((30 - adStore.adUnlockSecondsLeft) / 30) * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[adGateStyles.changeBtn, adStore.adUnlockTimerActive && adGateStyles.changeBtnDisabled]}
        onPress={handleChangeAvatar}
        disabled={adStore.adUnlockTimerActive}
      >
        <Text style={adGateStyles.changeBtnText}>
          {selectedModel ? `🔄 Change to ${selectedModel.replace('.glb', '')}` : '🎭 Change Avatar'}
        </Text>
      </TouchableOpacity>
    </>
  );
};

const adGateStyles = StyleSheet.create({
  pickerContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    marginTop: 12,
  },
  pickerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pickerItem: {
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  pickerItemText: { color: '#fff', fontSize: 14 },
  cancelBtn: { padding: 10, alignItems: 'center' },
  cancelText: { color: '#888', fontSize: 14 },
  timerContainer: { marginTop: 12, alignItems: 'center', width: '90%' },
  timerText: { color: '#e94560', fontSize: 14, marginBottom: 6 },
  progressBar: { width: '100%', height: 6, backgroundColor: '#1e1e30', borderRadius: 3 },
  progressFill: { height: '100%', backgroundColor: '#e94560', borderRadius: 3 },
  changeBtn: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 12,
  },
  changeBtnDisabled: { opacity: 0.5 },
  changeBtnText: { color: '#e94560', fontSize: 14, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#888', fontSize: 14, marginTop: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  avatarContainer: {
    width: 300,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555',
  },
  statusDotActive: { backgroundColor: '#44ff88' },
  statusText: { color: '#aaa', fontSize: 14 },
  lipSyncBar: {
    width: 200,
    height: 8,
    backgroundColor: '#16213e',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  lipSyncFill: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 4,
  },
  lipSyncLabel: { color: '#666', fontSize: 11, marginBottom: 24 },
  testBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  testBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fallbackToggle: {
    backgroundColor: '#16213e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  fallbackToggleText: { color: '#aaa', fontSize: 13 },
});

export default AvatarScreen;
