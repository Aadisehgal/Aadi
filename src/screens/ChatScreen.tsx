import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Fuse from 'fuse.js';
import { useChatStore } from '@stores/useChatStore';
import { useVoiceStore } from '@stores/useVoiceStore';
import { useSettingsStore } from '@stores/useSettingsStore';
import { useOffline } from '@hooks/useOffline';
import { useChat } from '@hooks/useChat';
import { useVoice } from '@hooks/useVoice';
import { adService, BannerAd, BannerAdSize } from '@services/adService';
import { ttsService } from '@services/ttsService';
import { ErrorBoundary } from '@components/ErrorBoundary';
import MessageItem, { MESSAGE_HEIGHT } from '@components/MessageItem';
import WaveformAnimation from '@components/WaveformAnimation';
import OfflineIndicator from '@components/OfflineIndicator';
import type { Message } from '@apptypes/index';

function ChatScreenInner() {
  const chatStore = useChatStore();
  const voiceStore = useVoiceStore();
  const settingsStore = useSettingsStore();
  const { isOnline, queuedCount, retryQueue } = useOffline();
  const { sendMessage } = useChat();
  const { isListening, waveformData, voiceMode, startListening, stopListening } = useVoice();
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);

  // Auto-create conversation if none exists
  React.useEffect(() => {
    if (!chatStore.currentConversationId) {
      chatStore.createConversation();
    }
  }, [chatStore]);

  const handleStopSpeaking = useCallback(() => {
    ttsService.stop().catch(() => {});
  }, []);

  const [inputText, setInputText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const convId = chatStore.currentConversationId;
  const allMessages = convId ? chatStore.getMessages(convId) : [];

  const displayMessages = useMemo(() => {
    if (!searchQuery.trim()) return allMessages;
    const fuse = new Fuse(allMessages, { keys: ['content'], threshold: 0.4 });
    return fuse.search(searchQuery).map((r) => r.item);
  }, [allMessages, searchQuery]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    voiceStore.setInputMode('text');
    sendMessage(text, 'text').catch(() => {});
  }, [inputText, sendMessage, voiceStore]);

  const handleLongPress = useCallback(
    (msg: Message) => {
      if (!convId) return;
      Alert.alert('Message Options', '', [
        {
          text: 'Copy',
          onPress: () => {
            import('@react-native-clipboard/clipboard').then(({ default: Clipboard }) => {
              Clipboard.setString(msg.content);
            });
          },
        },
        {
          text: msg.isFavorite ? 'Unfavorite' : 'Favorite',
          onPress: () => chatStore.toggleFavorite(convId, msg.id),
        },
        {
          text: 'Regenerate',
          onPress: () => {
            chatStore.deleteMessage(convId, msg.id);
            sendMessage(msg.content, msg.inputMode).catch(() => {});
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => chatStore.deleteMessage(convId, msg.id),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [chatStore, convId, sendMessage]
  );

  const handleSwipeDelete = useCallback(
    (id: string) => {
      if (!convId) return;
      chatStore.deleteMessage(convId, id);
    },
    [chatStore, convId]
  );

  const assistantName = settingsStore.assistantProfile.name;

  const handleExport = useCallback(() => {
    Alert.alert('Export Chat', 'Choose export format:', [
      {
        text: 'JSON',
        onPress: () => {
          const json = JSON.stringify(allMessages, null, 2);
          Share.share({ message: json, title: 'Chat Export (JSON)' }).catch(() => {});
        },
      },
      {
        text: 'TXT',
        onPress: () => {
          const txt = allMessages
            .map(
              (m) =>
                `[${m.role === 'user' ? 'You' : assistantName}] ${new Date(m.timestamp).toLocaleTimeString()}\n${m.content}`
            )
            .join('\n\n');
          Share.share({ message: txt, title: 'Chat Export (TXT)' }).catch(() => {});
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [allMessages, assistantName]);

  const getItemLayout = useCallback(
    (_: ArrayLike<Message> | null | undefined, index: number) => ({
      length: MESSAGE_HEIGHT,
      offset: MESSAGE_HEIGHT * index,
      index,
    }),
    []
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Mic button logic: tap mode vs hold mode
  const renderMicButton = () => {
    if (voiceMode === 'hold') {
      return (
        <TouchableOpacity
          onPressIn={startListening}
          onPressOut={stopListening}
          style={[styles.micBtn, isListening && styles.micBtnActive]}
          activeOpacity={0.8}
        >
          <Text style={styles.micBtnText}>🎙</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        onPress={isListening ? stopListening : startListening}
        style={[styles.micBtn, isListening && styles.micBtnActive]}
        activeOpacity={0.8}
      >
        <Text style={styles.micBtnText}>🎙</Text>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
        style={[styles.root, styles.container]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{assistantName}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setSearchVisible((v) => !v)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExport} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>📤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Offline indicator */}
        {!isOnline && (
          <OfflineIndicator
            queuedCount={queuedCount}
            onRetry={retryQueue}
          />
        )}

        {/* Search bar */}
        {searchVisible && (
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          renderItem={({ item }) => (
            <MessageItem
              item={item}
              onLongPress={handleLongPress}
              onSwipeDelete={handleSwipeDelete}
            />
          )}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{`Say hello to ${assistantName}!`}</Text>
            </View>
          }
        />

        {/* Waveform animation (standalone component) */}
        {isListening && (
          <WaveformAnimation waveformData={waveformData} color="#e94560" height={50} />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <Text style={styles.modeIndicator}>
            {voiceStore.inputMode === 'voice' ? '🎙' : '⌨️'}
          </Text>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={`Message ${assistantName}...`}
            placeholderTextColor="#666"
            multiline
            onFocus={() => voiceStore.setInputMode('text')}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
          {renderMicButton()}
          {isSpeaking && (
            <TouchableOpacity onPress={handleStopSpeaking} style={styles.stopBtn}>
              <Text style={styles.stopBtnText}>⏹</Text>
            </TouchableOpacity>
          )}
        </View>

        />
    </KeyboardAvoidingView>
  );
}

export default function ChatScreen() {
  return (
    <ErrorBoundary>
      <ChatScreenInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 18 },
  searchBar: { backgroundColor: '#1a1a2e', paddingHorizontal: 12, paddingVertical: 6 },
  searchInput: {
    backgroundColor: '#2a2a3e',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listContent: { padding: 12, paddingBottom: 8 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: { color: '#555', fontSize: 16 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  modeIndicator: { fontSize: 18, paddingBottom: 8 },
  textInput: {
    flex: 1,
    backgroundColor: '#2a2a3e',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#e94560',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18 },
  micBtn: {
    backgroundColor: '#2a2a3e',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnActive: { backgroundColor: '#e94560' },
  micBtnText: { fontSize: 20 },
  stopBtn: {
    backgroundColor: '#7c3535',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtnText: { fontSize: 18 },
});
