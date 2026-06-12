import { Linking } from 'react-native';
import type { Plugin, PluginResult } from '@apptypes/index';

type SearchEngine = 'google' | 'youtube' | 'bing';

function buildSearchUrl(query: string, engine: SearchEngine): string {
  const encoded = encodeURIComponent(query);
  switch (engine) {
    case 'youtube':
      return `https://www.youtube.com/results?search_query=${encoded}`;
    case 'bing':
      return `https://www.bing.com/search?q=${encoded}`;
    case 'google':
    default:
      return `https://www.google.com/search?q=${encoded}`;
  }
}

const searchPlugin: Plugin = {
  id: 'search',
  name: 'Search',
  description: 'Multi-engine web search router',
  execute: async (params): Promise<PluginResult> => {
    const query = params.query as string;
    const engine = ((params.engine as string) ?? 'google') as SearchEngine;

    if (!query?.trim()) return { success: false, error: 'No query provided' };

    const url = buildSearchUrl(query.trim(), engine);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) return { success: false, error: 'Cannot open browser' };
      await Linking.openURL(url);
      return { success: true, data: `Searching "${query}" on ${engine}` };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Search failed',
      };
    }
  },
};

export default searchPlugin;
