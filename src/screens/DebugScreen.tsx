import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Share,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import { storageService } from '@services/storageService';
import { analyticsService } from '@services/analyticsService';
import { useSettingsStore } from '@stores/useSettingsStore';
import { toolRegistry } from '@tools/ToolRegistry';

interface LogEntry {
  id: string;
  type: 'error' | 'info' | 'warn' | 'crash' | 'token' | 'perf';
  message: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

interface TokenStats {
  totalTokens: number;
  totalMessages: number;
  avgTokensPerMessage: number;
  conversationBreakdown: Array<{ id: string; tokens: number }>;
}

interface PerfMetrics {
  appStartMs?: number;
  avgResponseMs?: number;
  totalApiCalls?: number;
  failedApiCalls?: number;
}

const BUILD_INFO = {
  version: '1.0.0',
  rnVersion: '0.74.3',
  platform: Platform.OS,
  osVersion: String(Platform.Version),
  hermes: typeof HermesInternal !== 'undefined' ? 'enabled' : 'disabled',
  newArch: 'disabled',
};

declare const HermesInternal: unknown;

const DebugScreen = () => {
  const settingsStore = useSettingsStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    totalTokens: 0,
    totalMessages: 0,
    avgTokensPerMessage: 0,
    conversationBreakdown: [],
  });
  const analyticsEnabled = settingsStore.analyticsEnabled;
  const [perfMetrics, setPerfMetrics] = useState<PerfMetrics>({
    appStartMs: 0,
    avgResponseMs: 0,
    totalApiCalls: 0,
    failedApiCalls: 0,
  });
  const [showTools, setShowTools] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadLogs(), loadTokenStats(), loadPerfMetrics()]);
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const rawLogs = await storageService.getAnalyticsLogs();
      setLogs(rawLogs as LogEntry[]);
    } catch {
      setLogs([]);
    }
  }, []);

  const loadTokenStats = useCallback(async () => {
    try {
      const stats = await storageService.getTokenStats();
      setTokenStats(stats as TokenStats);
    } catch { /* ignore */ }
  }, []);

  const loadPerfMetrics = useCallback(async () => {
    try {
      const metrics = await storageService.getPerfMetrics();
      if (metrics) setPerfMetrics(metrics as PerfMetrics);
    } catch { /* ignore */ }
  }, []);

  const handleExportLogs = useCallback(async () => {
    try {
      const header = [
        '=== MANU AI Debug Log Export ===',
        `Exported: ${new Date().toISOString()}`,
        `App: ${BUILD_INFO.version} | RN: ${BUILD_INFO.rnVersion} | Hermes: ${BUILD_INFO.hermes}`,
        '',
      ].join('\n');

      const logText = logs
        .map(
          (l) =>
            `[${new Date(l.timestamp).toISOString()}] [${l.type.toUpperCase()}] ${l.message}${
              l.meta ? '\n  Meta: ' + JSON.stringify(l.meta) : ''
            }`
        )
        .join('\n');

      const full = header + logText;
      const path = `${RNFS.DocumentDirectoryPath}/manu-ai-debug-${Date.now()}.txt`;
      await RNFS.writeFile(path, full, 'utf8');
      await Share.share({
        url: `file://${path}`,
        message: full.substring(0, 500),
        title: 'MANU AI Debug Logs',
      });
    } catch (error) {
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [logs]);

  const handleExportAnalytics = useCallback(async () => {
    try {
      const events = await storageService.getAnalytics();
      const json = JSON.stringify({ tokenStats, perfMetrics, events }, null, 2);
      const path = `${RNFS.DocumentDirectoryPath}/manu-ai-analytics-${Date.now()}.txt`;
      await RNFS.writeFile(path, json, 'utf8');
      await Share.share({
        url: `file://${path}`,
        message: `Analytics export: ${events.length} events`,
        title: 'MANU AI Analytics',
      });
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    }
  }, [tokenStats, perfMetrics]);

  const handleClearLogs = useCallback(() => {
    Alert.alert(
      'Clear Logs',
      'Delete all analytics and log entries?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearAnalytics();
            setLogs([]);
            setTokenStats({ totalTokens: 0, totalMessages: 0, avgTokensPerMessage: 0, conversationBreakdown: [] });
            Alert.alert('Done', 'Logs cleared.');
          },
        },
      ]
    );
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will delete all messages, memory, logs, and settings. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearAllData();
            setLogs([]);
            setTokenStats({ totalTokens: 0, totalMessages: 0, avgTokensPerMessage: 0, conversationBreakdown: [] });
            Alert.alert('Done', 'All data cleared. Restart the app.');
          },
        },
      ]
    );
  }, []);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'crash': return '#ff4444';
      case 'error': return '#ff8800';
      case 'warn': return '#ffcc00';
      case 'token': return '#44aaff';
      case 'perf': return '#44ff88';
      default: return '#aaaaaa';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🛠 Debug Console</Text>

      {/* Analytics Toggle */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Analytics</Text>
          <Switch
            value={analyticsEnabled}
            onValueChange={(v) => settingsStore.setAnalyticsEnabled(v)}
            trackColor={{ false: '#333', true: '#e94560' }}
            thumbColor="#fff"
          />
        </View>
        <Text style={styles.cardSubtitle}>Local only — no data leaves your device.</Text>
      </View>

      {/* Build Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📦 Build Info</Text>
        {Object.entries(BUILD_INFO).map(([k, v]) => (
          <View style={styles.statRow} key={k}>
            <Text style={styles.statLabel}>{k}</Text>
            <Text style={styles.statValue}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Token Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Token Usage</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Tokens</Text>
          <Text style={styles.statValue}>{tokenStats.totalTokens.toLocaleString()}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Messages</Text>
          <Text style={styles.statValue}>{tokenStats.totalMessages}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Avg Tokens/Msg</Text>
          <Text style={styles.statValue}>{tokenStats.avgTokensPerMessage.toFixed(1)}</Text>
        </View>
      </View>

      {/* Performance */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ Performance</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>App Start</Text>
          <Text style={styles.statValue}>{(perfMetrics.appStartMs ?? 0).toFixed(0)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total API Calls</Text>
          <Text style={styles.statValue}>{perfMetrics.totalApiCalls ?? 0}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Failed Calls</Text>
          <Text style={[styles.statValue, { color: '#ff4444' }]}>{perfMetrics.failedApiCalls ?? 0}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Avg Response</Text>
          <Text style={styles.statValue}>{(perfMetrics.avgResponseMs ?? 0).toFixed(0)}ms</Text>
        </View>
      </View>

      {/* Current Config */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Current Config</Text>
        <Text style={styles.configText}>
          Assistant: {settingsStore.assistantProfile.name} ({settingsStore.assistantProfile.personality})
        </Text>
        <Text style={styles.configText}>
          User: {settingsStore.userProfile.name} | Lang: {settingsStore.userProfile.language}
        </Text>
        <Text style={styles.configText}>Tone: {settingsStore.userProfile.tone}</Text>
      </View>

      {/* Registered Tools */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={() => setShowTools((p) => !p)}>
          <Text style={styles.cardTitle}>🔧 Registered Tools</Text>
          <Text style={styles.refreshBtnText}>{showTools ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showTools &&
          toolRegistry.getAll().map((t, i) => (
            <Text key={i} style={styles.configText} numberOfLines={2}>{t.name} — {t.description}</Text>
          ))}
      </View>

      {/* Logs */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>📋 Logs ({logs.length})</Text>
          <TouchableOpacity onPress={loadLogs} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>
        {logs.slice(0, 50).map((log) => (
          <View key={log.id} style={styles.logEntry}>
            <Text style={[styles.logType, { color: getLogColor(log.type) }]}>
              [{log.type.toUpperCase()}]
            </Text>
            <Text style={styles.logMsg}>{log.message}</Text>
            <Text style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
          </View>
        ))}
        {logs.length === 0 && <Text style={styles.emptyText}>No logs yet</Text>}
      </View>

      {/* Action Buttons */}
      <TouchableOpacity style={styles.exportBtn} onPress={handleExportLogs}>
        <Text style={styles.exportBtnText}>📤 Export Logs TXT</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.exportBtn} onPress={handleExportAnalytics}>
        <Text style={styles.exportBtnText}>📊 Export Analytics</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.warnBtn} onPress={handleClearLogs}>
        <Text style={styles.warnBtnText}>🧹 Clear Logs</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
        <Text style={styles.clearBtnText}>🗑 Clear All App Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { padding: 16, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardSubtitle: { color: '#888', fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  statLabel: { color: '#aaa', fontSize: 13 },
  statValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  configText: { color: '#ccc', fontSize: 12, marginTop: 4, lineHeight: 18 },
  logEntry: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  logType: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  logMsg: { color: '#ddd', fontSize: 12, lineHeight: 16 },
  logTime: { color: '#666', fontSize: 10, marginTop: 2 },
  emptyText: { color: '#666', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  refreshBtn: { backgroundColor: '#1a1a2e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  refreshBtnText: { color: '#e94560', fontSize: 12 },
  exportBtn: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  exportBtnText: { color: '#e94560', fontWeight: '600', fontSize: 15 },
  warnBtn: {
    backgroundColor: '#2d1a00',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ff8800',
  },
  warnBtnText: { color: '#ff8800', fontWeight: '600', fontSize: 15 },
  clearBtn: {
    backgroundColor: '#2d0a0a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  clearBtnText: { color: '#ff4444', fontWeight: '600', fontSize: 15 },
});

export default DebugScreen;
