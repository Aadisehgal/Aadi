import { useMemoryStore } from '@stores/useMemoryStore';
import { storageService } from '@services/storageService';
import type { Memory, MemorySummary, Message } from '@apptypes/index';

// ─── Fact extraction patterns ─────────────────────────────────────────────────

interface FactPattern {
  regex: RegExp;
  category: string;
}

const FACT_PATTERNS: FactPattern[] = [
  { regex: /i (?:really )?(?:like|love|enjoy|prefer|adore) (.+?)(?:\.|,|$)/i, category: 'preference' },
  { regex: /i (?:hate|dislike|can't stand|despise) (.+?)(?:\.|,|$)/i, category: 'preference' },
  { regex: /my name is (.+?)(?:\.|,|$)/i, category: 'personal' },
  { regex: /(?:call me|i'm|i am) (.+?)(?:\.|,|$)/i, category: 'personal' },
  { regex: /my (?:birthday|birth date) is (.+?)(?:\.|,|$)/i, category: 'personal' },
  { regex: /i(?:'m| am) (\d+) years old/i, category: 'personal' },
  { regex: /i work(?:ed)? (?:as|at) (.+?)(?:\.|,|$)/i, category: 'professional' },
  { regex: /my (?:job|profession|occupation) is (.+?)(?:\.|,|$)/i, category: 'professional' },
  { regex: /i live in (.+?)(?:\.|,|$)/i, category: 'location' },
  { regex: /i(?:'m| am) from (.+?)(?:\.|,|$)/i, category: 'location' },
  { regex: /i(?:'m| am) (?:a |an )?(.+?)(?:\.|,|$)/i, category: 'identity' },
  { regex: /i(?:'m| am) (?:studying|learning) (.+?)(?:\.|,|$)/i, category: 'education' },
  { regex: /my (?:goal|dream|plan) is (?:to )?(.+?)(?:\.|,|$)/i, category: 'goal' },
];

// ─── Relevance Scoring ────────────────────────────────────────────────────────

/**
 * Score memory relevance to a query using term overlap + recency bias.
 */
function scoreRelevance(memory: Memory, query: string): number {
  const queryTerms = tokenize(query);
  const contentTerms = tokenize(memory.content);

  const overlap = queryTerms.filter((qt) =>
    contentTerms.some((ct) => ct.includes(qt) || qt.includes(ct))
  ).length;

  const termScore = queryTerms.length > 0 ? overlap / queryTerms.length : 0;

  // Recency bias: more recent = higher base score
  const ageDays = (Date.now() - memory.updatedAt) / (1000 * 60 * 60 * 24);
  const recencyBonus = Math.max(0, 1 - ageDays / 30) * 0.2;

  // Category weight
  const categoryWeight: Record<string, number> = {
    personal: 1.2,
    professional: 1.1,
    preference: 1.0,
    goal: 1.0,
    location: 0.9,
    identity: 1.1,
    education: 1.0,
    general: 0.8,
  };
  const catBonus = (categoryWeight[memory.category] ?? 1.0) - 1;

  return termScore + recencyBonus + catBonus * 0.1;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

// ─── MemoryAgent ──────────────────────────────────────────────────────────────

class MemoryAgent {
  /**
   * Called after every N messages. Triggers summary + fact extraction.
   */
  async processConversation(messages: Message[]): Promise<void> {
    await Promise.all([
      this.createSummary(messages),
      this.extractFacts(messages),
    ]);
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  private async createSummary(messages: Message[]): Promise<void> {
    const lastFive = messages.slice(-5);
    if (lastFive.length === 0) return;

    // Build a concise summary text from the last 5 messages
    const parts = lastFive.map((m) => {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      const snippet = m.content.length > 120 ? `${m.content.substring(0, 120)}…` : m.content;
      return `${role}: ${snippet}`;
    });
    const summary = parts.join(' | ');

    const newSummary: MemorySummary = {
      id: `summary-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      summary,
      messageCount: lastFive.length,
      createdAt: Date.now(),
    };

    useMemoryStore.getState().addSummary({
      summary: newSummary.summary,
      messageCount: newSummary.messageCount,
    });

    // Persist to SQLite
    await storageService.saveMemorySummary(newSummary);
  }

  // ── Fact Extraction ────────────────────────────────────────────────────────

  private async extractFacts(messages: Message[]): Promise<void> {
    const userMessages = messages.filter((m) => m.role === 'user');
    const newMemories: Memory[] = [];

    for (const message of userMessages) {
      for (const pattern of FACT_PATTERNS) {
        const match = message.content.match(pattern.regex);
        if (!match) continue;

        const factText = match[0].trim();
        if (factText.length < 5) continue;

        // Dedup: skip if similar memory already exists
        const existing = useMemoryStore.getState().memories;
        const isDuplicate = existing.some(
          (m) =>
            m.category === pattern.category &&
            tokenize(m.content).some((t) => tokenize(factText).includes(t))
        );
        if (isDuplicate) continue;

        const memory: Memory = {
          id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          content: factText,
          category: pattern.category,
          relevanceScore: 1.0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        useMemoryStore.getState().addMemory({
          content: memory.content,
          category: memory.category,
          relevanceScore: memory.relevanceScore,
        });

        newMemories.push(memory);
        break; // one fact per message to avoid noise
      }
    }

    // Batch persist
    for (const memory of newMemories) {
      await storageService.saveMemory(memory);
    }
  }

  // ── Retrieval ──────────────────────────────────────────────────────────────

  async retrieveRelevantContext(query: string, limit = 3): Promise<string> {
    const allMemories = useMemoryStore.getState().memories;
    if (allMemories.length === 0) return '';

    const scored = allMemories.map((memory) => ({
      memory,
      score: scoreRelevance(memory, query),
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit).filter((s) => s.score > 0);

    if (top.length === 0) return '';
    return top.map((s) => `[${s.memory.category}] ${s.memory.content}`).join('\n');
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async exportAsJSON(): Promise<string> {
    const memories = useMemoryStore.getState().memories;
    const summaries = useMemoryStore.getState().summaries;
    return JSON.stringify({ memories, summaries }, null, 2);
  }

  async exportAsTXT(): Promise<string> {
    const memories = useMemoryStore.getState().memories;
    const summaries = useMemoryStore.getState().summaries;

    const lines: string[] = [
      '=== MANU AI Memory Export ===',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '--- Memories ---',
    ];

    for (const m of memories) {
      lines.push(`[${m.category.toUpperCase()}] ${m.content}`);
      lines.push(`  Relevance: ${m.relevanceScore.toFixed(2)}  Created: ${new Date(m.createdAt).toLocaleString()}`);
    }

    lines.push('');
    lines.push('--- Conversation Summaries ---');
    for (const s of summaries) {
      lines.push(`${new Date(s.createdAt).toLocaleString()} (${s.messageCount} msgs): ${s.summary}`);
    }

    return lines.join('\n');
  }

  /** Update relevance scores based on query frequency (reinforcement). */
  async reinforceMemory(query: string): Promise<void> {
    const allMemories = useMemoryStore.getState().memories;
    for (const memory of allMemories) {
      const s = scoreRelevance(memory, query);
      if (s > 0.3) {
        const newScore = Math.min(1.0, memory.relevanceScore + 0.05);
        useMemoryStore.getState().updateMemory(memory.id, { relevanceScore: newScore });
      }
    }
  }
}

export const memoryAgent = new MemoryAgent();
