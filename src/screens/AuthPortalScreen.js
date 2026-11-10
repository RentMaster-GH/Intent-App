import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function AuthPortal({ navigation }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const handleAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }
    if (isSignup) {
      if (!name.trim()) {
        Alert.alert('Missing info', 'Please enter your name.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Password too short', 'Password must be at least 6 characters.');
        return;
      }
      // NEW: Confirm password check
      if (password !== confirmPassword) {
        Alert.alert('Passwords do not match', 'Your password and confirm password must match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        Alert.alert('Account created 🎉', 'Welcome to Intent! Please check your email to verify, then sign in.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        // Go to main app - change this to your home route name if different
        navigation?.reset?.({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (e) {
      Alert.alert(isSignup ? 'Could not create account' : 'Could not sign in', e?.message || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>Intent 💛</Text>
          <Text style={styles.subtitle}>Find someone intentional.</Text>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'signin' && styles.tabActive]}
              onPress={() => switchMode('signin')}
            >
              <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => switchMode('signup')}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.sub}>{isSignup ? 'Join Intent and start matching intentionally.' : 'Sign in to continue your conversations.'}</Text>

          {isSignup && (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ama Mensah"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#64748B"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* PASSWORD with EYE - both modes */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              placeholder={isSignup ? 'Create a password (6+ characters)' : 'Your password'}
              placeholderTextColor="#64748B"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* CONFIRM PASSWORD - Create Account only, with EYE */}
          {isSignup && (
            <>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Type your password again"
                  placeholderTextColor="#64748B"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={8}
                >
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={styles.mismatch}>⚠️ Passwords do not match yet</Text>
              )}
              {confirmPassword.length > 0 && password === confirmPassword && password.length >= 6 && (
                <Text style={styles.match}>✅ Passwords match</Text>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{isSignup ? 'Create Account' : 'Sign In'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchBtn} onPress={() => switchMode(isSignup ? 'signin' : 'signup')}>
            <Text style={styles.switchText}>
              {isSignup ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchTextBold}>{isSignup ? 'Sign In' : 'Create Account'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { padding: 24, paddingTop: 40, paddingBottom: 40 },
  logo: { fontSize: 32, fontWeight: '900', color: '#F8FAFC', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 6, marginBottom: 28 },
  tabs: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 14, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#F97316' },
  tabText: { color: '#94A3B8', fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: '#FFFFFF' },
  title: { fontSize: 22, fontWeight: '800', color: '#F8FAFC' },
  sub: { fontSize: 13, color: '#94A3B8', marginTop: 6, marginBottom: 20, lineHeight: 19 },
  label: { fontSize: 13, color: '#CBD5E1', fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1E293B', height: 50, borderRadius: 12, paddingHorizontal: 14, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155', fontSize: 15 },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingRight: 8 },
  passwordInput: { flex: 1, height: 50, paddingHorizontal: 14, color: '#F8FAFC', fontSize: 15 },
  eyeBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  mismatch: { color: '#F87171', fontSize: 12, marginTop: 6, fontWeight: '600' },
  match: { color: '#4ADE80', fontSize: 12, marginTop: 6, fontWeight: '600' },
  primaryBtn: { backgroundColor: '#F97316', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  switchBtn: { marginTop: 18, alignItems: 'center' },
  switchText: { color: '#94A3B8', fontSize: 14 },
  switchTextBold: { color: '#FBBF24', fontWeight: '800' },
});