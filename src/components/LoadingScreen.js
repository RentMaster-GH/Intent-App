import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LoadingScreen({ message = 'Finding intentional matches worldwide...' }) {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>I</Text>
      </View>
      <Text style={styles.title}>INTENT</Text>
      <Text style={styles.sub}>Three chats. Real dates. No games.</Text>
      <ActivityIndicator size="large" color="#F97316" style={{ marginTop: 24 }} />
      <Text style={styles.message}>{message}</Text>
      <View style={styles.dots}>
        <View style={[styles.dot, { opacity: 0.3 }]} />
        <View style={[styles.dot, { opacity: 0.6 }]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 32, fontWeight: '900', color: '#0F172A' },
  title: { marginTop: 16, fontSize: 24, fontWeight: '900', color: '#F8FAFC', letterSpacing: 4 },
  sub: { marginTop: 8, fontSize: 12, color: '#FBBF24', letterSpacing: 1 },
  message: { marginTop: 16, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F97316' },
});