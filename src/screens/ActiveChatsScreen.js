import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';

export default function ActiveChatsScreen({ navigation, route }) {
  const isDemo = route?.params?.isDemo === true;
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = useCallback(async () => {
    try {
      if (isDemo) {
        setChats([
          { id: 'demo-1', matchId: 'demo-1', name: 'Ama', age: 27, location: 'Accra, Ghana', intent: 'Long-term Relationship 💛', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80', lastMessage: 'I love ceramic art! Are you free Thursday?', lastAt: '2m ago', unread: 1, isDemo: true },
          { id: 'demo-2', matchId: 'demo-2', name: 'Kwame', age: 29, location: 'Accra, Ghana', intent: 'Friendship First 🤝', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', lastMessage: 'Hey! Did you see my prompt about jazz bars.', lastAt: '1h ago', unread: 0, isDemo: true },
        ]);
        setLoading(false); setRefreshing(false); return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChats([]); setLoading(false); setRefreshing(false); return; }

      // 1. My matches
      const { data: matches, error } = await supabase.from('matches').select('*').or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order('created_at', { ascending: false });
      if (error) throw error;
      if (!matches?.length) { setChats([]); setLoading(false); setRefreshing(false); return; }

      // 2. Other user profiles
      const otherIds = matches.map((m) => (m.user_a === user.id ? m.user_b : m.user_a));
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', otherIds);
      const byId = {};
      (profiles || []).forEach((p) => { byId[p.id] = p; });

      // 3. Last message per match
      const matchIds = matches.map((m) => m.id);
      const { data: msgs } = await supabase.from('messages').select('*').in('match_id', matchIds).order('created_at', { ascending: false }).limit(200);
      const lastByMatch = {};
      (msgs || []).forEach((msg) => { if (!lastByMatch[msg.match_id]) lastByMatch[msg.match_id] = msg; });

      // 4. Unread count (messages from other user, not read)
      const unreadByMatch = {};
      (msgs || []).forEach((msg) => { if (msg.sender_id !== user.id && !msg.is_read) unreadByMatch[msg.match_id] = (unreadByMatch[msg.match_id] || 0) + 1; });

      const list = matches.map((m) => {
        const otherId = m.user_a === user.id ? m.user_b : m.user_a;
        const p = byId[otherId] || {};
        const last = lastByMatch[m.id];
        return {
          id: m.id, matchId: m.id, otherUserId: otherId,
          name: p.full_name || 'Intent User', age: p.age || '',
          location: [p.city, p.country].filter(Boolean).join(', ') || 'Accra, Ghana',
          intent: p.intent || 'Long-term Relationship 💍',
          img: p.avatar_url || p.photos?.[0] || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
          lastMessage: last?.content || 'Say hi 👋 — you matched!',
          lastAt: last ? new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          unread: unreadByMatch[m.id] || 0, isDemo: false,
        };
      });
      // Sort by last message time, matches with no messages last
      list.sort((a, b) => (b.lastMessage === 'Say hi 👋 — you matched!' ? -1 : 0));
      setChats(list);
    } catch (e) {
      console.error('[Chats] load failed:', e);
      setChats([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, [isDemo]);

  useEffect(() => { loadChats(); }, [loadChats]);

  const onRefresh = () => { setRefreshing(true); loadChats(); };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#F97316" size="large" /><Text style={styles.loadingText}>Loading chats...</Text></View>;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.c} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}>
      <View style={styles.header}>
        <Text style={styles.title}>ACTIVE CHATS</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('Dates')}><Text style={styles.topBtnText}>Dates</Text></TouchableOpacity>
          <TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('Discovery')}><Text style={styles.topBtnText}>Deck</Text></TouchableOpacity>
        </View>
      </View>
      <Text style={styles.sub}>Global • 3 max chats only</Text>

      <View style={styles.capacityBox}>
        <View><Text style={styles.capacityLabel}>Active Slots Capacity</Text><Text style={styles.capacitySub}>Graduate a date to a chat & unlock next global match.</Text></View>
        <View style={styles.capacityBadge}><Text style={styles.capacityBadgeText}>{chats.length}/3</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Active Conversations (Max 3 — Global Rule)</Text>

      {chats.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySub}>Like someone in Discovery and if they like you back, your chat appears here.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Discovery')}><Text style={styles.emptyBtnText}>Go to Discovery →</Text></TouchableOpacity>
        </View>
      ) : chats.map((c) => (
        <TouchableOpacity key={c.id} style={styles.card} onPress={() => navigation.navigate('ChatDetail', { id: c.matchId, matchId: c.matchId, name: c.name, avatar: c.img, img: c.img, intent: c.intent, location: c.location, otherUserId: c.otherUserId })}>
          <Image source={{ uri: c.img }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <View style={styles.rowBetween}><Text style={styles.name}>{c.name}</Text><Text style={styles.time}>{c.lastAt}</Text></View>
            <Text style={styles.intent}>{c.intent} • {c.location}</Text>
            <Text style={styles.lastMsg} numberOfLines={1}>{c.lastMessage}</Text>
            <TouchableOpacity style={styles.graduateBtn} onPress={() => navigation.navigate('Dates')}><Text style={styles.graduateText}>Graduate to Date</Text></TouchableOpacity>
          </View>
          {c.unread > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{c.unread}</Text></View> : null}
        </TouchableOpacity>
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
  card: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 12, gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F172A' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  time: { color: '#64748B', fontSize: 11 },
  intent: { color: '#FBBF24', fontSize: 11, marginTop: 2 },
  lastMsg: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  graduateBtn: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8, alignSelf: 'flex-start' },
  graduateText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  unreadBadge: { backgroundColor: '#F97316', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  emptyEmoji: { fontSize: 36 }, emptyTitle: { color: '#FFF', fontWeight: '800', fontSize: 18, marginTop: 10 },
  emptySub: { color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  emptyBtn: { backgroundColor: '#F97316', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  emptyBtnText: { color: '#fff', fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 24, marginTop: 16 },
  link: { color: '#FBBF24', fontWeight: '700' },
});