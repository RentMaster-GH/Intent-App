import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, ScrollView, Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavBar from '../components/BottomNavBar';

// ✅ SINGLE SOURCE OF TRUTH — matches Discovery + ChatDetail PEOPLE_BY_ID
const ACTIVE_CHATS = [
  {
    id: '1', name: 'Ama',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80',
    lastMessage: 'I love ceramic art! Are you free Thursday?', hoursLeft: 34.2,
    intent: 'Long-term Relationship 💛', unread: true, location: 'Accra, Ghana • 3mi away',
  },
  {
    id: '2', name: 'Kwame',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
    lastMessage: 'Hey! Just saw your prompt about jazz bars.', hoursLeft: 18.1,
    intent: 'Friendship First 🤝', unread: false, location: 'Accra, Ghana • 1.5mi away',
  },
];

const QUEUED_MATCHES = [
  { id: '3', name: 'Efua', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80', status: 'Next in Queue (#1)', intent: 'Marriage Minded 💍' },
];

const FALLBACK_QUEUE_NAME = (QUEUED_MATCHES?.[0]?.name) || 'next match';

export default function ActiveChatsScreen({ navigation }) {
  const [activeChats, setActiveChats] = useState(ACTIVE_CHATS || []);
  const activeCount = (activeChats || []).length;
  const isFull = activeCount >= 3;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const formatTimeLeft = (hours) => {
    const h = Math.floor(hours || 0);
    const m = Math.floor(((hours || 0) - h) * 60);
    if (h <= 0) return 'Expiring!';
    return `${h}h ${m.toString().padStart(2,'0')}m`;
  };

  const getTimerColor = (hours) => {
    if ((hours || 0) < 6) return { bg: 'rgba(239,68,68,0.15)', border: '#EF4444', text: '#FCA5A5', bar: '#EF4444' };
    if ((hours || 0) < 24) return { bg: 'rgba(249,115,22,0.15)', border: '#F97316', text: '#FDBA74', bar: '#F97316' };
    return { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#6EE7B7', bar: '#10B981' };
  };

  // ✅ FIX: Pass flat id + name + avatar + intent — App.js can build /chat/1 and ChatDetail survives refresh
  const handleChatPress = (chat) => navigation.navigate('ChatDetail', {
    id: chat?.id, name: chat?.name, avatar: chat?.avatar, img: chat?.avatar,
    intent: chat?.intent, location: chat?.location, chat,
  });

  const handleQueuePress = () => {
    Alert.alert(
      '🌍 Slot Full — Global Rule',
      `Intent allows max 3 active chats worldwide to keep connections intentional. Graduate a chat to a real date to unlock ${FALLBACK_QUEUE_NAME}.\n\nThis is our core anti-ghosting rule.`,
      [{ text: 'View Dates', onPress: () => navigation.navigate('Dates') }, { text: 'OK', style: 'cancel' }]
    );
  };

  const handleGraduateChat = (chat) => {
    Alert.alert('Graduate to Date? 📅', `Schedule a real date with ${chat?.name || 'them'} to free this slot for next match in queue.`,[
      { text: 'Cancel', style: 'cancel' },
      { text: 'Schedule Date', onPress: () => {
        setActiveChats(prev => (prev || []).filter(c => c.id !== chat?.id));
        navigation.navigate('Dates', { graduateId: chat?.id, graduateName: chat?.name, graduateAvatar: chat?.avatar, graduateIntent: chat?.intent });
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.headerTitle}>ACTIVE CHATS</Text><Text style={styles.headerSub}>🌍 Global • 3 max • Real dates only</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.navHeaderButton} onPress={() => navigation.navigate('Dates')}><Text style={styles.navHeaderButtonText}>📅 Dates</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.navHeaderButton, { marginLeft: 8 }]} onPress={() => navigation.navigate('Discovery')}><Text style={styles.navHeaderButtonText}>🎴 Deck</Text></TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.slotBanner, isFull && styles.slotBannerFull]}>
          <View style={styles.slotBannerTextGroup}>
            <Text style={styles.slotBannerTitle}>{isFull ? '🔒 Slots Full — Graduate a Chat' : 'Active Slots Capacity'}</Text>
            <Text style={styles.slotBannerSubtitle}>{isFull ? 'You have 3/3 active worldwide. Schedule a date to unlock queue.' : 'Schedule a date to graduate a chat & unlock next global match!'}</Text>
          </View>
          <View style={[styles.slotCountBadge, isFull && { backgroundColor: '#EF4444' }]}><Text style={styles.slotCountText}>{activeCount}/3</Text></View>
        </View>
        <Text style={styles.sectionHeader}>Active Conversations (Max 3 — Global Rule)</Text>
        {(activeChats || []).map((chat) => {
          const timer = getTimerColor(chat?.hoursLeft);
          const progress = Math.max(5, Math.min(100, ((chat?.hoursLeft || 0) / 48) * 100));
          return (
            // ✅ FIX: Pressable card + inner Pressable with stopPropagation — Graduate no longer also opens Chat
            <Pressable key={chat?.id} style={styles.chatCard} onPress={() => handleChatPress(chat)}>
              <View style={styles.avatarWrapper}><Image source={{ uri: chat?.avatar || '' }} style={styles.avatar} />{chat?.unread && <View style={styles.unreadDot} />}</View>
              <View style={styles.chatInfo}>
                <View style={styles.chatHeaderRow}><Text style={styles.chatName}>{chat?.name || 'User'}</Text><View style={[styles.timerBadge, { backgroundColor: timer.bg, borderColor: timer.border }]}><Text style={[styles.timerText, { color: timer.text }]}>⏳ {formatTimeLeft(chat?.hoursLeft)}</Text></View></View>
                <Text style={styles.intentTag}>{chat?.intent || ''} • {chat?.location || ''}</Text><Text style={styles.lastMessage} numberOfLines={1}>{chat?.lastMessage || ''}</Text>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: timer.bar }]} /></View>
                <Pressable style={styles.graduateBtn} onPress={(e) => { e?.stopPropagation?.(); handleGraduateChat(chat); }}><Text style={styles.graduateText}>Graduate to Date 📅</Text></Pressable>
              </View>
            </Pressable>
          );
        })}
        {activeCount < 3 && <TouchableOpacity style={styles.emptySlotCard} onPress={() => navigation.navigate('Discovery')}><Text style={styles.emptySlotIcon}>+</Text><Text style={styles.emptySlotTitle}>Slot Available — {3-activeCount} left</Text><Text style={styles.emptySlotSub}>Match on Discovery worldwide to fill this slot</Text></TouchableOpacity>}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>Intent Queue ({(QUEUED_MATCHES || []).length}) — Global</Text><Text style={styles.queueSubtext}>Matches automatically unlock into your 3 slots as chats graduate to real dates.</Text>
        <View style={styles.queueContainer}>{(QUEUED_MATCHES || []).map((item) => (<TouchableOpacity key={item?.id} style={styles.queueCard} onPress={handleQueuePress} activeOpacity={0.7}><Image source={{ uri: item?.avatar || '' }} style={styles.queueAvatar} /><Text style={styles.queueName}>{item?.name || ''}</Text><Text style={styles.queueIntent}>{item?.intent || ''}</Text><Text style={styles.queueStatus}>🔒 {item?.status || ''}</Text><View style={styles.lockBadge}><Ionicons name="lock-closed" size={10} color="#94A3B8" /><Text style={styles.lockText}>Locked until slot free</Text></View></TouchableOpacity>))}</View>
        <View style={styles.globalInfoBox}><Ionicons name="globe-outline" size={16} color="#FBBF24" /><Text style={styles.globalInfoText}>Intent works in 200+ countries. 3-chat limit applies globally.</Text></View>
      </ScrollView>
      <BottomNavBar navigation={navigation} currentRoute="ActiveChats" />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', letterSpacing: 2 },
  headerSub: { fontSize: 10, color: '#64748B', fontWeight: '600', marginTop: 2 },
  navHeaderButton: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  navHeaderButtonText: { fontSize: 13, color: '#FBBF24', fontWeight: '700' },
  content: { padding: 20, paddingBottom: 110 },
  slotBanner: { backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, borderWidth: 1, borderColor: '#F97316' },
  slotBannerFull: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: '#EF4444' },
  slotBannerTextGroup: { flex: 1, marginRight: 10 },
  slotBannerTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  slotBannerSubtitle: { color: '#FBBF24', fontSize: 12, marginTop: 3, lineHeight: 16 },
  slotCountBadge: { backgroundColor: '#F97316', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  slotCountText: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: '#CBD5E1', marginBottom: 12 },
  chatCard: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 18, padding: 14, marginBottom: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: '#334155' },
  avatarWrapper: { position: 'relative', marginRight: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  unreadDot: { position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#F97316', borderWidth: 2, borderColor: '#1E293B' },
  chatInfo: { flex: 1 },
  chatHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontSize: 17, fontWeight: '800', color: '#F8FAFC' },
  timerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  timerText: { fontSize: 11, fontWeight: '700' },
  intentTag: { color: '#F97316', fontSize: 11, fontWeight: '600', marginTop: 2 },
  lastMessage: { color: '#94A3B8', fontSize: 13, marginTop: 5 },
  progressTrack: { height: 4, backgroundColor: '#0F172A', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  graduateBtn: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8 },
  graduateText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  emptySlotCard: { backgroundColor: '#0F172A', borderRadius: 18, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', padding: 18, alignItems: 'center', justifyContent: 'center' },
  emptySlotIcon: { fontSize: 22, color: '#FBBF24', fontWeight: '800' },
  emptySlotTitle: { color: '#CBD5E1', fontSize: 14, fontWeight: '700', marginTop: 2 },
  emptySlotSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  queueSubtext: { color: '#64748B', fontSize: 12, marginBottom: 12, lineHeight: 16 },
  queueContainer: { flexDirection: 'row' },
  queueCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 16, padding: 12, marginRight: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155', opacity: 0.85 },
  queueAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 8 },
  queueName: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
  queueIntent: { color: '#FBBF24', fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  queueStatus: { color: '#94A3B8', fontSize: 10, marginTop: 4 },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0F172A', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  lockText: { color: '#64748B', fontSize: 8, fontWeight: '600' },
  globalInfoBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', padding: 12, borderRadius: 12, marginTop: 20 },
  globalInfoText: { color: '#CBD5E1', fontSize: 11, lineHeight: 16, flex: 1 },
});