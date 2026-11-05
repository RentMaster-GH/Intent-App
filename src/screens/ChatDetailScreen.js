import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80';

const ICEBREAKER_CARDS = [
  '☕ Suggest a 20-min coffee meetup',
  '🎨 Ask about their favorite weekend spot',
  '🎲 Play 2 Truths & 1 Lie',
  '🎵 What song is on repeat for you right now?',
];

const RECOMMENDED_DATE_SPOTS = [
  {
    id: 'v1',
    name: 'Devoción Coffee & Vinyl Lounge',
    vibe: 'Cozy & Casual',
    category: 'coffee',
    rating: '4.9',
    address: '69 Grand St, Williamsburg',
    perk: '🎁 15% off with Intent',
  },
  {
    id: 'v2',
    name: 'Apex Cocktail Bistro & Lounge',
    vibe: 'Romantic & Fine Dining',
    category: 'dining',
    rating: '4.8',
    address: '142 Market St, Downtown',
    perk: '🎁 Free Appetizer on First Date',
  },
  {
    id: 'v3',
    name: 'Chelsea Contemporary Art Walk',
    vibe: 'Cultural & Quiet',
    category: 'art',
    rating: '4.9',
    address: '522 W 26th St, Chelsea',
    perk: '🎁 Complimentary Gallery Pass',
  },
  {
    id: 'v4',
    name: 'Conservatory Scenic Garden Walk',
    vibe: 'Outdoor & Scenic',
    category: 'parks',
    rating: '4.9',
    address: 'Central Park East & 105th St',
    perk: '🎁 Free Entry',
  },
];

// ✅ FIX: SAFE FALLBACK — NEVER READS [0] ON UNDEFINED
const FALLBACK_VENUE = RECOMMENDED_DATE_SPOTS?.[0] || {
  id: 'fallback',
  name: 'Local Coffee Shop',
  vibe: 'Cozy & Casual',
  category: 'coffee',
  rating: '4.9',
  address: 'Nearby — Search on Maps',
  perk: '🎁 Intent perk',
};

// ✅ FIX: SINGLE SOURCE OF TRUTH FOR DISCOVERY PEOPLE
// Must match DiscoveryScreen.js ids + names + intents.
// Used when user refreshes (F5) or types /chat/2 directly — params.name is lost then, but id survives in the URL.
const PEOPLE_BY_ID = {
  '1': {
    name: 'Ama',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
    intent: 'Long-term Relationship 💛',
    location: 'Accra, Ghana',
  },
  '2': {
    name: 'Kwame',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    intent: 'Friendship First 🤝',
    location: 'Accra, Ghana',
  },
  '3': {
    name: 'Efua',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    intent: 'Marriage Minded 💍',
    location: 'Kumasi, Ghana',
  },
};

export default function ChatDetailScreen({ route, navigation }) {
  // ✅ FIX: RESOLVE CHAT IN PRIORITY ORDER — chat object > flat params > id lookup > Elena fallback
  const rawChat =
    route.params?.chat ||
    (route.params?.name
      ? {
          name: route.params.name,
          avatar: route.params.avatar || route.params.img || FALLBACK_PHOTO,
          intent: route.params.intent || 'Long-term Relationship',
          location: route.params.location || '',
        }
      : PEOPLE_BY_ID[String(route.params?.id || '')] || {
          name: 'Elena Rostova',
          avatar: FALLBACK_PHOTO,
          intent: 'Long-term Relationship',
        });

  // ✅ FIX: SAFE AVATAR — handles avatar, photos[0], or fallback
  const safeChatAvatar = rawChat?.avatar || rawChat?.photos?.[0] || FALLBACK_PHOTO;
  const chat = { ...rawChat, avatar: safeChatAvatar };

  const [messages, setMessages] = useState([
    { id: 'm1', text: "Hey! Loved your prompt about urban architecture.", sender: 'them', time: '10:30 AM' },
    { id: 'm2', text: "Thanks Alex! It's rare finding someone who appreciates design.", sender: 'me', time: '10:35 AM' },
    { id: 'm3', text: "I'd love to check out that new coffee spot on Saturday!", sender: 'them', time: '10:42 AM' },
  ]);
  const [inputText, setInputText] = useState('');

  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const [showDateModal, setShowShowDateModal] = useState(false);
  const [selectedVibeCategory, setSelectedVibeCategory] = useState('all');
  const [selectedVenue, setSelectedVenue] = useState(FALLBACK_VENUE);
  const [dateTimeInput, setDateTimeInput] = useState('Saturday at 2:00 PM');

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Harassment or disrespectful behavior');

  useEffect(() => {
    let timer;
    if (activeCall) {
      timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [activeCall]);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const openGoogleMaps = (venueAddress) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueAddress || '')}`;
    Linking.openURL(url).catch(() => {});
  };

  const openUber = () => {
    const url = 'https://m.uber.com/ul/?action=setPickup';
    Linking.openURL(url).catch(() => {});
  };

  const handleStartCall = (type) => {
    setIsMuted(false);
    setIsCameraOff(false);
    setActiveCall(type);
  };

  const handleEndCall = () => {
    const durationFormatted = formatTimer(callDuration);
    const callTypeTitle = activeCall === 'video' ? 'Video Call' : 'Voice Call';
    setMessages((prev) => [
      ...(prev || []),
      {
        id: Date.now().toString(),
        text: `📞 In-App ${callTypeTitle} Ended (${durationFormatted})`,
        sender: 'me',
        isCallLog: true,
        time: 'Just now',
      },
    ]);
    setActiveCall(null);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    setMessages([...(messages || []), { id: Date.now().toString(), text: inputText, sender: 'me', time: 'Just now' }]);
    setInputText('');
  };

  const handleSendIcebreaker = (icebreakerText) => {
    setMessages((prev) => [...(prev || []), { id: Date.now().toString(), text: icebreakerText, sender: 'me', time: 'Just now' }]);
  };

  const handleProposeDate = () => {
    setShowShowDateModal(false);
    const venueName = selectedVenue?.name || FALLBACK_VENUE.name;
    const venueAddr = selectedVenue?.address || FALLBACK_VENUE.address;
    const venuePerk = selectedVenue?.perk || '';
    setMessages([...(messages || []), {
      id: Date.now().toString(),
      text: `📍 PROPOSED DATE: ${venueName} (${venueAddr})\n📅 ${dateTimeInput}\n${venuePerk}`,
      sender: 'me',
      isProposal: true,
      time: 'Just now',
    }]);
  };

  const handleSubmitReport = () => {
    setShowReportModal(false);
    Alert.alert('Report Received 🛡️', `Thank you. Your report against ${chat?.name || 'this user'} has been submitted to the Intent App Manager for review.`);
  };

  // ✅ FIX: SAFE FILTER — never crashes if RECOMMENDED_DATE_SPOTS undefined
  const filteredVenues = (RECOMMENDED_DATE_SPOTS || []).filter(
    (v) => selectedVibeCategory === 'all' || v?.category === selectedVibeCategory
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#F8FAFC" /></TouchableOpacity>
        <Image source={{ uri: chat?.avatar || FALLBACK_PHOTO }} style={styles.avatar} />
        <View style={styles.headerInfo}><Text style={styles.name}>{chat?.name || 'Intent User'}</Text><Text style={styles.intentLabel}>Seeking: {chat?.intent || 'Intentional'}</Text></View>
        <View style={styles.callHeaderActions}>
          <TouchableOpacity style={styles.callIconBtn} onPress={() => handleStartCall('audio')}><Ionicons name="call-outline" size={20} color="#FBBF24" /></TouchableOpacity>
          <TouchableOpacity style={styles.callIconBtn} onPress={() => handleStartCall('video')}><Ionicons name="videocam-outline" size={20} color="#FBBF24" /></TouchableOpacity>
          <TouchableOpacity style={styles.callIconBtn} onPress={() => setShowReportModal(true)}><Ionicons name="flag-outline" size={18} color="#EF4444" /></TouchableOpacity>
          <TouchableOpacity style={styles.planDateBtn} onPress={() => setShowShowDateModal(true)}><Ionicons name="location" size={16} color="#FFFFFF" /></TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={messages || []}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        contentContainerStyle={styles.msgList}
        renderItem={({ item }) => {
          const isMe = item?.sender === 'me';
          if (item?.isCallLog) {
            return (<View style={styles.callLogCard}><Ionicons name="call" size={16} color="#FBBF24" /><Text style={styles.callLogText}>{item?.text || ''}</Text></View>);
          }
          return (
            <View style={[styles.msgBubble, isMe ? styles.myMsg : styles.theirMsg, item?.isProposal && styles.proposalMsg]}>
              <Text style={[styles.msgText, isMe ? styles.myMsgText : styles.theirMsgText]}>{item?.text || ''}</Text>
              <Text style={styles.timeText}>{item?.time || ''}</Text>
            </View>
          );
        }}
      />

      <View style={styles.icebreakerBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.icebreakerScroll}>
          <Text style={styles.icebreakerLabel}>⚡ Icebreakers:</Text>
          {(ICEBREAKER_CARDS || []).map((cardText, idx) => (
            <TouchableOpacity key={idx} style={styles.icebreakerChip} onPress={() => handleSendIcebreaker(cardText)}><Text style={styles.icebreakerChipText}>{cardText}</Text></TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputBar}>
        <TextInput style={styles.input} placeholder="Type intentional message..." placeholderTextColor="#64748B" value={inputText} onChangeText={setInputText} />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}><Ionicons name="send" size={18} color="#FFFFFF" /></TouchableOpacity>
      </View>

      <Modal visible={activeCall !== null} transparent animationType="fade">
        <View style={styles.callOverlay}>
          <SafeAreaView style={styles.callContainer}>
            <View style={styles.callTopHeader}><View style={styles.encryptionBadge}><Ionicons name="lock-closed" size={12} color="#FBBF24" /><Text style={styles.encryptionText}>Intent Encrypted Call</Text></View><Text style={styles.callTimerText}>{formatTimer(callDuration)}</Text></View>
            {activeCall === 'video' ? (
              <View style={styles.videoFeedBox}>{!isCameraOff ? <Image source={{ uri: chat?.avatar || FALLBACK_PHOTO }} style={styles.remoteVideo} /> : <View style={styles.cameraOffPlaceholder}><Ionicons name="videocam-off" size={48} color="#64748B" /></View>}</View>
            ) : (
              <View style={styles.audioCallBox}><Image source={{ uri: chat?.avatar || FALLBACK_PHOTO }} style={styles.audioCallAvatar} /><Text style={styles.callPartnerName}>{chat?.name || 'Intent User'}</Text></View>
            )}
            <View style={styles.callControlsRow}>
              <TouchableOpacity style={[styles.controlCircle, isMuted && styles.controlCircleActive]} onPress={() => setIsMuted(!isMuted)}><Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFFFFF" /></TouchableOpacity>
              <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}><Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} /></TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={showDateModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <SafeAreaView style={styles.dateModalCard}>
            <View style={styles.recommenderHeader}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="location" size={20} color="#FBBF24" /><Text style={styles.modalTitle}>Date Venue & Vibe Recommender</Text></View><TouchableOpacity onPress={() => setShowShowDateModal(false)} style={{ padding: 4 }}><Ionicons name="close" size={20} color="#94A3B8" /></TouchableOpacity></View>
            <Text style={styles.modalSub}>Pick a top-rated date spot and time to invite {chat?.name || 'them'}.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vibeChipsRow}>
              <TouchableOpacity style={[styles.vibeChip, selectedVibeCategory === 'all' && styles.vibeChipActive]} onPress={() => setSelectedVibeCategory('all')}><Text style={[styles.vibeChipText, selectedVibeCategory === 'all' && styles.vibeChipTextActive]}>✨ All Vibes</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.vibeChip, selectedVibeCategory === 'coffee' && styles.vibeChipActive]} onPress={() => setSelectedVibeCategory('coffee')}><Text style={[styles.vibeChipText, selectedVibeCategory === 'coffee' && styles.vibeChipTextActive]}>☕ Coffee & Tea</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.vibeChip, selectedVibeCategory === 'dining' && styles.vibeChipActive]} onPress={() => setSelectedVibeCategory('dining')}><Text style={[styles.vibeChipText, selectedVibeCategory === 'dining' && styles.vibeChipTextActive]}>🍷 Fine Dining</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.vibeChip, selectedVibeCategory === 'art' && styles.vibeChipActive]} onPress={() => setSelectedVibeCategory('art')}><Text style={[styles.vibeChipText, selectedVibeCategory === 'art' && styles.vibeChipTextActive]}>🎨 Art Galleries</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.vibeChip, selectedVibeCategory === 'parks' && styles.vibeChipActive]} onPress={() => setSelectedVibeCategory('parks')}><Text style={[styles.vibeChipText, selectedVibeCategory === 'parks' && styles.vibeChipTextActive]}>🌳 Parks & Walks</Text></TouchableOpacity>
            </ScrollView>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={true}>
              {(filteredVenues || []).map((spot) => {
                const isSelected = selectedVenue?.id === spot?.id;
                return (
                  <TouchableOpacity key={spot?.id} style={[styles.spotCard, isSelected && styles.spotCardSelected]} onPress={() => setSelectedVenue(spot)}>
                    <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={styles.spotName}>{spot?.name || ''}</Text><Text style={styles.spotRating}>⭐ {spot?.rating || ''}</Text></View><Text style={styles.spotAddress}>📍 {spot?.address || ''}</Text><Text style={styles.spotPerk}>{spot?.perk || ''}</Text></View>
                    <TouchableOpacity style={styles.mapsBtn} onPress={() => openGoogleMaps(spot?.address)}><Ionicons name="navigate-outline" size={16} color="#FBBF24" /></TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Date & Time Suggestion</Text>
            <TextInput style={styles.modalInput} value={dateTimeInput} onChangeText={setDateTimeInput} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={styles.uberBtn} onPress={openUber}><Ionicons name="car-outline" size={18} color="#FFFFFF" /><Text style={styles.uberBtnText}>Uber</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmDateBtn} onPress={handleProposeDate}><Text style={styles.confirmDateText}>Send Proposal</Text></TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={showReportModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.dateModalCard}>
            <Text style={styles.modalTitle}>Report Member</Text><Text style={styles.modalSub}>Reports are strictly confidential and reviewed by the App Manager within 24 hours.</Text>
            <Text style={styles.fieldLabel}>Reason for Report</Text>
            {['Harassment or disrespectful behavior', 'Fake profile / Misrepresentation', 'Inappropriate messages', 'Spam / Commercial solicitation'].map((r) => (
              <TouchableOpacity key={r} style={[styles.vibeChip, reportReason === r && styles.vibeChipActive, { marginBottom: 6 }]} onPress={() => setReportReason(r)}><Text style={[styles.vibeChipText, reportReason === r && styles.vibeChipTextActive]}>{r}</Text></TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.confirmDateBtn, { backgroundColor: '#EF4444', marginTop: 12 }]} onPress={handleSubmitReport}><Text style={styles.confirmDateText}>Submit Report to Manager</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReportModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 10 },
  backBtn: { padding: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  intentLabel: { fontSize: 11, color: '#FBBF24', fontWeight: '600' },
  callHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  planDateBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center' },
  msgList: { padding: 16, gap: 12 },
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
  icebreakerBar: { backgroundColor: '#090D16', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1E293B' },
  icebreakerScroll: { paddingHorizontal: 12, alignItems: 'center', gap: 8 },
  icebreakerLabel: { color: '#FBBF24', fontSize: 12, fontWeight: '800', marginRight: 4 },
  icebreakerChip: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  icebreakerChipText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  inputBar: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#1E293B', backgroundColor: '#090D16', gap: 10 },
  input: { flex: 1, backgroundColor: '#1E293B', borderRadius: 20, paddingHorizontal: 16, color: '#F8FAFC', height: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center' },
  callOverlay: { flex: 1, backgroundColor: '#090D16' },
  callContainer: { flex: 1, justifyContent: 'space-between', padding: 24 },
  callTopHeader: { alignItems: 'center', marginTop: 10 },
  encryptionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, borderWidth: 1, borderColor: '#334155' },
  encryptionText: { color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  callTimerText: { color: '#F8FAFC', fontSize: 28, fontWeight: '900', marginTop: 12, letterSpacing: 2 },
  audioCallBox: { alignItems: 'center', justifyContent: 'center' },
  audioCallAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 16 },
  callPartnerName: { fontSize: 26, fontWeight: '800', color: '#F8FAFC' },
  videoFeedBox: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1E293B', marginVertical: 20 },
  remoteVideo: { width: '100%', height: '100%' },
  cameraOffPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  callControlsRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', marginBottom: 20 },
  controlCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  controlCircleActive: { backgroundColor: '#EF4444' },
  endCallBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'center', padding: 20 },
  dateModalCard: { backgroundColor: '#1E293B', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#334155', maxHeight: '90%' },
  recommenderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#F8FAFC' },
  modalSub: { fontSize: 12, color: '#94A3B8', marginTop: 4, marginBottom: 12 },
  vibeChipsRow: { gap: 8, marginBottom: 12 },
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
  fieldLabel: { fontSize: 12, color: '#CBD5E1', marginBottom: 6, fontWeight: '600' },
  modalInput: { backgroundColor: '#0F172A', height: 44, borderRadius: 10, paddingHorizontal: 14, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155' },
  uberBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000000', paddingHorizontal: 16, height: 48, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#334155' },
  uberBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  confirmDateBtn: { flex: 1, backgroundColor: '#F97316', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmDateText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  cancelBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
});