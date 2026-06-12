import { groqService } from '@services/groqService';
import { GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL } from '@utils/constants';
import type { Message, AssistantProfile, UserProfile, MemorySummary } from '@apptypes/index';
import { buildContext } from '@modules/ContextModule';
import { analyticsService } from '@services/analyticsService';
import { detectPromptInjection, buildSafetyErrorMessage } from '@utils/SafetySystem';

interface ChatParams {
  messages: Message[];
  assistantProfile: AssistantProfile;
  userProfile: UserProfile;
  memoryContext: string;
  ragContext: string;
  summaries?: MemorySummary[];
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (err: Error) => void;
}

async function attemptChat(
  params: ChatParams,
  attempt: number,
): Promise<void> {
  const {
    messages,
    assistantProfile,
    userProfile,
    memoryContext,
    ragContext,
    summaries = [],
    onToken,
    onComplete,
    onError,
  } = params;

  // Injection detection on last user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (lastUserMsg && detectPromptInjection(lastUserMsg.content)) {
    onError(new Error(buildSafetyErrorMessage('injection')));
    return;
  }

  const systemPrompt = `You are ${assistantProfile.name}, a ${assistantProfile.personality} AI assistant.
The user is ${userProfile.name}${userProfile.nickname ? ` (${userProfile.nickname})` : ''}.
Respond in ${userProfile.language} with a ${userProfile.tone} tone.${ragContext ? `\n\n[Document Context]\n${ragContext}` : ''}`;

  const memories = memoryContext ? memoryContext.split('\n').filter(Boolean) : [];

  // Build context for token budgeting (used for pruning only — we still pass Message[] to streamChat)
  const { messages: builtRaw, pruned } = buildContext(systemPrompt, messages, memories, summaries);
  // Recover pruned Message objects in original order (builtRaw includes system prompt at index 0)
  const builtIds = new Set(
    builtRaw.slice(1).map((_, i) => messages[i]?.id).filter(Boolean)
  );
  const prunedMessages: Message[] = pruned > 0
    ? messages.filter((m) => builtIds.has(m.id))
    : messages;

  // Switch to fallback model on last attempt
  if (attempt > 1) {
    groqService.setModel(GROQ_FALLBACK_MODEL);
  } else {
    groqService.setModel(GROQ_PRIMARY_MODEL);
  }

  return new Promise((resolve) => {
    let fullText = '';

    groqService
      .streamChat(
        prunedMessages,
        assistantProfile,
        userProfile,
        (token) => {
          fullText += token;
          onToken(token);
        },
        () => {
          analyticsService.trackTokens(Math.ceil(fullText.length / 4));
          onComplete(fullText);
          resolve();
        },
        (errMsg) => {
          const error = new Error(errMsg);
          const maxAttempts = 3;
          if (attempt < maxAttempts) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            setTimeout(() => {
              attemptChat(params, attempt + 1)
                .then(resolve)
                .catch(() => {
                  onError(error);
                  resolve();
                });
            }, delay);
          } else {
            onError(error);
            resolve();
          }
        },
        { ragContext, memoryContext },
      )
      .catch((e: unknown) => {
        const error = e instanceof Error ? e : new Error(String(e));
        onError(error);
        resolve();
      });
  });
}

export class ChatAgent {
  async chat(params: ChatParams): Promise<void> {
    return attemptChat(params, 1);
  }
}

export const chatAgent = new ChatAgent();
