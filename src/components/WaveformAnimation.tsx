import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface WaveformAnimationProps {
  waveformData: number[];
  color?: string;
  barCount?: number;
  height?: number;
}

const AnimatedBar = React.memo(
  ({
    amplitude,
    index,
    color,
  }: {
    amplitude: number;
    index: number;
    color: string;
  }) => {
    const barHeight = useSharedValue(8);

    useEffect(() => {
      barHeight.value = withSpring(8 + amplitude * 44, {
        damping: 10,
        stiffness: 180,
      });
    }, [amplitude, barHeight]);

    const animStyle = useAnimatedStyle(() => ({
      height: barHeight.value,
    }));

    return (
      <Reanimated.View
        style={[
          styles.bar,
          { backgroundColor: index % 2 === 0 ? color : adjustColor(color) },
          animStyle,
        ]}
      />
    );
  }
);

/** Slightly darken a hex color for alternating bars */
function adjustColor(hex: string): string {
  // Simple darken by 15 points per channel
  const clean = hex.replace('#', '');
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - 15);
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - 15);
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - 15);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

const WaveformAnimation = React.memo(
  ({
    waveformData,
    color = '#e94560',
    barCount = 20,
    height = 50,
  }: WaveformAnimationProps) => {
    const bars =
      waveformData.length > 0
        ? waveformData.slice(0, barCount)
        : Array<number>(barCount).fill(0.05);

    // Pad to barCount if needed
    const padded =
      bars.length < barCount
        ? [...bars, ...Array<number>(barCount - bars.length).fill(0.05)]
        : bars;

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
