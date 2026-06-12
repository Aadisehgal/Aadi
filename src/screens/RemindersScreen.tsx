import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { useSettingsStore } from '@stores/useSettingsStore';
import { ErrorBoundary } from '@components/ErrorBoundary';

interface ReminderItem {
  id: string;
  title: string;
  body: string;
  timestamp: number;
}

function parseReminderTime(input: string): number | null {
  const cleaned = input.trim().toLowerCase();

  // "in X minutes/hours"
  const relMatch = cleaned.match(/^in\s+(\d+)\s+(minute|minutes|min|hour|hours|hr|h|second|seconds|sec|s)$/);
  if (relMatch) {
    const val = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    if (unit.startsWith('h')) return Date.now() + val * 60 * 60 * 1000;
    if (unit.startsWith('m') || unit === 'min') return Date.now() + val * 60 * 1000;
    if (unit.startsWith('s')) return Date.now() + val * 1000;
  }

  // ISO or locale date string
  const parsed = Date.parse(input);
  if (!isNaN(parsed) && parsed > Date.now()) return parsed;

  return null;
}

function RescheduleModal({
  visible,
  reminder,
  onClose,
  onRescheduled,
}: {
  visible: boolean;
  reminder: ReminderItem | null;
  onClose: () => void;
  onRescheduled: () => void;
}) {
  const [timeInput, setTimeInput] = useState('');
  const [error, setError] = useState('');

  const handleReschedule = useCallback(async () => {
    if (!reminder) return;
    setError('');
    const ts = parseReminderTime(timeInput);
    if (!ts) {
      setError('Invalid time. Try "in 10 minutes", "in 2 hours", or a date like "2026-06-10 14:30".');
      return;
    }
    try {
      await notifee.cancelTriggerNotification(reminder.id);
      const channelId = await notifee.createChannel({
        id: 'reminders',
        name: 'Reminders',
        importance: AndroidImportance.HIGH,
      });
      await notifee.createTriggerNotification(
        {
          id: reminder.id,
          title: reminder.title,
          body: reminder.body,
          android: { channelId, pressAction: { id: 'default' } },
        },
        { type: TriggerType.TIMESTAMP, timestamp: ts }
      );
      setTimeInput('');
      onRescheduled();
    } catch (e) {
      setError(`Reschedule failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [reminder, timeInput, onRescheduled]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.dialog}>
          <Text style={modalStyles.title}>Reschedule Reminder</Text>
          {reminder && (
            <Text style={modalStyles.reminderName} numberOfLines={1}>
              📌 {reminder.title}
            </Text>
          )}
          <Text style={modalStyles.label}>New time:</Text>
          <TextInput
            style={modalStyles.input}
            value={timeInput}
            onChangeText={(v) => { setTimeInput(v); setError(''); }}
            placeholder="e.g. in 30 minutes, in 2 hours, 2026-06-10 14:30"
            placeholderTextColor="#666"
            autoFocus
          />
          {error !== '' && <Text style={modalStyles.errorText}>{error}</Text>}
          <Text style={modalStyles.hint}>
            Formats: "in X minutes", "in X hours", or a date/time string
          </Text>
          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modalStyles.confirmBtn} onPress={handleReschedule}>
              <Text style={modalStyles.confirmText}>Reschedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RemindersScreenInner() {
  const settingsStore = useSettingsStore();
  const assistantName = settingsStore.assistantProfile.name;
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [rescheduleTarget, setRescheduleTarget] = useState<ReminderItem | null>(null);

  const loadReminders = useCallback(async () => {
    try {
      const triggers = await notifee.getTriggerNotifications();
      const items: ReminderItem[] = triggers.map((n) => ({
        id: n.notification.id ?? '',
        title: n.notification.title ?? 'Reminder',
        body: n.notification.body ?? '',
        timestamp:
          (n.trigger as { type: number; timestamp?: number }).timestamp ?? Date.now(),
      }));
      setReminders(items.sort((a, b) => a.timestamp - b.timestamp));
    } catch {
      setReminders([]);
    }
  }, []);

  useEffect(() => { loadReminders(); }, [loadReminders]);

  const handleCancel = useCallback(
    (id: string, title: string) => {
      Alert.alert('Cancel Reminder', `Cancel "${title}"?`, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Reminder',
          style: 'destructive',
          onPress: async () => {
            await notifee.cancelTriggerNotification(id);
            setReminders((prev) => prev.filter((r) => r.id !== id));
          },
        },
      ]);
    },
    []
  );

  const handleRescheduled = useCallback(async () => {
    setRescheduleTarget(null);
    await loadReminders();
  }, [loadReminders]);

  const formatTime = (ts: number) => {
    const diff = ts - Date.now();
    if (diff > 0) {
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) return `in ${days}d ${hrs % 24}h`;
      if (hrs > 0) return `in ${hrs}h ${mins % 60}m`;
      return `in ${mins}m`;
    }
    return new Date(ts).toLocaleString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⏰ Reminders</Text>
        <TouchableOpacity onPress={loadReminders} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {reminders.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No scheduled reminders</Text>
            <Text style={styles.emptySubtext}>
              {`Ask ${assistantName} to "set a reminder" to create one`}
            </Text>
          </View>
        )}

        {reminders.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>{r.title}</Text>
              {r.body !== '' && <Text style={styles.cardBody}>{r.body}</Text>}
              <View style={styles.timeBadge}>
                <Text style={styles.cardTime}>{new Date(r.timestamp).toLocaleString()}</Text>
                <Text style={styles.countdown}>{formatTime(r.timestamp)}</Text>
              </View>
            </View>
            <View style={styles.btnCol}>
              <TouchableOpacity
                style={styles.rescheduleBtn}
                onPress={() => setRescheduleTarget(r)}
              >
                <Text style={styles.rescheduleBtnText}>🔄</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => handleCancel(r.id, r.title)}
              >
                <Text style={styles.cancelBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <RescheduleModal
        visible={rescheduleTarget !== null}
        reminder={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={handleRescheduled}
      />
    </View>
  );
}

export default function RemindersScreen() {
  return (
    <ErrorBoundary>
      <RemindersScreenInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#1a1a2e',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  refreshBtn: { padding: 8 },
  refreshText: { color: '#e94560', fontSize: 22 },
  content: { padding: 16, paddingBottom: 40 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#555', fontSize: 13, marginTop: 6, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardMain: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardBody: { color: '#ccc', fontSize: 13, marginTop: 4 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  cardTime: { color: '#888', fontSize: 12 },
  countdown: {
    color: '#e94560',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: '#2d0a1a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  btnCol: { flexDirection: 'column', gap: 6, marginLeft: 10 },
  rescheduleBtn: {
    backgroundColor: '#162040',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescheduleBtnText: { fontSize: 16 },
  cancelBtn: {
    backgroundColor: '#2d0a0a',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#ff4444', fontSize: 16, fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  dialog: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  reminderName: { color: '#888', fontSize: 13, marginBottom: 16 },
  label: { color: '#ccc', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#2a2a3e',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 6,
  },
  errorText: { color: '#ff4444', fontSize: 12, marginBottom: 6 },
  hint: { color: '#555', fontSize: 11, marginBottom: 20, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
