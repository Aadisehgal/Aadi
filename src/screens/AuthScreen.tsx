import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '@stores/useAuthStore';
import type { AuthMode } from '@apptypes/index';

type UIMode = 'pin' | 'guest';

const AuthScreen = () => {
  const authStore = useAuthStore();
  const [mode, setMode] = useState<UIMode>('pin');
  const [pin, setPin] = useState('');
  const [cooldownSecs, setCooldownSecs] = useState(0);

  useEffect(() => {
    authStore.loadAuthState();
  }, [authStore]);

  useEffect(() => {
    if (!authStore.cooldownActive) { setCooldownSecs(0); return; }
    const tick = () => {
      const elapsed = Date.now() - authStore.lastFailedAttempt;
      const remaining = Math.max(0, 30 - Math.floor(elapsed / 1000));
      setCooldownSecs(remaining);
      if (remaining === 0) authStore.setCooldownActive(false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [authStore.cooldownActive, authStore.lastFailedAttempt, authStore]);

  const handlePinAuth = useCallback(() => {
    if (authStore.cooldownActive) return;
    if (pin === authStore.pin) {
      authStore.setAuthenticated(true);
      authStore.resetFailedAttempts();
    } else {
      authStore.incrementFailedAttempts();
      const remaining = 3 - authStore.failedAttempts;
      if (remaining <= 0) {
        Alert.alert('Locked', 'Too many failed attempts. 30-second cooldown activated.');
      } else {
        Alert.alert('Incorrect PIN', `${remaining} attempt(s) remaining.`);
      }
      setPin('');
    }
  }, [pin, authStore]);

  const handleGuest = useCallback(() => {
    authStore.setAuthMode('guest' as AuthMode);
    authStore.setAuthenticated(true);
  }, [authStore]);

  if (authStore.cooldownActive && cooldownSecs > 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.title}>Locked</Text>
        <Text style={styles.subtitle}>Too many failed attempts</Text>
        <View style={styles.cooldownBadge}>
          <Text style={styles.cooldownNum}>{cooldownSecs}</Text>
          <Text style={styles.cooldownLabel}>seconds remaining</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>MANU AI</Text>
      <Text style={styles.subtitle}>Authentication Required</Text>

      <View style={styles.modeSelector}>
        {(['pin', 'guest'] as UIMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeButton, mode === m && styles.modeActive]}
            onPress={() => setMode(m)}>
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
              {m === 'pin' ? 'PIN' : 'Guest'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'pin' && (
        <>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            placeholderTextColor="#888"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handlePinAuth}
          />
          <TouchableOpacity style={styles.button} onPress={handlePinAuth}>
            <Text style={styles.buttonText}>Unlock</Text>
          </TouchableOpacity>
          {authStore.failedAttempts > 0 && (
            <Text style={styles.warnText}>
              {authStore.failedAttempts} failed attempt(s)
            </Text>
          )}
        </>
      )}

      {mode === 'guest' && (
        <>
          <Text style={styles.guestInfo}>Continue without authentication.</Text>
          <TouchableOpacity style={styles.button} onPress={handleGuest}>
            <Text style={styles.buttonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 56, marginBottom: 16 },
  appName: { color: '#e94560', fontSize: 36, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 32, textAlign: 'center' },
  modeSelector: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  modeButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#16213e', borderWidth: 1, borderColor: '#333' },
  modeActive: { backgroundColor: '#e94560', borderColor: '#e94560' },
  modeText: { color: '#aaa', fontSize: 14 },
  modeTextActive: { color: '#fff', fontWeight: '700' },
  input: { width: '100%', backgroundColor: '#16213e', borderRadius: 12, padding: 16, color: '#fff', fontSize: 20, textAlign: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  button: { width: '100%', backgroundColor: '#e94560', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  warnText: { color: '#ff8844', fontSize: 13, marginTop: 4 },
  guestInfo: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  cooldownBadge: { backgroundColor: '#16213e', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 20 },
  cooldownNum: { color: '#e94560', fontSize: 48, fontWeight: '900' },
  cooldownLabel: { color: '#888', fontSize: 14, marginTop: 4 },
});

export default AuthScreen;
