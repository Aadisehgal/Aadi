import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSettingsStore } from '@stores/useSettingsStore';
import { useAdStore } from '@stores/useAdStore';
import { useVoiceStore } from '@stores/useVoiceStore';
import { useMemoryStore } from '@stores/useMemoryStore';
import { useChatStore } from '@stores/useChatStore';
import { storageService } from '@services/storageService';
import { ErrorBoundary } from '@components/ErrorBoundary';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@apptypes/index';
import type { CuteMode, VoiceMode } from '@apptypes/index';

const PERSONALITY_OPTIONS = ['Friendly', 'Professional', 'Jarvis', 'Hindi First'] as const;
const VOICE_OPTIONS = ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'] as const;
const MODEL_OPTIONS = ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] as const;
const CUTE_OPTIONS: CuteMode[] = ['off', 'mild', 'full'];
const VOICE_MODE_OPTIONS: VoiceMode[] = ['tap', 'hold'];

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

function SettingsScreenInner() {
  const settings = useSettingsStore();
  const adStore = useAdStore();
  const voiceStore = useVoiceStore();
  const memoryStore = useMemoryStore();
  const chatStore = useChatStore();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const saveApiKey = useCallback(() => {
    if (!apiKeyInput.trim()) return;
    storageService.saveApiKey(apiKeyInput.trim()).catch(() => {});
    setApiKeyInput('');
    Alert.alert('Saved', 'API key saved securely.');
  }, [apiKeyInput]);

  const handleExportMemory = useCallback(() => {
    const data = JSON.stringify(memoryStore.memories, null, 2);
    Share.share({ message: data, title: 'Memory Export' }).catch(() => {});
  }, [memoryStore.memories]);

  const handleClearMemory = useCallback(() => {
    Alert.alert('Clear Memory', 'Delete all memories? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => memoryStore.clearAllMemories(),
      },
    ]);
  }, [memoryStore]);

  const handleExportChats = useCallback(() => {
    const data = JSON.stringify(chatStore.conversations, null, 2);
    Share.share({ message: data, title: 'Chat Export' }).catch(() => {});
  }, [chatStore.conversations]);

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear All Data', 'Delete ALL conversations, memories, and settings?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Everything',
        style: 'destructive',
        onPress: () => {
          settings.resetSettings();
          memoryStore.clearAllMemories();
          chatStore.clearAllConversations?.();
          storageService.clearAllData().catch(() => {});
        },
      },
    ]);
  }, [settings, memoryStore, chatStore]);

  const handleUnlockPremium = useCallback(() => {
    // TODO: implement IAP
    Alert.alert('Premium', 'In-app purchase coming soon!');
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>

      {/* ── Identity ── */}
      <SectionHeader title="Identity" />

      <Row label="Assistant Name">
        <TextInput
          style={styles.textInput}
          value={settings.assistantProfile.name}
          onChangeText={(v) => settings.setAssistantProfile({ name: v })}
          placeholderTextColor="#666"
        />
      </Row>

      <Row label="Greeting">
        <TextInput
          style={styles.textInput}
          value={settings.assistantProfile.greeting ?? ''}
          onChangeText={(v) => settings.setAssistantProfile({ greeting: v })}
          placeholder="Hello, how can I assist you?"
          placeholderTextColor="#666"
        />
      </Row>

      <Row label="Your Name">
        <TextInput
          style={styles.textInput}
          value={settings.userProfile.name}
          onChangeText={(v) => settings.setUserProfile({ name: v })}
          placeholderTextColor="#666"
        />
      </Row>

      <Row label="Your Nickname">
        <TextInput
          style={styles.textInput}
          value={settings.userProfile.nickname ?? ''}
          onChangeText={(v) => settings.setUserProfile({ nickname: v })}
          placeholder="Optional"
          placeholderTextColor="#666"
        />
      </Row>

      <Row label="Personality">
        <View style={styles.chipRow}>
          {PERSONALITY_OPTIONS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => settings.setAssistantProfile({ personality: p })}
              style={[
                styles.chip,
                settings.assistantProfile.personality === p && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.assistantProfile.personality === p && styles.chipTextActive,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Row>

      <Row label="TTS Voice">
        <View style={styles.chipRow}>
          {VOICE_OPTIONS.map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => settings.setAssistantProfile({ voice: v })}
              style={[
                styles.chip,
                settings.assistantProfile.voice === v && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.assistantProfile.voice === v && styles.chipTextActive,
                ]}
              >
                {v}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Row>

      {/* ── Voice & Response ── */}
      <SectionHeader title="Voice & Response" />

      <Row label="Always Speak Responses">
        <Switch
          value={settings.alwaysSpeakResponses ?? false}
          onValueChange={(v) => settings.setAlwaysSpeakResponses(v)}
          trackColor={{ false: '#333', true: '#e94560' }}
          thumbColor="#fff"
        />
      </Row>

      <Row label="Voice Mode">
        <View style={styles.chipRow}>
          {VOICE_MODE_OPTIONS.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => voiceStore.setVoiceMode(m)}
              style={[styles.chip, voiceStore.voiceMode === m && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  voiceStore.voiceMode === m && styles.chipTextActive,
                ]}
              >
                {m === 'tap' ? 'Tap-to-Speak' : 'Hold-to-Speak'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Row>

      <Row label="Continuous Conversation">
        <Switch
          value={voiceStore.continuousMode}
          onValueChange={(v) => voiceStore.setContinuousMode(v)}
          trackColor={{ false: '#333', true: '#e94560' }}
          thumbColor="#fff"
        />
      </Row>

      <Row label="Avatar Cute Mode">
        <View style={styles.chipRow}>
          {CUTE_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => settings.setAvatarCuteMode(c)}
              style={[
                styles.chip,
                (settings.avatarCuteMode ?? 'mild') === c && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  (settings.avatarCuteMode ?? 'mild') === c && styles.chipTextActive,
                ]}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Row>

      {/* ── AI Model ── */}
      <SectionHeader title="AI Model" />

      <Row label="Groq Model">
        <View style={styles.chipRow}>
          {MODEL_OPTIONS.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => settings.setGroqModel(m)}
              style={[styles.chip, settings.groqModel === m && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.groqModel === m && styles.chipTextActive,
                ]}
                numberOfLines={1}
              >
                {m.split('-').slice(0, 2).join('-')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Row>

      <Row label="Groq API Key">
        <View style={styles.apiKeyRow}>
          <TextInput
            style={[styles.textInput, styles.apiKeyInput]}
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder={apiKeyVisible ? 'Enter API key...' : '••••••••••••'}
            placeholderTextColor="#666"
            secureTextEntry={!apiKeyVisible}
          />
          <TouchableOpacity onPress={() => setApiKeyVisible((v) => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{apiKeyVisible ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={saveApiKey} style={styles.saveKeyBtn}>
            <Text style={styles.saveKeyText}>Save</Text>
          </TouchableOpacity>
        </View>
      </Row>

      {/* ── Premium ── */}
      <SectionHeader title="Premium" />

      <Row label="Status">
        <Text style={[styles.statusText, adStore.isPremiumUnlocked && styles.statusPremium]}>
          {adStore.isPremiumUnlocked ? '✅ Premium Unlocked' : '🔒 Free'}
        </Text>
      </Row>

      {!adStore.isPremiumUnlocked && (
        <TouchableOpacity onPress={handleUnlockPremium} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Unlock Premium</Text>
        </TouchableOpacity>
      )}

      {/* ── Data ── */}
      <SectionHeader title="Data" />

      <TouchableOpacity onPress={handleExportMemory} style={styles.actionBtn}>
        <Text style={styles.actionBtnText}>📤 Export Memories (JSON)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleClearMemory} style={[styles.actionBtn, styles.dangerBtn]}>
        <Text style={styles.actionBtnText}>🗑 Clear All Memories</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleExportChats} style={styles.actionBtn}>
        <Text style={styles.actionBtnText}>📤 Export Chat History</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleClearAll} style={[styles.actionBtn, styles.dangerBtn]}>
        <Text style={styles.actionBtnText}>⚠️ Clear All Data</Text>
      </TouchableOpacity>

      {/* ── Developer ── */}
      <SectionHeader title="Developer" />

      <Row label="Analytics">
        <Switch
          value={settings.analyticsEnabled}
          onValueChange={(v) => settings.setAnalyticsEnabled(v)}
          trackColor={{ false: '#333', true: '#e94560' }}
          thumbColor="#fff"
        />
      </Row>

      <TouchableOpacity
        onPress={() => navigation.navigate('Debug')}
        style={styles.actionBtn}
      >
        <Text style={styles.actionBtnText}>🛠 Open Debug Screen</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

export default function SettingsScreen() {
  return (
    <ErrorBoundary>
      <SettingsScreenInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { paddingBottom: 40 },
  pageTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    padding: 20,
    paddingBottom: 8,
  },
  sectionHeader: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 16,
  },
  sectionTitle: { color: '#e94560', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e1e30',
  },
  rowLabel: { color: '#ccc', fontSize: 15, flex: 1 },
  rowValue: { flex: 1.5, alignItems: 'flex-end' },
  textInput: {
    backgroundColor: '#1e1e30',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    width: '100%',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  chip: {
    backgroundColor: '#1e1e30',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: { backgroundColor: '#e94560' },
  chipText: { color: '#888', fontSize: 12 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  apiKeyInput: { flex: 1 },
  eyeBtn: { padding: 6 },
  eyeText: { fontSize: 18 },
  saveKeyBtn: {
    backgroundColor: '#e94560',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  saveKeyText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statusText: { color: '#888', fontSize: 14 },
  statusPremium: { color: '#4caf50' },
  primaryBtn: {
    backgroundColor: '#e94560',
    margin: 20,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionBtn: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#1e1e30',
    borderRadius: 12,
    padding: 14,
  },
  dangerBtn: { backgroundColor: '#2a1515' },
  actionBtnText: { color: '#fff', fontSize: 15 },
  spacer: { height: 40 },
});
