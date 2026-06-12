import { toolRegistry } from '@tools/ToolRegistry';
import { TOOL_RATE_LIMIT_PER_MINUTE, MAX_TOOL_LOOP_DETECT } from '@utils/constants';
import type { ToolResult } from '@apptypes/index';

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
const callTimestamps: number[] = [];

function checkRateLimit(): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  // Remove timestamps older than 1 minute
  while (callTimestamps.length > 0 && callTimestamps[0] < windowStart) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= TOOL_RATE_LIMIT_PER_MINUTE) {
    return false; // rate limit exceeded
  }
  callTimestamps.push(now);
  return true;
}

// ─── Loop Detector ────────────────────────────────────────────────────────────
const recentCalls: string[] = [];

function checkLoopDetection(toolName: string, params: Record<string, unknown>): boolean {
  const callSignature = `${toolName}:${JSON.stringify(params)}`;
  const identicalCount = recentCalls.filter((s) => s === callSignature).length;
  if (identicalCount >= MAX_TOOL_LOOP_DETECT) {
    return false; // loop detected
  }
  recentCalls.push(callSignature);
  // Keep only last 20 calls in memory
  if (recentCalls.length > 20) recentCalls.shift();
  return true;
}

// ─── ToolRouter ───────────────────────────────────────────────────────────────
export const toolRouter = {
  async route(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    // Rate limit check
    if (!checkRateLimit()) {
      return {
        success: false,
        error: `Rate limit exceeded: max ${TOOL_RATE_LIMIT_PER_MINUTE} tool calls per minute. Please wait.`,
      };
    }

    // Loop detection
    if (!checkLoopDetection(toolName, params)) {
      return {
        success: false,
        error: `Loop detected: tool "${toolName}" called with identical parameters ${MAX_TOOL_LOOP_DETECT}+ times. Stopping.`,
      };
    }

    // Route to registry
    if (!toolRegistry.has(toolName)) {
      return { success: false, error: `Unknown tool: "${toolName}"` };
    }

    return toolRegistry.execute(toolName, params);
  },

  resetCounters(): void {
    callTimestamps.length = 0;
    recentCalls.length = 0;
  },
};
