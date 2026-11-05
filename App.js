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

// FIX 3 + OLD ACCOUNT FIX: Check profile, auto-create from metadata if old account
const hasProfile = async (userId) => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (error) {
      console.warn('[App] hasProfile check failed:', error.message);
      return false;
    }
    return !!data;
  } catch (e) {
    console.warn('[App] hasProfile threw:', e?.message);
    return false;
  }
};

// For old accounts: no profiles row, but auth.users exists.
// Build a minimal profile from user_metadata (or email) so old users are NOT forced through full onboarding.
const ensureProfileForOldAccount = async (user) => {
  if (!user?.id) return false;
  if (await hasProfile(user.id)) return true;

  const meta = user.user_metadata || {};
  const emailName = user.email?.split('@')[0] || 'Intent User';
  const fullName = meta.full_name || meta.name || emailName;
  const ageNum = parseInt(meta.age, 10);
  const safeAge = !isNaN(ageNum) && ageNum >= 18 && ageNum <= 100 ? ageNum : 25;

  const profile = {
    id: user.id,
    email: user.email || null,
    full_name: fullName,
    age: safeAge,
    city: meta.city || 'Accra',
    country: meta.country || 'Ghana',
    bio: meta.bio || '',
    intent: meta.intent || 'Long-term Relationship 💍',
    avatar_url: meta.avatar_url || meta.photo || null,
    gender: meta.gender || 'Woman',
    seeking: meta.seeking || 'Men',
    photos: meta.photo || meta.avatar_url ? [meta.photo || meta.avatar_url] : [],
  };

  const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
  if (error) {
    console.warn('[App] auto-create profile failed:', error.message);
    return false;
  }
  console.log('[App] auto-created profile for old account:', user.email);
  return true;
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [stack, setStack] = useState([{ name: 'AuthPortal', params: {} }]);
  const isPoppingRef = useRef(false);
  const sessionRef = useRef(null);
  const profileCacheRef = useRef({}); // userId -> true/false, avoids re-query on every Back
  const justSignedUpRef = useRef(false); // true only for the 30s after a fresh signUp from AuthPortal

  const current = stack[stack.length - 1];
  const currentRoute = current.name;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const getProfileExists = useCallback(async (user) => {
    if (!user?.id) return false;
    if (profileCacheRef.current[user.id] !== undefined) return profileCacheRef.current[user.id];
    const exists = await hasProfile(user.id);
    profileCacheRef.current[user.id] = exists;
    return exists;
  }, []);

  const clearProfileCache = useCallback((userId) => {
    if (userId) delete profileCacheRef.current[userId];
  }, []);

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

        if (!sess) {
          if (initial && (PROTECTED_ROUTES.includes(initial.name) || initial.name === 'SignupOnboarding')) {
            initial = { name: 'AuthPortal', params: {} };
          }
          if (!initial) initial = { name: 'AuthPortal', params: {} };
        } else {
          // Has session -> OLD ACCOUNT FIX: auto-create profile if missing, don't force onboarding on refresh
          const profileExists = await ensureProfileForOldAccount(sess.user);
          profileCacheRef.current[sess.user.id] = profileExists;
          if (!mounted) return;

          if (!profileExists) {
            // Only if auto-create failed (e.g. RLS / table missing) -> onboarding
            initial = { name: 'SignupOnboarding', params: {} };
          } else {
            if (!initial) initial = { name: 'Discovery', params: {} };
            if (initial.name === 'AuthPortal') initial = { name: 'Discovery', params: {} };
            if (initial.name === 'SignupOnboarding') {
              // Returning user with profile who lands on /onboarding via URL -> Discovery
              // UNLESS they just signed up seconds ago (handled by justSignedUpRef in listener)
              initial = { name: 'Discovery', params: {} };
            }
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
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_IN' && sess) {
        setSession(sess);
        sessionRef.current = sess;

        // Fresh signup from AuthPortal: AuthPortal sets justSignedUpRef via sessionStorage flag
        // We check it so a brand-new user still goes to Onboarding, not auto-created Discovery
        let isFreshSignup = false;
        try {
          if (typeof window !== 'undefined' && window.sessionStorage?.getItem('intent_fresh_signup') === '1') {
            isFreshSignup = true;
            window.sessionStorage.removeItem('intent_fresh_signup');
          }
        } catch {}
        if (justSignedUpRef.current) {
          isFreshSignup = true;
          justSignedUpRef.current = false;
        }

        if (isFreshSignup) {
          // Brand-new user -> MUST do onboarding, do NOT auto-create profile
          profileCacheRef.current[sess.user.id] = false;
          setStack((prev) => {
            const topName = prev[prev.length - 1]?.name;
            if (topName === 'SignupOnboarding') return prev;
            if (topName === 'AuthPortal' || topName === 'SignupOnboarding') {
              return [{ name: 'SignupOnboarding', params: {} }];
            }
            return prev;
          });
          return;
        }

        // Old / returning account -> ensure profile exists (auto-create if needed)
        const profileExists = await ensureProfileForOldAccount(sess.user);
        profileCacheRef.current[sess.user.id] = profileExists;

        setStack((prev) => {
          const top = prev[prev.length - 1];
          const topName = top?.name;
          if (top?.params?.isDemo) return prev;

          if (!profileExists) {
            if (topName === 'SignupOnboarding') return prev;
            return [{ name: 'SignupOnboarding', params: {} }];
          }
          if (topName === 'AuthPortal' || topName === 'SignupOnboarding') {
            return [{ name: 'Discovery', params: {} }];
          }
          return prev;
        });
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
        sessionRef.current = null;
        profileCacheRef.current = {};
        justSignedUpRef.current = false;
        setStack([{ name: 'AuthPortal', params: {} }]);
      }
      if (event === 'SIGNED_UP') {
        // Supabase fires SIGNED_UP before SIGNED_IN for new accounts - mark it
        justSignedUpRef.current = true;
        try {
          if (typeof window !== 'undefined') window.sessionStorage?.setItem('intent_fresh_signup', '1');
        } catch {}
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // --- Browser Back / Forward ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = async () => {
      const parsed = pathToRoute(window.location.pathname);
      if (!parsed) return;

      // Logged-out -> bounce to Auth
      if (!sessionRef.current && (PROTECTED_ROUTES.includes(parsed.name) || parsed.name === 'SignupOnboarding')) {
        isPoppingRef.current = true;
        setStack([{ name: 'AuthPortal', params: {} }]);
        setTimeout(() => { isPoppingRef.current = false; }, 50);
        return;
      }

      // Logged-in but no profile + trying to go to Discovery/etc via Back -> bounce to Onboarding
      // (only for fresh signups - old accounts auto-create profile, so this rarely triggers)
      if (sessionRef.current && parsed.name !== 'SignupOnboarding') {
        const exists = profileCacheRef.current[sessionRef.current.user.id] ?? (await getProfileExists(sessionRef.current.user));
        if (!exists) {
          // Check if it's a fresh signup still in onboarding flow
          const currentTop = stack[stack.length - 1]?.name;
          if (currentTop === 'SignupOnboarding') {
            isPoppingRef.current = true;
            setStack([{ name: 'SignupOnboarding', params: {} }]);
            // Push onboarding URL back so Back doesn't loop
            try { window.history.pushState(null, '', '/onboarding'); } catch {}
            setTimeout(() => { isPoppingRef.current = false; }, 50);
            return;
          }
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
    // Guard: don't let any screen navigate to protected route if no profile and not Demo / not Onboarding
    if (PROTECTED_ROUTES.includes(name) && !params?.isDemo && sessionRef.current) {
      const cached = profileCacheRef.current[sessionRef.current.user.id];
      if (cached === false) {
        setStack([{ name: 'SignupOnboarding', params: {} }]);
        return;
      }
    }
    setStack((prev) => {
      const top = prev[prev.length - 1];
      if (top?.name === name && JSON.stringify(top?.params || {}) === JSON.stringify(params)) return prev;
      return [...prev, { name, params }];
    });
  }, []);

  const reset = useCallback((opts) => {
    if (typeof opts === 'string') {
      // Guard reset('Discovery') when no profile
      if (PROTECTED_ROUTES.includes(opts) && sessionRef.current) {
        const cached = profileCacheRef.current[sessionRef.current.user.id];
        if (cached === false) {
          setStack([{ name: 'SignupOnboarding', params: {} }]);
          return;
        }
      }
      setStack([{ name: opts, params: {} }]);
      return;
    }
    const routes = opts?.routes || opts;
    if (Array.isArray(routes) && routes.length) {
      // If resetting to Discovery but no profile -> Onboarding
      const first = routes[0];
      if (first && PROTECTED_ROUTES.includes(first.name) && !first.params?.isDemo && sessionRef.current) {
        const cached = profileCacheRef.current[sessionRef.current.user.id];
        if (cached === false) {
          setStack([{ name: 'SignupOnboarding', params: {} }]);
          return;
        }
      }
      setStack(routes.map((r) => ({ name: r.name, params: r.params || {} })));
    } else if (opts?.name) {
      setStack([{ name: opts.name, params: opts.params || {} }]);
    }
  }, []);

  const goBack = useCallback(() => {
    // FIX: Onboarding Back must NOT go to Discovery via history.back()
    // If current is Onboarding and no profile, stay. Onboarding screen handles its own Back UI.
    const top = stack[stack.length - 1];
    if (top?.name === 'SignupOnboarding') {
      const cached = sessionRef.current ? profileCacheRef.current[sessionRef.current.user.id] : undefined;
      if (cached === false) {
        return; // block - Onboarding's own handleBack will show "Leave setup?" dialog
      }
      // If profile exists (old account editing), allow normal back to Discovery
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