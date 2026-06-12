import { useCallback, useRef } from 'react';
import { useChatStore } from '@stores/useChatStore';
import { useVoiceStore } from '@stores/useVoiceStore';
import { useSettingsStore } from '@stores/useSettingsStore';
import { useAvatarStore } from '@stores/useAvatarStore';
import { plannerAgent } from '@agents/PlannerAgent';
import { chatAgent } from '@agents/ChatAgent';
import { toolAgent } from '@agents/ToolAgent';
import { memoryAgent } from '@agents/MemoryAgent';
import { ragModule } from '@modules/RAGModule';
import { ttsService } from '@services/ttsService';
import { storageService } from '@services/storageService';
import { CuteLanguageModule } from '@modules/CuteLanguageModule';
import { buildContext } from '@utils/SmartContextEngine';
import { processCommand } from '@utils/CommandProcessor';
import { sanitizeInput } from '@utils/validators';
import { useOffline } from '@hooks/useOffline';
import { MAX_CONTEXT_TOKENS } from '@utils/constants';
import type { InputMode } from '@apptypes/index';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function useChat() {
  const chatStore = useChatStore();
  const voiceStore = useVoiceStore();
  const settingsStore = useSettingsStore();
  const avatarStore = useAvatarStore();
  const { isOnline } = useOffline();

  // Stable refs — always point to latest values, safe to use inside async callbacks
  const chatStoreRef = useRef(chatStore);
  const voiceStoreRef = useRef(voiceStore);
  const settingsStoreRef = useRef(settingsStore);
  const avatarStoreRef = useRef(avatarStore);
  const isOnlineRef = useRef(isOnline);

  chatStoreRef.current = chatStore;
  voiceStoreRef.current = voiceStore;
  settingsStoreRef.current = settingsStore;
  avatarStoreRef.current = avatarStore;
  isOnlineRef.current = isOnline;

  const sendMessage = useCallback(
    async (text: string, mode: InputMode): Promise<void> => {
      const cs = chatStoreRef.current;
      const vs = voiceStoreRef.current;
      const ss = settingsStoreRef.current;
      const as = avatarStoreRef.current;
      const online = isOnlineRef.current;

      // Ensure conversation exists — capture convId at call time
      let convId = cs.currentConversationId;
      if (!convId) {
        convId = cs.createConversation();
        cs.setCurrentConversation(convId);
      }

      // Snapshot convId into a const so all async callbacks below use same value
      const activeConvId = convId;

      // 1. Add user message
      cs.addMessage(activeConvId, {
        id: generateId(),
        role: 'user',
        content: text,
        inputMode: mode,
        isFavorite: false,
      });

      // 2. Track input mode
      vs.setInputMode(mode);

      // 3a. Safety: prompt injection detection
      const { safe, sanitized } = sanitizeInput(text);
      if (!safe) {
        cs.addMessage(activeConvId, {
          id: generateId(),
          role: 'assistant',
          content: 'I detected a potential prompt injection attempt in your message. Please rephrase your request.',
          inputMode: mode,
          isFavorite: false,
        });
        return;
      }
      const safeText = sanitized;

      // 3. Slash command handling
      const cmdResult = processCommand(safeText);
      if (cmdResult !== null) {
        if (cmdResult.response === '__CLEAR_MEMORY__') {
          cs.addMessage(activeConvId, {
            id: generateId(),
            role: 'assistant',
            content: 'Memory cleared.',
            inputMode: mode,
            isFavorite: false,
          });
          return;
        }
        if (cmdResult.toolCall) {
          const result = await toolAgent.execute(
            cmdResult.toolCall.tool,
            cmdResult.toolCall.params,
          );
          cs.addMessage(activeConvId, {
            id: generateId(),
            role: 'assistant',
            content: result.success ? (result.data ?? 'Done.') : (result.error ?? 'Failed.'),
            inputMode: mode,
            isFavorite: false,
          });
          return;
        }
        if (
          cmdResult.response &&
          cmdResult.response !== '__EXPORT_CHATS__' &&
          cmdResult.response !== '__OPEN_SETTINGS__'
        ) {
          cs.addMessage(activeConvId, {
            id: generateId(),
            role: 'assistant',
            content: cmdResult.response,
            inputMode: mode,
            isFavorite: false,
          });
          return;
        }
      }

      // 4. Offline queue
      if (!online) {
        await storageService
          .enqueueOfflineItem({
            id: generateId(),
            payload: JSON.stringify({ text, inputMode: mode, conversationId: activeConvId }),
            type: 'chat_message',
            createdAt: Date.now(),
          })
          .catch(() => {});
        cs.addMessage(activeConvId, {
          id: generateId(),
          role: 'assistant',
          content: "You're offline. Message queued — will be sent when reconnected.",
          inputMode: mode,
          isFavorite: false,
        });
        return;
      }

      // 5. Plan
      const allMessages = cs.getMessages(activeConvId);
      const plan = plannerAgent.plan(safeText, allMessages);

      // 6. Memory context
      let memoryContext = '';
      if (plan.useMemory) {
        try {
          memoryContext = await memoryAgent.retrieveRelevantContext(safeText, 3);
        } catch { /* silent */ }
      }

      // 7. RAG context
      let ragContext = '';
      try {
        ragContext = await ragModule.buildContext(safeText, 3);
      } catch { /* silent */ }

      // 8. Tool execution
      let toolResultText = '';
      if (plan.useTools && plan.toolHint && plan.toolHint !== 'command') {
        try {
          const toolResult = await toolAgent.execute(plan.toolHint, { query: safeText });
          if (toolResult.success && toolResult.data) {
            toolResultText = toolResult.data;
          }
        } catch { /* fall through to chat */ }
      }

      // 9. Streaming chat response
      if (plan.useChat) {
        const contextMessages = buildContext({
          messages: allMessages,
          memories: memoryContext,
          ragContext,
          maxTokens: MAX_CONTEXT_TOKENS,
        });

        const assistantMsgId = generateId();
        cs.addMessage(activeConvId, {
          id: assistantMsgId,
          role: 'assistant',
          content: toolResultText,
          inputMode: mode,
          isFavorite: false,
          isStreaming: true,
        });
        cs.setStreaming(true);

        let fullText = toolResultText;

        await chatAgent.chat({
          messages: contextMessages,
          assistantProfile: ss.assistantProfile,
          userProfile: ss.userProfile,
          memoryContext,
          ragContext,
          onToken: (token) => {
            fullText += token;
            // Use ref snapshot — activeConvId is already stable
            chatStoreRef.current.updateMessageContent(activeConvId, assistantMsgId, fullText);
          },
          onComplete: async (completed) => {
            fullText = completed;
            chatStoreRef.current.updateMessage(activeConvId, assistantMsgId, {
              content: fullText,
              isStreaming: false,
            });
            chatStoreRef.current.setStreaming(false);

            // 10. TTS decision
            const currentSs = settingsStoreRef.current;
            const alwaysSpeak = currentSs.alwaysSpeakResponses ?? false;
            const cuteMode = currentSs.avatarCuteMode ?? 'mild';

            if (mode === 'voice' || alwaysSpeak) {
              const ttsText = CuteLanguageModule.transformForTTS(fullText, cuteMode);
              avatarStoreRef.current.setIsTalking(true);
              voiceStoreRef.current.setSpeaking(true);
              try {
                await ttsService.speak(ttsText);
              } finally {
                avatarStoreRef.current.setIsTalking(false);
                voiceStoreRef.current.setSpeaking(false);
              }
            }

            // 11. Memory summarise every 5 messages
            const currentCs = chatStoreRef.current;
            const msgCount = currentCs.getMessageCount(activeConvId);
            if (msgCount > 0 && msgCount % 5 === 0) {
              try {
                await memoryAgent.processConversation(currentCs.getMessages(activeConvId));
              } catch { /* silent */ }
            }
          },
          onError: (err) => {
            chatStoreRef.current.updateMessage(activeConvId, assistantMsgId, {
              content: `Error: ${err.message}`,
              isStreaming: false,
            });
            chatStoreRef.current.setStreaming(false);
          },
        });
      } else if (toolResultText) {
        cs.addMessage(activeConvId, {
          id: generateId(),
          role: 'assistant',
          content: toolResultText,
          inputMode: mode,
          isFavorite: false,
        });
      }
    },
    // sendMessage is now stable — all store access via refs
    [],
  );

  return { sendMessage };
}
