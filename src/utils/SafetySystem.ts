/**
 * SafetySystem — prompt injection detection, tool rate limiting, loop prevention.
 */

import { TOOL_RATE_LIMIT_PER_MINUTE, MAX_TOOL_LOOP_DETECT } from './constants';

// ─── Prompt Injection ─────────────────────────────────────────────────────────

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i,
  /you\s+are\s+now\s+(a\s+)?different/i,
  /disregard\s+(your|the|all)\s+(previous|instructions|rules)/i,
  /act\s+as\s+(if\s+)?(you\s+are|a|an)\s+/i,
  /system\s*:\s*you\s+are/i,
  /\bDAN\b/,
  /jailbreak/i,
  /override\s+(your\s+)?(safety|instructions|rules)/i,
  /forget\s+(your|all)\s+(previous\s+)?(instructions|rules|training)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|evil|uncensored)/i,
];

const KEYWORD_BLOCKLIST: string[] = [
  'ignore previous instructions',
  'disregard your rules',
  'new persona',
  'you have no restrictions',
  'unrestricted mode',
  'developer mode enabled',
];

export function detectPromptInjection(input: string): boolean {
  const lower = input.toLowerCase();
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) return true;
  }
  for (const kw of KEYWORD_BLOCKLIST) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

// ─── Tool Parameter Validation ────────────────────────────────────────────────

export function validateToolParams(
  params: Record<string, unknown>,
  required: string[],
): { valid: boolean; error?: string } {
  for (const key of required) {
    if (params[key] === undefined || params[key] === null || params[key] === '') {
      return { valid: false, error: `Missing required parameter: "${key}"` };
    }
  }
  return { valid: true };
}

// ─── Tool Rate Limiting ───────────────────────────────────────────────────────

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

const rateBuckets = new Map<string, RateLimitBucket>();

export function checkToolRateLimit(toolId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const bucket = rateBuckets.get(toolId);

  if (!bucket || now - bucket.windowStart > windowMs) {
    rateBuckets.set(toolId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (bucket.count >= TOOL_RATE_LIMIT_PER_MINUTE) {
    const retryAfterMs = windowMs - (now - bucket.windowStart);
    return { allowed: false, retryAfterMs };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function resetRateLimits(): void {
  rateBuckets.clear();
}

// ─── Loop Detection ───────────────────────────────────────────────────────────

interface LoopRecord {
  paramsHash: string;
  count: number;
}

const loopRecords = new Map<string, LoopRecord>();

function hashParams(params: Record<string, unknown>): string {
  try {
    return JSON.stringify(params, Object.keys(params).sort());
  } catch {
    return String(params);
  }
}

export function detectToolLoop(toolId: string, params: Record<string, unknown>): boolean {
  const hash = hashParams(params);
  const record = loopRecords.get(toolId);

  if (!record || record.paramsHash !== hash) {
    loopRecords.set(toolId, { paramsHash: hash, count: 1 });
    return false;
  }

  record.count += 1;

  if (record.count >= MAX_TOOL_LOOP_DETECT) {
    return true; // loop detected
  }
  return false;
}

export function resetLoopDetector(): void {
  loopRecords.clear();
}

// ─── Auto Failure Recovery ────────────────────────────────────────────────────

export function buildSafetyErrorMessage(reason: 'injection' | 'rate_limit' | 'loop' | 'validation', detail?: string): string {
  switch (reason) {
    case 'injection':
      return '⚠️ Potential prompt injection detected. Request blocked for safety.';
    case 'rate_limit':
      return `⚠️ Too many tool calls. Please wait a moment before trying again.${detail ? ` (${detail})` : ''}`;
    case 'loop':
      return '⚠️ Repeated identical action detected. Stopping to prevent an infinite loop.';
    case 'validation':
      return `⚠️ Invalid parameters: ${detail ?? 'unknown error'}`;
    default:
      return '⚠️ Safety check failed.';
  }
}
