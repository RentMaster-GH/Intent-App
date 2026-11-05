import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';

// Production: Demo preview data is ONLY for isDemo=true. Never used for logged-in users.
// No MOCK_PROFILES import. No fallback to mocks on error / empty table.
const DEMO_PREVIEW = [
  { id: 'demo-1', name: 'Ama', age: 27, location: 'Accra, Ghana', city: 'Accra', country: 'Ghana', intent: 'Long-term Relationship 💛', bio: 'Intentional. Coffee lover. Looking for something real.', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80', isDemo: true },
  { id: 'demo-2', name: 'Kwame', age: 29, location: 'Accra, Ghana', city: 'Accra', country: 'Ghana', intent: 'Friendship First 🤝', bio: 'Gym, Afrobeats, and good conversation.', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', isDemo: true },
  { id: 'demo-3', name: 'Efua', age: 26, location: 'Kumasi, Ghana', city: 'Kumasi', country: 'Ghana', intent: 'Marriage Minded 💍', bio: 'Faith, family, and building something lasting.', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', isDemo: true },
];

const CITY_FILTERS = ['All', 'Accra', 'Kumasi', 'Lagos', 'Tema'];
const INTENT_FILTERS = ['All Intents', 'Long-term Relationship 💛', 'Marriage Minded 💍', 'Friendship First 🤝'];

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80';

// Production: No invented defaults. If a profile has no age / city / bio, we show it as-is or hide the field.
// Never default to 25 / Accra.
const normalizeProfile = (p) => ({
  id: p.id,
  name: p.full_name || null,
  age: p.age ?? null,
  city: p.city || null,
  country: p.country || null,
  location: [p.city, p.country].filter(Boolean).join(', ') || null,
  intent: p.intent || null,
  bio: p.bio || '',
  img: p.avatar_url || (Array.isArray(p.photos) && p.photos[0]) || null,
  photos: Array.isArray(p.photos) ? p.photos : p.avatar_url ? [p.avatar_url] : [],
  gender: p.gender || null,
  seeking: p.seeking || null,
  isDemo: false,
});

export default function DiscoveryScreen({ navigation, route }) {
  const isDemo = route?.params?.isDemo === true;
  const [people, setPeople] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [likedIds, setLikedIds] = useState(new Set());
  const [passedIds, setPassedIds] = useState(new Set());
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
        // Production: No session -> no fake people. App.js should bounce to Auth, but don't invent data.
        setPeople([]);
        setMyId(null);
        setLoading(false); setRefreshing(false);
        return;
      }
      setMyId(user.id);

      // My profile — needed for gender/seeking filter. If no profile, App.js should have sent to Onboarding.
      const { data: me } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (me) setMyProfile(normalizeProfile(me));

      // My likes (to exclude) + my matches (to exclude from deck — already matched)
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

      // Real profiles only. No mock fallback.
      const { data, error } = await supabase.from('profiles').select('*').neq('id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;

      // Production filter: exclude liked + matched. Do NOT invent age/city.
      // Only show profiles with at least a name + photo + intent — otherwise card is empty.
      const real = (data || [])
        .map(normalizeProfile)
        .filter((p) => p.id && p.name && p.img)
        .filter((p) => !alreadyLiked.has(p.id) && !matched.has(p.id))
        // Optional: respect seeking if both set — e.g. Woman seeking Man should not see Women
        .filter((p) => {
          if (!me?.seeking || !p.gender) return true;
          if (me.seeking === 'Everyone') return true;
          return p.gender === me.seeking;
        });

      if (!mountedRef.current) return;
      setPeople(real);
      setIndex(0);
    } catch (e) {
      if (!mountedRef.current) return;
      // Production: On error, show empty + error, NEVER fake people
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
    setPassedIds((prev) => new Set(prev).add(person.id));
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
      // 23505 = duplicate like — treat as success, don't crash
      if (likeError && likeError.code !== '23505') throw likeError;
      setLikedIds((prev) => new Set(prev).add(person.id));

      const { data: mutual } = await supabase.from('likes').select('id').eq('liker_id', person.id).eq('liked_id', myId).maybeSingle();
      if (mutual) {
        // Mutual only — create match
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

  // Production: Start Chat ONLY if already matched. No unilateral match creation.
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
        <Text style={styles.sub}>People near you — max 3 active chats worldwide.{isDemo ? ' Preview Mode' : ''}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>{loadError ? 'Could not load people' : people.length === 0 ? 'No one nearby yet' : 'No more people nearby'}</Text>
          <Text style={styles.emptySub}>
            {loadError || (people.length === 0
              ? 'Be the first in your area. Share Intent with friends — new profiles appear here as they join.'
              : 'You have seen everyone matching your filters. Try clearing filters or pull to refresh.')}
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}><Text style={styles.btnText}>↻ Refresh</Text></TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setCityFilter('All'); setIntentFilter('All Intents'); setIndex(0); }}>
            <Text style={styles.clearBtnText}>Clear Filters</Text>
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
        <Image source={{ uri: person.img || PLACEHOLDER_IMG }} style={styles.img} />
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
  refreshBtn: { backgroundColor: '#F97316', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, marginTop: 16 },
  clearBtn: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  clearBtnText: { color: '#FBBF24', fontWeight: '700' },
});