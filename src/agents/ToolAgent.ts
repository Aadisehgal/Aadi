import { toolRouter } from '@tools/ToolRouter';
import type { ToolResult } from '@apptypes/index';

const SENSITIVE_TOOLS = new Set([
  'whatsapp_msg',
  'set_reminder',
  'share_content',
  'open_app',
]);

export class ToolAgent {
  async execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const result = await toolRouter.route(toolName, params);
      return result;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  requiresConfirmation(toolName: string): boolean {
    return SENSITIVE_TOOLS.has(toolName);
  }
}

export const toolAgent = new ToolAgent();
