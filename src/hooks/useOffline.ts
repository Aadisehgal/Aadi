import { useEffect, useCallback, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useChatStore } from '@stores/useChatStore';
import { storageService } from '@services/storageService';
import { groqService } from '@services/groqService';
import { useSettingsStore } from '@stores/useSettingsStore';
import type { Message } from '@apptypes/index';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000;

export const useOffline = () => {
  const chatStore = useChatStore();
  const settingsStore = useSettingsStore();
  const isProcessingRef = useRef(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);

  const refreshQueueCount = useCallback(async () => {
    try {
      const queue = await storageService.getOfflineQueue();
      setQueuedCount(queue.length);
    } catch {
      setQueuedCount(0);
    }
  }, []);

  const replaySingleItem = useCallback(
    async (payload: string, conversationId: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const message: Message = {
          id: `queued-${Date.now()}`,
          role: 'user',
          content: payload,
          timestamp: Date.now(),
          inputMode: 'text',
          isFavorite: false,
        };

        chatStore.addMessage(conversationId, message);

        const replyId = `queued-reply-${Date.now()}`;
        const replyMsg: Message = {
          id: replyId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          inputMode: 'text',
          isFavorite: false,
        };
        chatStore.addMessage(conversationId, replyMsg);

        const contextMessages = chatStore.getContextMessages(conversationId, payload);

        let accumulated = '';
        groqService
          .streamChat(
            contextMessages,
            settingsStore.assistantProfile,
            settingsStore.userProfile,
            (token) => {
              accumulated += token;
              chatStore.updateMessageContent(conversationId, replyId, accumulated);
            },
            () => resolve(true),
            (_err) => resolve(false)
          )
          .catch(() => resolve(false));
      });
    },
    [chatStore, settingsStore]
  );

  const syncOfflineQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const queue = await storageService.getOfflineQueue();
      if (queue.length === 0) {
        isProcessingRef.current = false;
        return;
      }

      const conversationId =
        chatStore.currentConversationId ?? chatStore.createConversation();

      for (const item of queue) {
        let success = false;
        for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
          success = await replaySingleItem(item.payload, conversationId);
          if (success) {
            await storageService.removeOfflineItem(item.id);
            break;
          }
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
        if (!success) {
          await storageService
            .saveAnalyticsLog({
              id: `offline-fail-${Date.now()}`,
              type: 'warn',
              message: `Offline queue item failed after ${MAX_RETRY_ATTEMPTS} retries`,
              timestamp: Date.now(),
              meta: { itemId: item.id },
            })
            .catch(() => {});
        }
      }

      await refreshQueueCount();
    } finally {
      isProcessingRef.current = false;
    }
  }, [chatStore, replaySingleItem, refreshQueueCount]);

  const enqueueMessage = useCallback(async (content: string) => {
    await storageService.enqueueOfflineItem({
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      payload: content,
      type: 'chat_message',
      createdAt: Date.now(),
    });
    await refreshQueueCount();
  }, [refreshQueueCount]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) {
        setTimeout(() => {
          syncOfflineQueue().catch(() => {});
        }, 500);
      }
    });

    NetInfo.fetch()
      .then((state) => {
        const online = state.isConnected === true && state.isInternetReachable !== false;
        setIsOnline(online);
        if (online) syncOfflineQueue().catch(() => {});
      })
      .catch(() => {});

    refreshQueueCount().catch(() => {});

    return () => unsubscribe();
  }, [syncOfflineQueue, refreshQueueCount]);

  return {
    isOnline,
    queuedCount,
    enqueueMessage,
    syncOfflineQueue,
    retryQueue: syncOfflineQueue,
  };
};
