import SQLite from 'react-native-sqlite-storage';
import { OFFLINE_CACHE_LIMIT } from '@utils/constants';
import { MMKV } from 'react-native-mmkv';
import { SQLITE_TABLES } from '@utils/constants';
import type { Message, Conversation, Memory, MemorySummary, Note, Document, DocumentChunk, AnalyticsEvent } from '@apptypes/index';

SQLite.enablePromise(true);

const mmkv = new MMKV();

// MMKV key for offline queue metadata
const OFFLINE_QUEUE_KEY = 'offline_queue_items';

export interface OfflineQueueItem {
  id: string;
  payload: string;
  type: string;
  createdAt: number;
}

class StorageService {
  private db: SQLite.SQLiteDatabase | null = null;

  /** Public init alias — called by App.tsx */
  async init(): Promise<void> {
    return this.initDatabase();
  }

  async initDatabase(): Promise<void> {
    this.db = await SQLite.openDatabase({
      name: 'manu_ai.db',
      location: 'default',
    });

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.CONVERSATIONS} (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_pinned INTEGER DEFAULT 0
      )
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.MESSAGES} (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        input_mode TEXT NOT NULL,
        is_favorite INTEGER DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES ${SQLITE_TABLES.CONVERSATIONS}(id)
      )
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.MEMORIES} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        relevance_score REAL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.MEMORY_SUMMARIES} (
        id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.OFFLINE_QUEUE} (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.DOCUMENTS} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.DOCUMENT_CHUNKS} (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        vector TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES ${SQLITE_TABLES.DOCUMENTS}(id)
      )
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.NOTES} (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_TABLES.ANALYTICS} (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
  }

  // ─── Conversations ──────────────────────────────────────────────────────────

  async saveConversation(conversation: Conversation): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(
      `INSERT OR REPLACE INTO ${SQLITE_TABLES.CONVERSATIONS} (id, title, created_at, updated_at, is_pinned) VALUES (?, ?, ?, ?, ?)`,
      [conversation.id, conversation.title, conversation.createdAt, conversation.updatedAt, conversation.isPinned ? 1 : 0]
    );
  }

  async getConversations(): Promise<Conversation[]> {
    if (!this.db) return [];
    const [results] = await this.db.executeSql(`SELECT * FROM ${SQLITE_TABLES.CONVERSATIONS} ORDER BY updated_at DESC`);
    const conversations: Conversation[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i) as { id: string; title: string; created_at: number; updated_at: number; is_pinned: number };
      conversations.push({
        id: row.id,
        title: row.title,
        messages: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isPinned: row.is_pinned === 1,
      });
    }
    return conversations;
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  async saveMessage(message: Message, conversationId: string): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(
      `INSERT OR REPLACE INTO ${SQLITE_TABLES.MESSAGES} (id, conversation_id, role, content, timestamp, input_mode, is_favorite) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [message.id, conversationId, message.role, message.content, message.timestamp, message.inputMode, message.isFavorite ? 1 : 0]
    );
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    if (!this.db) return [];
    const [results] = await this.db.executeSql(
      `SELECT * FROM ${SQLITE_TABLES.MESSAGES} WHERE conversation_id = ? ORDER BY timestamp ASC`,
      [conversationId]
    );
    const messages: Message[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i) as { id: string; role: string; content: string; timestamp: number; input_mode: string; is_favorite: number };
      messages.push({
        id: row.id,
        role: row.role as Message['role'],
        content: row.content,
        timestamp: row.timestamp,
        inputMode: row.input_mode as Message['inputMode'],
        isFavorite: row.is_favorite === 1,
      });
    }
    return messages;
  }

  // ─── Memories ──────────────────────────────────────────────────────────────

  async saveMemory(memory: Memory): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(
      `INSERT OR REPLACE INTO ${SQLITE_TABLES.MEMORIES} (id, content, category, relevance_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [memory.id, memory.content, memory.category, memory.relevanceScore, memory.createdAt, memory.updatedAt]
    );
  }

  async getMemories(): Promise<Memory[]> {
    if (!this.db) return [];
    const [results] = await this.db.executeSql(`SELECT * FROM ${SQLITE_TABLES.MEMORIES} ORDER BY relevance_score DESC`);
    const memories: Memory[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i) as { id: string; content: string; category: string; relevance_score: number; created_at: number; updated_at: number };
      memories.push({
        id: row.id,
        content: row.content,
        category: row.category,
        relevanceScore: row.relevance_score,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
    return memories;
  }

  async saveMemorySummary(summary: MemorySummary): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(
      `INSERT OR REPLACE INTO ${SQLITE_TABLES.MEMORY_SUMMARIES} (id, summary, message_count, created_at) VALUES (?, ?, ?, ?)`,
      [summary.id, summary.summary, summary.messageCount, summary.createdAt]
    );
  }

  async getMemorySummaries(): Promise<MemorySummary[]> {
    if (!this.db) return [];
    const [results] = await this.db.executeSql(`SELECT * FROM ${SQLITE_TABLES.MEMORY_SUMMARIES} ORDER BY created_at DESC`);
    const summaries: MemorySummary[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i) as { id: string; summary: string; message_count: number; created_at: number };
      summaries.push({
        id: row.id,
        summary: row.summary,
        messageCount: row.message_count,
        createdAt: row.created_at,
      });
    }
    return summaries;
  }

  async clearMemories(): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(`DELETE FROM ${SQLITE_TABLES.MEMORIES}`);
    await this.db.executeSql(`DELETE FROM ${SQLITE_TABLES.MEMORY_SUMMARIES}`);
  }

  // ─── Notes ─────────────────────────────────────────────────────────────────

  async saveNote(note: Note): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(
      `INSERT OR REPLACE INTO ${SQLITE_TABLES.NOTES} (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [note.id, note.title, note.content, note.createdAt, note.updatedAt]
    );
  }

  async getNotes(): Promise<Note[]> {
    if (!this.db) return [];
    const [results] = await this.db.executeSql(`SELECT * FROM ${SQLITE_TABLES.NOTES} ORDER BY updated_at DESC`);
    const notes: Note[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i) as { id: string; title: string; content: string; created_at: number; updated_at: number };
      notes.push({
        id: row.id,
        title: row.title,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
    return notes;
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(`DELETE FROM ${SQLITE_TABLES.NOTES} WHERE id = ?`, [id]);
  }

  // ─── Documents (RAG) ───────────────────────────────────────────────────────

  async saveDocument(document: Document): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(
      `INSERT OR REPLACE INTO ${SQLITE_TABLES.DOCUMENTS} (id, name, type, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      [document.id, document.name, document.type, document.content, document.createdAt]
    );
    for (const chunk of document.chunks) {
      await this.db.executeSql(
        `INSERT OR REPLACE INTO ${SQLITE_TABLES.DOCUMENT_CHUNKS} (id, document_id, content, vector, position) VALUES (?, ?, ?, ?, ?)`,
        [chunk.id, chunk.documentId, chunk.content, JSON.stringify(chunk.vector), chunk.position]
      );
    }
  }

  async getDocuments(): Promise<Document[]> {
    if (!this.db) return [];
    const [docResults] = await this.db.executeSql(`SELECT * FROM ${SQLITE_TABLES.DOCUMENTS} ORDER BY created_at DESC`);
    const documents: Document[] = [];
    for (let i = 0; i < docResults.rows.length; i++) {
      const row = docResults.rows.item(i) as { id: string; name: string; type: string; content: string; created_at: number };
      const [chunkResults] = await this.db.executeSql(
        `SELECT * FROM ${SQLITE_TABLES.DOCUMENT_CHUNKS} WHERE document_id = ? ORDER BY position ASC`,
        [row.id]
      );
      const chunks: DocumentChunk[] = [];
      for (let j = 0; j < chunkResults.rows.length; j++) {
        const cr = chunkResults.rows.item(j) as { id: string; document_id: string; content: string; vector: string; position: number };
        chunks.push({
          id: cr.id,
          documentId: cr.document_id,
          content: cr.content,
          vector: JSON.parse(cr.vector) as number[],
          position: cr.position,
        });
      }
      documents.push({
        id: row.id,
        name: row.name,
        type: row.type as Document['type'],
        content: row.content,
        chunks,
        createdAt: row.created_at,
      });
    }
    return documents;
  }

  async deleteDocument(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(`DELETE FROM ${SQLITE_TABLES.DOCUMENT_CHUNKS} WHERE document_id = ?`, [id]);
    await this.db.executeSql(`DELETE FROM ${SQLITE_TABLES.DOCUMENTS} WHERE id = ?`, [id]);
  }

  // ─── Offline Queue ──────────────────────────────────────────────────────────

  async enqueueOfflineItem(item: OfflineQueueItem): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(
      `INSERT OR REPLACE INTO ${SQLITE_TABLES.OFFLINE_QUEUE} (id, payload, type, created_at) VALUES (?, ?, ?, ?)`,
      [item.id, item.payload, item.type, item.createdAt]
    );
  }

  async getOfflineQueue(): Promise<OfflineQueueItem[]> {
    if (!this.db) return [];
    try {
      const [results] = await this.db.executeSql(
        `SELECT * FROM ${SQLITE_TABLES.OFFLINE_QUEUE} ORDER BY created_at ASC LIMIT ${OFFLINE_CACHE_LIMIT}`
      );
      const items: OfflineQueueItem[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i) as { id: string; payload: string; type: string; created_at: number };
        items.push({ id: row.id, payload: row.payload, type: row.type, createdAt: row.created_at });
      }
      return items;
    } catch {
      return [];
    }
  }

  async clearOfflineQueue(): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(`DELETE FROM ${SQLITE_TABLES.OFFLINE_QUEUE}`);
  }

  async removeOfflineItem(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(`DELETE FROM ${SQLITE_TABLES.OFFLINE_QUEUE} WHERE id = ?`, [id]);
  }

  // ─── Analytics ─────────────────────────────────────────────────────────────

  async logAnalytics(event: AnalyticsEvent): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(
      `INSERT INTO ${SQLITE_TABLES.ANALYTICS} (id, event_type, payload, timestamp) VALUES (?, ?, ?, ?)`,
      [event.id, event.eventType, JSON.stringify(event.payload), event.timestamp]
    );
  }

  async getAnalytics(): Promise<AnalyticsEvent[]> {
    if (!this.db) return [];
    const [results] = await this.db.executeSql(`SELECT * FROM ${SQLITE_TABLES.ANALYTICS} ORDER BY timestamp DESC`);
    const events: AnalyticsEvent[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i) as { id: string; event_type: string; payload: string; timestamp: number };
      events.push({
        id: row.id,
        eventType: row.event_type,
        payload: JSON.parse(row.payload) as Record<string, unknown>,
        timestamp: row.timestamp,
      });
    }
    return events;
  }

  async clearAnalytics(): Promise<void> {
    if (!this.db) return;
    await this.db.executeSql(`DELETE FROM ${SQLITE_TABLES.ANALYTICS}`);
  }

  // ─── Debug / Analytics Helpers ─────────────────────────────────────────────

  async saveAnalyticsLog(log: {
    id: string;
    type: 'error' | 'info' | 'warn' | 'crash' | 'token' | 'perf';
    message: string;
    timestamp: number;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.executeSql(
        `INSERT OR REPLACE INTO ${SQLITE_TABLES.ANALYTICS} (id, event_type, payload, timestamp) VALUES (?, ?, ?, ?)`,
        [log.id, log.type, JSON.stringify({ message: log.message, meta: log.meta ?? {} }), log.timestamp]
      );
    } catch {
      // Fail silently — crash handler must never throw
    }
  }

  async getAnalyticsLogs(): Promise<unknown[]> {
    if (!this.db) return [];
    try {
      const [results] = await this.db.executeSql(
        `SELECT * FROM ${SQLITE_TABLES.ANALYTICS} ORDER BY timestamp DESC LIMIT 200`
      );
      const logs: unknown[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i) as { id: string; event_type: string; payload: string; timestamp: number };
        const payload = JSON.parse(row.payload ?? '{}') as { message?: string; meta?: Record<string, unknown> };
        logs.push({
          id: row.id,
          type: row.event_type,
          message: payload.message ?? '',
          timestamp: row.timestamp,
          meta: payload.meta,
        });
      }
      return logs;
    } catch {
      return [];
    }
  }

  async getTokenStats(): Promise<unknown> {
    if (!this.db) return { totalTokens: 0, totalMessages: 0, avgTokensPerMessage: 0, conversationBreakdown: [] };
    try {
      const [results] = await this.db.executeSql(
        `SELECT * FROM ${SQLITE_TABLES.ANALYTICS} WHERE event_type = 'token' ORDER BY timestamp DESC`
      );
      let totalTokens = 0;
      let totalMessages = 0;
      const breakdown: Record<string, number> = {};

      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i) as { payload: string };
        const payload = JSON.parse(row.payload ?? '{}') as { tokens?: number; conversationId?: string };
        const tokens = payload.tokens ?? 0;
        totalTokens += tokens;
        totalMessages += 1;
        const convId = payload.conversationId ?? 'unknown';
        breakdown[convId] = (breakdown[convId] ?? 0) + tokens;
      }

      return {
        totalTokens,
        totalMessages,
        avgTokensPerMessage: totalMessages > 0 ? totalTokens / totalMessages : 0,
        conversationBreakdown: Object.entries(breakdown).map(([id, tokens]) => ({ id, tokens })),
      };
    } catch {
      return { totalTokens: 0, totalMessages: 0, avgTokensPerMessage: 0, conversationBreakdown: [] };
    }
  }

  async trackTokenUsage(conversationId: string, tokens: number): Promise<void> {
    await this.saveAnalyticsLog({
      id: `token-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'token',
      message: `${tokens} tokens used`,
      timestamp: Date.now(),
      meta: { tokens, conversationId },
    });
  }

  async getPerfMetrics(): Promise<unknown> {
    const raw = mmkv.getString('perf_metrics');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  async updatePerfMetric(key: string, value: number): Promise<void> {
    const existing = (await this.getPerfMetrics() as Record<string, number> | null) ?? {};
    existing[key] = value;
    if (key === 'responseMs') {
      const count = (existing.totalApiCalls ?? 0) + 1;
      const prev = existing.avgResponseMs ?? 0;
      existing.avgResponseMs = (prev * (count - 1) + value) / count;
      existing.totalApiCalls = count;
    }
    mmkv.set('perf_metrics', JSON.stringify(existing));
  }

  async trackApiFailure(): Promise<void> {
    const existing = (await this.getPerfMetrics() as Record<string, number> | null) ?? {};
    existing.failedApiCalls = (existing.failedApiCalls ?? 0) + 1;
    mmkv.set('perf_metrics', JSON.stringify(existing));
  }

  async clearAllData(): Promise<void> {
    if (!this.db) return;
    const tables = Object.values(SQLITE_TABLES);
    for (const table of tables) {
      await this.db.executeSql(`DELETE FROM ${table}`);
    }
    mmkv.clearAll();
  }

  // MMKV helpers
  getMMKVString(key: string): string | undefined {
    return mmkv.getString(key);
  }

  setMMKVString(key: string, value: string): void {
    mmkv.set(key, value);
  }

  getMMKVBoolean(key: string): boolean | undefined {
    return mmkv.getBoolean(key);
  }

  setMMKVBoolean(key: string, value: boolean): void {
    mmkv.set(key, value);
  }

  // Proxy to groqService encrypted storage (for backward compat with SettingsScreen)
  async saveApiKey(key: string): Promise<void> {
    const { groqService } = await import('@services/groqService');
    await groqService.saveApiKey(key);
  }

  async loadApiKey(): Promise<string | null> {
    try {
      const EncryptedStorage = (await import('react-native-encrypted-storage')).default;
      return await EncryptedStorage.getItem('groq_api_key');
    } catch {
      return null;
    }
  }

}

export const storageService = new StorageService();
