import type { ToolDefinition, ToolResult } from '@apptypes/index';

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  unregister(id: string): void {
    this.tools.delete(id);
  }

  async execute(id: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(id);
    if (!tool) {
      return { success: false, error: `Tool "${id}" not registered` };
    }
    try {
      return await tool.execute(params);
    } catch (e) {
      return {
        success: false,
        error: `Tool "${id}" threw: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
