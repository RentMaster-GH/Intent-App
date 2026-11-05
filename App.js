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

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [stack, setStack] = useState([{ name: 'AuthPortal', params: {} }]);
  const isPoppingRef = useRef(false);
  const sessionRef = useRef(null);

  const current = stack[stack.length - 1];
  const currentRoute = current.name;

  // Keep session in a ref so popstate / auth callbacks always see the latest value
  // without re-subscribing and creating duplicate listeners.
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // --- Boot: read session + initial URL once ---
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
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

      // FIX: Protected route without session -> Auth. Auth with session -> Discovery (unless already on /auth)
      if (!sess && initial && PROTECTED_ROUTES.includes(initial.name)) {
        initial = { name: 'AuthPortal', params: {} };
      }
      if (sess && initial?.name === 'AuthPortal' && window.location.pathname !== '/auth') {
        initial = { name: 'Discovery', params: {} };
      }
      if (sess && !initial) initial = { name: 'Discovery', params: {} };
      if (!sess && !initial) initial = { name: 'AuthPortal', params: {} };

      try {
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', routeToPath(initial.name, initial.params));
        }
      } catch {}
      setStack([initial]);
      setIsLoading(false);
    }).catch(() => {
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  // --- FIX 2: Single source of truth for auth ---
  // AuthPortal must NOT call navigation.reset() on sign-in.
  // It should just call supabase.auth.signInWithPassword() and let this listener move us.
  // If both reset, you get 2 resets in 1 tick = Auth + Profile mounted together (ghost at 18s).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'SIGNED_IN' && sess) {
        setSession(sess);
        sessionRef.current = sess;
        setStack((prev) => {
          const top = prev[prev.length - 1]?.name;
          // Only auto-move if we are still on Auth / Onboarding.
          // If user is already on Discovery/Profile/Chats, don't yank them.
          if (top === 'AuthPortal' || top === 'SignupOnboarding') {
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

      // FIX: Logged-out user pressing Back to /profile or /discovery -> bounce to /auth, don't show Profile ghost
      if (!sessionRef.current && PROTECTED_ROUTES.includes(parsed.name)) {
        isPoppingRef.current = true;
        setStack([{ name: 'AuthPortal', params: {} }]);
        setTimeout(() => { isPoppingRef.current = false; }, 50);
        return;
      }

      isPoppingRef.current = true;
      setStack((prev) => {
        // If Back URL matches the previous entry, pop to it (normal Back behaviour)
        if (prev.length > 1) {
          const prevEntry = prev[prev.length - 2];
          if (prevEntry.name === parsed.name) return prev.slice(0, -1);
        }
        // Otherwise treat the URL as a single-entry stack — kills ghost
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
    // In-app Back == browser Back, so history and stack stay in sync
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
          {/* FIX 3: key={currentRoute} forces React to UNMOUNT the old screen.
              Without this, React reuses the same View and the old screen can linger for 1 frame = ghost. */}
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
  // FIX: 480px for ALL screens. Profile is now single-column, so it fits. No 860px widen hack.
  inner: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: '#0F172A', alignSelf: 'center', overflow: 'hidden' },
});