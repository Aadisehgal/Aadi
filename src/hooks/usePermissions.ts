/**
 * usePermissions — runtime permission requests with rationale dialogs.
 * Gracefully degrades on denial. Never crashes.
 * Uses dynamic assistant name from settings store.
 */

import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  type Permission,
  type PermissionStatus,
} from 'react-native-permissions';
import { useSettingsStore } from '@stores/useSettingsStore';

type NamedPermission =
  | 'microphone'
  | 'notifications'
  | 'readMediaAudio'
  | 'readMediaImages'
  | 'readStorage'
  | 'writeStorage';

const PERMISSION_MAP: Record<NamedPermission, Permission> = {
  microphone: PERMISSIONS.ANDROID.RECORD_AUDIO,
  notifications: PERMISSIONS.ANDROID.POST_NOTIFICATIONS,
  readMediaAudio: PERMISSIONS.ANDROID.READ_MEDIA_AUDIO,
  readMediaImages: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
  readStorage: PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
  writeStorage: PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
};

export const usePermissions = () => {
  const assistantName = useSettingsStore((s) => s.assistantProfile.name);

  const getRationale = useCallback(
    (permission: NamedPermission): { title: string; message: string } => {
      const n = assistantName;
      const map: Record<NamedPermission, { title: string; message: string }> = {
        microphone: {
          title: 'Microphone Access',
          message: `${n} needs microphone access to listen to your voice commands and enable voice chat.`,
        },
        notifications: {
          title: 'Notification Permission',
          message: `${n} needs notification permission to alert you about reminders and timers you set.`,
        },
        readMediaAudio: {
          title: 'Audio Access',
          message: `${n} needs access to audio files for voice profile management.`,
        },
        readMediaImages: {
          title: 'Image Access',
          message: `${n} needs access to images for avatar customisation.`,
        },
        readStorage: {
          title: 'Storage Access',
          message: `${n} needs storage access to read and import documents for AI analysis.`,
        },
        writeStorage: {
          title: 'Storage Write Access',
          message: `${n} needs storage write access to save exported files and logs to your device.`,
        },
      };
      return map[permission];
    },
    [assistantName]
  );

  const checkPermission = useCallback(
    async (permission: NamedPermission): Promise<PermissionStatus> => {
      if (Platform.OS !== 'android') return RESULTS.GRANTED;
      try {
        return await check(PERMISSION_MAP[permission]);
      } catch {
        return RESULTS.DENIED;
      }
    },
    []
  );

  const requestPermission = useCallback(
    async (permission: NamedPermission): Promise<PermissionStatus> => {
      if (Platform.OS !== 'android') return RESULTS.GRANTED;

      try {
        const current = await check(PERMISSION_MAP[permission]);
        if (current === RESULTS.GRANTED) return RESULTS.GRANTED;
        if (current === RESULTS.BLOCKED) {
          const { title, message } = getRationale(permission);
          Alert.alert(title, `${message}\n\nPlease enable it in Settings.`);
          return RESULTS.BLOCKED;
        }

        if (current === RESULTS.DENIED) {
          const { title, message } = getRationale(permission);
          return new Promise<PermissionStatus>((resolve) => {
            Alert.alert(title, message, [
              {
                text: 'Not Now',
                style: 'cancel',
                onPress: () => resolve(RESULTS.DENIED),
              },
              {
                text: 'Allow',
                onPress: async () => {
                  try {
                    const result = await request(PERMISSION_MAP[permission]);
                    resolve(result);
                  } catch {
                    resolve(RESULTS.DENIED);
                  }
                },
              },
            ]);
          });
        }

        return current;
      } catch {
        return RESULTS.DENIED;
      }
    },
    [getRationale]
  );

  const isGranted = useCallback(
    async (permission: NamedPermission): Promise<boolean> => {
      const status = await checkPermission(permission);
      return status === RESULTS.GRANTED;
    },
    [checkPermission]
  );

  return { checkPermission, requestPermission, isGranted };
};
