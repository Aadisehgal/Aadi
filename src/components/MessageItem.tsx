import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { Message } from '@apptypes/index';

interface MessageItemProps {
  item: Message;
  onLongPress: (msg: Message) => void;
  onSwipeDelete: (id: string) => void;
}

const MESSAGE_HEIGHT = 80;

const MessageItem = React.memo(
  ({ item, onLongPress }: MessageItemProps) => {
    const isUser = item.role === 'user';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => onLongPress(item)}
        style={[
          styles.msgRow,
          isUser ? styles.userRow : styles.assistantRow,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {item.isStreaming ? (
            <Text style={styles.msgText}>
              {item.content}
              <Text style={styles.cursor}>▋</Text>
            </Text>
          ) : (
            <Text style={styles.msgText}>{item.content}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.timeText}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {item.isFavorite && (
              <Text style={styles.favIcon}>⭐</Text>
            )}
            {item.toolCalls && item.toolCalls.length > 0 && (
              <Text style={styles.toolIcon}>🔧</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  msgRow: {
    marginVertical: 4,
    minHeight: MESSAGE_HEIGHT,
  },
  userRow: { alignItems: 'flex-end' },
  assistantRow: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: { backgroundColor: '#e94560' },
  assistantBubble: { backgroundColor: '#1e1e30' },
  msgText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  cursor: { color: '#e94560' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  timeText: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  favIcon: { fontSize: 11 },
  toolIcon: { fontSize: 11 },
});

export { MESSAGE_HEIGHT };
export default MessageItem;
