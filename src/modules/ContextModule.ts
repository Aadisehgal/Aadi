/**
 * ContextModule — Smart Context Engine.
 * - Max 4000 tokens per context window
 * - Message relevance scoring
 * - Summary hierarchy: short → medium → long
 * - Prune low-score messages first
 * - Prevent overflow on every request
 */

import type { Message, MemorySummary } from '@apptypes/index';
import { MAX_CONTEXT_TOKENS, CONTEXT_SLIDING_WINDOW } from '@utils/constants';

// ─── Token Estimation ─────────────────────────────────────────────────────────
// Approximation: ~4 characters per token (good enough for budgeting)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Relevance Scoring ────────────────────────────────────────────────────────
// Score based on: recency, length, role, contains question/command
function scoreMessage(msg: Message, index: number, total: number): number {
  let score = 0;

  // Recency bonus — messages closer to end score higher
  const recencyRatio = index / Math.max(total - 1, 1);
  score += recencyRatio * 50;

  // Role bonus
  if (msg.role === 'user') score += 10;
  if (msg.role === 'assistant') score += 8;

  // Contains a question
  if (msg.content.includes('?')) score += 5;

  // Favorite messages are important
  if (msg.isFavorite) score += 20;

  // Streaming/incomplete messages score low
  if (msg.isStreaming) score -= 30;

  // Very short messages score lower
  if (msg.content.length < 20) score -= 5;

  return score;
}

// ─── Summary Hierarchy ────────────────────────────────────────────────────────
type SummaryLevel = 'short' | 'medium' | 'long';

function pickSummaryLevel(tokenBudgetRemaining: number): SummaryLevel {
  if (tokenBudgetRemaining < 200) return 'short';
  if (tokenBudgetRemaining < 600) return 'medium';
  return 'long';
}

function truncateSummary(summary: string, level: SummaryLevel): string {
  switch (level) {
    case 'short':
      // First sentence only
      return summary.split('.')[0]?.trim() ?? summary.slice(0, 80);
    case 'medium':
      return summary.slice(0, 300);
    case 'long':
    default:
      return summary;
  }
}

// ─── Main Context Builder ─────────────────────────────────────────────────────

export interface BuiltContext {
  messages: Array<{ role: string; content: string }>;
  tokenCount: number;
  pruned: number;
}

export function buildContext(
  systemPrompt: string,
  allMessages: Message[],
  memories: string[],
  summaries: MemorySummary[],
): BuiltContext {
  let budget = MAX_CONTEXT_TOKENS;

  // 1. System prompt always included
  const systemTokens = estimateTokens(systemPrompt);
  budget -= systemTokens;

  // 2. Memory injection — top 3 already filtered by caller
  let memoryBlock = '';
  if (memories.length > 0) {
    memoryBlock = `\n[Relevant Memories]\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n`;
    budget -= estimateTokens(memoryBlock);
  }

  // 3. Sliding window — last N messages
  const windowMessages = allMessages.slice(-CONTEXT_SLIDING_WINDOW);

  // 4. Score and sort by relevance
  const scored = windowMessages.map((msg, i) => ({
    msg,
    score: scoreMessage(msg, i, windowMessages.length),
    tokens: estimateTokens(msg.content),
  }));

  // 5. Greedily add messages from highest score until budget exhausted
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const included = new Set<string>();
  let tokenCount = systemTokens + estimateTokens(memoryBlock);
  let pruned = 0;

  for (const entry of sorted) {
    if (tokenCount + entry.tokens <= MAX_CONTEXT_TOKENS) {
      included.add(entry.msg.id);
      tokenCount += entry.tokens;
    } else {
      pruned++;
    }
  }

  // 6. If we pruned too many, try inserting a summary
  if (pruned > 0 && summaries.length > 0) {
    const latestSummary = summaries[summaries.length - 1];
    if (latestSummary) {
      const level = pickSummaryLevel(budget);
      const truncated = truncateSummary(latestSummary.summary, level);
      const summaryTokens = estimateTokens(truncated);
      if (tokenCount + summaryTokens <= MAX_CONTEXT_TOKENS) {
        memoryBlock = `\n[Conversation Summary]\n${truncated}\n` + memoryBlock;
        tokenCount += summaryTokens;
      }
    }
  }

  // 7. Re-order included messages in original chronological order
  const finalMessages: Array<{ role: string; content: string }> = [];

  // System prompt first
  finalMessages.push({ role: 'system', content: systemPrompt + memoryBlock });

  // Then chronological messages that were included
  for (const entry of scored) {
    if (included.has(entry.msg.id)) {
      finalMessages.push({ role: entry.msg.role, content: entry.msg.content });
    }
  }

  return { messages: finalMessages, tokenCount, pruned };
}

// ─── Overflow Guard ───────────────────────────────────────────────────────────
// Quick check before any API call
export function willOverflow(messages: Array<{ role: string; content: string }>): boolean {
  const total = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  return total > MAX_CONTEXT_TOKENS;
}

// ─── Summarise Messages ───────────────────────────────────────────────────────
// Produces a plain-text summary for storage (actual Groq call is in ChatAgent)
export function summariseMessages(messages: Message[]): string {
  if (messages.length === 0) return '';
  const lines = messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 120)}`);
  return lines.join('\n');
}
