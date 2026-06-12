import type { AgentPlan, Message } from '@apptypes/index';

const TOOL_KEYWORDS: Record<string, string> = {
  open_app: 'open|launch|start|run app',
  browser_search: 'search|google|look up|find|browse',
  youtube_search: 'youtube|video|watch|play video',
  whatsapp_msg: 'whatsapp|message|send message|text',
  set_reminder: 'remind|reminder|alert me|notify me',
  clipboard_copy: 'copy|clipboard',
  share_content: 'share|send to|forward',
  calculator: 'calculate|compute|math|how much is|what is [0-9]',
  set_timer: 'timer|set timer|countdown',
  take_note: 'note|write down|save note|remember this',
  media_control: 'play|pause|next|previous|volume|music',
  open_settings: 'settings|wifi|bluetooth|brightness|airplane',
};

function detectToolIntent(input: string): { detected: boolean; toolHint?: string } {
  const lower = input.toLowerCase();
  for (const [tool, pattern] of Object.entries(TOOL_KEYWORDS)) {
    const parts = pattern.split('|');
    for (const part of parts) {
      if (new RegExp(part).test(lower)) {
        return { detected: true, toolHint: tool };
      }
    }
  }
  return { detected: false };
}

const COMMAND_PREFIXES = ['/', '/open', '/search', '/remind', '/export', '/clear', '/settings'];

export class PlannerAgent {
  plan(input: string, _context: Message[]): AgentPlan {
    const trimmed = input.trim();

    // Slash command → tool only
    if (COMMAND_PREFIXES.some((p) => trimmed.startsWith(p))) {
      return { useChat: false, useTools: true, useMemory: true, toolHint: 'command' };
    }

    const { detected, toolHint } = detectToolIntent(trimmed);

    if (detected) {
      return { useChat: true, useTools: true, useMemory: true, toolHint };
    }

    return { useChat: true, useTools: false, useMemory: true };
  }
}

export const plannerAgent = new PlannerAgent();
