import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Avatar3DProps {
  modelPath: string;
  animationState: 'idle' | 'talking' | 'blinking';
  lipSyncValue: number;
  onError: () => void;
}

/**
 * Stub Avatar3D component.
 *
 * GLB / three.js / @react-three/fiber are intentionally NOT loaded in this build —
 * the app uses the SVG fallback avatar exclusively (see AvatarScreen.tsx → SVGAvatar).
 *
 * When this component is mounted, it immediately triggers onError() so the
 * parent switches to SVG fallback. This keeps the original API/contract intact
 * while avoiding heavy 3D dependencies for the APK build.
 *
 * To re-enable 3D avatars later: restore the original implementation from git
 * history and add .glb files to android/app/src/main/assets/.
 */
const Avatar3D: React.FC<Avatar3DProps> = ({ onError }) => {
  useEffect(() => {
    onError();
  }, [onError]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading SVG avatar…</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 300,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: '#666', fontSize: 12 },
});

export default Avatar3D;
