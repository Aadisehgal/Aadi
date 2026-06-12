import axios, { type AxiosInstance } from 'axios';
import EncryptedStorage from 'react-native-encrypted-storage';
import { storageService } from '@services/storageService';
import type { Message, AssistantProfile, UserProfile } from '@apptypes/index';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const API_KEY_STORAGE = 'groq_api_key';

// Primary and fallback models per spec
const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'mixtral-8x7b-32768';
const MAX_RETRY_ATTEMPTS = 3;

interface StreamChatCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

interface GroqChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class GroqService {
  private client: AxiosInstance;
  private apiKey: string = '';
  private model: string = PRIMARY_MODEL;

  constructor() {
    this.client = axios.create({
      baseURL: GROQ_BASE_URL,
      timeout: 30_000,
    });
  }

  async loadApiKey(): Promise<void> {
    try {
      const key = await EncryptedStorage.getItem(API_KEY_STORAGE);
      if (key) this.apiKey = key;
    } catch {
      // No key stored yet
    }
  }

  async saveApiKey(key: string): Promise<void> {
    this.apiKey = key;
    await EncryptedStorage.setItem(API_KEY_STORAGE, key);
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  hasApiKey(): boolean {
    return this.apiKey.length > 0;
  }

  private buildSystemPrompt(
    assistant: AssistantProfile,
    user: UserProfile,
    ragContext: string = '',
    memoryContext: string = '',
    toolsSection: string = ''
  ): string {
    const parts = [
      `You are ${assistant.name}, an AI assistant with a ${assistant.personality} personality.`,
      `The user's name is ${user.name}${user.nickname ? ` (${user.nickname})` : ''}. Use a ${user.tone} tone. Language: ${user.language}.`,
    ];
    if (memoryContext) {
      parts.push(`\nMemory context:\n${memoryContext}`);
    }
    if (ragContext) {
      parts.push(`\n${ragContext}`);
    }
    if (toolsSection) {
      parts.push(`\n${toolsSection}`);
    }
    parts.push('\nBe helpful, concise, and accurate. Never fabricate facts.');
    return parts.join('\n');
  }

  /**
   * Attempt a streaming request on a specific model.
   * Returns true if successful, false if a retriable error occurred.
   */
  private async attemptStream(
    model: string,
    groqMessages: GroqChatMessage[],
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (error: string) => void,
    startTime: number
  ): Promise<boolean> {
    try {
      const response = await this.client.post(
        '/chat/completions',
        {
          model,
          messages: groqMessages,
          max_tokens: 1024,
          stream: true,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
        }
      );

      const stream = response.data as {
        on: (event: string, cb: (chunk: unknown) => void) => void;
      };

      let buffer = '';

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: unknown) => {
          const text = typeof chunk === 'string' ? chunk : String(chunk);
          buffer += text;

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const stripped = line.trim();
            if (!stripped || stripped === 'data: [DONE]') continue;
            if (!stripped.startsWith('data: ')) continue;

            try {
              const json = JSON.parse(stripped.slice(6)) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const token = json.choices?.[0]?.delta?.content;
              if (token) onToken(token);
            } catch {
              // Malformed chunk — skip
            }
          }
        });

        stream.on('end', async () => {
          const responseMs = Date.now() - startTime;
          await storageService.updatePerfMetric('responseMs', responseMs).catch(() => {});
          resolve();
        });

        stream.on('error', (err: unknown) => {
          reject(err);
        });
      });

      onDone();
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        // 401 = bad key, 429 = rate limited — don't retry with fallback
        if (status === 401) {
          onError('Invalid API key. Please check your Groq API key in Settings.');
          return true; // mark handled, don't retry
        }
        if (status === 429) {
          onError('Rate limit exceeded. Please wait a moment and try again.');
          return true;
        }
      }
      // Retriable error
      return false;
    }
  }

  /**
   * Stream a chat response with automatic retry (3 attempts, exponential backoff)
   * and automatic fallback to mixtral-8x7b-32768 if primary model fails.
   */
  async streamChat(
    messages: Message[],
    assistant: AssistantProfile,
    user: UserProfile,
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (error: string) => void,
    options?: {
      ragContext?: string;
      memoryContext?: string;
      toolsSection?: string;
    }
  ): Promise<void> {
    if (!this.apiKey) {
      onError('No API key configured. Please add your Groq API key in Settings.');
      return;
    }

    const systemPrompt = this.buildSystemPrompt(
      assistant,
      user,
      options?.ragContext,
      options?.memoryContext,
      options?.toolsSection
    );

    const groqMessages: GroqChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const startTime = Date.now();
    const modelsToTry = [this.model, this.model === PRIMARY_MODEL ? FALLBACK_MODEL : PRIMARY_MODEL];

    for (const modelToUse of modelsToTry) {
      for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        const success = await this.attemptStream(
          modelToUse,
          groqMessages,
          onToken,
          onDone,
          onError,
          startTime
        );

        if (success) return;

        // Exponential backoff before retry: 500ms, 1000ms, 2000ms
        if (attempt < MAX_RETRY_ATTEMPTS) {
          await sleep(500 * Math.pow(2, attempt - 1));
        }
      }
      // Primary model exhausted — trying fallback
    }

    await storageService.trackApiFailure().catch(() => {});
    onError('All models unavailable after 3 attempts. Please check your connection and try again.');
  }

  /**
   * Non-streaming completion with retry + fallback.
   */
  async complete(
    prompt: string,
    systemPrompt?: string,
    maxTokens = 512
  ): Promise<string> {
    if (!this.apiKey) throw new Error('No API key configured');

    const messages: GroqChatMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const modelsToTry = [this.model, this.model === PRIMARY_MODEL ? FALLBACK_MODEL : PRIMARY_MODEL];

    for (const modelToUse of modelsToTry) {
      for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          const response = await this.client.post<{
            choices: Array<{ message: { content: string } }>;
          }>(
            '/chat/completions',
            {
              model: modelToUse,
              messages,
              max_tokens: maxTokens,
              stream: false,
              temperature: 0.3,
            },
            {
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          return response.data.choices[0]?.message?.content ?? '';
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            if (status === 401 || status === 429) throw error; // don't retry auth/rate errors
          }
          if (attempt < MAX_RETRY_ATTEMPTS) {
            await sleep(500 * Math.pow(2, attempt - 1));
          }
        }
      }
    }

    throw new Error('All models unavailable after retries');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.complete('Say "ok" in one word.', undefined, 10);
      return true;
    } catch {
      return false;
    }
  }
}

export const groqService = new GroqService();

export type { StreamChatCallbacks };
