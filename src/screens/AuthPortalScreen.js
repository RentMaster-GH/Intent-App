import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Modal, FlatList, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { COUNTRIES } from '../data/countries';
import { supabase } from '../lib/supabase';
import EmpathDonateModal from '../components/EmpathDonateModal';

const FALLBACK_COUNTRY = { code: '+233', flag: '🇬🇭', name: 'Ghana' };
const FRESH_SIGNUP_KEY = 'intent_fresh_signup';

const getDisplayFlag = (country) => {
  if (Platform.OS === 'web') return '🌍';
  return country?.flag || '🌍';
};

const setFreshSignupFlag = () => {
  try { if (typeof window !== 'undefined') window.sessionStorage?.setItem(FRESH_SIGNUP_KEY, '1'); } catch {}
};
const clearFreshSignupFlag = () => {
  try { if (typeof window !== 'undefined') window.sessionStorage?.removeItem(FRESH_SIGNUP_KEY); } catch {}
};

const extractEmail = (raw) => {
  if (!raw) return null;
  const m = String(raw).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : null;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || '');

const mapAuthError = (err) => {
  const msg = err?.message || 'Auth failed';
  const lower = msg.toLowerCase();
  if (lower.includes('database error saving new user') || lower.includes('database error') || lower.includes('db error')) {
    return 'We could not create your account — our database is temporarily unavailable. Please try again in a minute. If it persists, contact support.';
  }
  if (lower.includes('failed to fetch') || lower.includes('fetch') || lower.includes('network')) {
    return 'Cannot reach our servers. Check your internet and try again.';
  }
  if (lower.includes('user already registered') || lower.includes('already registered') || lower.includes('already exists') || lower.includes('user already exists')) {
    return 'That email already has an account. Tap Sign In above instead.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid email or password')) {
    return 'Wrong email or password. Try again, or tap Forgot password?';
  }
  if (lower.includes('email link is invalid') || lower.includes('expired') || lower.includes('otp expired')) {
    return 'That code/link expired. Request a new one.';
  }
  if (lower.includes('invalid otp') || lower.includes('invalid code') || lower.includes('token')) {
    return 'Wrong code. Check the SMS / email and try again.';
  }
  if (lower.includes('password')) {
    if (lower.includes('8') || lower.includes('6') || lower.includes('short') || lower.includes('weak')) {
      return 'Password must be at least 8 characters.';
    }
    return 'Password is not valid. Use at least 8 characters.';
  }
  if (lower.includes('email') && lower.includes('invalid')) {
    return 'Please enter a valid email address.';
  }
  if (lower.includes('phone')) {
    return 'Phone sign-in needs a valid number with country code. Try email instead.';
  }
  if (lower.includes('too many') || lower.includes('rate limit') || lower.includes('429')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  return 'Something went wrong. Please try again.';
};

const getPasswordStrength = (pw) => {
  if (!pw) return { label: '', color: '#64748B' };
  if (pw.length < 8) return { label: 'Too short — use 8+ characters', color: '#EF4444' };
  let score = 0;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { label: 'Weak — add uppercase, number or symbol', color: '#F59E0B' };
  if (score === 3) return { label: 'Good', color: '#22C55E' };
  return { label: 'Strong', color: '#22C55E' };
};

export default function AuthPortalScreen({ navigation }) {
  const [authMode, setAuthMode] = useState('signin');
  const [inputIdentifier, setInputIdentifier] = useState('');

  const smartDefaultCountry = useMemo(() => {
    const list = COUNTRIES && COUNTRIES.length ? COUNTRIES : [FALLBACK_COUNTRY];
    const findByCode = (code) => list.find(c => c.code === code);
    const ghana = findByCode('+233') || FALLBACK_COUNTRY;
    try {
      if (Platform.OS === 'web' && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (tz.includes('Accra')) return ghana;
        if (tz.includes('Lagos')) return findByCode('+234') || ghana;
        if (tz.includes('London')) return findByCode('+44') || ghana;
        if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) return findByCode('+1') || ghana;
      }
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        const locale = navigator.language || '';
        if (locale.includes('GH')) return ghana;
        if (locale.includes('NG')) return findByCode('+234') || ghana;
        if (locale.includes('GB')) return findByCode('+44') || ghana;
        if (locale.includes('US')) return findByCode('+1') || ghana;
      }
    } catch {}
    return ghana || list[0] || FALLBACK_COUNTRY;
  }, []);

  const [selectedCountry, setSelectedCountry] = useState(smartDefaultCountry || FALLBACK_COUNTRY);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'auth-web-scrollbar';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0F172A}::-webkit-scrollbar-thumb{background:#F97316;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#FBBF24}`;
        document.head.appendChild(style);
      }
    }
    clearFreshSignupFlag();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const switchMode = (mode) => {
    setAuthMode(mode);
    setErrorMessage('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
    if (mode === 'signin') clearFreshSignupFlag();
  };

  const handleAuth = async () => {
    if (loading) return;
    setErrorMessage(''); setSuccessMessage(''); setLoading(true);
    const rawInput = inputIdentifier.trim();
    if (!rawInput) { setErrorMessage('Please enter email or phone.'); setLoading(false); return; }

    const extracted = extractEmail(rawInput);
    const isEmail = !!extracted;
    const inputVal = isEmail ? extracted : rawInput;

    try {
      if (isEmail) {
        if (!isValidEmail(inputVal)) { setErrorMessage('Please enter a valid email address.'); setLoading(false); return; }
        if (!password) { setErrorMessage('Enter password.'); setLoading(false); return; }
        if (password.length < 8) { setErrorMessage('Password must be at least 8 characters.'); setLoading(false); return; }
        if (authMode === 'signup' && password !== confirmPassword) { setErrorMessage('Passwords do not match.'); setLoading(false); return; }

        if (authMode === 'signup') {
          setFreshSignupFlag();
          const { data, error } = await supabase.auth.signUp({ email: inputVal, password });
          if (error) {
            clearFreshSignupFlag();
            setPassword(''); setConfirmPassword('');
            throw error;
          }
          if (!data?.session) {
            setSuccessMessage('Account created! Check your email to confirm, then Sign In.');
            setPassword(''); setConfirmPassword('');
            setAuthMode('signin');
            setLoading(false);
            return;
          }
          setSuccessMessage('Account Created! Launching setup...');
          navigation.navigate('SignupOnboarding', { email: inputVal, isDemo: false });
        } else {
          clearFreshSignupFlag();
          const { error } = await supabase.auth.signInWithPassword({ email: inputVal, password });
          if (error) throw error;
          setSuccessMessage('Signed in! Loading...');
        }
      } else {
        const safeCountry = selectedCountry || FALLBACK_COUNTRY;
        const digits = inputVal.replace(/\D/g, '');
        const localDigits = digits.startsWith('0') ? digits.slice(1) : digits;
        const formattedPhone = inputVal.startsWith('+') ? `+${digits}` : `${safeCountry.code}${localDigits}`;
        if (localDigits.length < 9) { setErrorMessage('Enter a valid phone number (e.g. 55 000 0000).'); setLoading(false); return; }
        if (authMode === 'signup') setFreshSignupFlag(); else clearFreshSignupFlag();
        const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
        if (error) { if (authMode === 'signup') clearFreshSignupFlag(); throw error; }
        setOtpPhone(formattedPhone);
        setOtpCode('');
        setResendCooldown(30);
        setOtpModalVisible(true);
        setSuccessMessage(`OTP sent to ${formattedPhone} — enter the 6-digit code below.`);
      }
    } catch (err) {
      setErrorMessage(mapAuthError(err));
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    const code = otpCode.trim();
    if (code.length < 6) { setErrorMessage('Enter the 6-digit code sent to your phone.'); return; }
    setOtpVerifying(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone: otpPhone, token: code, type: 'sms' });
      if (error) throw error;
      if (!data?.session) throw new Error('No session after OTP. Try again.');
      setOtpModalVisible(false);
      setSuccessMessage('Verified! Launching...');
      if (authMode === 'signup') {
        navigation.navigate('SignupOnboarding', { fullPhone: otpPhone, isDemo: false });
      }
    } catch (e) {
      setErrorMessage(mapAuthError(e));
    } finally { setOtpVerifying(false); }
  };

  const handleResendOtp = async () => {
    if (!otpPhone || resendCooldown > 0) return;
    setOtpVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: otpPhone });
      if (error) throw error;
      setResendCooldown(30);
      setSuccessMessage(`New code sent to ${otpPhone}`);
    } catch (e) { setErrorMessage(mapAuthError(e)); } finally { setOtpVerifying(false); }
  };

  const handleForgotPassword = async () => {
    const val = forgotIdentifier.trim();
    if (!val) { setErrorMessage('Enter email to reset.'); return; }
    const cleanEmail = extractEmail(val);
    if (!cleanEmail || !isValidEmail(cleanEmail)) { setErrorMessage('Enter your email to receive a reset link.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined,
      });
      if (error) throw error;
      setSuccessMessage('If an account exists for that email, reset instructions were sent. Check your inbox.');
      setForgotModalVisible(false);
      setForgotIdentifier('');
    } catch (e) {
      setErrorMessage(mapAuthError(e));
    } finally { setLoading(false); }
  };

  const handleDemoMode = () => {
    clearFreshSignupFlag();
    navigation.reset({ index: 0, routes: [{ name: 'Discovery', params: { isDemo: true } }] });
  };

  const listForFilter = COUNTRIES || [FALLBACK_COUNTRY];
  const filteredCountries = listForFilter.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.code.includes(searchQuery) || c.code.replace('+', '').includes(searchQuery));

  const displayCountry = selectedCountry || FALLBACK_COUNTRY;
  const displayFlag = getDisplayFlag(displayCountry);
  const donorEmail = extractEmail(inputIdentifier);
  const pwStrength = authMode === 'signup' ? getPasswordStrength(password) : { label: '', color: '#64748B' };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView style={styles.scrollWrapper} contentContainerStyle={styles.innerContainer} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
          <View style={styles.header}>
            <View style={styles.logoCircle}><Text style={{ fontSize: 28 }}>✨</Text></View>
            <Text style={styles.logoText}>INTENT</Text>
            <Text style={styles.tagline}>Three chats. Real dates. No games.</Text>
            <View style={styles.globalBadge}><Text style={styles.globalText}>🌍 Global • 200+ countries • MoMo + Cards • Paystack</Text></View>
          </View>

          <View style={styles.modeTabContainer}>
            <TouchableOpacity style={[styles.modeTab, authMode === 'signin' && styles.activeModeTab]} onPress={() => switchMode('signin')}>
              <Text style={[styles.modeTabText, authMode === 'signin' && styles.activeModeTabText]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeTab, authMode === 'signup' && styles.activeModeTab]} onPress={() => switchMode('signup')}>
              <Text style={[styles.modeTabText, authMode === 'signup' && styles.activeModeTabText]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {errorMessage ? <View style={styles.errorBanner}><Text style={{ marginRight: 8, fontSize: 16 }}>⚠️</Text><Text style={styles.errorText}>{errorMessage}</Text></View> : null}
          {successMessage ? <View style={styles.successBanner}><Text style={{ marginRight: 8, fontSize: 16 }}>✅</Text><Text style={styles.successText}>{successMessage}</Text></View> : null}

          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Email Address or Phone Number</Text>
            <View style={styles.unifiedInputWrapper}>
              <TouchableOpacity style={styles.countryPickerButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.countryFlag}>{displayFlag}</Text>
                <Text style={styles.countryCode}>{displayCountry.code}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TextInput
                style={styles.inputFlex}
                placeholder="alex@example.com or 55 000 0000"
                placeholderTextColor="#64748B"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={authMode === 'signin' ? 'username' : 'off'}
                textContentType={authMode === 'signin' ? 'username' : 'none'}
                returnKeyType="next"
                value={inputIdentifier}
                onChangeText={v => { setInputIdentifier(v); setErrorMessage(''); }}
              />
            </View>
            <Text style={styles.helperText}>We auto-detected {displayFlag} {displayCountry.name} ({displayCountry.code}) — tap to change for any country</Text>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Password</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.inputFlex}
                placeholder="••••••••••••"
                placeholderTextColor="#64748B"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                textContentType={authMode === 'signin' ? 'password' : 'newPassword'}
                returnKeyType="done"
                blurOnSubmit={true}
                value={password}
                onChangeText={v => { setPassword(v); setErrorMessage(''); }}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}><Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text></TouchableOpacity>
            </View>
            {authMode === 'signup' && pwStrength.label ? <Text style={[styles.strengthText, { color: pwStrength.color }]}>{pwStrength.label}</Text> : null}

            {authMode === 'signup' && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="••••••••••••"
                    placeholderTextColor="#64748B"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    blurOnSubmit={true}
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); setErrorMessage(''); }}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirmPassword(!showConfirmPassword)}><Text style={{ fontSize: 18 }}>{showConfirmPassword ? '🙈' : '👁️'}</Text></TouchableOpacity>
                </View>
                {confirmPassword && password !== confirmPassword ? <Text style={styles.mismatchText}>Passwords do not match</Text> : null}
              </View>
            )}

            {authMode === 'signin' && <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 8 }} onPress={() => setForgotModalVisible(true)}><Text style={styles.forgotText}>Forgot password?</Text></TouchableOpacity>}

            <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{authMode === 'signin' ? 'Sign In to Intent' : 'Continue to Profile'}</Text>}</TouchableOpacity>
            <TouchableOpacity style={styles.demoButton} onPress={handleDemoMode}><Text style={styles.demoButtonText}>👀 Preview Demo — No account, no chats saved</Text></TouchableOpacity>

            <TouchableOpacity style={styles.donateBanner} onPress={() => setShowDonateModal(true)} activeOpacity={0.85}>
              <Text style={styles.donateBannerHeart}>💛</Text>
              <View style={{ flex: 1 }}><Text style={styles.donateBannerTitle}>Donate to Empath Safe Spaces</Text><Text style={styles.donateBannerSub}>Support recovery groups for survivors of narcissistic abuse — Global</Text></View>
              <Text style={{ color: '#FBBF24', fontSize: 20, fontWeight: '800' }}>›</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>By continuing, you agree to treat matches with respect and honor intentional connections worldwide.</Text>
        </ScrollView>

        <Modal visible={modalVisible} animationType="slide" transparent><View style={styles.modalOverlay}><SafeAreaView style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Select Country • Global</Text><TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{ fontSize: 20, color: '#94A3B8' }}>✕</Text></TouchableOpacity></View>
          <TextInput style={styles.searchInput} placeholder="Search United States, Ghana, UK, Nigeria..." placeholderTextColor="#64748B" value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" returnKeyType="search" />
          <FlatList data={filteredCountries} keyExtractor={(item, i) => `${item.name}-${i}`} renderItem={({ item }) => (<TouchableOpacity style={styles.countryRow} onPress={() => { setSelectedCountry(item); setModalVisible(false); setSearchQuery(''); }}><Text style={styles.countryRowFlag}>{getDisplayFlag(item)}</Text><Text style={styles.countryRowName}>{item.name}</Text><Text style={styles.countryRowCode}>{item.code}</Text></TouchableOpacity>)} /></SafeAreaView></View></Modal>

        <Modal visible={forgotModalVisible} animationType="fade" transparent><View style={styles.modalOverlay}><View style={[styles.modalContent, { maxHeight: 340 }]}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Reset Password</Text><TouchableOpacity onPress={() => setForgotModalVisible(false)}><Text style={{ fontSize: 20, color: '#94A3B8' }}>✕</Text></TouchableOpacity></View><Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>Enter email to receive reset instructions — works globally.</Text>
          <TextInput style={styles.singleInput} placeholder="alex@example.com" placeholderTextColor="#64748B" value={forgotIdentifier} onChangeText={setForgotIdentifier} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" returnKeyType="done" blurOnSubmit={true} />
          <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={handleForgotPassword} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}</TouchableOpacity><TouchableOpacity style={styles.cancelModalBtn} onPress={() => setForgotModalVisible(false)}><Text style={styles.cancelModalText}>Cancel & Return</Text></TouchableOpacity></View></View></Modal>

        <Modal visible={otpModalVisible} animationType="fade" transparent><View style={styles.modalOverlay}><View style={[styles.modalContent, { maxHeight: 400 }]}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Enter OTP Code</Text><TouchableOpacity onPress={() => setOtpModalVisible(false)}><Text style={{ fontSize: 20, color: '#94A3B8' }}>✕</Text></TouchableOpacity></View>
          <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>We sent a 6-digit code to {otpPhone}. Enter it below.</Text>
          <TextInput style={[styles.singleInput, { textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: '800' }]} placeholder="123456" placeholderTextColor="#64748B" value={otpCode} onChangeText={(v) => setOtpCode(v.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} autoComplete="one-time-code" textContentType="oneTimeCode" returnKeyType="done" maxLength={6} />
          <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={handleVerifyOtp} disabled={otpVerifying}>{otpVerifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}</TouchableOpacity>
          <TouchableOpacity style={styles.cancelModalBtn} onPress={handleResendOtp} disabled={otpVerifying || resendCooldown > 0}><Text style={styles.cancelModalText}>{resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}</Text></TouchableOpacity>
        </View></View></Modal>

        <EmpathDonateModal visible={showDonateModal} onClose={() => setShowDonateModal(false)} donorEmail={donorEmail} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  keyboardView: { flex: 1, width: '100%' }, scrollWrapper: { flex: 1 }, innerContainer: { paddingHorizontal: 28, paddingTop: 50, paddingBottom: 40, maxWidth: 440, width: '100%', alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: 20 }, logoCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(249,115,22,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)' },
  logoText: { fontSize: 42, fontWeight: '900', color: '#F8FAFC', letterSpacing: 6 }, tagline: { fontSize: 14, color: '#FBBF24', marginTop: 6, textAlign: 'center', fontWeight: '600' },
  globalBadge: { backgroundColor: 'rgba(249,115,22,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 10, borderWidth: 1, borderColor: '#F97316' }, globalText: { color: '#FBBF24', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  modeTabContainer: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 14, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 }, activeModeTab: { backgroundColor: '#F97316' }, modeTabText: { color: '#94A3B8', fontWeight: '700', fontSize: 14 }, activeModeTabText: { color: '#FFF' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444', marginBottom: 16 }, errorText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600', flex: 1 },
  successBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.15)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#10B981', marginBottom: 16 }, successText: { color: '#6EE7B7', fontSize: 13, fontWeight: '600', flex: 1 },
  formContainer: { width: '100%' }, inputLabel: { fontSize: 13, color: '#CBD5E1', marginBottom: 8, fontWeight: '600' },
  unifiedInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155', height: 54, overflow: 'hidden' },
  countryPickerButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: '#0F172A', height: '100%', flexShrink: 0 },
  countryFlag: { fontSize: 18, marginRight: 4 }, countryCode: { fontSize: 14, color: '#F8FAFC', fontWeight: '600' }, dropdownArrow: { fontSize: 10, color: '#94A3B8', marginLeft: 2 },
  divider: { width: 1, height: 22, backgroundColor: '#334155', marginHorizontal: 0 }, singleInput: { backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16, height: 52, color: '#F8FAFC' },
  passwordInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 16, height: 52 },
  inputFlex: { flex: 1, minWidth: 0, color: '#F8FAFC', fontSize: 15, paddingHorizontal: 10 },
  eyeButton: { padding: 6, marginLeft: 8 }, forgotText: { color: '#FBBF24', fontSize: 12, fontWeight: '600' },
  helperText: { color: '#475569', fontSize: 10, marginTop: 6, marginLeft: 4 },
  strengthText: { fontSize: 11, marginTop: 6, fontWeight: '600' },
  mismatchText: { color: '#FCA5A5', fontSize: 11, marginTop: 6, fontWeight: '600' },
  button: { backgroundColor: '#F97316', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 }, buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  demoButton: { backgroundColor: 'rgba(30,41,59,0.8)', height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#334155' }, demoButtonText: { color: '#FBBF24', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
  donateBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.12)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#F59E0B', marginTop: 16, gap: 10 }, donateBannerHeart: { fontSize: 20 }, donateBannerTitle: { color: '#FBBF24', fontSize: 13, fontWeight: '800' }, donateBannerSub: { color: '#CBD5E1', fontSize: 11, marginTop: 1 },
  disclaimer: { textAlign: 'center', color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' }, modalContent: { backgroundColor: '#1E293B', borderRadius: 24, width: '90%', maxWidth: 440, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, modalTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
  cancelModalBtn: { height: 40, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, cancelModalText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  searchInput: { backgroundColor: '#0F172A', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#F8FAFC', paddingHorizontal: 14, height: 44, marginBottom: 16 },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#334155' }, countryRowFlag: { fontSize: 22, marginRight: 12 }, countryRowName: { flex: 1, fontSize: 16, color: '#F8FAFC' }, countryRowCode: { fontSize: 16, color: '#94A3B8', fontWeight: '600' },
});