import type { Message } from '@apptypes/index';

interface BuildContextParams {
  messages: Message[];
  memories: string;
  ragContext: string;
  maxTokens: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function scoreMessage(msg: Message, index: number, total: number): number {
  // Recency score: higher index = more recent = higher score
  const recencyScore = index / total;
  // Favorite boost
  const favoriteBoost = msg.isFavorite ? 0.2 : 0;
  // Role boost: user messages slightly more important
  const roleBoost = msg.role === 'user' ? 0.1 : 0;
  return recencyScore + favoriteBoost + roleBoost;
}

export function buildContext(params: BuildContextParams): Message[] {
  const { messages, memories, ragContext, maxTokens } = params;

  const systemReserve = 500;
  const memoriesTokens = estimateTokens(memories);
  const ragTokens = estimateTokens(ragContext);
  let budget = maxTokens - systemReserve - memoriesTokens - ragTokens;

  if (budget <= 0) budget = maxTokens - systemReserve;

  // Always keep last 5
  const ALWAYS_KEEP = 5;
  const mustKeep = messages.slice(-ALWAYS_KEEP);
  const candidates = messages.slice(0, -ALWAYS_KEEP);

  // Score candidates
  const scored = candidates.map((msg, i) => ({
    msg,
    score: scoreMessage(msg, i, candidates.length),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const selected: Message[] = [];
  let usedTokens = mustKeep.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  for (const { msg } of scored) {
    const t = estimateTokens(msg.content);
    if (usedTokens + t <= budget) {
      selected.push(msg);
      usedTokens += t;
    }
  }

  // Re-sort selected by original order (timestamp)
  selected.sort((a, b) => a.timestamp - b.timestamp);

  return [...selected, ...mustKeep];
}

export const SmartContextEngine = { buildContext };
