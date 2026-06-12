import { create } from 'zustand';
import { MAX_PINNED_CONVERSATIONS } from '@utils/constants';
import type { Message, Conversation } from '@apptypes/index';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

type MessageInput = Omit<Message, 'id' | 'timestamp' | 'isFavorite'> &
  Partial<Pick<Message, 'id' | 'timestamp' | 'isFavorite'>>;

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  pinnedConversations: string[];
  isStreaming: boolean;

  // Message actions
  addMessage: (conversationId: string, message: MessageInput) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  updateMessageContent: (conversationId: string, messageId: string, content: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  toggleFavorite: (conversationId: string, messageId: string) => void;

  // Conversation actions
  createConversation: () => string;
  setCurrentConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  pinConversation: (id: string) => void;
  unpinConversation: (id: string) => void;
  clearAllConversations: () => void;
  setStreaming: (isStreaming: boolean) => void;

  // Queries
  getMessages: (conversationId: string) => Message[];
  getMessageCount: (conversationId: string) => number;
  getContextMessages: (conversationId: string, _query: string) => Message[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  pinnedConversations: [],
  isStreaming: false,

  addMessage: (conversationId, message) => {
    const full: Message = {
      id: message.id ?? generateId(),
      role: message.role,
      content: message.content,
      timestamp: message.timestamp ?? Date.now(),
      inputMode: message.inputMode ?? 'text',
      isFavorite: message.isFavorite ?? false,
      isStreaming: message.isStreaming,
      toolCalls: message.toolCalls,
    };
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, messages: [...conv.messages, full], updatedAt: Date.now() }
          : conv
      ),
    }));
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              ),
              updatedAt: Date.now(),
            }
          : conv
      ),
    }));
  },

  updateMessageContent: (conversationId, messageId, content) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, content } : msg
              ),
            }
          : conv
      ),
    }));
  },

  deleteMessage: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, messages: conv.messages.filter((msg) => msg.id !== messageId) }
          : conv
      ),
    }));
  },

  toggleFavorite: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, isFavorite: !msg.isFavorite } : msg
              ),
            }
          : conv
      ),
    }));
  },

  createConversation: () => {
    const id = generateId();
    const newConversation: Conversation = {
      id,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false,
    };
    set((state) => ({
      conversations: [newConversation, ...state.conversations],
      currentConversationId: id,
    }));
    return id;
  },

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  deleteConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.filter((conv) => conv.id !== id),
      pinnedConversations: state.pinnedConversations.filter((pid) => pid !== id),
      currentConversationId:
        state.currentConversationId === id ? null : state.currentConversationId,
    }));
  },

  pinConversation: (id) => {
    set((state) => {
      if (state.pinnedConversations.includes(id)) return state;
      if (state.pinnedConversations.length >= MAX_PINNED_CONVERSATIONS) {
        return state; // max pinned conversations reached
      }
      const newPinned = [...state.pinnedConversations, id].slice(0, 3);
      return {
        pinnedConversations: newPinned,
        conversations: state.conversations.map((conv) =>
          conv.id === id ? { ...conv, isPinned: true } : conv
        ),
      };
    });
  },

  unpinConversation: (id) => {
    set((state) => ({
      pinnedConversations: state.pinnedConversations.filter((pid) => pid !== id),
      conversations: state.conversations.map((conv) =>
        conv.id === id ? { ...conv, isPinned: false } : conv
      ),
    }));
  },

  setStreaming: (isStreaming) => set({ isStreaming }),
  clearAllConversations: () => set({ conversations: [], currentConversationId: null }),

  getMessages: (conversationId) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    return conv?.messages ?? [];
  },

  getMessageCount: (conversationId) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    return conv?.messages.length ?? 0;
  },

  // Returns last 10 messages for context (sliding window)
  getContextMessages: (conversationId, _query) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return [];
    return conv.messages.slice(-10);
  },
}));
