import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useMemoryStore } from '@stores/useMemoryStore';
import { useSettingsStore } from '@stores/useSettingsStore';
import ConfirmDialog from '@components/ConfirmDialog';
import { storageService } from '@services/storageService';
import { memoryAgent } from '@agents/MemoryAgent';
import type { Memory } from '@apptypes/index';

const CATEGORY_COLORS: Record<string, string> = {
  personal: '#e94560',
  professional: '#44aaff',
  preference: '#44dd88',
  location: '#ffcc44',
  identity: '#cc44ff',
  education: '#ff8844',
  goal: '#44ffdd',
  general: '#888888',
};

const MemoryScreen = () => {
  const memoryStore = useMemoryStore();
  const settingsStore = useSettingsStore();
  const assistantName = settingsStore.assistantProfile.name;
  const [isExporting, setIsExporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    // Load persisted memories from SQLite into store on mount
    loadMemoriesFromDB();
  }, []);

  const loadMemoriesFromDB = async () => {
    try {
      const dbMemories = await storageService.getMemories();
      for (const m of dbMemories) {
        const existing = memoryStore.memories.find((e) => e.id === m.id);
        if (!existing) {
          memoryStore.addMemory({
            content: m.content,
            category: m.category,
            relevanceScore: m.relevanceScore,
          });
        }
      }
    } catch {
      // DB not ready yet — fine on first launch
    }
  };

  const handleExportJSON = useCallback(async () => {
    setIsExporting(true);
    try {
      const json = await memoryAgent.exportAsJSON();
      const path = `${RNFS.DocumentDirectoryPath}/manu-ai-memory-${Date.now()}.json`;
      await RNFS.writeFile(path, json, 'utf8');
      await Share.share({
        url: `file://${path}`,
        message: json.substring(0, 200),
        title: 'MANU AI Memory Export (JSON)',
      });
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleExportTXT = useCallback(async () => {
    setIsExporting(true);
    try {
      const txt = await memoryAgent.exportAsTXT();
      const path = `${RNFS.DocumentDirectoryPath}/manu-ai-memory-${Date.now()}.txt`;
      await RNFS.writeFile(path, txt, 'utf8');
      await Share.share({
        url: `file://${path}`,
        message: txt.substring(0, 200),
        title: 'MANU AI Memory Export (TXT)',
      });
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleClearMemories = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const handleClearConfirmed = useCallback(async () => {
    memoryStore.clearAllMemories();
    await storageService.clearMemories();
    setShowClearConfirm(false);
    Alert.alert('Done', 'All memories cleared.');
  }, [memoryStore]);

  const handleDeleteMemory = useCallback((memory: Memory) => {
    Alert.alert(
      'Delete Memory',
      `Delete: "${memory.content.substring(0, 60)}…"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            memoryStore.deleteMemory(memory.id);
          },
        },
      ]
    );
  }, [memoryStore]);

  const grouped = memoryStore.memories.reduce<Record<string, Memory[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🧠 Memory</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{memoryStore.memories.length}</Text>
          <Text style={styles.statLabel}>Memories</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{memoryStore.summaries.length}</Text>
          <Text style={styles.statLabel}>Summaries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{Object.keys(grouped).length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
      </View>

      {/* Memories by category */}
      {Object.entries(grouped).map(([category, memories]) => (
        <View key={category} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[category] ?? '#888' }]} />
            <Text style={styles.sectionTitle}>
              {category.charAt(0).toUpperCase() + category.slice(1)} ({memories.length})
            </Text>
          </View>
          {memories
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .map((memory) => (
              <TouchableOpacity
                key={memory.id}
                style={styles.memoryCard}
                onLongPress={() => handleDeleteMemory(memory)}
                activeOpacity={0.8}>
                <Text style={styles.memoryContent}>{memory.content}</Text>
                <View style={styles.memoryMeta}>
                  <Text style={styles.memoryScore}>
                    Relevance: {(memory.relevanceScore * 100).toFixed(0)}%
                  </Text>
                  <Text style={styles.memoryDate}>
                    {new Date(memory.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
        </View>
      ))}

      {memoryStore.memories.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No memories yet</Text>
          <Text style={styles.emptySubtext}>
            {assistantName} learns from your conversations automatically
          </Text>
        </View>
      )}

      {/* Summaries */}
      {memoryStore.summaries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Conversation Summaries</Text>
          {memoryStore.summaries.slice(0, 5).map((s) => (
            <View key={s.id} style={styles.summaryCard}>
              <Text style={styles.summaryText} numberOfLines={3}>{s.summary}</Text>
              <Text style={styles.summaryMeta}>
                {s.messageCount} messages · {new Date(s.createdAt).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.exportBtn, isExporting && styles.btnDisabled]}
          onPress={handleExportJSON}
          disabled={isExporting}>
          <Text style={styles.exportBtnText}>📤 Export JSON</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, isExporting && styles.btnDisabled]}
          onPress={handleExportTXT}
          disabled={isExporting}>
          <Text style={styles.exportBtnText}>📄 Export TXT</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearBtn} onPress={handleClearMemories}>
          <Text style={styles.clearBtnText}>🗑 Clear All Memories</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Long-press a memory to delete it</Text>

      <ConfirmDialog
        visible={showClearConfirm}
        title="Clear All Memories"
        message="This will permanently delete all memories and summaries. This cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleClearConfirmed}
        onCancel={() => setShowClearConfirm(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { padding: 16, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNum: { color: '#e94560', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  memoryCard: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  memoryContent: { color: '#ddd', fontSize: 13, lineHeight: 18 },
  memoryMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  memoryScore: { color: '#888', fontSize: 11 },
  memoryDate: { color: '#666', fontSize: 11 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#555', fontSize: 13, marginTop: 6, textAlign: 'center' },
  summaryCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  summaryText: { color: '#ccc', fontSize: 12, lineHeight: 18 },
  summaryMeta: { color: '#666', fontSize: 10, marginTop: 6 },
  actions: { gap: 10, marginTop: 8 },
  exportBtn: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  exportBtnText: { color: '#e94560', fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  clearBtn: {
    backgroundColor: '#2d0a0a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  clearBtnText: { color: '#ff4444', fontWeight: '600', fontSize: 14 },
  hint: { color: '#555', fontSize: 11, textAlign: 'center', marginTop: 12 },
});

export default MemoryScreen;
