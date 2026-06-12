import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from './src/navigation/AppNavigator';
import { storageService } from './src/services/storageService';
import { adService } from './src/services/adService';
import { groqService } from './src/services/groqService';
import { ttsService } from './src/services/ttsService';
import { useAdStore } from './src/stores/useAdStore';
import { toolRegistry } from './src/tools/ToolRegistry';
import { defaultTools } from './src/tools/ToolExecutor';
import calculatorPlugin from './src/plugins/calculator';
import notesPlugin from './src/plugins/notes';
import translatorPlugin from './src/plugins/translator';
import searchPlugin from './src/plugins/search';
import { useSettingsStore } from './src/stores/useSettingsStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { analyticsService } from './src/services/analyticsService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 1000 * 60 * 5 },
  },
});

function AppInner(): React.JSX.Element {
  useEffect(() => {
    const init = async () => {
      // Register plugins dynamically
      // Register built-in device tools (open app, search, reminders, notes, etc.)
      for (const tool of defaultTools) {
        toolRegistry.register(tool);
      }

      toolRegistry.register({
        id: calculatorPlugin.id,
        name: calculatorPlugin.name,
        description: calculatorPlugin.description,
        parameters: [],
        execute: calculatorPlugin.execute,
      });
      toolRegistry.register({
        id: notesPlugin.id,
        name: notesPlugin.name,
        description: notesPlugin.description,
        parameters: [],
        execute: notesPlugin.execute,
      });
      toolRegistry.register({
        id: translatorPlugin.id,
        name: translatorPlugin.name,
        description: translatorPlugin.description,
        parameters: [],
        execute: translatorPlugin.execute,
      });
      toolRegistry.register({
        id: searchPlugin.id,
        name: searchPlugin.name,
        description: searchPlugin.description,
        parameters: [],
        execute: searchPlugin.execute,
      });

      analyticsService.startSession();

      try { await storageService.init(); } catch { /* silent */ }
      try { await adService.init(); } catch { /* silent */ }
      try { await ttsService.init(); } catch { /* silent */ }

      useAdStore.getState().loadFromMMKV();

      // Load settings first so we can sync model selection
      useSettingsStore.getState().loadSettings();

      // Sync groqService model from persisted settings
      const settings = useSettingsStore.getState();
      groqService.setModel(settings.groqModel);

      // Load API key from encrypted storage
      try { await groqService.loadApiKey(); } catch { /* silent */ }
    };
    void init();
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
      <AppNavigator />
    </>
  );
}

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AppInner />
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
