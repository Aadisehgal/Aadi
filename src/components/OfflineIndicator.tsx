import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

interface OfflineIndicatorProps {
  queuedCount?: number;
  onRetry?: () => void;
}

const OfflineIndicator = React.memo(
  ({ queuedCount = 0, onRetry }: OfflineIndicatorProps) => {
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }, [pulse]);

    return (
      <View style={styles.container}>
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Text style={styles.text}>
          {queuedCount > 0
            ? `Offline — ${queuedCount} message${queuedCount > 1 ? 's' : ''} queued`
            : 'Offline — messages will be queued'}
        </Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3535',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff8a80',
  },
  text: {
    color: '#ffcdd2',
    fontSize: 13,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
  },
  retryText: {
    color: '#ffcdd2',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineIndicator;
