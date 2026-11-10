import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, TextInput, Modal, ScrollView, Linking, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useP2PCall } from '../hooks/useP2PCall';
import CallOverlay from '../components/CallOverlay';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80';
const getMessageText = (mm) => mm?.body ?? '';
const isUuidLike = (v) => typeof v === 'string' && v.length > 20 && v.includes('-');
const isCallLogText = (text = '') => /Call Ended|Missed.*call|Video Call|Voice Call/i.test(String(text));
const parseCallSeconds = (text = '') => {
  const m = String(text).match(/\((\d+):(\d+)\)/) || String(text).match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};
const isZeroSecondCall = (text = '') => {
  const s = parseCallSeconds(text);
  return s !== null && s <= 0;
};
const formatCallLog = (text = '') => {
  const s = parseCallSeconds(text);
  const label = /Video/i.test(text) ? '📹 Video call' : /Voice/i.test(text) ? '📞 Voice call' : '📞 Call';
  if (/Missed/i.test(text)) return '📞 Missed call';
  if (s === null) return text;
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${label} • ${mm}:${ss}`;
};

const ICEBREAKER_CARDS = ['☕ Suggest a 20-min coffee meetup', '🎨 Ask about their favorite weekend spot', '🎲 Play 2 Truths & 1 Lie', '🎵 What song is on repeat for you right now?'];
const RECOMMENDED_DATE_SPOTS = [
  { id: 'v1', name: 'Devoción Coffee & Vinyl Lounge', vibe: 'Cozy & Casual', category: 'coffee', rating: '4.9', address: '69 Grand St, Williamsburg', perk: '🎁 15% off with Intent' },
  { id: 'v2', name: 'Apex Cocktail Bistro & Lounge', vibe: 'Romantic & Fine Dining', category: 'dining', rating: '4.8', address: '142 Market St, Downtown', perk: '🎁 Free Appetizer on First Date' },
  { id: 'v3', name: 'Chelsea Contemporary Art Walk', vibe: 'Cultural & Quiet', category: 'art', rating: '4.9', address: '522 W 26th St, Chelsea', perk: '🎁 Complimentary Gallery Pass' },
  { id: 'v4', name: 'Conservatory Scenic Garden Walk', vibe: 'Outdoor & Scenic', category: 'parks', rating: '4.9', address: 'Central Park East & 105th St', perk: '🎁 Free Entry' },
];
const FALLBACK_VENUE = RECOMMENDED_DATE_SPOTS[0];
const PEOPLE_BY_ID = {
  '1': { name: 'Ama', avatar: FALLBACK_PHOTO, intent: 'Long-term Relationship 💛', location: 'Accra, Ghana' },
  '2': { name: 'Kwame', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', intent: 'Friendship First 🤝', location: 'Accra, Ghana' },
  '3': { name: 'Efua', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', intent: 'Marriage Minded 💍', location: 'Kumasi, Ghana' },
};
const getWebParams = () => {
  if (Platform.OS !== 'web') return {};
  try {
    const out = {};
    const sp = new URLSearchParams(window.location.search || '');
    sp.forEach((v, k) => { out[k] = v; });
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'chat' && parts[1]) out.id = parts[1];
    return out;
  } catch { return {}; }
};
const mapSpotRow = (row) => ({
  id: String(row.id), name: row.name, address: row.address || 'Custom spot', perk: row.perk || '✨ My pick', vibe: 'Your Pick', category: row.category || 'coffee', rating: '—', isCustom: true,
});

export default function ChatDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const allParams = { ...(route?.params || {}), ...getWebParams() };
  const paramChat = allParams?.chat;
  const rawId = String(allParams?.id || allParams?.rawChatId || allParams?.matchId || allParams?.match_id || '');
  const paramMatchId = allParams?.matchId || allParams?.match_id || null;
  const paramOtherId = allParams?.otherUserId || allParams?.userId || allParams?.other_id || allParams?.otherId || null;
  const paramId = rawId;
  const initialChat = paramChat || (allParams?.name ? { name: allParams.name, avatar: allParams.avatar || FALLBACK_PHOTO, intent: allParams.intent || 'Long-term Relationship', location: allParams.location || '' } : PEOPLE_BY_ID[paramId] || { name: 'Elena Rostova', avatar: FALLBACK_PHOTO, intent: 'Long-term Relationship' });

  const [userId, setUserId] = useState(null);
  const [otherUserId, setOtherUserId] = useState(paramOtherId);
  const [matchId, setMatchId] = useState(paramMatchId);
  const [chat, setChat] = useState({ ...initialChat, avatar: initialChat?.avatar || FALLBACK_PHOTO });
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showDateModal, setShowShowDateModal] = useState(false);
  const [selectedVibeCategory, setSelectedVibeCategory] = useState('all');
  const [selectedVenue, setSelectedVenue] = useState(FALLBACK_VENUE);
  const [dateTimeInput, setDateTimeInput] = useState('Saturday at 2:00 PM');
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reportReason, setReportReason] = useState('Harassment or disrespectful behavior');
  const [customSpots, setCustomSpots] = useState([]);
  const [customSpotsLoading, setCustomSpotsLoading] = useState(false);
  const [savingSpot, setSavingSpot] = useState(false);
  const [showCustomVenue, setShowCustomVenue] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [customPerk, setCustomPerk] = useState('');
  const [customCategory, setCustomCategory] = useState('coffee');
  const [editingSpotId, setEditingSpotId] = useState(null);
  const listRef = useRef(null);
  const matchIdRef = useRef(paramMatchId);
  const otherUserIdRef = useRef(paramOtherId);
  const userIdRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const setMatchIdBoth = (id) => { matchIdRef.current = id; setMatchId(id); };
  const setOtherIdBoth = (id) => { otherUserIdRef.current = id; setOtherUserId(id); };

  const ensureMatchId = useCallback(async () => {
    if (matchIdRef.current) return matchIdRef.current;
    const uid = userIdRef.current; if (!uid) return null;
    try {
      if (rawId && isUuidLike(rawId)) {
        const { data: m } = await supabase.from('matches').select('id, user_a, user_b').eq('id', rawId).maybeSingle();
        if (m) { setOtherIdBoth(m.user_a === uid ? m.user_b : m.user_a); setMatchIdBoth(m.id); return m.id; }
        const { data: existing } = await supabase.from('matches').select('id').or(`and(user_a.eq.${uid},user_b.eq.${rawId}),and(user_a.eq.${rawId},user_b.eq.${uid})`).maybeSingle();
        if (existing) { setOtherIdBoth(rawId); setMatchIdBoth(existing.id); return existing.id; }
      }
      if (otherUserIdRef.current) {
        const { data: existing } = await supabase.from('matches').select('id').or(`and(user_a.eq.${uid},user_b.eq.${otherUserIdRef.current}),and(user_a.eq.${otherUserIdRef.current},user_b.eq.${uid})`).maybeSingle();
        if (existing) { setMatchIdBoth(existing.id); return existing.id; }
      }
    } catch (e) { console.log('[ChatDetail] ensureMatchId:', e?.message); }
    return null;
  }, [rawId]);

  const refetchMessages = useCallback(async () => {
    const mid = matchIdRef.current || await ensureMatchId();
    const uid = userIdRef.current; if (!mid || !uid) return;
    try {
      const { data: msgs, error } = await supabase.from('messages').select('id, match_id, sender_id, body, created_at').eq('match_id', mid).order('created_at', { ascending: true }).limit(200);
      if (error) return;
      if (Array.isArray(msgs) && mountedRef.current) {
        const cleaned = [];
        msgs.forEach((mm) => {
          const text = getMessageText(mm);
          if (isZeroSecondCall(text)) return;
          const prev = cleaned[cleaned.length - 1];
          if (prev && isCallLogText(text) && isCallLogText(prev.text) && prev.text === text) return;
          cleaned.push({ id: String(mm.id), text, sender: mm.sender_id === uid ? 'me' : 'them', time: mm.created_at ? new Date(mm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '', isProposal: String(text).startsWith('📍 PROPOSED DATE'), isCallLog: isCallLogText(text) });
        });
        setMessages(cleaned);
      }
    } catch {}
  }, [ensureMatchId]);

  const persistMessage = async (text) => {
    const mid = await ensureMatchId(); const uid = userIdRef.current; if (!mid || !uid) return false;
    try {
      const { data, error } = await supabase.from('messages').insert({ match_id: mid, sender_id: uid, body: text }).select('id, match_id, sender_id, body, created_at').single();
      if (error) { Alert.alert('Message not sent', error.message); return false; }
      setTimeout(() => refetchMessages(), 500); return true;
    } catch (e) { Alert.alert('Message not sent', e?.message || 'Could not send'); return false; }
  };

  const call = useP2PCall({
    matchId, userId, userIdRef, otherUserIdRef, ensureMatchId,
    onCallEnded: async (logText) => {
      if (isZeroSecondCall(logText)) return;
      let isDup = false;
      setMessages((prev) => { const last = prev[prev.length - 1]; if (last?.isCallLog && last?.text === logText) isDup = true; return prev; });
      if (isDup) return;
      const mid = await ensureMatchId();
      if (mid && userIdRef.current) await persistMessage(logText);
      setMessages((prev) => [...prev, { id: Date.now().toString(), text: logText, sender: 'me', isCallLog: true, time: 'Just now' }]);
    },
  });

  const loadCustomSpots = useCallback(async (uid) => {
    const idToUse = uid || userIdRef.current;
    if (!idToUse) return;
    setCustomSpotsLoading(true);
    try {
      const { data, error } = await supabase.from('custom_spots').select('*').eq('user_id', idToUse).order('created_at', { ascending: false });
      if (error) { console.log('[CustomSpots] load error:', error.message); return; }
      if (Array.isArray(data)) setCustomSpots(data.map(mapSpotRow));
    } catch (e) { console.log('[CustomSpots] load catch:', e?.message); }
    finally { setCustomSpotsLoading(false); }
  }, []);

  const loadChat = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigation?.reset?.({ index: 0, routes: [{ name: 'AuthPortal' }] }); return; }
      setUserId(user.id); userIdRef.current = user.id;
      await loadCustomSpots(user.id);
      let resolvedOtherId = paramOtherId; let resolvedMatchId = paramMatchId;
      const ambiguousId = !resolvedMatchId && !resolvedOtherId ? rawId : null;
      if (resolvedMatchId) {
        const { data: m } = await supabase.from('matches').select('id, user_a, user_b').eq('id', resolvedMatchId).maybeSingle();
        if (m) { resolvedOtherId = m.user_a === user.id ? m.user_b : m.user_a; setOtherIdBoth(resolvedOtherId); }
      }
      if (!resolvedMatchId && ambiguousId && isUuidLike(ambiguousId)) {
        const { data: m } = await supabase.from('matches').select('id, user_a, user_b').eq('id', ambiguousId).maybeSingle();
        if (m) { resolvedMatchId = m.id; setMatchIdBoth(m.id); resolvedOtherId = m.user_a === user.id ? m.user_b : m.user_a; setOtherIdBoth(resolvedOtherId); }
        else { resolvedOtherId = ambiguousId; setOtherIdBoth(ambiguousId); const { data: existing } = await supabase.from('matches').select('id').or(`and(user_a.eq.${user.id},user_b.eq.${ambiguousId}),and(user_a.eq.${ambiguousId},user_b.eq.${user.id})`).maybeSingle(); if (existing) { resolvedMatchId = existing.id; setMatchIdBoth(existing.id); } }
      }
      if (!resolvedMatchId && resolvedOtherId && isUuidLike(String(resolvedOtherId))) {
        const { data: existing } = await supabase.from('matches').select('id').or(`and(user_a.eq.${user.id},user_b.eq.${resolvedOtherId}),and(user_a.eq.${resolvedOtherId},user_b.eq.${user.id})`).maybeSingle();
        if (existing) { resolvedMatchId = existing.id; setMatchIdBoth(existing.id); }
      }
      if (resolvedOtherId && isUuidLike(String(resolvedOtherId))) {
        const { data: p } = await supabase.from('profiles').select('id, name, bio, intent, location, photos').eq('id', resolvedOtherId).maybeSingle();
        if (p) setChat((prev) => ({ ...prev, name: p.name || prev.name, intent: p.intent || prev.intent, location: p.location || prev.location, avatar: (Array.isArray(p.photos) && p.photos[0]) || prev.avatar || FALLBACK_PHOTO }));
      }
      if (resolvedMatchId) await refetchMessages(); else setMessages([]);
    } catch (e) { console.log('[ChatDetail] load error', e?.message); }
    finally { if (mountedRef.current) setLoading(false); }
  }, [navigation, paramOtherId, paramMatchId, paramId, rawId, refetchMessages, loadCustomSpots]);

  useEffect(() => { loadChat(); }, [loadChat]);
  useEffect(() => {
    if (!matchId) return;
    const interval = setInterval(() => { refetchMessages(); }, 3000);
    return () => clearInterval(interval);
  }, [matchId, refetchMessages]);

  const openGoogleMaps = (addr) => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || '')}`).catch(() => {});
  const openUber = () => Linking.openURL('https://m.uber.com/ul/?action=setPickup').catch(() => {});
  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim(); setInputText('');
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, text, sender: 'me', time: 'Just now' }]);
    setSending(true);
    try { const ok = await persistMessage(text); if (!ok) setMessages((prev) => prev.filter((x) => x.id !== optimisticId)); } finally { setSending(false); }
  };
  const handleSendIcebreaker = async (t) => {
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, text: t, sender: 'me', time: 'Just now' }]);
    const ok = await persistMessage(t); if (!ok) setMessages((prev) => prev.filter((x) => x.id !== optimisticId));
  };
  const persistDateProposal = async ({ venueName, venueAddr, dateTimeInput }) => {
    const mid = matchIdRef.current || await ensureMatchId(); const uid = userIdRef.current; const other = otherUserIdRef.current;
    if (!mid || !uid || !other) return { ok: false, error: 'No match found' };
    const attempts = [
      { match_id: mid, proposer_id: uid, invitee_id: other, venue_name: venueName, venue_address: venueAddr, proposed_time: dateTimeInput, status: 'proposed' },
      { match_id: mid, user_a: uid, user_b: other, venue_name: venueName, venue_address: venueAddr, proposed_time: dateTimeInput, status: 'proposed' },
      { match_id: mid, proposer_id: uid, invitee_id: other, venue: venueName, address: venueAddr, date_time: dateTimeInput, status: 'proposed' },
    ];
    for (const payload of attempts) {
      try {
        const { data, error } = await supabase.from('dates').insert(payload).select().single();
        if (!error) return { ok: true, data };
        if (!error.message.includes('Could not find') && !error.message.includes('column') && !error.message.includes('schema cache')) return { ok: false, error: error.message };
      } catch {}
    }
    return { ok: false, error: 'dates table columns do not match — check Supabase dates columns' };
  };
  const handleProposeDate = async () => {
    setShowShowDateModal(false);
    const venueName = selectedVenue?.name || FALLBACK_VENUE.name; const venueAddr = selectedVenue?.address || FALLBACK_VENUE.address; const venuePerk = selectedVenue?.perk || '';
    const text = `📍 PROPOSED DATE: ${venueName} (${venueAddr})\n📅 ${dateTimeInput}\n${venuePerk}`;
    const res = await persistDateProposal({ venueName, venueAddr, dateTimeInput });
    if (!res.ok) { Alert.alert('Date not saved', res.error); return; }
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, text, sender: 'me', isProposal: true, time: 'Just now' }]);
    const ok = await persistMessage(text); if (!ok) setMessages((prev) => prev.filter((x) => x.id !== optimisticId));
    else Alert.alert('Date Proposed 📍', `${venueName} — ${dateTimeInput}`);
  };
  const handleSubmitReport = async () => {
    setShowReportModal(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('customer_support').insert({ user_id: user.id, user_email: user.email, ticket_type: 'complaint', subject: `Report: ${chat?.name} — ${reportReason}`, message: `Reported ${chat?.name} (ID: ${otherUserId || paramId}) for: ${reportReason}. From chat ${matchId || paramId}.`, status: 'under_review' });
    } catch {}
    Alert.alert('Report Received 🛡️', `Thank you. Your report against ${chat?.name || 'this user'} has been submitted.`);
  };

  const resetCustomForm = () => { setCustomName(''); setCustomAddress(''); setCustomPerk(''); setCustomCategory('coffee'); setEditingSpotId(null); };
  const handleStartEditSpot = (spot) => {
    setCustomName(spot?.name || ''); setCustomAddress(spot?.address || ''); setCustomPerk(String(spot?.perk || '').replace(/^✨\s*/, '').replace(/^🎁\s*/, '')); setCustomCategory(spot?.category || 'coffee'); setEditingSpotId(spot?.id); setShowCustomVenue(true); setSelectedVibeCategory('all');
  };
  const handleSaveCustomSpot = async () => {
    if (!customName.trim()) { Alert.alert('Add a spot', 'Type the spot name first'); return; }
    const uid = userIdRef.current;
    if (!uid) { Alert.alert('Not signed in', 'Please log in again'); return; }
    setSavingSpot(true);
    const payload = { user_id: uid, name: customName.trim(), address: customAddress.trim() || 'Custom spot', perk: customPerk.trim() || '✨ My pick', category: customCategory };
    try {
      if (editingSpotId) {
        const { data, error } = await supabase.from('custom_spots').update(payload).eq('id', editingSpotId).eq('user_id', uid).select().single();
        if (error) { Alert.alert('Could not update', error.message); return; }
        const updated = mapSpotRow(data);
        setCustomSpots((prev) => prev.map((s) => s.id === editingSpotId ? updated : s));
        if (selectedVenue?.id === editingSpotId) setSelectedVenue(updated);
      } else {
        const { data, error } = await supabase.from('custom_spots').insert(payload).select().single();
        if (error) { Alert.alert('Could not save', error.message + '\n\nDid you run the SQL to create custom_spots table?'); return; }
        const newSpot = mapSpotRow(data);
        setCustomSpots((prev) => [newSpot, ...prev]); setSelectedVenue(newSpot); setSelectedVibeCategory('all');
      }
      resetCustomForm(); setShowCustomVenue(false);
    } catch (e) { Alert.alert('Could not save', e?.message || 'Try again'); }
    finally { setSavingSpot(false); }
  };
  const handleDeleteCustomSpot = async (spot) => {
    if (!spot?.id) return;
    const uid = userIdRef.current;
    const prevSpots = customSpots; const prevSelected = selectedVenue;
    setCustomSpots((prev) => prev.filter((s) => s.id !== spot.id));
    if (selectedVenue?.id === spot.id) setSelectedVenue(FALLBACK_VENUE);
    if (editingSpotId === spot.id) { resetCustomForm(); setShowCustomVenue(false); }
    try {
      const { error } = await supabase.from('custom_spots').delete().eq('id', spot.id).eq('user_id', uid);
      if (error) { setCustomSpots(prevSpots); setSelectedVenue(prevSelected); Alert.alert('Could not delete', error.message + '\n\nCheck RLS DELETE policy on custom_spots in Supabase.'); }
    } catch (e) { setCustomSpots(prevSpots); setSelectedVenue(prevSelected); Alert.alert('Could not delete', e?.message || 'Try again'); }
  };

  const allVenues = [...customSpots, ...RECOMMENDED_DATE_SPOTS];
  const filteredVenues = allVenues.filter((v) => selectedVibeCategory === 'all' || v?.category === selectedVibeCategory);
  const avatarUri = chat?.avatar || FALLBACK_PHOTO;
  const avatarInitial = String(chat?.name || 'I').trim().charAt(0).toUpperCase();

  if (loading) return (<SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#F97316" size="large" /><Text style={{ color: '#94A3B8', marginTop: 12 }}>Loading chat...</Text></SafeAreaView>);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#F8FAFC" /></TouchableOpacity>
        <View style={styles.avatarWrap}><Image source={{ uri: avatarUri }} style={styles.avatar} />{!chat?.avatar && <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{avatarInitial}</Text></View>}</View>
        <View style={styles.headerInfo}><Text style={styles.name} numberOfLines={1}>{chat?.name || 'Intent User'}</Text><Text style={styles.intentLabel} numberOfLines={1}>Seeking: {chat?.intent || 'Intentional'}</Text></View>
        <View style={styles.callHeaderActions}>
          <TouchableOpacity style={styles.callIconBtn} onPress={() => call.handleStartCall('audio')}><Ionicons name="call-outline" size={18} color="#FBBF24" /></TouchableOpacity>
          <TouchableOpacity style={styles.callIconBtn} onPress={() => call.handleStartCall('video')}><Ionicons name="videocam-outline" size={18} color="#FBBF24" /></TouchableOpacity>
          <TouchableOpacity style={styles.planDateBtn} onPress={() => setShowShowDateModal(true)}><Ionicons name="location" size={14} color="#FFF" /></TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)}><Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" /></TouchableOpacity>
        </View>
      </View>
      <FlatList ref={listRef} data={messages || []} keyExtractor={(item) => String(item?.id || Math.random().toString())} contentContainerStyle={styles.msgList}
        ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyEmoji}>👋</Text><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.emptySub}>You matched with {chat?.name || 'Vio'}. Say hi — send your first intentional message below.</Text></View>}
        onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item?.sender === 'me';
          if (item?.isCallLog) return (<View style={styles.callLogCard}><Ionicons name="call" size={16} color="#FBBF24" /><Text style={styles.callLogText}>{formatCallLog(item?.text || '')}</Text></View>);
          return (<View style={[styles.msgBubble, isMe ? styles.myMsg : styles.theirMsg, item?.isProposal && styles.proposalMsg]}><Text style={[styles.msgText, isMe ? styles.myMsgText : styles.theirMsgText]}>{item?.text || ''}</Text><Text style={styles.timeText}>{item?.time || ''}</Text></View>);
        }} />
      <View style={[styles.icebreakerBar, { paddingBottom: Math.max(8, insets.bottom / 2) }]}>
        <Text style={styles.icebreakerLabel}>⚡ Icebreakers:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.icebreakerScroll}>
          {ICEBREAKER_CARDS.map((cardText, idx) => (<TouchableOpacity key={idx} style={styles.icebreakerChip} onPress={() => handleSendIcebreaker(cardText)}><Text style={styles.icebreakerChipText} numberOfLines={1}>{cardText}</Text></TouchableOpacity>))}
        </ScrollView>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.inputBar, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <TextInput style={styles.input} placeholder="Type intentional message..." placeholderTextColor="#64748B" value={inputText} onChangeText={setInputText} onSubmitEditing={handleSend} multiline maxLength={2000} returnKeyType="send" />
          <TouchableOpacity style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]} onPress={handleSend} disabled={sending || !inputText.trim()}><Ionicons name="send" size={18} color="#FFF" /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowReportModal(true); }}><Ionicons name="flag-outline" size={18} color="#EF4444" /><Text style={styles.menuItemTextDanger}>Report {chat?.name || 'User'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowShowDateModal(true); }}><Ionicons name="location-outline" size={18} color="#FBBF24" /><Text style={styles.menuItemText}>Propose Date</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setShowMenu(false)}><Ionicons name="close-outline" size={18} color="#94A3B8" /><Text style={styles.menuItemText}>Cancel</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <CallOverlay call={call} chat={chat} avatarUri={avatarUri} />

      {/* DATE VENUE MODAL - CENTRE-JUSTIFIED */}
      <Modal visible={showDateModal} transparent animationType="fade" onRequestClose={() => setShowShowDateModal(false)}>
        <Pressable style={styles.centeredView} onPress={() => setShowShowDateModal(false)}>
          <Pressable style={styles.dateModalCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dateModalScroll}>
              <View style={styles.recommenderHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Ionicons name="location" size={20} color="#FBBF24" />
                  <Text style={styles.modalTitle}>Date Venue & Vibe Recommender</Text>
                </View>
                <TouchableOpacity onPress={() => setShowShowDateModal(false)} style={{ padding: 4 }}><Ionicons name="close" size={20} color="#94A3B8" /></TouchableOpacity>
              </View>
              <Text style={styles.modalSub}>Pick a top-rated date spot and time to invite {chat?.name || 'them'}.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vibeChipsRow}>
                {['all', 'coffee', 'dining', 'art', 'parks'].map((c) => (<TouchableOpacity key={c} style={[styles.vibeChip, selectedVibeCategory === c && styles.vibeChipActive]} onPress={() => setSelectedVibeCategory(c)}><Text style={[styles.vibeChipText, selectedVibeCategory === c && styles.vibeChipTextActive]}>{c === 'all' ? '✨ All Vibes' : c === 'coffee' ? '☕ Coffee & Tea' : c === 'dining' ? '🍷 Fine Dining' : c === 'art' ? '🎨 Art Galleries' : '🌳 Parks & Walks'}</Text></TouchableOpacity>))}
              </ScrollView>
              <TouchableOpacity style={styles.addCustomBtn} onPress={() => { if (showCustomVenue) { resetCustomForm(); setShowCustomVenue(false); } else setShowCustomVenue(true); }}>
                <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                <Text style={styles.addCustomBtnText}>{showCustomVenue ? 'Close Custom Spot' : '+ Add Custom Spot'}</Text>
              </TouchableOpacity>
              {showCustomVenue && (
                <View style={styles.customForm}>
                  <Text style={styles.customFormTitle}>{editingSpotId ? 'Edit your spot' : 'Your own spot'}</Text>
                  <Text style={styles.fieldLabel}>Spot Name</Text>
                  <TextInput style={styles.customInput} placeholder="Spot name - e.g. Cape Coast Castle" placeholderTextColor="#64748B" value={customName} onChangeText={setCustomName} />
                  <Text style={styles.fieldLabel}>Town / Address</Text>
                  <TextInput style={styles.customInput} placeholder="Town - e.g. Cape Coast" placeholderTextColor="#64748B" value={customAddress} onChangeText={setCustomAddress} />
                  <Text style={styles.fieldLabel}>Why this spot?</Text>
                  <TextInput style={styles.customInput} placeholder="Why this spot? - e.g. Historical, quiet" placeholderTextColor="#64748B" value={customPerk} onChangeText={setCustomPerk} />
                  <Text style={styles.fieldLabel}>Vibe for this spot</Text>
                  <View style={styles.customVibeRow}>
                    {['coffee', 'dining', 'art', 'parks'].map((c) => (
                      <TouchableOpacity key={c} style={[styles.vibeChip, customCategory === c && styles.vibeChipActive]} onPress={() => setCustomCategory(c)}>
                        <Text style={[styles.vibeChipText, customCategory === c && styles.vibeChipTextActive]}>{c === 'coffee' ? '☕ Coffee' : c === 'dining' ? '🍷 Dining' : c === 'art' ? '🎨 Art' : '🌳 Parks'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[styles.useCustomBtn, { flex: 1, opacity: savingSpot ? 0.6 : 1 }]} onPress={handleSaveCustomSpot} disabled={savingSpot}>
                      <Text style={styles.useCustomBtnText}>{savingSpot ? 'Saving...' : editingSpotId ? 'Save Changes' : 'Use This Spot'}</Text>
                    </TouchableOpacity>
                    {editingSpotId && (
                      <TouchableOpacity style={[styles.cancelEditBtn, { flex: 1 }]} onPress={() => { resetCustomForm(); setShowCustomVenue(false); }}>
                        <Text style={styles.cancelEditBtnText}>Cancel Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
              {customSpotsLoading && <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>Loading your spots...</Text>}
              {filteredVenues.map((spot) => (
                <View key={spot?.id} style={[styles.spotCard, selectedVenue?.id === spot?.id && styles.spotCardSelected]}>
                  <View style={{ flex: 1 }}>
                    <Pressable onPress={() => setSelectedVenue(spot)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.spotName}>{spot?.name}</Text>
                        <Text style={styles.spotRating}>⭐ {spot?.rating}</Text>
                        {spot?.isCustom && <Text style={styles.customBadge}>YOUR PICK</Text>}
                      </View>
                      <Text style={styles.spotAddress}>📍 {spot?.address}</Text>
                      <Text style={styles.spotPerk}>{spot?.perk}</Text>
                    </Pressable>
                    {spot?.isCustom && (
                      <View style={styles.editDeleteRow}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => handleStartEditSpot(spot)} activeOpacity={0.7}>
                          <Ionicons name="pencil-outline" size={13} color="#FBBF24" />
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteCustomSpot(spot)} activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={13} color="#FFFFFF" />
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.mapsBtn} onPress={() => openGoogleMaps(spot?.address)}><Ionicons name="navigate-outline" size={16} color="#FBBF24" /></TouchableOpacity>
                </View>
              ))}
              {filteredVenues.length === 0 && !customSpotsLoading && <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', paddingVertical: 12 }}>No spots for this vibe yet — add a custom one above.</Text>}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Date & Time Suggestion</Text>
              <TextInput style={styles.modalInput} value={dateTimeInput} onChangeText={setDateTimeInput} />
              {selectedVenue?.isCustom && <Text style={{ color: '#FBBF24', fontSize: 12, marginTop: 6, fontWeight: '700' }}>Selected: {selectedVenue?.name} — your custom spot</Text>}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}><TouchableOpacity style={styles.uberBtn} onPress={openUber}><Ionicons name="car-outline" size={18} color="#FFF" /><Text style={styles.uberBtnText}>Uber</Text></TouchableOpacity><TouchableOpacity style={styles.confirmDateBtn} onPress={handleProposeDate}><Text style={styles.confirmDateText}>Send Proposal</Text></TouchableOpacity></View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* REPORT MODAL - SAME CENTRE-JUSTIFIED PATTERN */}
      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <Pressable style={styles.centeredView} onPress={() => setShowReportModal(false)}>
          <Pressable style={styles.dateModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Report Member</Text><Text style={styles.modalSub}>Reports are strictly confidential and reviewed by the App Manager within 24 hours.</Text>
            <Text style={styles.fieldLabel}>Reason for Report</Text>
            {['Harassment or disrespectful behavior', 'Fake profile / Misrepresentation', 'Inappropriate messages', 'Spam / Commercial solicitation'].map((r) => (<TouchableOpacity key={r} style={[styles.vibeChip, reportReason === r && styles.vibeChipActive, { marginBottom: 6, alignSelf: 'flex-start' }]} onPress={() => setReportReason(r)}><Text style={[styles.vibeChipText, reportReason === r && styles.vibeChipTextActive]}>{r}</Text></TouchableOpacity>))}
            <TouchableOpacity style={[styles.confirmDateBtn, { backgroundColor: '#EF4444', marginTop: 12 }]} onPress={handleSubmitReport}><Text style={styles.confirmDateText}>Submit Report to Manager</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReportModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 8 },
  backBtn: { padding: 2, flexShrink: 0 },
  avatarWrap: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#334155', flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  avatarFallbackText: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  headerInfo: { flex: 1, minWidth: 0, flexShrink: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  intentLabel: { fontSize: 11, color: '#FBBF24', fontWeight: '600' },
  callHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  callIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  planDateBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center' },
  menuBtn: { width: 28, height: 32, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  menuCard: { position: 'absolute', top: 60, right: 12, backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155', paddingVertical: 6, width: 200, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  menuItemText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  menuItemTextDanger: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  msgList: { padding: 16, gap: 12, flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#F8FAFC', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  myMsg: { alignSelf: 'flex-end', backgroundColor: '#F97316' },
  theirMsg: { alignSelf: 'flex-start', backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  proposalMsg: { backgroundColor: 'rgba(251, 191, 36, 0.2)', borderWidth: 1, borderColor: '#FBBF24' },
  msgText: { fontSize: 14, lineHeight: 20 },
  myMsgText: { color: '#FFFFFF' },
  theirMsgText: { color: '#E2E8F0' },
  timeText: { fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', alignSelf: 'flex-end', marginTop: 4 },
  callLogCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, alignSelf: 'center', borderWidth: 1, borderColor: '#334155', gap: 8, marginVertical: 4 },
  callLogText: { color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  icebreakerBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#090D16', paddingVertical: 8, paddingLeft: 12, borderTopWidth: 1, borderTopColor: '#1E293B' },
  icebreakerLabel: { color: '#FBBF24', fontSize: 12, fontWeight: '800', marginRight: 8, flexShrink: 0 },
  icebreakerScroll: { paddingRight: 12, alignItems: 'center', gap: 8 },
  icebreakerChip: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  icebreakerChipText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#1E293B', backgroundColor: '#090D16', gap: 10 },
  input: { flex: 1, backgroundColor: '#1E293B', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#F8FAFC', minHeight: 44, maxHeight: 100, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sendBtnDisabled: { opacity: 0.5 },
  // FIX: Centre-justify - outer Pressable centres, inner card is capped width
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(2,6,23,0.85)', paddingHorizontal: 16, paddingVertical: 20 },
  dateModalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#1E293B', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#334155', maxHeight: '88%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  dateModalScroll: { paddingBottom: 4 },
  recommenderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', flexShrink: 1 },
  modalSub: { fontSize: 12, color: '#94A3B8', marginTop: 4, marginBottom: 12, textAlign: 'center' },
  vibeChipsRow: { gap: 8, marginBottom: 12, justifyContent: 'center' },
  vibeChip: { backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#334155' },
  vibeChipActive: { borderColor: '#F97316', backgroundColor: 'rgba(249, 115, 22, 0.2)' },
  vibeChipText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  vibeChipTextActive: { color: '#FBBF24', fontWeight: '700' },
  spotCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 8 },
  spotCardSelected: { borderColor: '#F97316', backgroundColor: 'rgba(249, 115, 22, 0.15)' },
  spotName: { fontSize: 14, fontWeight: '700', color: '#F8FAFC' },
  spotRating: { fontSize: 12, color: '#FBBF24', fontWeight: '700' },
  spotAddress: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  spotPerk: { fontSize: 11, color: '#FBBF24', fontWeight: '700', marginTop: 2 },
  mapsBtn: { padding: 8, backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  fieldLabel: { fontSize: 12, color: '#CBD5E1', marginBottom: 6, fontWeight: '600', textAlign: 'center' },
  modalInput: { backgroundColor: '#0F172A', height: 44, borderRadius: 10, paddingHorizontal: 14, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155', textAlign: 'center' },
  uberBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000000', paddingHorizontal: 16, height: 48, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#334155' },
  uberBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  confirmDateBtn: { flex: 1, backgroundColor: '#F97316', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmDateText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  cancelBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  addCustomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F97316', paddingVertical: 11, borderRadius: 12, marginBottom: 10 },
  addCustomBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  customForm: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#F97316', borderRadius: 14, padding: 12, marginBottom: 12 },
  customFormTitle: { color: '#F8FAFC', fontWeight: '800', fontSize: 14, marginBottom: 8, textAlign: 'center' },
  customInput: { backgroundColor: '#1E293B', height: 44, borderRadius: 10, paddingHorizontal: 12, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155', marginBottom: 8, fontSize: 13, textAlign: 'center' },
  customVibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10, justifyContent: 'center' },
  useCustomBtn: { backgroundColor: '#F8FAFC', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  useCustomBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  customBadge: { fontSize: 9, fontWeight: '800', color: '#0F172A', backgroundColor: '#FBBF24', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  editDeleteRow: { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'center' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  editBtnText: { color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  deleteBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  cancelEditBtn: { backgroundColor: '#334155', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  cancelEditBtnText: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
});