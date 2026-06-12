import { create } from 'zustand';
import type { Memory, MemorySummary } from '@apptypes/index';

interface MemoryState {
  memories: Memory[];
  summaries: MemorySummary[];

  addMemory: (memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>) => Memory;
  updateMemory: (id: string, updates: Partial<Memory>) => void;
  deleteMemory: (id: string) => void;
  addSummary: (summary: Omit<MemorySummary, 'id' | 'createdAt'>) => MemorySummary;
  getRelevantMemories: (query: string, limit?: number) => Memory[];
  clearAllMemories: () => void;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  summaries: [],

  addMemory: (memory) => {
    const newMemory: Memory = {
      ...memory,
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ memories: [...state.memories, newMemory] }));
    return newMemory;
  },

  updateMemory: (id, updates) => {
    set((state) => ({
      memories: state.memories.map((m) =>
        m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m
      ),
    }));
  },

  deleteMemory: (id) => {
    set((state) => ({ memories: state.memories.filter((m) => m.id !== id) }));
  },

  addSummary: (summary) => {
    const newSummary: MemorySummary = {
      ...summary,
      id: `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };
    set((state) => ({ summaries: [...state.summaries, newSummary] }));
    return newSummary;
  },

  getRelevantMemories: (query, limit = 3) => {
    const state = get();
    if (state.memories.length === 0) return [];

    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (queryWords.length === 0) {
      // Return most recent memories when no query terms
      return [...state.memories]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
    }

    const scored = state.memories.map((memory) => {
      const contentWords = memory.content.toLowerCase().split(/\s+/);
      let score = 0;
      for (const qw of queryWords) {
        if (contentWords.some((cw) => cw.includes(qw) || qw.includes(cw))) score += 1;
      }
      // Weight by stored relevance score
      const weighted = (score / queryWords.length) * 0.7 + memory.relevanceScore * 0.3;
      return { memory, score: weighted };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.memory);
  },

  clearAllMemories: () => set({ memories: [], summaries: [] }),
}));
