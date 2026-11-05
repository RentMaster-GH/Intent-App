import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Image, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavBar from '../components/BottomNavBar';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80';

const MOCK_DATES = [
  { id: 'd1', personId: '1', name: 'Ama', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80', venue: 'Devoción Coffee, Williamsburg', time: 'Sat 2:00 PM', status: 'Confirmed', intent: 'Long-term Relationship 💛' },
  { id: 'd2', personId: '2', name: 'Kwame', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80', venue: 'Apex Cocktail Bistro', time: 'Sun 6:30 PM', status: 'Proposed', intent: 'Friendship First 🤝' },
];

export default function DatesScreen({ navigation, route }) {
  const [dates, setDates] = useState(MOCK_DATES || []);

  // ✅ FIX: If we came from ActiveChats → Graduate, add that person as a new Proposed date once
  useEffect(() => {
    const gId = route?.params?.graduateId;
    const gName = route?.params?.graduateName;
    if (!gId || !gName) return;
    setDates(prev => {
      if ((prev || []).some(d => d.personId === String(gId))) return prev;
      return [...(prev || []), {
        id: `d-${Date.now()}`, personId: String(gId), name: gName,
        avatar: route.params.graduateAvatar || FALLBACK_PHOTO,
        venue: 'To be chosen — pick in Chat', time: 'To be scheduled',
        status: 'Proposed', intent: route.params.graduateIntent || '',
      }];
    });
  }, [route?.params?.graduateId]);

  const safeDates = dates || [];
  const firstDate = safeDates?.[0] || null;

  const openMaps = (addr) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || '')}`;
    Linking.openURL(url).catch(()=>{});
  };

  const handleChat = (d) => navigation.navigate('ChatDetail', {
    id: d?.personId, name: d?.name, avatar: d?.avatar, img: d?.avatar, intent: d?.intent,
  });

  const handleConfirm = (id) => setDates(prev => (prev || []).map(d => d.id === id ? { ...d, status: 'Confirmed' } : d));
  const handleCancel = (id) => {
    const target = (dates || []).find(d => d.id === id);
    Alert.alert('Cancel date?', `Cancel your date with ${target?.name || 'them'}?`, [
      { text: 'Keep Date', style: 'cancel' },
      { text: 'Cancel Date', style: 'destructive', onPress: () => setDates(prev => (prev || []).filter(d => d.id !== id)) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>DATES</Text><Text style={styles.headerSub}>🌍 Global • Real dates only</Text></View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>{safeDates.length > 0 ? `🔥 ${safeDates.length} Date${safeDates.length>1?'s':''} Planned` : '📅 No Dates Yet'}</Text>
          <Text style={styles.bannerSub}>{firstDate ? `Next: ${firstDate.name} • ${firstDate.time}` : 'Graduate a chat to schedule a real date'}</Text>
        </View>

        {safeDates.map((d) => (
          <View key={d?.id} style={styles.card}>
            <Image source={{ uri: d?.avatar || d?.photos?.[0] || FALLBACK_PHOTO }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{d?.name || 'Intent User'} • {d?.status || ''}</Text>
              <Text style={styles.intent}>{d?.intent || ''}</Text>
              <Text style={styles.venue}>📍 {d?.venue || ''} • {d?.time || ''}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.mapsBtn} onPress={()=>openMaps(d?.venue)}><Text style={styles.mapsText}>Maps</Text></TouchableOpacity>
                <TouchableOpacity style={styles.uberBtn} onPress={()=>Linking.openURL('https://m.uber.com/').catch(()=>{})}><Text style={styles.uberText}>Uber</Text></TouchableOpacity>
                <TouchableOpacity style={styles.chatBtn} onPress={()=>handleChat(d)}><Text style={styles.chatText}>Chat</Text></TouchableOpacity>
              </View>
              <View style={styles.row}>
                {d?.status !== 'Confirmed' && <TouchableOpacity style={styles.confirmBtn} onPress={()=>handleConfirm(d?.id)}><Text style={styles.confirmText}>Confirm</Text></TouchableOpacity>}
                <TouchableOpacity style={styles.cancelBtn} onPress={()=>handleCancel(d?.id)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {safeDates.length === 0 && (
          <View style={styles.empty}><Ionicons name="calendar-outline" size={48} color="#64748B" /><Text style={styles.emptyTitle}>No dates yet</Text><Text style={styles.emptySub}>Go to Active Chats → Graduate to Date</Text>
            <TouchableOpacity style={styles.goBtn} onPress={()=>navigation.navigate('ActiveChats')}><Text style={styles.goText}>Go to Chats</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <BottomNavBar navigation={navigation} currentRoute="Dates" />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', letterSpacing: 2 },
  headerSub: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  content: { padding: 20, paddingBottom: 110 },
  banner: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: '#10B981', borderRadius: 18, padding: 16, marginBottom: 16 },
  bannerTitle: { color: '#F8FAFC', fontWeight: '800', fontSize: 15 },
  bannerSub: { color: '#6EE7B7', fontSize: 12, marginTop: 4 },
  card: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 12, gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  name: { color: '#F8FAFC', fontWeight: '800', fontSize: 15 },
  intent: { color: '#FBBF24', fontSize: 11, marginTop: 2 },
  venue: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  mapsBtn: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  mapsText: { color: '#FBBF24', fontWeight: '700', fontSize: 12 },
  uberBtn: { backgroundColor: '#000', borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  uberText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  chatBtn: { backgroundColor: '#F97316', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  chatText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  confirmBtn: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  confirmText: { color: '#10B981', fontWeight: '700', fontSize: 12 },
  cancelBtn: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  cancelText: { color: '#FCA5A5', fontWeight: '700', fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { color: '#F8FAFC', fontWeight: '700', fontSize: 16, marginTop: 12 },
  emptySub: { color: '#64748B', fontSize: 12, marginTop: 4 },
  goBtn: { backgroundColor: '#F97316', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  goText: { color: '#FFF', fontWeight: '800' },
});