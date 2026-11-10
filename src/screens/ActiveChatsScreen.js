import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { supabase } from '../lib/supabase';

export default function ActiveChatsScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadChats = useCallback(async () => {
    setLoadError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChats([]); return; }

      // 1. My matches, source of truth, no status filter, no message join
      const { data: matches, error: matchError } = await supabase.from('matches')
        .select('id, user_a, user_b, created_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (matchError) throw matchError;
      if (!matches?.length) { setChats([]); return; }

      // 2. Other user profiles, ONLY real columns. No photo_url, no avatar_url.
      // Real columns: id, name, age, location, intent, photos
      const otherIds = [...new Set(matches.map((m) => (m.user_a === user.id ? m.user_b : m.user_a)))];
      const { data: profiles, error: profileError } = await supabase.from('profiles')
        .select('id, name, age, location, intent, photos')
        .in('id', otherIds);
      if (profileError) throw profileError;

      const byId = {};
      (profiles || []).forEach((p) => { byId[p.id] = p; });

      // 3. Last message per match, optional, never filters out matches
      // FIX: messages table uses body, NOT content
      const matchIds = matches.map((m) => m.id);
      const { data: msgs, error: msgsError } = await supabase.from('messages')
        .select('match_id, sender_id, body, created_at')
        .in('match_id', matchIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (msgsError) console.log('[Chats] last message load skipped:', msgsError.message);

      const lastByMatch = {};
      (msgs || []).forEach((msg) => { if (!lastByMatch[msg.match_id]) lastByMatch[msg.match_id] = msg; });

      const list = matches.map((m) => {
        const otherId = m.user_a === user.id ? m.user_b : m.user_a;
        // Do NOT filter out matches if profile is missing.
        // Show fallback name + letter avatar instead of hiding the chat.
        const p = byId[otherId] || {};
        const last = lastByMatch[m.id];
        const photo = Array.isArray(p.photos) && p.photos[0] ? p.photos[0] : null;
        return {
          id: m.id,
          matchId: m.id,
          otherUserId: otherId,
          name: p.name || 'Matched User',
          age: p.age || '',
          location: p.location || '',
          intent: p.intent || '',
          img: photo,
          lastMessage: last?.body || 'Say hi, you matched!',
          lastAt: last ? new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          lastAtMs: last ? new Date(last.created_at).getTime() : new Date(m.created_at).getTime(),
          unread: 0,
        };
      });
      list.sort((a, b) => b.lastAtMs - a.lastAtMs);
      setChats(list);
    } catch (e) {
      console.error('[Chats] load failed:', e);
      setLoadError(e.message || 'Could not load chats');
      setChats([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  const onRefresh = () => { setRefreshing(true); loadChats(); };

  const openChat = (c) => {
    navigation.navigate('ChatDetail', {
      id: c.matchId,
      matchId: c.matchId,
      name: c.name,
      avatar: c.img,
      img: c.img,
      intent: c.intent,
      location: c.location,
      otherUserId: c.otherUserId,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F97316" size="large" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.c} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}>
      <View style={styles.header}>
        <Text style={styles.title}>ACTIVE CHATS</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('Dates')}><Text style={styles.topBtnText}>Dates</Text></TouchableOpacity>
          <TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('Discovery')}><Text style={styles.topBtnText}>Deck</Text></TouchableOpacity>
        </View>
      </View>
      <Text style={styles.sub}>Global, 3 max chats only</Text>

      <View style={styles.capacityBox}>
        <View><Text style={styles.capacityLabel}>Active Slots Capacity</Text><Text style={styles.capacitySub}>Graduate a date to a chat and unlock next global match.</Text></View>
        <View style={styles.capacityBadge}><Text style={styles.capacityBadgeText}>{chats.length}/3</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Active Conversations (Max 3, Global Rule)</Text>
      {loadError ? <Text style={{ color: '#FCA5A5', fontSize: 12, marginBottom: 12 }}>{loadError}</Text> : null}

      {chats.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySub}>Like someone in Discovery and if they like you back, your chat appears here.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Discovery')}><Text style={styles.emptyBtnText}>Go to Discovery</Text></TouchableOpacity>
        </View>
      ) : chats.map((c) => (
        <View key={c.id} style={styles.card}>
          <TouchableOpacity onPress={() => openChat(c)} style={styles.cardMain}>
            {c.img ? (
              <Image source={{ uri: c.img }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.avatarLetter}>{c.name ? c.name[0].toUpperCase() : '?'}</Text></View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.rowBetween}><Text style={styles.name}>{c.name}{c.age ? `, ${c.age}` : ''}</Text><Text style={styles.time}>{c.lastAt}</Text></View>
              <Text style={styles.intent}>{[c.intent, c.location].filter(Boolean).join(' • ')}</Text>
              <Text style={styles.lastMsg} numberOfLines={1}>{c.lastMessage}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.openChatBtn} onPress={() => openChat(c)}>
              <Text style={styles.openChatText}>Open Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.graduateBtn} onPress={() => navigation.navigate('Dates')}>
              <Text style={styles.graduateText}>Graduate to Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('Discovery')}><Text style={styles.link}>Explore</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Dates')}><Text style={styles.link}>Dates</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.link}>Profile</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0F172A' },
  c: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#FFF', fontWeight: '900', fontSize: 18, letterSpacing: 1 },
  topBtn: { backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  topBtnText: { color: '#FBBF24', fontWeight: '700', fontSize: 12 },
  sub: { color: '#94A3B8', fontSize: 12, marginTop: 4, marginBottom: 16 },
  capacityBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 16 },
  capacityLabel: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  capacitySub: { color: '#94A3B8', fontSize: 11, marginTop: 2, maxWidth: 220 },
  capacityBadge: { backgroundColor: '#F97316', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  capacityBadgeText: { color: '#fff', fontWeight: '900' },
  sectionTitle: { color: '#FFF', fontWeight: '800', fontSize: 14, marginBottom: 12 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  cardMain: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F172A' },
  avatarPlaceholder: { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#FBBF24', fontSize: 22, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  time: { color: '#64748B', fontSize: 11 },
  intent: { color: '#FBBF24', fontSize: 11, marginTop: 2 },
  lastMsg: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10, marginLeft: 68 },
  openChatBtn: { backgroundColor: '#F97316', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  openChatText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  graduateBtn: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  graduateText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 24, marginTop: 16 },
  link: { color: '#FBBF24', fontWeight: '700' },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { color: '#FFF', fontWeight: '800', fontSize: 18, marginTop: 10 },
  emptySub: { color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  emptyBtn: { backgroundColor: '#F97316', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  emptyBtnText: { color: '#fff', fontWeight: '800' },
});