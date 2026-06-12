export const GROQ_PRIMARY_MODEL = 'llama-3.3-70b-versatile';
export const GROQ_FALLBACK_MODEL = 'mixtral-8x7b-32768';
export const MAX_CONTEXT_TOKENS = 4000;
export const MAX_AUTO_RESTARTS = 3;
export const VAD_AMPLITUDE_THRESHOLD = 0.02;
export const VAD_SILENCE_TIMEOUT = 1500;
export const MEMORY_INJECT_COUNT = 3;
export const OFFLINE_CACHE_LIMIT = 50;
export const MAX_PINNED_CONVERSATIONS = 3;
export const TOOL_RATE_LIMIT_PER_MINUTE = 10;
export const AD_UNLOCK_TIMER_SECONDS = 30;
export const VOICE_AUTH_THRESHOLD = 0.85;
export const VOICE_AUTH_SAMPLES = 3;
export const GROQ_TIMEOUT_MS = 30000;
export const GROQ_RETRY_ATTEMPTS = 3;
export const CONTEXT_SLIDING_WINDOW = 5;
export const MAX_TOOL_LOOP_DETECT = 3;

// ─── SQLite Table Names ───────────────────────────────────────────────────────
export const SQLITE_TABLES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  MEMORIES: 'memories',
  MEMORY_SUMMARIES: 'memory_summaries',
  OFFLINE_QUEUE: 'offline_queue',
  DOCUMENTS: 'documents',
  DOCUMENT_CHUNKS: 'document_chunks',
  NOTES: 'notes',
  ANALYTICS: 'analytics',
} as const;

