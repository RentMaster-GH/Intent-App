import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
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

// FIX 1: Strip ?query and #hash — was keeping ?user=[object Object] in the URL
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

// FIX 3: Helper — does this user have a profiles row?
const hasProfile = async (userId) => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      // Table missing / RLS error -> treat as no profile, but don't crash boot
      console.warn('[App] hasProfile check failed:', error.message);
      return false;
    }
    return !!data;
  } catch (e) {
    console.warn('[App] hasProfile threw:', e?.message);
    return false;
  }
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [stack, setStack] = useState([{ name: 'AuthPortal', params: {} }]);
  const isPoppingRef = useRef(false);
  const sessionRef = useRef(null);

  const current = stack[stack.length - 1];
  const currentRoute = current.name;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // --- Boot: read session + profile + initial URL once ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const sess = data?.session || null;
        setSession(sess);
        sessionRef.current = sess;

        let initial = null;
        try {
          if (typeof window !== 'undefined' && window.location?.pathname) {
            initial = pathToRoute(window.location.pathname);
          }
        } catch {}

        // No session -> protected routes bounce to Auth. Onboarding without session also bounces to Auth
        // (except Demo Mode which is handled via in-app navigation, not URL reload)
        if (!sess) {
          if (initial && (PROTECTED_ROUTES.includes(initial.name) || initial.name === 'SignupOnboarding')) {
            initial = { name: 'AuthPortal', params: {} };
          }
          if (!initial) initial = { name: 'AuthPortal', params: {} };
        } else {
          // Has session -> check profile
          const profileExists = await hasProfile(sess.user.id);
          if (!mounted) return;

          if (!profileExists) {
            // FIX 3: New user, no profile yet -> force Onboarding, even if URL says /discovery
            // Exception: if user is on /auth and just signed up, still go to Onboarding
            initial = { name: 'SignupOnboarding', params: {} };
          } else {
            // Returning user with profile
            if (!initial) initial = { name: 'Discovery', params: {} };
            if (initial.name === 'AuthPortal') initial = { name: 'Discovery', params: {} };
            if (initial.name === 'SignupOnboarding') initial = { name: 'Discovery', params: {} };
            // If initial is a protected route, keep it (e.g. deep link to /chats)
          }
        }

        try {
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', routeToPath(initial.name, initial.params));
          }
        } catch {}
        setStack([initial]);
        setIsLoading(false);
      } catch {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // --- FIX 2 + FIX 3: Single source of truth for auth ---
  // AuthPortal must NOT call navigation.reset() on sign-in.
  // It should just call supabase.auth.signInWithPassword() and let this listener move us.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_IN' && sess) {
        setSession(sess);
        sessionRef.current = sess;

        // FIX 3: Don't yank to Discovery if profile doesn't exist yet
        const profileExists = await hasProfile(sess.user.id);

        setStack((prev) => {
          const top = prev[prev.length - 1];
          const topName = top?.name;

          // Demo mode: no session normally, but if SIGNED_IN fires while in Demo, don't yank
          if (top?.params?.isDemo) return prev;

          if (!profileExists) {
            // New signup -> must complete onboarding
            if (topName === 'SignupOnboarding') return prev; // already there, stay
            return [{ name: 'SignupOnboarding', params: {} }];
          }

          // Profile exists -> only auto-move if still on Auth / Onboarding
          // If user is already on Discovery/Profile/Chats, don't yank them
          if (topName === 'AuthPortal' || topName === 'SignupOnboarding') {
            return [{ name: 'Discovery', params: {} }];
          }
          return prev;
        });
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
        sessionRef.current = null;
        setStack([{ name: 'AuthPortal', params: {} }]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // --- Browser Back / Forward ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      const parsed = pathToRoute(window.location.pathname);
      if (!parsed) return;

      // FIX: Logged-out user pressing Back to /profile or /discovery -> bounce to /auth
      if (!sessionRef.current && PROTECTED_ROUTES.includes(parsed.name)) {
        isPoppingRef.current = true;
        setStack([{ name: 'AuthPortal', params: {} }]);
        setTimeout(() => { isPoppingRef.current = false; }, 50);
        return;
      }
      // Logged-out user pressing Back to /onboarding -> bounce to /auth
      if (!sessionRef.current && parsed.name === 'SignupOnboarding') {
        isPoppingRef.current = true;
        setStack([{ name: 'AuthPortal', params: {} }]);
        setTimeout(() => { isPoppingRef.current = false; }, 50);
        return;
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
  }, []);

  // --- Keep URL in sync — skip push when change CAME from browser Back ---
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

  const navigate = useCallback((name, params = {}) => {
    setStack((prev) => {
      const top = prev[prev.length - 1];
      if (top?.name === name && JSON.stringify(top?.params || {}) === JSON.stringify(params)) return prev;
      return [...prev, { name, params }];
    });
  }, []);

  const reset = useCallback((opts) => {
    if (typeof opts === 'string') { setStack([{ name: opts, params: {} }]); return; }
    const routes = opts?.routes || opts;
    if (Array.isArray(routes) && routes.length) {
      setStack(routes.map((r) => ({ name: r.name, params: r.params || {} })));
    } else if (opts?.name) {
      setStack([{ name: opts.name, params: opts.params || {} }]);
    }
  }, []);

  const goBack = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch {}
    setStack((prev) => (prev.length <= 1 ? [{ name: 'Discovery', params: {} }] : prev.slice(0, -1)));
  }, []);

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
            {currentRoute === 'Discovery' && <DiscoveryScreen {...screenProps} />}
            {currentRoute === 'ActiveChats' && <ActiveChatsScreen {...screenProps} />}
            {currentRoute === 'ChatDetail' && <ChatDetailScreen {...screenProps} />}
            {currentRoute === 'Dates' && <DatesScreen {...screenProps} />}
            {currentRoute === 'Profile' && <ProfileScreen {...screenProps} />}
            {currentRoute === 'SettingsPortal' && <SettingsPortalScreen {...screenProps} />}
            {currentRoute === 'CustomerSupport' && <CustomerSupportScreen {...screenProps} />}
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
});