import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthPortalScreen from './src/screens/AuthPortalScreen';
import SignupOnboardingScreen from './src/screens/SignupOnboardingScreen';
import DiscoveryScreen from './src/screens/DiscoveryScreen';
import ActiveChatsScreen from './src/screens/ActiveChatsScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import DatesScreen from './src/screens/DatesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsPortalScreen from './src/screens/SettingsPortalScreen';
import CustomerSupportScreen from './src/screens/CustomerSupportScreen';
import { supabase } from './src/lib/supabase';
import ErrorBoundary from './src/components/ErrorBoundary';

const FRESH_SIGNUP_KEY = 'intent_fresh_signup';

const ROUTE_TO_PATH = {
  AuthPortal: '/auth',
  SignupOnboarding: '/onboarding',
  Discovery: '/discovery',
  ActiveChats: '/chats',
  ChatDetail: '/chat',
  Dates: '/dates',
  Profile: '/profile',
  SettingsPortal: '/settings',
  CustomerSupport: '/support',
};

const PROTECTED_ROUTES = ['Discovery', 'ActiveChats', 'ChatDetail', 'Dates', 'Profile', 'SettingsPortal', 'CustomerSupport'];

// Production: /onboarding is also auth-required, but handled separately so we can show a different bounce
const AUTH_REQUIRED_ROUTES = [...PROTECTED_ROUTES, 'SignupOnboarding'];

const pathToRoute = (pathname) => {
  const raw = (pathname || '/').split('?')[0].split('#')[0];
  const p = raw.replace(/\/$/, '') || '/';
  if (p === '/' || p === '/auth') return { name: 'AuthPortal', params: {} };
  if (p === '/onboarding') return { name: 'SignupOnboarding', params: {} };
  if (p === '/discovery') return { name: 'Discovery', params: {} };
  if (p === '/chats') return { name: 'ActiveChats', params: {} };
  if (p.startsWith('/chat/')) return { name: 'ChatDetail', params: { id: p.replace('/chat/', '') } };
  if (p === '/dates') return { name: 'Dates', params: {} };
  if (p === '/profile') return { name: 'Profile', params: {} };
  if (p === '/settings') return { name: 'SettingsPortal', params: {} };
  if (p === '/support') return { name: 'CustomerSupport', params: {} };
  return null;
};

const routeToPath = (name, params = {}) => {
  let path = ROUTE_TO_PATH[name] || '/';
  if (name === 'ChatDetail' && params?.id) path = `/chat/${params.id}`;
  return path;
};

// PRODUCTION: Pure read-only check. No upsert, no auto-create, no fake data.
// Returns { exists: boolean, error: string | null }
const checkProfileExists = async (userId) => {
  if (!userId) return { exists: false, error: null };
  try {
    const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (error) return { exists: false, error: error.message };
    return { exists: !!data, error: null };
  } catch (e) {
    return { exists: false, error: e?.message || 'Profile check failed' };
  }
};

const readFreshSignupFlag = () => {
  try {
    if (typeof window !== 'undefined') return window.sessionStorage?.getItem(FRESH_SIGNUP_KEY) === '1';
  } catch {}
  return false;
};
const consumeFreshSignupFlag = () => {
  try { if (typeof window !== 'undefined') window.sessionStorage?.removeItem(FRESH_SIGNUP_KEY); } catch {}
};
const clearFreshSignupFlag = () => {
  try { if (typeof window !== 'undefined') window.sessionStorage?.removeItem(FRESH_SIGNUP_KEY); } catch {}
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [bootError, setBootError] = useState('');
  const [session, setSession] = useState(null);
  const [stack, setStack] = useState([{ name: 'AuthPortal', params: {} }]);
  const isPoppingRef = useRef(false);
  const sessionRef = useRef(null);
  const profileCacheRef = useRef({}); // userId -> true/false, cleared on sign-out / profile save
  const bootAttemptRef = useRef(0);

  const current = stack[stack.length - 1];
  const currentRoute = current.name;

  useEffect(() => { sessionRef.current = session; }, [session]);

  // Called by Onboarding after successful save — lets App.js know profile now exists without re-query
  const markProfileComplete = useCallback((userId) => {
    if (userId) profileCacheRef.current[userId] = true;
    clearFreshSignupFlag();
  }, []);

  const getProfileExists = useCallback(async (user) => {
    if (!user?.id) return false;
    if (profileCacheRef.current[user.id] !== undefined) return profileCacheRef.current[user.id];
    const { exists, error } = await checkProfileExists(user.id);
    if (error) throw new Error(error);
    profileCacheRef.current[user.id] = exists;
    return exists;
  }, []);

  // --- Boot: session + profile + initial URL once ---
  const boot = useCallback(async () => {
    bootAttemptRef.current += 1;
    setIsLoading(true);
    setBootError('');
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const sess = data?.session || null;
      setSession(sess);
      sessionRef.current = sess;

      let initial = null;
      try {
        if (typeof window !== 'undefined' && window.location?.pathname) {
          initial = pathToRoute(window.location.pathname);
        }
      } catch {}

      if (!sess) {
        if (initial && AUTH_REQUIRED_ROUTES.includes(initial.name)) {
          initial = { name: 'AuthPortal', params: {} };
        }
        if (!initial) initial = { name: 'AuthPortal', params: {} };
      } else {
        // Logged in — must have a real profiles row to enter Discovery / protected routes
        const { exists, error: profileError } = await checkProfileExists(sess.user.id);
        if (profileError) throw new Error(`Could not load your profile: ${profileError}`);
        profileCacheRef.current[sess.user.id] = exists;

        if (!exists) {
          // PRODUCTION: No fake profile. Real onboarding required.
          initial = { name: 'SignupOnboarding', params: {} };
        } else {
          if (!initial) initial = { name: 'Discovery', params: {} };
          if (initial.name === 'AuthPortal') initial = { name: 'Discovery', params: {} };
          if (initial.name === 'SignupOnboarding') initial = { name: 'Discovery', params: {} };
          // Otherwise keep deep link (e.g. /chats, /chat/xxx) — user has a profile, allowed
        }
      }

      try {
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', routeToPath(initial.name, initial.params));
        }
      } catch {}
      setStack([initial]);
      setIsLoading(false);
    } catch (e) {
      setBootError(e.message || 'Could not load Intent. Check your connection and try again.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  // --- Single source of truth for auth ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_UP') {
        // Fresh signup marker — AuthPortal already sets it before signUp, this is a backup
        try { if (typeof window !== 'undefined') window.sessionStorage?.setItem(FRESH_SIGNUP_KEY, '1'); } catch {}
        return;
      }
      if (event === 'SIGNED_IN' && sess) {
        setSession(sess);
        sessionRef.current = sess;

        // If we are in Demo preview (no real session normally, but SIGNED_IN fired), don't yank Demo
        const topNow = stack[stack.length - 1];
        if (topNow?.params?.isDemo) return;

        const isFresh = readFreshSignupFlag();
        if (isFresh) {
          consumeFreshSignupFlag();
          profileCacheRef.current[sess.user.id] = false;
          setStack((prev) => {
            const topName = prev[prev.length - 1]?.name;
            if (topName === 'SignupOnboarding') return prev;
            return [{ name: 'SignupOnboarding', params: {} }];
          });
          return;
        }

        // Returning user — check real profile, no auto-create
        try {
          const exists = await getProfileExists(sess.user);
          setStack((prev) => {
            const top = prev[prev.length - 1];
            const topName = top?.name;
            if (top?.params?.isDemo) return prev;
            if (!exists) {
              if (topName === 'SignupOnboarding') return prev;
              return [{ name: 'SignupOnboarding', params: {} }];
            }
            if (topName === 'AuthPortal' || topName === 'SignupOnboarding') {
              return [{ name: 'Discovery', params: {} }];
            }
            return prev;
          });
        } catch (e) {
          setBootError(`Could not load your profile: ${e.message}`);
        }
        return;
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
        sessionRef.current = null;
        profileCacheRef.current = {};
        clearFreshSignupFlag();
        setStack([{ name: 'AuthPortal', params: {} }]);
      }
      if (event === 'TOKEN_REFRESHED' && sess) {
        setSession(sess);
        sessionRef.current = sess;
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getProfileExists]);

  // --- Browser Back / Forward ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = async () => {
      const parsed = pathToRoute(window.location.pathname);
      if (!parsed) return;

      // Logged out -> Auth, no protected / onboarding via Back
      if (!sessionRef.current && AUTH_REQUIRED_ROUTES.includes(parsed.name)) {
        isPoppingRef.current = true;
        setStack([{ name: 'AuthPortal', params: {} }]);
        setTimeout(() => { isPoppingRef.current = false; }, 50);
        return;
      }

      // Logged in but no profile -> any Back to protected route bounces to Onboarding
      if (sessionRef.current && PROTECTED_ROUTES.includes(parsed.name)) {
        try {
          const exists = await getProfileExists(sessionRef.current.user);
          if (!exists) {
            const currentTop = stack[stack.length - 1]?.name;
            if (currentTop === 'SignupOnboarding') {
              isPoppingRef.current = true;
              setStack([{ name: 'SignupOnboarding', params: {} }]);
              try { window.history.pushState(null, '', '/onboarding'); } catch {}
              setTimeout(() => { isPoppingRef.current = false; }, 50);
              return;
            }
            isPoppingRef.current = true;
            setStack([{ name: 'SignupOnboarding', params: {} }]);
            setTimeout(() => { isPoppingRef.current = false; }, 50);
            return;
          }
        } catch {
          // If profile check fails on Back, stay — don't leak protected screen
          return;
        }
      }

      isPoppingRef.current = true;
      setStack((prev) => {
        if (prev.length > 1) {
          const prevEntry = prev[prev.length - 2];
          if (prevEntry.name === parsed.name) return prev.slice(0, -1);
        }
        return [parsed];
      });
      setTimeout(() => { isPoppingRef.current = false; }, 50);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [stack, getProfileExists]);

  // --- Keep URL in sync ---
  useEffect(() => {
    if (isLoading) return;
    try {
      if (typeof window === 'undefined') return;
      if (isPoppingRef.current) return;
      const path = routeToPath(currentRoute, current.params);
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path);
      }
    } catch {}
  }, [currentRoute, current.params, isLoading]);

  const guardProtected = useCallback((name, params = {}) => {
    if (!PROTECTED_ROUTES.includes(name)) return false;
    if (params?.isDemo) return false; // Demo preview allowed
    if (!sessionRef.current) return true; // no session -> block, go to Auth
    const cached = profileCacheRef.current[sessionRef.current.user.id];
    if (cached === false) return true; // no profile -> block, go to Onboarding
    return false; // cached true or unknown -> allow, App will verify on next auth event if needed
  }, []);

  const navigate = useCallback((name, params = {}) => {
    if (guardProtected(name, params)) {
      if (!sessionRef.current) setStack([{ name: 'AuthPortal', params: {} }]);
      else setStack([{ name: 'SignupOnboarding', params: {} }]);
      return;
    }
    setStack((prev) => {
      const top = prev[prev.length - 1];
      if (top?.name === name && JSON.stringify(top?.params || {}) === JSON.stringify(params)) return prev;
      return [...prev, { name, params }];
    });
  }, [guardProtected]);

  const reset = useCallback((opts) => {
    if (typeof opts === 'string') {
      if (guardProtected(opts, {})) {
        if (!sessionRef.current) setStack([{ name: 'AuthPortal', params: {} }]);
        else setStack([{ name: 'SignupOnboarding', params: {} }]);
        return;
      }
      setStack([{ name: opts, params: {} }]);
      return;
    }
    const routes = opts?.routes || opts;
    if (Array.isArray(routes) && routes.length) {
      const first = routes[0];
      if (first && guardProtected(first.name, first.params || {})) {
        if (!sessionRef.current) setStack([{ name: 'AuthPortal', params: {} }]);
        else setStack([{ name: 'SignupOnboarding', params: {} }]);
        return;
      }
      setStack(routes.map((r) => ({ name: r.name, params: r.params || {} })));
    } else if (opts?.name) {
      if (guardProtected(opts.name, opts.params || {})) {
        if (!sessionRef.current) setStack([{ name: 'AuthPortal', params: {} }]);
        else setStack([{ name: 'SignupOnboarding', params: {} }]);
        return;
      }
      setStack([{ name: opts.name, params: opts.params || {} }]);
    }
  }, [guardProtected]);

  const goBack = useCallback(() => {
    const top = stack[stack.length - 1];
    // Onboarding with no profile must NOT use history.back() to Discovery
    if (top?.name === 'SignupOnboarding') {
      const cached = sessionRef.current ? profileCacheRef.current[sessionRef.current.user.id] : undefined;
      if (cached === false) return;
    }
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch {}
    setStack((prev) => (prev.length <= 1 ? [{ name: 'Discovery', params: {} }] : prev.slice(0, -1)));
  }, [stack]);

  const canGoBack = useCallback(() => stack.length > 1, [stack.length]);

  const navigation = {
    navigate,
    reset,
    goBack,
    canGoBack,
    setParams: (params) => setStack((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], params: { ...copy[copy.length - 1].params, ...params } };
      return copy;
    }),
    getState: () => ({ routes: stack, index: stack.length - 1 }),
    // Exposed for Onboarding to mark profile complete without a re-query race
    markProfileComplete,
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingLogo}>I</Text>
        <Text style={styles.loadingText}>INTENT</Text>
        <ActivityIndicator color="#F97316" style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (bootError) {
    return (
      <SafeAreaProvider>
        <View style={styles.errorWrap}>
          <Text style={styles.loadingLogo}>I</Text>
          <Text style={styles.errorTitle}>Couldn’t load Intent</Text>
          <Text style={styles.errorText}>{bootError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={boot}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setBootError(''); setStack([{ name: 'AuthPortal', params: {} }]); }}>
            <Text style={styles.secondaryText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  const route = { name: currentRoute, params: current.params || {}, key: currentRoute };
  const screenProps = { navigation, route, currentRoute };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <View style={styles.outer}>
          <StatusBar style="light" />
          <View key={`${currentRoute}-${JSON.stringify(current.params || {})}`} style={styles.inner}>
            {currentRoute === 'AuthPortal' && <AuthPortalScreen {...screenProps} session={session} />}
            {currentRoute === 'SignupOnboarding' && <SignupOnboardingScreen {...screenProps} session={session} />}
            {currentRoute === 'Discovery' && <DiscoveryScreen {...screenProps} session={session} />}
            {currentRoute === 'ActiveChats' && <ActiveChatsScreen {...screenProps} session={session} />}
            {currentRoute === 'ChatDetail' && <ChatDetailScreen {...screenProps} session={session} />}
            {currentRoute === 'Dates' && <DatesScreen {...screenProps} session={session} />}
            {currentRoute === 'Profile' && <ProfileScreen {...screenProps} session={session} />}
            {currentRoute === 'SettingsPortal' && <SettingsPortalScreen {...screenProps} session={session} />}
            {currentRoute === 'CustomerSupport' && <CustomerSupportScreen {...screenProps} session={session} />}
          </View>
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingLogo: { fontSize: 32, fontWeight: '900', color: '#F97316' },
  loadingText: { color: '#F8FAFC', fontWeight: '900', letterSpacing: 4, marginTop: 8 },
  outer: { flex: 1, backgroundColor: '#020617' },
  inner: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: '#0F172A', alignSelf: 'center', overflow: 'hidden' },
  errorWrap: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  errorTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginTop: 12 },
  errorText: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  retryBtn: { backgroundColor: '#F97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 20 },
  retryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  secondaryText: { color: '#FBBF24', fontWeight: '700' },
});