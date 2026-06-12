import { Linking, Share, PermissionsAndroid, Platform, NativeModules } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import type { ToolDefinition, ToolResult } from '@apptypes/index';
import { isValidExpression } from '@utils/validators';
import { analyticsService } from '@services/analyticsService';
import { detectToolLoop, checkToolRateLimit, validateToolParams, buildSafetyErrorMessage } from '@utils/SafetySystem';

// ─── open_app ─────────────────────────────────────────────────────────────────

const openAppTool: ToolDefinition = {
  id: 'open_app',
  name: 'Open App',
  description: 'Launch an Android app by package name',
  parameters: [
    { name: 'packageName', type: 'string', required: true, description: 'Android package name e.g. com.spotify.music' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const packageName = params.packageName as string;
    if (!packageName || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(packageName)) {
      return { success: false, error: 'Invalid package name format' };
    }
    try {
      const url = Platform.OS === 'android' ? `package:${packageName}` : packageName;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        // Fallback: try to open in Play Store
        await Linking.openURL(`market://details?id=${packageName}`);
        return { success: true, data: `Opened Play Store for ${packageName}` };
      }
      await Linking.openURL(url);
      return { success: true, data: `Opened ${packageName}` };
    } catch (e) {
      return { success: false, error: `Failed to open ${packageName}: ${(e as Error).message}` };
    }
  },
};

// ─── browser_search ───────────────────────────────────────────────────────────

const browserSearchTool: ToolDefinition = {
  id: 'browser_search',
  name: 'Browser Search',
  description: 'Open a search query in the default browser',
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Search query text' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const query = params.query as string;
    if (!query?.trim()) return { success: false, error: 'Empty search query' };
    const url = `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`;
    try {
      await Linking.openURL(url);
      return { success: true, data: `Searched: ${query}` };
    } catch (e) {
      return { success: false, error: `Failed to open browser: ${(e as Error).message}` };
    }
  },
};

// ─── youtube_search ───────────────────────────────────────────────────────────

const youtubeSearchTool: ToolDefinition = {
  id: 'youtube_search',
  name: 'YouTube Search',
  description: 'Search YouTube for videos',
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Search query' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const query = params.query as string;
    if (!query?.trim()) return { success: false, error: 'Empty search query' };
    const encoded = encodeURIComponent(query.trim());
    const appUrl = `vnd.youtube://results?search_query=${encoded}`;
    const webUrl = `https://www.youtube.com/results?search_query=${encoded}`;
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpen ? appUrl : webUrl);
      return { success: true, data: `YouTube search: ${query}` };
    } catch {
      try {
        await Linking.openURL(webUrl);
        return { success: true, data: `YouTube search (web): ${query}` };
      } catch (e2) {
        return { success: false, error: `Failed: ${(e2 as Error).message}` };
      }
    }
  },
};

// ─── whatsapp_msg ─────────────────────────────────────────────────────────────

const whatsappMsgTool: ToolDefinition = {
  id: 'whatsapp_msg',
  name: 'WhatsApp Message',
  description: 'Open WhatsApp to send a message to a phone number',
  parameters: [
    { name: 'phone', type: 'string', required: true, description: 'Phone number with country code e.g. +15551234567' },
    { name: 'message', type: 'string', required: true, description: 'Message text' },
  ],
  requiresConfirmation: true,
  execute: async (params): Promise<ToolResult> => {
    const phone = (params.phone as string).replace(/\s+/g, '').replace(/^\+/, '');
    const message = params.message as string;
    if (!/^\d{7,15}$/.test(phone)) {
      return { success: false, error: 'Invalid phone number. Use digits with country code.' };
    }
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) return { success: false, error: 'WhatsApp is not installed' };
      await Linking.openURL(url);
      return { success: true, data: `WhatsApp opened for +${phone}` };
    } catch (e) {
      return { success: false, error: `WhatsApp error: ${(e as Error).message}` };
    }
  },
};

// ─── set_reminder ─────────────────────────────────────────────────────────────

const setReminderTool: ToolDefinition = {
  id: 'set_reminder',
  name: 'Set Reminder',
  description: 'Create a notification reminder at a specific time (Unix timestamp ms)',
  parameters: [
    { name: 'title', type: 'string', required: true, description: 'Reminder title' },
    { name: 'body', type: 'string', required: false, description: 'Reminder body text' },
    { name: 'timestamp', type: 'number', required: true, description: 'Unix timestamp in milliseconds' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const title = params.title as string;
    const body = (params.body as string) || '';
    const timestamp = params.timestamp as number;

    if (!title?.trim()) return { success: false, error: 'Reminder title is required' };
    if (typeof timestamp !== 'number' || timestamp <= Date.now()) {
      return { success: false, error: 'Timestamp must be a future Unix ms timestamp' };
    }

    try {
      // Request notification permission
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as never
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return { success: false, error: 'Notification permission denied' };
        }
      }

      const channelId = await notifee.createChannel({
        id: 'reminders',
        name: 'Reminders',
        importance: AndroidImportance.HIGH,
      });

      await notifee.createTriggerNotification(
        {
          title,
          body,
          android: { channelId, pressAction: { id: 'default' } },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp,
        }
      );

      const timeStr = new Date(timestamp).toLocaleString();
      return { success: true, data: `Reminder set: "${title}" at ${timeStr}` };
    } catch (e) {
      return { success: false, error: `Failed to set reminder: ${(e as Error).message}` };
    }
  },
};

// ─── clipboard_copy ───────────────────────────────────────────────────────────

const clipboardCopyTool: ToolDefinition = {
  id: 'clipboard_copy',
  name: 'Copy to Clipboard',
  description: 'Copy text to the device clipboard',
  parameters: [
    { name: 'text', type: 'string', required: true, description: 'Text to copy' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const text = params.text as string;
    if (typeof text !== 'string') return { success: false, error: 'Text must be a string' };
    Clipboard.setString(text);
    return { success: true, data: `Copied to clipboard (${text.length} chars)` };
  },
};

// ─── share_content ────────────────────────────────────────────────────────────

const shareContentTool: ToolDefinition = {
  id: 'share_content',
  name: 'Share Content',
  description: 'Open the Android share sheet to share text',
  parameters: [
    { name: 'text', type: 'string', required: true, description: 'Content to share' },
    { name: 'title', type: 'string', required: false, description: 'Share dialog title' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const text = params.text as string;
    if (!text?.trim()) return { success: false, error: 'Empty share content' };
    try {
      const result = await Share.share(
        { message: text, title: (params.title as string) || 'Share via MANU AI' },
        { dialogTitle: (params.title as string) || 'Share via MANU AI' }
      );
      if (result.action === Share.dismissedAction) {
        return { success: true, data: 'Share dismissed' };
      }
      return { success: true, data: 'Content shared' };
    } catch (e) {
      return { success: false, error: `Share failed: ${(e as Error).message}` };
    }
  },
};

// ─── calculator ───────────────────────────────────────────────────────────────

const calculatorTool: ToolDefinition = {
  id: 'calculator',
  name: 'Calculator',
  description: 'Evaluate a safe mathematical expression and return the result',
  parameters: [
    { name: 'expression', type: 'string', required: true, description: 'Math expression e.g. 2 + 2 * 3' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const expression = params.expression as string;
    if (!isValidExpression(expression)) {
      return { success: false, error: 'Invalid or unsafe expression' };
    }
    try {
      // Evaluate with constrained scope (no globals)
      // eslint-disable-next-line no-new-func
      const result = new Function(
        'Math',
        `"use strict"; return (${expression})`
      )(Math) as unknown;
      if (typeof result !== 'number' || !isFinite(result)) {
        return { success: false, error: 'Result is not a finite number' };
      }
      return { success: true, data: String(result) };
    } catch (e) {
      return { success: false, error: `Evaluation error: ${(e as Error).message}` };
    }
  },
};

// ─── set_timer ────────────────────────────────────────────────────────────────

const setTimerTool: ToolDefinition = {
  id: 'set_timer',
  name: 'Set Timer',
  description: 'Create a countdown timer notification (duration in seconds)',
  parameters: [
    { name: 'seconds', type: 'number', required: true, description: 'Duration in seconds' },
    { name: 'label', type: 'string', required: false, description: 'Timer label' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const seconds = params.seconds as number;
    const label = (params.label as string) || 'Timer';
    if (typeof seconds !== 'number' || seconds <= 0 || seconds > 86400) {
      return { success: false, error: 'Seconds must be between 1 and 86400 (24h)' };
    }
    try {
      const channelId = await notifee.createChannel({
        id: 'timers',
        name: 'Timers',
        importance: AndroidImportance.HIGH,
      });

      const timestamp = Date.now() + seconds * 1000;
      await notifee.createTriggerNotification(
        {
          title: `⏱ ${label}`,
          body: `Your ${seconds}s timer is done!`,
          android: { channelId, pressAction: { id: 'default' } },
        },
        { type: TriggerType.TIMESTAMP, timestamp }
      );

      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return { success: true, data: `Timer set for ${timeStr}` };
    } catch (e) {
      return { success: false, error: `Failed to set timer: ${(e as Error).message}` };
    }
  },
};

// ─── take_note ────────────────────────────────────────────────────────────────

const takeNoteTool: ToolDefinition = {
  id: 'take_note',
  name: 'Take Note',
  description: 'Save a quick note to the local notes store',
  parameters: [
    { name: 'title', type: 'string', required: true, description: 'Note title' },
    { name: 'content', type: 'string', required: true, description: 'Note content' },
  ],
  execute: async (params): Promise<ToolResult> => {
    const title = (params.title as string)?.trim();
    const content = (params.content as string)?.trim();
    if (!title) return { success: false, error: 'Note title is required' };
    if (!content) return { success: false, error: 'Note content is required' };

    try {
      // Lazy import to avoid circular deps
      const { storageService } = await import('@services/storageService');
      const note = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await storageService.saveNote(note);
      return { success: true, data: `Note saved: "${title}"` };
    } catch (e) {
      return { success: false, error: `Failed to save note: ${(e as Error).message}` };
    }
  },
};

// ─── media_control ────────────────────────────────────────────────────────────

type MediaAction = 'play' | 'pause' | 'next' | 'previous' | 'stop';
const MEDIA_ACTIONS: MediaAction[] = ['play', 'pause', 'next', 'previous', 'stop'];

const mediaControlTool: ToolDefinition = {
  id: 'media_control',
  name: 'Media Control',
  description: 'Control media playback (play, pause, next, previous, stop)',
  parameters: [
    {
      name: 'action',
      type: 'string',
      required: true,
      description: `Action to perform: ${MEDIA_ACTIONS.join(' | ')}`,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const action = (params.action as string)?.toLowerCase() as MediaAction;
    if (!MEDIA_ACTIONS.includes(action)) {
      return { success: false, error: `Invalid action. Must be one of: ${MEDIA_ACTIONS.join(', ')}` };
    }

    const MEDIA_INTENT_MAP: Record<MediaAction, string> = {
      play: 'com.android.music.musicservicecommand.play',
      pause: 'com.android.music.musicservicecommand.pause',
      next: 'com.android.music.musicservicecommand.next',
      previous: 'com.android.music.musicservicecommand.previous',
      stop: 'com.android.music.musicservicecommand.stop',
    };

    try {
      // Try via NativeModules if available (custom bridge), else use Linking intent
      if (NativeModules.IntentModule) {
        const mod = NativeModules.IntentModule as { sendBroadcast: (action: string) => void };
        mod.sendBroadcast(MEDIA_INTENT_MAP[action]);
        return { success: true, data: `Media: ${action}` };
      }

      // Fallback: open media player via Linking
      const PLAYER_INTENTS: Partial<Record<MediaAction, string>> = {
        play: 'android.intent.action.MEDIA_BUTTON',
      };
      const intent = PLAYER_INTENTS[action] ?? 'android.intent.action.MAIN';
      await Linking.sendIntent(intent);
      return { success: true, data: `Media ${action} sent` };
    } catch (e) {
      // Last resort: open a media app
      try {
        await Linking.openURL('package:com.spotify.music');
        return { success: true, data: 'Opened Spotify (media control unavailable)' };
      } catch {
        return { success: false, error: `Media control failed: ${(e as Error).message}` };
      }
    }
  },
};

// ─── open_settings ────────────────────────────────────────────────────────────

const openSettingsTool: ToolDefinition = {
  id: 'open_settings',
  name: 'Open Settings',
  description: 'Open Android system settings',
  parameters: [
    {
      name: 'setting',
      type: 'string',
      required: false,
      description: 'Settings page: wifi | bluetooth | location | sound | display | storage | battery | app | accessibility | language | notification | developer',
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const setting = ((params.setting as string) ?? 'settings').toLowerCase();
    const settingsMap: Record<string, string> = {
      wifi: 'android.settings.WIFI_SETTINGS',
      bluetooth: 'android.settings.BLUETOOTH_SETTINGS',
      location: 'android.settings.LOCATION_SOURCE_SETTINGS',
      sound: 'android.settings.SOUND_SETTINGS',
      display: 'android.settings.DISPLAY_SETTINGS',
      storage: 'android.settings.INTERNAL_STORAGE_SETTINGS',
      battery: 'android.settings.BATTERY_SAVER_SETTINGS',
      app: 'android.settings.APPLICATION_SETTINGS',
      accessibility: 'android.settings.ACCESSIBILITY_SETTINGS',
      language: 'android.settings.LOCALE_SETTINGS',
      notification: 'android.settings.NOTIFICATION_SETTINGS',
      developer: 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS',
      settings: 'android.settings.SETTINGS',
    };
    const action = settingsMap[setting] ?? 'android.settings.SETTINGS';
    try {
      await Linking.sendIntent(action);
      return { success: true, data: `Opened ${setting} settings` };
    } catch {
      // Fallback via openURL
      try {
        await Linking.openSettings();
        return { success: true, data: 'Opened settings' };
      } catch (e2) {
        return { success: false, error: `Failed to open settings: ${(e2 as Error).message}` };
      }
    }
  },
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const defaultTools: ToolDefinition[] = [
  openAppTool,
  browserSearchTool,
  youtubeSearchTool,
  whatsappMsgTool,
  setReminderTool,
  clipboardCopyTool,
  shareContentTool,
  calculatorTool,
  setTimerTool,
  takeNoteTool,
  mediaControlTool,
  openSettingsTool,
];
