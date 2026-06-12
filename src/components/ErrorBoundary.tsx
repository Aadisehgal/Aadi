import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { storageService } from '@services/storageService';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    storageService
      .saveAnalyticsLog({
        id: `boundary-${Date.now()}`,
        type: 'crash',
        message: `ErrorBoundary caught: ${error.message}`,
        timestamp: Date.now(),
        meta: { stack: error.stack ?? '', componentStack: info.componentStack ?? '' },
      })
      .catch(() => {});
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.errorMessage}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.handleReset}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  message: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
