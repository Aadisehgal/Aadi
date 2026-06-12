import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Swipeable as RNSwipeable } from 'react-native-gesture-handler';
import type { Message } from '@apptypes/index';

// Cast to a typed component to avoid JSX class-element type mismatch caused by
// react-native-gesture-handler bundling a different @types/react version.
const Swipeable = RNSwipeable as unknown as React.ComponentType<{
  renderRightActions?: (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => React.ReactNode;
  onSwipeableOpen?: () => void;
  rightThreshold?: number;
  children?: React.ReactNode;
}>;

interface MessageItemProps {
  item: Message;
  onLongPress: (msg: Message) => void;
  onSwipeDelete: (id: string) => void;
}

const MESSAGE_HEIGHT = 80;

const MessageItem = React.memo(
  ({ item, onLongPress, onSwipeDelete }: MessageItemProps) => {
    const isUser = item.role === 'user';

    const renderRightActions = useCallback(
      (
        _prog: Animated.AnimatedInterpolation<number>,
        drag: Animated.AnimatedInterpolation<number>
      ) => {
        const trans = drag.interpolate({
          inputRange: [-80, 0],
          outputRange: [0, 80],
        });
        return (
          <Animated.View
            style={[
              styles.deleteAction,
              { transform: [{ translateX: trans }] },
            ]}
          >
            <Text style={styles.deleteText}>🗑</Text>
          </Animated.View>
        );
      },
      []
    );

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        onSwipeableOpen={() => onSwipeDelete(item.id)}
        rightThreshold={40}
      >
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
              <Text style={styles.modeIcon}>
                {item.inputMode === 'voice' ? '🎙' : '⌨️'}
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
      </Swipeable>
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
  modeIcon: { fontSize: 11 },
  favIcon: { fontSize: 11 },
  toolIcon: { fontSize: 11 },
  deleteAction: {
    backgroundColor: '#c62828',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    borderRadius: 14,
    marginVertical: 4,
  },
  deleteText: { fontSize: 18 },
});

export { MESSAGE_HEIGHT };
export default MessageItem;
