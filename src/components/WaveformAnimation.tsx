import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface WaveformAnimationProps {
  waveformData: number[];
  color?: string;
  barCount?: number;
  height?: number;
}

const AnimatedBar = React.memo(
  ({ amplitude, index, color }: { amplitude: number; index: number; color: string }) => {
    const barHeight = useRef(new Animated.Value(8)).current;

    useEffect(() => {
      Animated.spring(barHeight, {
        toValue: 8 + amplitude * 44,
        damping: 10,
        stiffness: 180,
        useNativeDriver: false,
      }).start();
    }, [amplitude, barHeight]);

    return (
      <Animated.View
        style={[
          styles.bar,
          { backgroundColor: index % 2 === 0 ? color : adjustColor(color), height: barHeight },
        ]}
      />
    );
  }
);

function adjustColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - 15);
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - 15);
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - 15);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const WaveformAnimation = React.memo(
  ({ waveformData, color = '#e94560', barCount = 20, height = 50 }: WaveformAnimationProps) => {
    const bars = waveformData.length > 0 ? waveformData.slice(0, barCount) : Array<number>(barCount).fill(0.05);
    const padded = bars.length < barCount ? [...bars, ...Array<number>(barCount - bars.length).fill(0.05)] : bars;

    return (
      <View style={[styles.container, { height }]}>
        {padded.map((amp, i) => (
          <AnimatedBar key={i} amplitude={amp} index={i} color={color} />
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
});

export default WaveformAnimation;
