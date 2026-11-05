import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase, MOCK_PROFILES } from '../lib/supabase';

// Fallback demo people (your original 3) — used ONLY in Demo Mode or when profiles table is empty
const DEMO_PEOPLE = [
  { id: 'demo-1', name: 'Ama', age: 27, location: 'Accra, Ghana', city: 'Accra', country: 'Ghana', intent: 'Long-term Relationship 💛', bio: 'Intentional. Coffee lover. Looking for something real.', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80' },
  { id: 'demo-2', name: 'Kwame', age: 29, location: 'Accra, Ghana', city: 'Accra', country: 'Ghana', intent: 'Friendship First 🤝', bio: 'Gym, Afrobeats, and good conversation.', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80' },
  { id: 'demo-3', name: 'Efua', age: 26, location: 'Kumasi, Ghana', city: 'Kumasi', country: 'Ghana', intent: 'Marriage Minded 💍', bio: 'Faith, family, and building something lasting.', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80' },
];

const CITY_FILTERS = ['All', 'Accra', 'Kumasi', 'Lagos', 'Tema'];
const INTENT_FILTERS = ['All Intents', 'Long-term Relationship 💍', 'Marriage Minded 💍', 'Friendship First 🤝'];

const normalizeDbProfile = (p) => ({
  id: p.id,
  name: p.full_name || p.name || 'Intent User',
  age: p.age || 25,
  city: p.city || 'Accra',
  country: p.country || 'Ghana',
  location: [p.city, p.country].filter(Boolean).join(', ') || 'Accra, Ghana',
  intent: p.intent || 'Long-term Relationship 💍',
  bio: p.bio || 'Looking for something real.',
  img: p.avatar_url || p.photos?.[0] || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
  photos: p.photos?.length ? p.photos : p.avatar_url ? [p.avatar_url] : [],
  gender: p.gender,
  seeking: p.seeking,
  isDemo: false,
});

const normalizeMockProfile = (p) => ({
  id: p.id,
  name: p.name || p.full_name || 'Intent User',
  age: p.age || 25,
  city: p.city || 'Accra',
  country: p.country || 'Ghana',
  location: p.location || [p.city, p.country].filter(Boolean).join(', ') || 'Accra, Ghana',
  intent: p.intent || 'Long-term Relationship 💍',
  bio: p.bio || 'Looking for something real.',
  img: p.avatar_url || p.photo || p.photos?.[0] || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
  photos: p.photos || [],
  isDemo: true,
});

export default function DiscoveryScreen({ navigation, route }) {
  const isDemo = route?.params?.isDemo === true;
  const [people, setPeople] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState(null);
  const [likedIds, setLikedIds] = useState(new Set());
  const [liking, setLiking] = useState(false);
  const [cityFilter, setCityFilter] = useState('All');
  const [intentFilter, setIntentFilter] = useState('All Intents');
  const [loadError, setLoadError] = useState('');

  const loadPeople = useCallback(async () => {
    setLoadError('');
    try {
      if (isDemo) {
        setPeople(DEMO_PEOPLE);
        setMyId('demo-user');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // No session but not demo -> use mocks so screen doesn't crash, App.js will redirect to Auth on refresh
        setPeople(DEMO_PEOPLE.map((p) => ({ ...p, isDemo: true })));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setMyId(user.id);

      // Fetch my likes so we don't show people I already liked
      const { data: myLikes } = await supabase.from('likes').select('liked_id').eq('liker_id', user.id);
      const alreadyLiked = new Set((myLikes || []).map((l) => l.liked_id));
      setLikedIds(alreadyLiked);

      // Fetch all profiles except me
      const { data, error } = await supabase.from('profiles').select('*').neq('id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;

      if (!data || data.length === 0) {
        // Table empty -> show MOCK_PROFILES from supabase.js so Discovery still looks full
        // These are demo profiles, marked isDemo so Like/Chat will prompt to sign up properly
        const mocks = (MOCK_PROFILES || []).map(normalizeMockProfile);
        setPeople(mocks);
      } else {
        const real = data.map(normalizeDbProfile).filter((p) => !alreadyLiked.has(p.id));
        // If all real people already liked, still show empty state (don't fall back to mocks)
        setPeople(real);
      }
      setIndex(0);
    } catch (e) {
      console.error('[Discovery] load failed:', e);
      setLoadError(e.message || 'Could not load people.');
      // Fallback to mocks so UI never blank
      setPeople(DEMO_PEOPLE);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDemo]);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setIndex(0);
    loadPeople();
  }, [loadPeople]);

  // Apply filters
  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (cityFilter !== 'All' && p.city !== cityFilter) return false;
      if (intentFilter !== 'All Intents' && !p.intent?.includes(intentFilter.split(' ')[0])) {
        // Loose match: "Long-term" vs "Long-term Relationship 💍"
        if (intentFilter === 'Long-term Relationship 💍' && !p.intent?.includes('Long-term')) return false;
        if (intentFilter === 'Marriage Minded 💍' && !p.intent?.includes('Marriage')) return false;
        if (intentFilter === 'Friendship First 🤝' && !p.intent?.includes('Friendship')) return false;
      }
      return true;
    });
  }, [people, cityFilter, intentFilter]);

  const person = filtered[index % (filtered.length || 1)];

  const findOrCreateMatch = async (otherId) => {
    if (!myId || myId === 'demo-user') return null;
    const [a, b] = myId < otherId ? [myId, otherId] : [otherId, myId];
    // Find existing match (either direction)
    const { data: existing } = await supabase
      .from('matches')
      .select('*')
      .or(`and(user_a.eq.${myId},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${myId})`)
      .maybeSingle();
    if (existing) return existing;

    const { data: created, error } = await supabase
      .from('matches')
      .insert({ user_a: a, user_b: b })
      .select()
      .single();
    if (error) throw error;
    return created;
  };

  const handlePass = () => {
    setIndex((i) => i + 1);
  };

  const handleLike = async () => {
    if (!person || liking) return;
    if (isDemo || person.isDemo || !myId || myId === 'demo-user') {
      Alert.alert('Demo Mode', 'Create a free account to like real people and start real chats.', [
        { text: 'Stay in Demo', style: 'cancel' },
        { text: 'Create Account', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'AuthPortal', params: {} }] }) },
      ]);
      return;
    }
    setLiking(true);
    try {
      // 1. Insert like
      const { error: likeError } = await supabase.from('likes').insert({ liker_id: myId, liked_id: person.id });
      if (likeError && !likeError.message?.includes('duplicate')) throw likeError;

      setLikedIds((prev) => new Set(prev).add(person.id));

      // 2. Check mutual: did they already like me?
      const { data: mutual } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_id', person.id)
        .eq('liked_id', myId)
        .maybeSingle();

      if (mutual) {
        // 3. Mutual -> create match
        const match = await findOrCreateMatch(person.id);
        Alert.alert(
          "It's a Match! 💛",
          `You and ${person.name} liked each other. Start chatting?`,
          [
            { text: 'Keep Browsing', style: 'cancel', onPress: () => setIndex((i) => i + 1) },
            {
              text: 'Start Chat 💬',
              onPress: () =>
                navigation.navigate('ChatDetail', {
                  id: match?.id || person.id,
                  matchId: match?.id,
                  name: person.name,
                  avatar: person.img,
                  img: person.img,
                  intent: person.intent,
                  location: person.location,
                  otherUserId: person.id,
                }),
            },
          ]
        );
      } else {
        Alert.alert('Liked 💛', `You liked ${person.name}. If they like you back, you'll match!`);
        setIndex((i) => i + 1);
      }
    } catch (e) {
      console.error('[Discovery] like failed:', e);
      Alert.alert('Could not like', e.message || 'Check internet and try again.');
    } finally {
      setLiking(false);
    }
  };

  const handleStartChat = async () => {
    if (!person) return;
    if (isDemo || person.isDemo || !myId || myId === 'demo-user') {
      // Demo: keep old behaviour - navigate with fake data so ChatDetail still shows
      navigation.navigate('ChatDetail', { id: person.id, name: person.name, avatar: person.img, img: person.img, intent: person.intent, location: person.location });
      return;
    }
    try {
      const match = await findOrCreateMatch(person.id);
      navigation.navigate('ChatDetail', {
        id: match?.id || person.id,
        matchId: match?.id,
        name: person.name,
        avatar: person.img,
        img: person.img,
        intent: person.intent,
        location: person.location,
        otherUserId: person.id,
      });
    } catch (e) {
      Alert.alert('Could not start chat', e.message || 'Try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color="#F97316" size="large" />
        <Text style={styles.loadingText}>Finding people near you...</Text>
      </View>
    );
  }

  if (!person) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.c} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}>
        <View style={styles.header}>
          <Text style={styles.logo}>INTENT</Text>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}><Text style={styles.profileBtnText}>👤 Profile</Text></TouchableOpacity>
        </View>
        <Text style={styles.title}>Discovery</Text>
        <Text style={styles.sub}>People near you — max 3 active chats worldwide.</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No more people nearby</Text>
          <Text style={styles.emptySub}>
            {loadError ? loadError : 'You have seen everyone matching your filters. Try clearing filters or pull to refresh.'}
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}><Text style={styles.btnText}>↻ Refresh</Text></TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setCityFilter('All'); setIntentFilter('All Intents'); setIndex(0); }}>
            <Text style={styles.clearBtnText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate('ActiveChats')}><Text style={styles.link}>Chats →</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.link}>Profile →</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SettingsPortal')}><Text style={styles.link}>Settings →</Text></TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.c} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}>
      <View style={styles.header}>
        <Text style={styles.logo}>INTENT</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}><Text style={styles.profileBtnText}>👤 Profile</Text></TouchableOpacity>
      </View>

      <Text style={styles.title}>Discovery</Text>
      <Text style={styles.sub}>People near you — max 3 active chats worldwide. {isDemo ? '(Demo Mode)' : ''}</Text>

      {loadError ? <Text style={styles.errorText}>⚠️ {loadError}</Text> : null}

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {CITY_FILTERS.map((c) => (
          <TouchableOpacity key={c} style={[styles.filterChip, cityFilter === c && styles.filterChipActive]} onPress={() => { setCityFilter(c); setIndex(0); }}>
            <Text style={[styles.filterText, cityFilter === c && styles.filterTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterRow, { marginTop: 8 }]}>
        {INTENT_FILTERS.map((it) => (
          <TouchableOpacity key={it} style={[styles.filterChip, intentFilter === it && styles.filterChipActive]} onPress={() => { setIntentFilter(it); setIndex(0); }}>
            <Text style={[styles.filterText, intentFilter === it && styles.filterTextActive]}>{it}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <Image source={{ uri: person.img }} style={styles.img} />
        <Text style={styles.name}>{person.name}, {person.age} ✓</Text>
        <Text style={styles.intent}>{person.intent}</Text>
        <Text style={styles.meta}>{person.location}</Text>
        <Text style={styles.bio}>{person.bio}</Text>
        <Text style={styles.counter}>{filtered.length ? `${(index % filtered.length) + 1} of ${filtered.length}` : ''}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.pass]} onPress={handlePass}><Text style={styles.btnText}>✕ Pass</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.like, liking && styles.btnDisabled]} onPress={handleLike} disabled={liking}>
            {liking ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>♥ Like</Text>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.chatBtn} onPress={handleStartChat}>
          <Text style={styles.chatText}>💬 Start Chat →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('ActiveChats')}><Text style={styles.link}>Chats →</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Dates')}><Text style={styles.link}>Dates →</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.link}>Profile →</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('SettingsPortal')}><Text style={styles.link}>Settings →</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0F172A' },
  c: { padding: 20, paddingBottom: 40, width: '100%' },
  centerBox: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12 },
  errorText: { color: '#FCA5A5', fontSize: 13, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 },
  logo: { color: '#FFF', fontWeight: '900', letterSpacing: 3, fontSize: 18 },
  profileBtn: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  profileBtnText: { color: '#FBBF24', fontWeight: '800', fontSize: 13 },
  title: { color: '#FFF', fontWeight: '900', fontSize: 26, alignSelf: 'flex-start' },
  sub: { color: '#94A3B8', alignSelf: 'flex-start', marginTop: 4, marginBottom: 12 },
  filterRow: { flexDirection: 'row', marginBottom: 4 },
  filterChip: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#334155', marginRight: 8 },
  filterChipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  filterText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  card: { width: '100%', backgroundColor: '#1E293B', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#334155', marginTop: 8 },
  img: { width: '100%', height: 320, borderRadius: 14, backgroundColor: '#0F172A' },
  name: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 12 },
  intent: { color: '#FBBF24', marginTop: 4, fontWeight: '700' },
  meta: { color: '#94A3B8', marginTop: 4 },
  bio: { color: '#CBD5E1', marginTop: 8, lineHeight: 20 },
  counter: { color: '#64748B', fontSize: 12, marginTop: 8, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  btn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  pass: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  like: { backgroundColor: '#F97316' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontWeight: '800' },
  chatBtn: { backgroundColor: '#0F172A', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#334155' },
  chatText: { color: '#FBBF24', fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 24, marginTop: 20, flexWrap: 'wrap' },
  link: { color: '#FBBF24', fontWeight: '700' },
  emptyCard: { width: '100%', backgroundColor: '#1E293B', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#334155', alignItems: 'center', marginTop: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  emptySub: { color: '#94A3B8', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  refreshBtn: { backgroundColor: '#F97316', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, marginTop: 16 },
  clearBtn: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  clearBtnText: { color: '#FBBF24', fontWeight: '700' },
});