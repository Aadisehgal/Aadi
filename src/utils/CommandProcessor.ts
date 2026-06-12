import type { CommandResult } from '@apptypes/index';

export function processCommand(input: string): CommandResult | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const [command, ...rest] = trimmed.split(' ');
  const args = rest.join(' ').trim();

  switch (command.toLowerCase()) {
    case '/open':
      if (!args) return { handled: false, response: 'Usage: /open [app name]' };
      return {
        handled: true,
        toolCall: { tool: 'open_app', params: { app: args } },
      };

    case '/search':
      if (!args) return { handled: false, response: 'Usage: /search [query]' };
      return {
        handled: true,
        toolCall: { tool: 'browser_search', params: { query: args } },
      };

    case '/remind':
      if (!args) return { handled: false, response: 'Usage: /remind [reminder text]' };
      return {
        handled: true,
        toolCall: { tool: 'set_reminder', params: { text: args } },
      };

    case '/export':
      if (args.toLowerCase() === 'chats') {
        return { handled: true, response: '__EXPORT_CHATS__' };
      }
      return { handled: false, response: 'Usage: /export chats' };

    case '/clear':
      if (args.toLowerCase() === 'memory') {
        return { handled: true, response: '__CLEAR_MEMORY__' };
      }
      return { handled: false, response: 'Usage: /clear memory' };

    case '/settings':
      return { handled: true, response: '__OPEN_SETTINGS__' };

    default:
      return {
        handled: false,
        response:
          'Unknown command. Available: /open [app], /search [query], /remind [text], /export chats, /clear memory, /settings',
      };
  }
}

export const CommandProcessor = { processCommand };
