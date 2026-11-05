import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';

export default function DatesScreen({ navigation }) {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDates = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDates([]); return; }

      // dates table: proposer_id, invitee_id, match_id, venue, date_time, status
      const { data, error } = await supabase.from('dates')
        .select('*')
        .or(`proposer_id.eq.${user.id},invitee_id.eq.${user.id}`)
        .neq('status', 'cancelled')
        .order('date_time', { ascending: true });

      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') { setDates([]); return; }
        throw error;
      }
      if (!data?.length) { setDates([]); return; }

      const otherIds = [...new Set(data.map((d) => (d.proposer_id === user.id ? d.invitee_id : d.proposer_id)))];
      const { data: profiles } = await supabase.from('profiles')
        .select('id, name, intent, photos, photo_url')
        .in('id', otherIds);
      const byId = {}; (profiles || []).forEach((p) => { byId[p.id] = p; });

      setDates(data.map((d) => {
        const otherId = d.proposer_id === user.id ? d.invitee_id : d.proposer_id;
        const p = byId[otherId] || {};
        const photo = Array.isArray(p.photos) && p.photos[0] ? p.photos[0] : p.photo_url || null;
        return {
          id: d.id, matchId: d.match_id, otherUserId: otherId,
          name: p.name || 'Matched User',
          status: d.status || 'Proposed',
          venue: d.venue || d.location || 'TBD',
          when: d.date_time ? new Date(d.date_time).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD',
          img: photo,
          intent: p.intent || '',
          isMine: d.proposer_id === user.id,
        };
      }));
    } catch (e) {
      console.error('[Dates] load failed:', e);
      setDates([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadDates(); }, [loadDates]);

  const handleMaps = (venue) => {
    const q = encodeURIComponent(venue || 'Accra');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };
  const handleCancel = async (dateId) => {
    Alert.alert('Cancel date?', 'This will cancel the date for both of you.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Date', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('dates').update({ status: 'cancelled' }).eq('id', dateId);
        if (!error) loadDates();
      }},
    ]);
  };
  const handleConfirm = async (dateId) => {
    const { error } = await supabase.from('dates').update({ status: 'confirmed' }).eq('id', dateId);
    if (!error) loadDates();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#F97316" size="large" /><Text style={styles.loadingText}>Loading dates...</Text></View>;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.c} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDates(); }} tintColor="#F97316" />}>
      <View style={styles.header}><Text style={styles.title}>DATES</Text><TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('ActiveChats')}><Text style={styles.topBtnText}>Chats</Text></TouchableOpacity></View>
      <Text style={styles.sub}>Global • 3 max chats only</Text>

      {/* FIX: Only show count banner when there ARE dates. Never "0 Dates Planned" + "No dates yet" together. */}
      {dates.length > 0 && (
        <View style={styles.countBox}><Text style={styles.countTitle}>{dates.length} {dates.length === 1 ? 'Date' : 'Dates'} Planned</Text><Text style={styles.countSub}>Meet IRL • Confirm time with your match</Text></View>
      )}

      {dates.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyEmoji}>🥂</Text><Text style={styles.emptyTitle}>No dates yet</Text><Text style={styles.emptySub}>Go to a chat and propose a date. When they confirm, it appears here.</Text><TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('ActiveChats')}><Text style={styles.emptyBtnText}>Go to Chats →</Text></TouchableOpacity></View>
      ) : dates.map((d) => (
        <View key={d.id} style={styles.card}>
          {d.img ? (
            <Image source={{ uri: d.img }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.avatarLetter}>{d.name ? d.name[0].toUpperCase() : '?'}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{d.name} • {d.status}</Text>
            {d.intent ? <Text style={styles.intent}>{d.intent}</Text> : null}
            <Text style={styles.venue}>{d.venue} • {d.when}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.smallBtn} onPress={() => handleMaps(d.venue)}><Text style={styles.smallBtnText}>Maps</Text></TouchableOpacity>
              <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('ChatDetail', { id: d.matchId, matchId: d.matchId, name: d.name, avatar: d.img, otherUserId: d.otherUserId })}><Text style={styles.smallBtnText}>Chat</Text></TouchableOpacity>
              {d.status?.toLowerCase() === 'proposed' && !d.isMine ? <TouchableOpacity style={[styles.smallBtn, styles.confirmBtn]} onPress={() => handleConfirm(d.id)}><Text style={styles.smallBtnText}>Confirm</Text></TouchableOpacity> : null}
              <TouchableOpacity style={[styles.smallBtn, styles.cancelBtn]} onPress={() => handleCancel(d.id)}><Text style={styles.smallBtnText}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('Discovery')}><Text style={styles.link}>Explore</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('ActiveChats')}><Text style={styles.link}>Chats</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.link}>Profile</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0F172A' }, c: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }, loadingText: { color: '#94A3B8', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: '#FFF', fontWeight: '900', fontSize: 18, letterSpacing: 1 },
  topBtn: { backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }, topBtnText: { color: '#FBBF24', fontWeight: '700', fontSize: 12 },
  sub: { color: '#94A3B8', fontSize: 12, marginTop: 4, marginBottom: 16 },
  countBox: { backgroundColor: '#14532D', borderRadius: 16, padding: 14, marginBottom: 16 }, countTitle: { color: '#fff', fontWeight: '800', fontSize: 15 }, countSub: { color: '#BBF7D0', fontSize: 12, marginTop: 2 },
  card: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 12, gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F172A' },
  avatarPlaceholder: { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#FBBF24', fontSize: 22, fontWeight: '800' },
  name: { color: '#FFF', fontWeight: '800', fontSize: 16 }, intent: { color: '#FBBF24', fontSize: 11, marginTop: 2 }, venue: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  smallBtn: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }, smallBtnText: { color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  confirmBtn: { backgroundColor: '#14532D', borderColor: '#22C55E' }, cancelBtn: { backgroundColor: '#7F1D1D', borderColor: '#EF4444' },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  emptyEmoji: { fontSize: 36 }, emptyTitle: { color: '#FFF', fontWeight: '800', fontSize: 18, marginTop: 10 }, emptySub: { color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  emptyBtn: { backgroundColor: '#F97316', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, marginTop: 16 }, emptyBtnText: { color: '#fff', fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 24, marginTop: 16 }, link: { color: '#FBBF24', fontWeight: '700' },
});