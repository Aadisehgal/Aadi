import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useChatStore } from '@stores/useChatStore';
import { useSettingsStore } from '@stores/useSettingsStore';
import { ErrorBoundary } from '@components/ErrorBoundary';
import ConfirmDialog from '@components/ConfirmDialog';
import type { Conversation, RootStackParamList } from '@apptypes/index';

function ConversationsScreenInner() {
  const chatStore = useChatStore();
  const settingsStore = useSettingsStore();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [deleteTarget, setDeleteTarget] = React.useState<Conversation | null>(null);

  const assistantName = settingsStore.assistantProfile.name;

  const sortedConversations = useMemo(() => {
    const pinned = chatStore.conversations.filter((c) => c.isPinned);
    const unpinned = chatStore.conversations.filter((c) => !c.isPinned);
    return [
      ...pinned.sort((a, b) => b.updatedAt - a.updatedAt),
      ...unpinned.sort((a, b) => b.updatedAt - a.updatedAt),
    ];
  }, [chatStore.conversations]);

  const handleSelect = useCallback(
    (conv: Conversation) => {
      chatStore.setCurrentConversation(conv.id);
      navigation.navigate('Chat' as never);
    },
    [chatStore, navigation]
  );

  const handleNew = useCallback(() => {
    chatStore.createConversation();
    navigation.navigate('Chat' as never);
  }, [chatStore, navigation]);

  const handlePin = useCallback(
    (conv: Conversation) => {
      if (conv.isPinned) {
        chatStore.unpinConversation(conv.id);
      } else {
        if (chatStore.pinnedConversations.length >= 3) {
          Alert.alert('Pin Limit', 'You can pin up to 3 conversations.');
          return;
        }
        chatStore.pinConversation(conv.id);
      }
    },
    [chatStore]
  );

  const handleExportConversation = useCallback((conv: Conversation) => {
    const lines = [
      `=== ${conv.title} ===`,
      `Date: ${new Date(conv.createdAt).toLocaleDateString()}`,
      '',
      ...conv.messages.map(
        (m) =>
          `[${m.role === 'user' ? 'You' : assistantName}] ${new Date(m.timestamp).toLocaleTimeString()}\n${m.content}`
      ),
    ];
    const txt = lines.join('\n\n');
    Share.share({ message: txt, title: `${conv.title} — Export` }).catch(() => {});
  }, [assistantName]);

  const handleDeleteConfirmed = useCallback(() => {
    if (!deleteTarget) return;
    chatStore.deleteConversation(deleteTarget.id);
    setDeleteTarget(null);
  }, [chatStore, deleteTarget]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const isActive = chatStore.currentConversationId === item.id;
      const lastMsg = item.messages[item.messages.length - 1];
      return (
        <TouchableOpacity
          style={[styles.card, isActive && styles.cardActive]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.8}
        >
          <View style={styles.cardLeft}>
            {item.isPinned && <Text style={styles.pinIcon}>📌</Text>}
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {lastMsg && (
                <Text style={styles.cardPreview} numberOfLines={1}>
                  {lastMsg.role === 'user' ? 'You: ' : `${assistantName}: `}
                  {lastMsg.content}
                </Text>
              )}
              <Text style={styles.cardMeta}>
                {item.messages.length} message{item.messages.length !== 1 ? 's' : ''} •{' '}
                {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => handlePin(item)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.actionIcon}>{item.isPinned ? '📌' : '🔖'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleExportConversation(item)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.actionIcon}>📤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDeleteTarget(item)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.actionIcon}>🗑</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [chatStore.currentConversationId, handleSelect, handlePin, handleExportConversation, assistantName]
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 Conversations</Text>
        <TouchableOpacity style={styles.newBtn} onPress={handleNew} activeOpacity={0.8}>
          <Text style={styles.newBtnText}>＋ New</Text>
        </TouchableOpacity>
      </View>

      {chatStore.pinnedConversations.length > 0 && (
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionText}>📌 Pinned ({chatStore.pinnedConversations.length}/3)</Text>
        </View>
      )}

      {sortedConversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Tap "+ New" to start chatting with {assistantName}</Text>
          <TouchableOpacity style={styles.startBtn} onPress={handleNew}>
            <Text style={styles.startBtnText}>Start Chatting</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedConversations}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Conversation"
        message={`Delete "${deleteTarget?.title ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

export default function ConversationsScreen() {
  return (
    <ErrorBoundary>
      <ConversationsScreenInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  newBtn: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionText: { color: '#888', fontSize: 12, fontWeight: '600' },
  listContent: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardActive: { borderColor: '#e94560' },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pinIcon: { fontSize: 14, marginTop: 2 },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardPreview: { color: '#888', fontSize: 12, marginBottom: 3 },
  cardMeta: { color: '#555', fontSize: 11 },
  cardActions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  actionBtn: { padding: 6 },
  actionIcon: { fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptySubtext: { color: '#555', fontSize: 14, textAlign: 'center', paddingHorizontal: 40, marginBottom: 24 },
  startBtn: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
