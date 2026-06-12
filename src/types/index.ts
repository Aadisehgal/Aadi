// ─── Auth ─────────────────────────────────────────────────────────────────────

export type AuthMode = 'pin' | 'voice' | 'guest' | 'voice+pin';

export interface VoiceProfile {
  id: string;
  name: string;
  mfccFeatures: number[][];
  createdAt: number;
}

// ─── Chat / Messages ──────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';
export type InputMode = 'text' | 'voice';

export interface ToolCallRef {
  tool: string;
  params: Record<string, unknown>;
  result?: ToolResult;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  inputMode: InputMode;
  isFavorite: boolean;
  isStreaming?: boolean;
  toolCalls?: ToolCallRef[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  content: string;
  category: string;
  relevanceScore: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemorySummary {
  id: string;
  summary: string;
  messageCount: number;
  createdAt: number;
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Documents (RAG) ──────────────────────────────────────────────────────────

export type DocumentType = 'pdf' | 'txt' | 'docx';

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  vector: number[];
  position: number;
}

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  content: string;
  chunks: DocumentChunk[];
  createdAt: number;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  requiresConfirmation?: boolean;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: string;
  error?: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AssistantProfile {
  voice?: string;        // default: 'nova'
  nickname?: string;
  greeting?: string;     // default: 'Hello, how can I assist you?'
  avatar?: string;       // default: 'default.glb'
  name: string;
  personality: string;
  voiceEnabled: boolean;
  avatarEnabled: boolean;
  streamingEnabled: boolean;
}

export interface UserProfile {
  nickname?: string;
  name: string;
  language: string;
  tone: 'casual' | 'professional' | 'friendly' | 'concise';
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Debug: undefined;
  Reminders: undefined;
};

export type MainTabParamList = {
  Chat: undefined;
  Convs: undefined;
  Avatar: undefined;
  Docs: undefined;
  Memory: undefined;
  Notes: undefined;
  Settings: undefined;
};

// ─── SQLite Table Names ───────────────────────────────────────────────────────

export interface SqliteTables {
  CONVERSATIONS: string;
  MESSAGES: string;
  MEMORIES: string;
  MEMORY_SUMMARIES: string;
  OFFLINE_QUEUE: string;
  DOCUMENTS: string;
  DOCUMENT_CHUNKS: string;
  NOTES: string;
  ANALYTICS: string;
}

// ─── CuteLanguage ─────────────────────────────────────────────────────────────

export type CuteMode = 'off' | 'mild' | 'full';

// ─── Voice ───────────────────────────────────────────────────────────────────

export type VoiceMode = 'hold' | 'tap';

// ─── Ad ──────────────────────────────────────────────────────────────────────

export interface AdFailureLog {
  reason: string;
  timestamp: number;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export interface PluginResult {
  success: boolean;
  data?: string;
  error?: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  execute: (params: Record<string, unknown>) => Promise<PluginResult>;
}

// ─── Log ─────────────────────────────────────────────────────────────────────

export interface AnalyticsLog {
  id: string;
  type: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

// ─── Agent Plan ───────────────────────────────────────────────────────────────

export interface AgentPlan {
  useChat: boolean;
  useTools: boolean;
  useMemory: boolean;
  toolHint?: string;
}

// ─── Command ─────────────────────────────────────────────────────────────────

export interface CommandResult {
  handled: boolean;
  response?: string;
  toolCall?: { tool: string; params: Record<string, unknown> };
}
