import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Supabase keys come from .env (local) and EAS secrets (builds).
// They must be EXPO_PUBLIC_ prefixed to be inlined by Expo.
// NEVER hardcode a real key here - not even the anon key.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // warn, never throw - App.js handles the unconfigured state
  // by showing AuthPortal instead of white-screen crashing.
  console.warn(
    '[INTENT] Missing Supabase keys. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (local) AND in EAS secrets (APK) / Vercel > Settings > Environment Variables (web), then rebuild.'
  );
} else if (Platform.OS === 'web' && typeof window !== 'undefined') {
  console.log('[INTENT] Supabase URL:', supabaseUrl);
}

// Safe storage adapter for Supabase Auth.
// On Android/iOS there is no window.localStorage.
// Passing AsyncStorage raw can crash if it is undefined in a build -
// wrap every method and always return a Promise.
const safeStorage = {
  getItem: async (key) => {
    try {
      if (typeof AsyncStorage?.getItem !== 'function') return null;
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      if (typeof AsyncStorage?.setItem !== 'function') return;
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key) => {
    try {
      if (typeof AsyncStorage?.removeItem !== 'function') return;
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

// Safe fetch - Supabase calls global.fetch. Guard it so a missing
// fetch in a native build never becomes "undefined is not a function".
const safeFetch = (...args) => {
  if (typeof fetch !== 'function') {
    return Promise.reject(new Error('fetch is not available in this build'));
  }
  return fetch(...args);
};

export const supabase = createClient(
  // Never pass undefined/empty to createClient - it throws on init.
  // If keys are missing we use a syntactically valid placeholder so the
  // client can be created, but App.js will NOT call it (isSupabaseConfigured === false).
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: safeStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Only try to read session from URL on web
      detectSessionInUrl: Platform.OS === 'web',
    },
    global: {
      fetch: safeFetch,
    },
  }
);

// Shared by App.js - single source of truth for "does this user have a profile?"
export const checkProfileExists = async (userId) => {
  if (!userId) return { exists: false, error: null };
  if (!isSupabaseConfigured) return { exists: false, error: null };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (error) return { exists: false, error: error.message };
    return { exists: !!data, error: null };
  } catch (e) {
    return { exists: false, error: e?.message || 'Profile check failed' };
  }
};

// Helper: map ANY profile shape to what DiscoveryScreen expects
const normalizeProfile = (p) => {
  if (!p) return null;
  const photo = p.avatar_url || p.photo || p.photos?.[0] || p.images?.[0] || p.avatar || '';
  const photos = p.photos?.length ? p.photos : p.images?.length ? p.images : photo ? [photo] : [];
  return {
    id: p.id || String(Math.random()),
    name: p.name || p.full_name || p.display_name || 'Intent User',
    age: p.age || 24,
    location: p.location || ([p.city, p.country].filter(Boolean).join(', ') || 'Accra, Ghana'),
    title: p.title || p.job || p.occupation || (p.city ? `${p.city} - ${p.country || ''}` : 'Intentional Member'),
    bio: p.bio || p.about || 'Looking for something real.',
    intent: p.intent || 'Long-term Relationship',
    photos,
    photo,
    avatar: photo,
    avatar_url: photo,
    images: photos,
    interests: p.interests || [],
    prompts: p.prompts || [{ question: 'My ideal Sunday morning', answer: p.bio || 'Coffee, good conversation, and no rush.' }],
    verified: p.verified ?? true,
    city: p.city || 'Accra',
    country: p.country || 'Ghana',
  };
};

const RAW_MOCK = [
  { id: '1', full_name: 'Amara', age: 24, city: 'Accra', country: 'Ghana', bio: 'Love art, coffee and deep conversations. Looking for something real.', intent: 'Long-term Relationship', title: 'Artist & Coffee Lover', avatar_url: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&auto=format&fit=crop&q=80', interests: ['Art', 'Travel', 'Coffee'] },
  { id: '2', full_name: 'Kwame', age: 27, city: 'Kumasi', country: 'Ghana', bio: 'Entrepreneur. Gym, books, building. Family first.', intent: 'Long-term Relationship', title: 'Entrepreneur', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80', interests: ['Business', 'Fitness'] },
  { id: '3', full_name: 'Efua', age: 26, city: 'Cape Town', country: 'South Africa', bio: 'Cape Town nurse, loves amapiano and beach walks.', intent: 'Friendship First', title: 'Nurse & Foodie', avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&auto=format&fit=crop&q=80', interests: ['Amapiano', 'Beach', 'Cooking'] },
  { id: '4', full_name: 'Kofi', age: 29, city: 'Accra', country: 'Ghana', bio: 'Accra dev. Code by day, highlife by night.', intent: 'Marriage Minded', title: 'Software Engineer', avatar_url: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=800&auto=format&fit=crop&q=80', interests: ['Tech', 'Highlife', 'Football'] },
  { id: '5', full_name: 'Abena', age: 25, city: 'Lagos', country: 'Nigeria', bio: 'Lagos designer. Ankara, art, and intentional love.', intent: 'Long-term Relationship', title: 'Fashion Designer', avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80', interests: ['Fashion', 'Ankara', 'Travel'] },
  { id: '6', full_name: 'Yaw', age: 31, city: 'Tema', country: 'Ghana', bio: 'Tema photographer. Chasing light and real stories.', intent: 'Activity & Event Buddy', title: 'Photographer', avatar_url: 'https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=800&auto=format&fit=crop&q=80', interests: ['Photography', 'Hiplife', 'Travel'] },
  { id: '7', full_name: 'Elena', age: 26, city: 'Berlin', country: 'Germany', bio: 'Love ceramic art and sunsets.', intent: 'Friends First', title: 'Ceramic Artist', avatar_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80', interests: ['Art', 'Ceramics'] },
  { id: '8', full_name: 'Zara', age: 23, city: 'London', country: 'UK', bio: 'Studying design. New in town.', intent: 'Activity & Event Buddy', title: 'Design Student', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80', interests: ['Design', 'Art'] },
];

export const MOCK_PROFILES = RAW_MOCK.map(normalizeProfile);

export const getAuthenticatedUser = async () => {
  try {
    if (!isSupabaseConfigured) return null;
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Account',
      intent: u.user_metadata?.intent || 'Long-term Relationship',
      avatar: u.user_metadata?.avatar_url || '',
      photos: u.user_metadata?.avatar_url ? [u.user_metadata.avatar_url] : [],
      ...u,
    };
  } catch {
    return null;
  }
};

export const signUpUser = async (email, password) => {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  return supabase.auth.signUp({ email, password });
};

export const signInUser = async (email, password) => {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  return supabase.auth.signInWithPassword({ email, password });
};

export const signOutUser = async () => {
  try {
    if (!isSupabaseConfigured) return { error: null };
    return await supabase.auth.signOut();
  } catch (e) {
    return { error: e };
  }
};