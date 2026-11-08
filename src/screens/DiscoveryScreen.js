import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, RefreshControl, Share, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const DEMO_PREVIEW = [
  { id: 'demo-1', name: 'Ama', age: 27, location: 'Accra, Ghana', city: 'Accra', intent: 'Long-term Relationship 💛', bio: 'Intentional. Coffee lover. Looking for something real.', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80', isDemo: true },
  { id: 'demo-2', name: 'Kwame', age: 29, location: 'Accra, Ghana', city: 'Accra', intent: 'Friendship First 🤝', bio: 'Gym, Afrobeats, and good conversation.', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', isDemo: true },
];

const CITY_FILTERS = ['All', 'Accra', 'Kumasi', 'Lagos', 'Tema'];
const INTENT_FILTERS = ['All Intents', 'Long-term Relationship 💛', 'Marriage Minded 💍', 'Friendship First 🤝'];

const INTENT_WEB_URL = 'https://intent-app-zeta.vercel.app';

// FIX: Real columns are name / location / photos. NOT full_name / city / country / avatar_url.
// location is a single string like "Accra" or "Accra, Ghana" — parse city from it.
const normalizeProfile = (p) => {
  const photos = Array.isArray(p.photos) ? p.photos.filter(Boolean) : [];
  const location = p.location || '';
  // City = part before comma. "Accra, Ghana" -> "Accra". "Tema" -> "Tema".
  const city = location.split(',')[0]?.trim() || null;
  return {
    id: p.id,
    name: p.name || null,
    age: p.age ?? null,
    city,
    location: location || null,
    intent: p.intent || null,
    bio: p.bio || '',
    img: photos[0] || null,
    photos,
    isDemo: false,
  };
};

export default function DiscoveryScreen({ navigation, route }) {
  const isDemo = route?.params?.isDemo === true;
  const [people, setPeople] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState(null);
  const [likedIds, setLikedIds] = useState(new Set());
  const [matchedIds, setMatchedIds] = useState(new Set());
  const [matchIdByUser, setMatchIdByUser] = useState({});
  const [liking, setLiking] = useState(false);
  const [cityFilter, setCityFilter] = useState('All');
  const [intentFilter, setIntentFilter] = useState('All Intents');
  const [loadError, setLoadError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const loadPeople = useCallback(async () => {
    setLoadError('');
    try {
      if (isDemo) {
        setPeople(DEMO_PREVIEW);
        setMyId('demo-user');
        setLoading(false); setRefreshing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPeople([]);
        setMyId(null);
        setLoading(false); setRefreshing(false);
        return;
      }
      setMyId(user.id);

      const [likesRes, matchesRes] = await Promise.all([
        supabase.from('likes').select('liked_id').eq('liker_id', user.id),
        supabase.from('matches').select('id, user_a, user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      ]);
      const alreadyLiked = new Set((likesRes.data || []).map((l) => l.liked_id));
      setLikedIds(alreadyLiked);

      const matched = new Set();
      const matchMap = {};
      (matchesRes.data || []).forEach((m) => {
        const other = m.user_a === user.id ? m.user_b : m.user_a;
        matched.add(other);
        matchMap[other] = m.id;
      });
      setMatchedIds(matched);
      setMatchIdByUser(matchMap);

      // FIX: Select only real columns. select('*') worked, but normalize now uses real names.
      // Also: NO location filter here. Accra must see Tema. Ghana-wide / Global.
      const { data, error } = await supabase.from('profiles')
        .select('id, name, age, location, intent, bio, photos, show_on_discovery, created_at')
        .neq('id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const real = (data || [])
        .map(normalizeProfile)
        // FIX: name + photo required. img now comes from photos[0], so this works.
        .filter((p) => p.id && p.name && p.img)
        .filter((p) => !alreadyLiked.has(p.id) && !matched.has(p.id))
        // Respect opt-out only. No gender/seeking filter — you don't collect gender.
        .filter((p) => {
          const raw = (data || []).find(d => d.id === p.id);
          return raw?.show_on_discovery !== false;
        });

      if (!mountedRef.current) return;
      setPeople(real);
      setIndex(0);
    } catch (e) {
      if (!mountedRef.current) return;
      setPeople([]);
      setLoadError('Could not load people. Check your connection and pull to refresh.');
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, [isDemo]);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setIndex(0);
    loadPeople();
  }, [loadPeople]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      // City filter now works because city is parsed from location string.
      // Default is 'All', so Accra sees Tema unless user taps a city chip.
      if (cityFilter !== 'All' && p.city !== cityFilter) return false;
      if (intentFilter !== 'All Intents') {
        if (intentFilter === 'Long-term Relationship 💛' && !p.intent?.includes('Long-term')) return false;
        if (intentFilter === 'Marriage Minded 💍' && !p.intent?.includes('Marriage')) return false;
        if (intentFilter === 'Friendship First 🤝' && !p.intent?.includes('Friendship')) return false;
      }
      return true;
    });
  }, [people, cityFilter, intentFilter]);

  const person = filtered[index];

  const handlePass = () => {
    if (!person) return;
    setIndex((i) => i + 1);
  };

  const handleLike = async () => {
    if (!person || liking) return;
    if (isDemo || person.isDemo || !myId || myId === 'demo-user') {
      Alert.alert('Preview Mode', 'This is a preview. Create a free account to like real people.', [
        { text: 'Stay in Preview', style: 'cancel' },
        { text: 'Create Account', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'AuthPortal', params: {} }] }) },
      ]);
      return;
    }
    setLiking(true);
    try {
      const { error: likeError } = await supabase.from('likes').insert({ liker_id: myId, liked_id: person.id });
      if (likeError && likeError.code !== '23505') throw likeError;
      setLikedIds((prev) => new Set(prev).add(person.id));

      const { data: mutual } = await supabase.from('likes').select('id').eq('liker_id', person.id).eq('liked_id', myId).maybeSingle();
      if (mutual) {
        const [a, b] = myId < person.id ? [myId, person.id] : [person.id, myId];
        const { data: existing } = await supabase.from('matches').select('*').or(`and(user_a.eq.${myId},user_b.eq.${person.id}),and(user_a.eq.${person.id},user_b.eq.${myId})`).maybeSingle();
        let match = existing;
        if (!match) {
          const { data: created, error: matchError } = await supabase.from('matches').insert({ user_a: a, user_b: b }).select().single();
          if (matchError) throw matchError;
          match = created;
        }
        setMatchedIds((prev) => new Set(prev).add(person.id));
        setMatchIdByUser((prev) => ({ ...prev, [person.id]: match.id }));
        Alert.alert("It's a Match! 💛", `You and ${person.name} liked each other.`, [
          { text: 'Keep Browsing', style: 'cancel', onPress: () => setIndex((i) => i + 1) },
          { text: 'Start Chat 💬', onPress: () => navigation.navigate('ChatDetail', { id: match.id, matchId: match.id, name: person.name, avatar: person.img, img: person.img, intent: person.intent, location: person.location, otherUserId: person.id }) },
        ]);
      } else {
        setIndex((i) => i + 1);
      }
    } catch (e) {
      Alert.alert('Could not like', 'Please try again.');
    } finally {
      setLiking(false);
    }
  };

  const handleStartChat = () => {
    if (!person) return;
    if (isDemo || person.isDemo) {
      Alert.alert('Preview Mode', 'Create a free account to chat with real people.', [
        { text: 'Stay in Preview', style: 'cancel' },
        { text: 'Create Account', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'AuthPortal', params: {} }] }) },
      ]);
      return;
    }
    const existingMatchId = matchIdByUser[person.id];
    if (!existingMatchId) {
      Alert.alert('Like first 💛', `Like ${person.name} to unlock chat. If they like you back, you'll match and can chat.`, [
        { text: 'OK', style: 'cancel' },
        { text: 'Like Now', onPress: handleLike },
      ]);
      return;
    }
    navigation.navigate('ChatDetail', { id: existingMatchId, matchId: existingMatchId, name: person.name, avatar: person.img, img: person.img, intent: person.intent, location: person.location, otherUserId: person.id });
  };

  const handleShareIntent = async () => {
    const message = `Intent — Date with intention 💛\nFind people who actually want something real.\n${INTENT_WEB_URL}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Intent', text: message, url: INTENT_WEB_URL });
        return;
      }
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(INTENT_WEB_URL);
        Alert.alert('Link copied', 'Share it with a friend — they will appear here when they join.');
        return;
      }
      await Share.share({ message });
    } catch (e) {
      // User cancelled share — do nothing
    }
  };

  const handleClearFilters = () => {
    setCityFilter('All');
    setIntentFilter('All Intents');
    setIndex(0);
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
    const isTrulyEmpty = people.length === 0;
    const isFilteredOut = !isTrulyEmpty && filtered.length === 0;
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.c} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}>
        <View style={styles.header}>
          <Text style={styles.logo}>INTENT</Text>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}><Text style={styles.profileBtnText}>👤 Profile</Text></TouchableOpacity>
        </View>
        <Text style={styles.title}>Discovery</Text>
        <Text style={styles.sub}>People near you — max 3 active chats worldwide.{isDemo ? ' Preview Mode' : ''}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>
            {loadError ? 'Could not load people'
              : isTrulyEmpty ? 'No one nearby yet'
              : 'No more people nearby'}
          </Text>
          <Text style={styles.emptySub}>
            {loadError
              ? 'Check your connection and pull to refresh.'
              : isTrulyEmpty
              ? 'Be the first in your area. Share Intent with a friend — they will appear here as soon as they join.'
              : 'You have seen everyone matching your filters. Clear them to see everyone in Ghana again.'}
          </Text>

          {/* Only show Share when DB is truly empty — not when user just filtered everyone out */}
          {!loadError && isTrulyEmpty ? (
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareIntent}>
              <Text style={styles.shareBtnText}>💛 Share Intent</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}><Text style={styles.btnText}>↻ Refresh</Text></TouchableOpacity>

          {isFilteredOut ? (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearFilters}>
              <Text style={styles.clearBtnText}>Clear Filters</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.clearBtn} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.clearBtnText}>Complete Your Profile →</Text>
          </TouchableOpacity>

          {isDemo ? (
            <TouchableOpacity style={styles.clearBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'AuthPortal', params: {} }] })}>
              <Text style={styles.clearBtnText}>Create Free Account →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate('ActiveChats')}><Text style={styles.link}>Chats →</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.link}>Profile →</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SettingsPortal')}><Text style={styles.link}>Settings →</Text></TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const isMatched = matchedIds.has(person.id);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.c} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}>
      <View style={styles.header}>
        <Text style={styles.logo}>INTENT</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}><Text style={styles.profileBtnText}>👤 Profile</Text></TouchableOpacity>
      </View>

      <Text style={styles.title}>Discovery</Text>
      <Text style={styles.sub}>People near you — max 3 active chats worldwide.{isDemo ? ' Preview Mode' : ''}</Text>
      {loadError ? <Text style={styles.errorText}>⚠️ {loadError}</Text> : null}

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
        {person.img ? (
          <Image source={{ uri: person.img }} style={styles.img} />
        ) : (
          <View style={[styles.img, styles.imgPlaceholder]}><Text style={styles.imgLetter}>{person.name?.[0]?.toUpperCase() || '?'}</Text></View>
        )}
        <Text style={styles.name}>{person.name}{person.age ? `, ${person.age}` : ''} ✓</Text>
        {person.intent ? <Text style={styles.intent}>{person.intent}</Text> : null}
        {person.location ? <Text style={styles.meta}>{person.location}</Text> : null}
        {person.bio ? <Text style={styles.bio}>{person.bio}</Text> : null}
        <Text style={styles.counter}>{`${index + 1} of ${filtered.length}`}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.pass]} onPress={handlePass}><Text style={styles.btnText}>✕ Pass</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.like, liking && styles.btnDisabled]} onPress={handleLike} disabled={liking}>
            {liking ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>♥ Like</Text>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.chatBtn, !isMatched && !isDemo && styles.chatBtnLocked]} onPress={handleStartChat}>
          <Text style={styles.chatText}>{isMatched ? '💬 Start Chat →' : '💬 Like to Unlock Chat'}</Text>
        </TouchableOpacity>
        {!isMatched && !isDemo ? <Text style={styles.lockHint}>Chat unlocks only after a mutual Like.</Text> : null}
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
  imgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  imgLetter: { color: '#FBBF24', fontSize: 80, fontWeight: '800' },
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
  chatBtnLocked: { opacity: 0.7 },
  chatText: { color: '#FBBF24', fontWeight: '800' },
  lockHint: { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 6 },
  footer: { flexDirection: 'row', gap: 24, marginTop: 20, flexWrap: 'wrap' },
  link: { color: '#FBBF24', fontWeight: '700' },
  emptyCard: { width: '100%', backgroundColor: '#1E293B', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#334155', alignItems: 'center', marginTop: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  emptySub: { color: '#94A3B8', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  shareBtn: { backgroundColor: '#FBBF24', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, marginTop: 16, width: '100%' },
  shareBtnText: { color: '#0F172A', fontWeight: '800' },
  refreshBtn: { backgroundColor: '#F97316', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, marginTop: 12, width: '100%' },
  clearBtn: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  clearBtnText: { color: '#FBBF24', fontWeight: '700' },
});