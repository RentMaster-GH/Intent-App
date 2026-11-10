import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(e, info) {
    console.log('INTENT Crash:', e?.message || e);
    console.log('INTENT Stack:', e?.stack);
    console.log('INTENT ComponentStack:', info?.componentStack);
    // Save stack in state too so it shows on screen
    this.setState({ stack: e?.stack || '', componentStack: info?.componentStack || '' });
  }

  handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      this.setState({ hasError: false, error: null, stack: '', componentStack: '' });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.c}>
          <Text style={styles.t}>INTENT</Text>
          <Text style={styles.sub}>Oops, something broke. Don't worry, your chats are safe.</Text>
          {this.state.error ? (
            <Text style={styles.err}>{String(this.state.error?.message || this.state.error)}</Text>
          ) : null}

          {/* DEBUG - shows WHICH function crashed */}
          <ScrollView style={styles.stackBox}>
            <Text style={styles.stackText}>{this.state.stack || 'no stack'}</Text>
            <Text style={[styles.stackText, { marginTop: 12, color: '#FBBF24' }]}>{this.state.componentStack || ''}</Text>
          </ScrollView>

          <TouchableOpacity style={styles.btn} onPress={this.handleReset}>
            <Text style={styles.btnText}>Reload Intent</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>This just goes back to Discovery. It never closes the app.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24 },
  t: { fontSize: 28, fontWeight: '900', color: '#F8FAFC', letterSpacing: 4 },
  sub: { color: '#94A3B8', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  err: { color: '#FCA5A5', textAlign: 'center', marginTop: 12, fontSize: 12, lineHeight: 18 },
  stackBox: { maxHeight: 300, width: '100%', backgroundColor: '#020617', borderRadius: 12, padding: 12, marginTop: 12 },
  stackText: { color: '#E2E8F0', fontSize: 10, lineHeight: 14 },
  btn: { backgroundColor: '#F97316', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 20 },
  btnText: { color: '#FFF', fontWeight: '800' },
  hint: { color: '#64748B', textAlign: 'center', marginTop: 12, fontSize: 11 },
});