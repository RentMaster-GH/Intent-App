import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, TextInput, Modal, ScrollView, Linking, Alert, ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const IS_WEB = Platform.OS === 'web';
const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80';

// messages table: id, match_id, sender_id, body, created_at — ONLY body
const getMessageText = (mm) => mm?.body ?? '';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

const ICEBREAKER_CARDS = [
  '☕ Suggest a 20-min coffee meetup',
  '🎨 Ask about their favorite weekend spot',
  '🎲 Play 2 Truths & 1 Lie',
  '🎵 What song is on repeat for you right now?',
];

const RECOMMENDED_DATE_SPOTS = [
  { id: 'v1', name: 'Devoción Coffee & Vinyl Lounge', vibe: 'Cozy & Casual', category: 'coffee', rating: '4.9', address: '69 Grand St, Williamsburg', perk: '🎁 15% off with Intent' },
  { id: 'v2', name: 'Apex Cocktail Bistro & Lounge', vibe: 'Romantic & Fine Dining', category: 'dining', rating: '4.8', address: '142 Market St, Downtown', perk: '🎁 Free Appetizer on First Date' },
  { id: 'v3', name: 'Chelsea Contemporary Art Walk', vibe: 'Cultural & Quiet', category: 'art', rating: '4.9', address: '522 W 26th St, Chelsea', perk: '🎁 Complimentary Gallery Pass' },
  { id: 'v4', name: 'Conservatory Scenic Garden Walk', vibe: 'Outdoor & Scenic', category: 'parks', rating: '4.9', address: 'Central Park East & 105th St', perk: '🎁 Free Entry' },
];

const FALLBACK_VENUE = RECOMMENDED_DATE_SPOTS[0];
const PEOPLE_BY_ID = {
  '1': { name: 'Ama', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80', intent: 'Long-term Relationship 💛', location: 'Accra, Ghana' },
  '2': { name: 'Kwame', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', intent: 'Friendship First 🤝', location: 'Accra, Ghana' },
  '3': { name: 'Efua', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', intent: 'Marriage Minded 💍', location: 'Kumasi, Ghana' },
};

const formatTimer = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
const isUuidLike = (v) => typeof v === 'string' && v.length > 20 && v.includes('-');

const getWebParams = () => {
  if (Platform.OS !== 'web') return {};
  try {
    const out = {};
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search || '');
      sp.forEach((v, k) => { out[k] = v; });
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'chat' && pathParts[1]) out.id = pathParts[1];
      if (pathParts[0] === 'chat' && pathParts[1]) out.rawChatId = pathParts[1];
      if (window.location.hash && window.location.hash.includes('?')) {
        const hashSearch = window.location.hash.split('?')[1] || '';
        new URLSearchParams(hashSearch).forEach((v, k) => { out[k] = v; });
      }
    }
    return out;
  } catch { return {}; }
};

// ---------- WEBRTC LOADER — NO STATIC IMPORTS, WEB-SAFE ----------
// Web build never imports react-native-webrtc or expo-camera.
// Native loads them only when a call starts.
let cachedWebRTC = null;
const getWebRTC = async () => {
  if (cachedWebRTC) return cachedWebRTC;
  if (Platform.OS === 'web') {
    // Web: use browser built-in WebRTC if ever needed, but calls are native-only
    cachedWebRTC = {
      RTCPeerConnection: window.RTCPeerConnection,
      RTCSessionDescription: window.RTCSessionDescription,
      RTCIceCandidate: window.RTCIceCandidate,
      mediaDevices: navigator.mediaDevices,
      RTCView: null,
    };
    return cachedWebRTC;
  }
  try {
    // eslint-disable-next-line no-undef
    const mod = await import('react-native-webrtc');
    cachedWebRTC = {
      RTCPeerConnection: mod.RTCPeerConnection,
      RTCSessionDescription: mod.RTCSessionDescription,
      RTCIceCandidate: mod.RTCIceCandidate,
      mediaDevices: mod.mediaDevices,
      RTCView: mod.RTCView,
    };
    return cachedWebRTC;
  } catch (e) {
    console.log('[WebRTC] load failed:', e?.message);
    throw new Error('WebRTC not available — run: npx expo install react-native-webrtc and rebuild with npx expo prebuild');
  }
};

export default function ChatDetailScreen({ route, navigation }) {
  const webParams = getWebParams();
  const allParams = { ...(route?.params || {}), ...webParams };

  const paramChat = allParams?.chat;
  const rawId = String(allParams?.id || allParams?.rawChatId || allParams?.matchId || allParams?.match_id || '');
  const paramMatchId = allParams?.matchId || allParams?.match_id || null;
  const paramOtherId = allParams?.otherUserId || allParams?.userId || allParams?.other_id || allParams?.otherId || null;
  const paramId = rawId;

  const initialChat =
    paramChat ||
    (allParams?.name ? {
      name: allParams.name,
      avatar: allParams.avatar || allParams.img || FALLBACK_PHOTO,
      intent: allParams.intent || 'Long-term Relationship',
      location: allParams.location || '',
    } : PEOPLE_BY_ID[paramId] || { name: 'Elena Rostova', avatar: FALLBACK_PHOTO, intent: 'Long-term Relationship' });

  const [userId, setUserId] = useState(null);
  const [otherUserId, setOtherUserId] = useState(paramOtherId);
  const [matchId, setMatchId] = useState(paramMatchId);
  const [chat, setChat] = useState({ ...initialChat, avatar: initialChat?.avatar || initialChat?.photos?.[0] || FALLBACK_PHOTO });
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // --- CALLS STATE (P2P, no LiveKit) ---
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [RTCViewComp, setRTCViewComp] = useState(null);

  const [showDateModal, setShowShowDateModal] = useState(false);
  const [selectedVibeCategory, setSelectedVibeCategory] = useState('all');
  const [selectedVenue, setSelectedVenue] = useState(FALLBACK_VENUE);
  const [dateTimeInput, setDateTimeInput] = useState('Saturday at 2:00 PM');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Harassment or disrespectful behavior');
  const listRef = useRef(null);

  const matchIdRef = useRef(paramMatchId);
  const otherUserIdRef = useRef(paramOtherId);
  const userIdRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const signalChannelRef = useRef(null);

  const setMatchIdBoth = (id) => { matchIdRef.current = id; setMatchId(id); };
  const setOtherIdBoth = (id) => { otherUserIdRef.current = id; setOtherUserId(id); };

  const ensureMatchId = useCallback(async () => {
    if (matchIdRef.current) return matchIdRef.current;
    const uid = userIdRef.current;
    if (!uid) return null;
    if (rawId && isUuidLike(rawId)) {
      const { data: m } = await supabase.from('matches').select('id, user_a, user_b').eq('id', rawId).maybeSingle();
      if (m) {
        const other = m.user_a === uid ? m.user_b : m.user_a;
        setOtherIdBoth(other);
        setMatchIdBoth(m.id);
        return m.id;
      }
      const { data: existing } = await supabase.from('matches').select('id')
        .or(`and(user_a.eq.${uid},user_b.eq.${rawId}),and(user_a.eq.${rawId},user_b.eq.${uid})`)
        .maybeSingle();
      if (existing) { setOtherIdBoth(rawId); setMatchIdBoth(existing.id); return existing.id; }
    }
    if (otherUserIdRef.current) {
      const { data: existing } = await supabase.from('matches').select('id')
        .or(`and(user_a.eq.${uid},user_b.eq.${otherUserIdRef.current}),and(user_a.eq.${otherUserIdRef.current},user_b.eq.${uid})`)
        .maybeSingle();
      if (existing) { setMatchIdBoth(existing.id); return existing.id; }
    }
    return null;
  }, [rawId]);

  const refetchMessages = useCallback(async () => {
    const mid = matchIdRef.current || await ensureMatchId();
    const uid = userIdRef.current;
    if (!mid || !uid) return;
    const { data: msgs, error } = await supabase.from('messages')
      .select('id, match_id, sender_id, body, created_at')
      .eq('match_id', mid)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) { console.log('[ChatDetail] LOAD ERROR:', error.message); return; }
    if (Array.isArray(msgs)) {
      setMessages(msgs.map((mm) => {
        const txt = getMessageText(mm);
        return {
          id: String(mm.id),
          text: txt,
          sender: mm.sender_id === uid ? 'me' : 'them',
          time: mm.created_at ? new Date(mm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          isProposal: String(txt).startsWith('📍 PROPOSED DATE'),
          isCallLog: String(txt).includes('Call Ended'),
        };
      }));
    }
  }, [ensureMatchId]);

  // ---------- P2P CALLS — NO LIVEKIT, NO CLOUD ----------
  // Supabase Realtime broadcast = signaling only. Video/audio goes phone-to-phone.

  const cleanupCall = useCallback(async () => {
    try { if (signalChannelRef.current) await supabase.removeChannel(signalChannelRef.current); } catch {}
    signalChannelRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    try { localStreamRef.current?.getTracks()?.forEach((t) => { try { t.stop(); } catch {} }); } catch {}
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnecting(false);
  }, []);

  useEffect(() => { return () => { cleanupCall(); }; }, [cleanupCall]);

  // Request mic/camera via getUserMedia — NO expo-camera import, web-safe
  const requestCallPermissions = useCallback(async (needVideo) => {
    if (IS_WEB) return false;
    try {
      const { Audio } = await import('expo-av');
      const mic = await Audio.requestPermissionsAsync();
      if (mic.status !== 'granted') {
        Alert.alert('Microphone needed', 'Allow microphone access to make calls.');
        return false;
      }
      // Camera permission is requested automatically by getUserMedia on iOS/Android
      // No expo-camera needed — avoids web build crash
      return true;
    } catch (e) {
      console.log('[Calls] permission check skipped:', e?.message);
      return true;
    }
  }, []);

  const createPeerConnection = useCallback(async (callId, isVideo) => {
    const wrtc = await getWebRTC();
    if (wrtc.RTCView && !RTCViewComp) setRTCViewComp(() => wrtc.RTCView);

    const pc = new wrtc.RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = async (e) => {
      if (e.candidate && callId && signalChannelRef.current) {
        try {
          await signalChannelRef.current.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { candidate: e.candidate, from: userIdRef.current },
          });
        } catch {}
      }
    };

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        console.log('[P2P] Remote track received');
        setRemoteStream(e.streams[0]);
        setIsConnecting(false);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[P2P] connectionState:', pc.connectionState);
      if (pc.connectionState === 'connected') setIsConnecting(false);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Keep UI, polling will show it
      }
    };

    return pc;
  }, [RTCViewComp]);

  // Subscribe to signaling for one callId
  const subscribeSignaling = useCallback((callId) => {
    if (!callId || signalChannelRef.current) return;
    const ch = supabase.channel(`call-signal-${callId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (!payload || payload.from === userIdRef.current) return;
        console.log('[P2P] Got offer');
        pendingOfferRef.current = payload.offer;
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!payload || payload.from === userIdRef.current) return;
        console.log('[P2P] Got answer');
        if (pcRef.current && payload.answer) {
          try {
            const wrtc = await getWebRTC();
            await pcRef.current.setRemoteDescription(new wrtc.RTCSessionDescription(payload.answer));
          } catch (e) { console.log('[P2P] setRemote answer error:', e?.message); }
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (!payload || payload.from === userIdRef.current) return;
        if (pcRef.current && payload.candidate) {
          try {
            const wrtc = await getWebRTC();
            await pcRef.current.addIceCandidate(new wrtc.RTCIceCandidate(payload.candidate));
          } catch {}
        }
      })
      .subscribe((status) => console.log('[P2P] signal channel:', status));
    signalChannelRef.current = ch;
    return ch;
  }, []);

  const loadChat = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] }); return; }
      setUserId(user.id);
      userIdRef.current = user.id;

      let resolvedOtherId = paramOtherId;
      let resolvedMatchId = paramMatchId;
      const ambiguousId = !resolvedMatchId && !resolvedOtherId ? rawId : null;

      if (resolvedMatchId) {
        const { data: m } = await supabase.from('matches').select('id, user_a, user_b').eq('id', resolvedMatchId).maybeSingle();
        if (m) {
          resolvedOtherId = m.user_a === user.id ? m.user_b : m.user_a;
          setOtherIdBoth(resolvedOtherId);
        }
      }

      if (!resolvedMatchId && ambiguousId && isUuidLike(ambiguousId)) {
        const { data: m } = await supabase.from('matches').select('id, user_a, user_b').eq('id', ambiguousId).maybeSingle();
        if (m) {
          resolvedMatchId = m.id;
          setMatchIdBoth(m.id);
          resolvedOtherId = m.user_a === user.id ? m.user_b : m.user_a;
          setOtherIdBoth(resolvedOtherId);
        } else {
          resolvedOtherId = ambiguousId;
          setOtherIdBoth(ambiguousId);
          const { data: existing } = await supabase.from('matches').select('id')
            .or(`and(user_a.eq.${user.id},user_b.eq.${ambiguousId}),and(user_a.eq.${ambiguousId},user_b.eq.${user.id})`)
            .maybeSingle();
          if (existing) { resolvedMatchId = existing.id; setMatchIdBoth(existing.id); }
        }
      }

      if (!resolvedMatchId && resolvedOtherId && isUuidLike(String(resolvedOtherId))) {
        const { data: existing } = await supabase.from('matches').select('id')
          .or(`and(user_a.eq.${user.id},user_b.eq.${resolvedOtherId}),and(user_a.eq.${resolvedOtherId},user_b.eq.${user.id})`)
          .maybeSingle();
        if (existing) { resolvedMatchId = existing.id; setMatchIdBoth(existing.id); }
      }

      if (resolvedOtherId && isUuidLike(String(resolvedOtherId))) {
        const { data: p } = await supabase.from('profiles').select('id, name, bio, intent, location, photos').eq('id', resolvedOtherId).maybeSingle();
        if (p) {
          setChat((prev) => ({
            ...prev,
            name: p.name || prev.name,
            intent: p.intent || prev.intent,
            location: p.location || prev.location,
            avatar: (Array.isArray(p.photos) && p.photos[0]) || prev.avatar || FALLBACK_PHOTO,
          }));
        }
      }

      if (resolvedMatchId) await refetchMessages();
      else setMessages([]);
    } catch (e) {
      console.log('[ChatDetail] load error', e?.message);
    } finally { setLoading(false); }
  }, [navigation, paramOtherId, paramMatchId, paramId, rawId, refetchMessages]);

  useEffect(() => { loadChat(); }, [loadChat]);

  useEffect(() => {
    if (!matchId) return;
    const interval = setInterval(() => { refetchMessages(); }, 3000);
    const onFocus = () => refetchMessages();
    const onVisibility = () => { if (typeof document !== 'undefined' && !document.hidden) refetchMessages(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [matchId, refetchMessages]);

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase.channel(`messages-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` }, (p) => {
        const mm = p.new;
        const txt = getMessageText(mm);
        setMessages((prev) => {
          if (prev.some((x) => String(x.id) === String(mm.id))) return prev;
          const filtered = prev.filter((x) => !(String(x.id).startsWith('local-') && x.text === txt && x.sender === (mm.sender_id === userIdRef.current ? 'me' : 'them')));
          return [...filtered, {
            id: String(mm.id),
            text: txt,
            sender: mm.sender_id === userIdRef.current ? 'me' : 'them',
            time: mm.created_at ? new Date(mm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
            isProposal: String(txt).startsWith('📍 PROPOSED DATE'),
            isCallLog: String(txt).includes('Call Ended'),
          }];
        });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [matchId]);

  // Calls table realtime — ringing / answered / ended
  useEffect(() => {
    if (!userId || !matchId) return;
    const ch = supabase.channel(`calls-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `match_id=eq.${matchId}` }, (p) => {
        const row = p.new;
        if (row.callee_id === userId && row.status === 'ringing') {
          console.log('[P2P] Incoming call:', row.id);
          setIncomingCall(row);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `match_id=eq.${matchId}` }, (p) => {
        const row = p.new;
        if (['declined', 'ended', 'missed'].includes(row.status)) {
          setIncomingCall(null);
          setActiveCall(null);
          cleanupCall();
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId, matchId, cleanupCall]);

  useEffect(() => {
    let t;
    if (activeCall?.status === 'answered') t = setInterval(() => setCallDuration((v) => v + 1), 1000);
    else setCallDuration(0);
    return () => clearInterval(t);
  }, [activeCall]);

  const openGoogleMaps = (addr) => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || '')}`).catch(() => {});
  const openUber = () => Linking.openURL('https://m.uber.com/ul/?action=setPickup').catch(() => {});

  // ---------- CALL ACTIONS ----------

  const handleStartCall = async (type) => {
    if (IS_WEB) { Alert.alert('Use mobile app', 'Calls work in the Intent mobile app (Expo dev build / TestFlight / Play), not the web preview.'); return; }
    const isVideo = type === 'video';
    const okPerm = await requestCallPermissions(isVideo);
    if (!okPerm) return;
    const mid = await ensureMatchId();
    if (!userIdRef.current || !otherUserIdRef.current || !mid) { Alert.alert('Call unavailable', 'Start a chat first — this profile is not yet a real match.'); return; }

    setIsMuted(false); setIsCameraOff(false); setIsConnecting(true);
    try {
      const wrtc = await getWebRTC();
      if (wrtc.RTCView) setRTCViewComp(() => wrtc.RTCView);

      // 1. Local mic/camera
      const stream = await wrtc.mediaDevices.getUserMedia({ audio: true, video: isVideo ? { facingMode: 'user' } : false });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Create ringing row
      await supabase.from('calls').update({ status: 'missed' }).eq('match_id', mid).eq('status', 'ringing');
      const { data: callRow, error: callErr } = await supabase.from('calls')
        .insert({ match_id: mid, caller_id: userIdRef.current, callee_id: otherUserIdRef.current, type, status: 'ringing' })
        .select().single();
      if (callErr || !callRow) throw new Error(callErr?.message || 'Could not create call');
      setActiveCall(callRow);

      // 3. Signaling channel + offer
      subscribeSignaling(callRow.id);
      // Wait a tick for channel to subscribe
      await new Promise((r) => setTimeout(r, 400));
      const pc = await createPeerConnection(callRow.id, isVideo);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await signalChannelRef.current?.send({ type: 'broadcast', event: 'offer', payload: { offer, from: userIdRef.current } });
      console.log('[P2P] Offer sent, waiting for answer...');
    } catch (e) {
      console.log('[P2P] Start call failed:', e?.message);
      Alert.alert('Call failed', e.message || 'Could not start call. Check mic/camera permissions + rebuild with react-native-webrtc.');
      setIsConnecting(false);
      await cleanupCall();
      setActiveCall(null);
    }
  };

  const handleAnswerCall = async () => {
    if (!incomingCall) return;
    if (IS_WEB) { Alert.alert('Use mobile app', 'Calls work in the Intent mobile app, not web preview.'); return; }
    const isVideo = incomingCall.type === 'video';
    const okPerm = await requestCallPermissions(isVideo);
    if (!okPerm) return;

    setIsConnecting(true);
    try {
      const wrtc = await getWebRTC();
      if (wrtc.RTCView) setRTCViewComp(() => wrtc.RTCView);

      const stream = await wrtc.mediaDevices.getUserMedia({ audio: true, video: isVideo ? { facingMode: 'user' } : false });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const { error } = await supabase.from('calls').update({ status: 'answered' }).eq('id', incomingCall.id);
      if (error) throw new Error(error.message);

      setActiveCall({ ...incomingCall, status: 'answered' });
      setIncomingCall(null);
      setCallDuration(0);

      subscribeSignaling(incomingCall.id);
      await new Promise((r) => setTimeout(r, 400));
      const pc = await createPeerConnection(incomingCall.id, isVideo);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new wrtc.RTCSessionDescription(pendingOfferRef.current));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await signalChannelRef.current?.send({ type: 'broadcast', event: 'answer', payload: { answer, from: userIdRef.current } });
        console.log('[P2P] Answer sent');
      } else {
        console.log('[P2P] No pending offer — caller may need to redial. Waiting...');
      }
    } catch (e) {
      console.log('[P2P] Answer failed:', e?.message);
      Alert.alert('Answer failed', e.message || 'Could not answer call.');
      setIsConnecting(false);
      await cleanupCall();
      setActiveCall(null);
    }
  };

  const handleDeclineCall = async () => {
    if (incomingCall) await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', incomingCall.id);
    await cleanupCall();
    setIncomingCall(null);
    setActiveCall(null);
  };

  const handleEndCall = async () => {
    const callRow = activeCall || incomingCall;
    const durationFormatted = formatTimer(callDuration);
    const callTypeTitle = (callRow?.type || activeCall?.type || 'audio') === 'video' ? 'Video Call' : 'Voice Call';
    if (callRow?.id) await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callRow.id);
    await cleanupCall();
    const mid = await ensureMatchId();
    if (mid && userIdRef.current) {
      const logText = `📞 ${callTypeTitle} Ended (${durationFormatted})`;
      await persistMessage(logText);
    }
    setMessages((prev) => [...prev, { id: Date.now().toString(), text: `📞 ${callTypeTitle} Ended (${durationFormatted})`, sender: 'me', isCallLog: true, time: 'Just now' }]);
    setActiveCall(null); setIncomingCall(null); setCallDuration(0);
  };

  const toggleMute = async () => {
    const next = !isMuted;
    setIsMuted(next);
    try { localStreamRef.current?.getAudioTracks()?.forEach((t) => { t.enabled = !next; }); } catch {}
  };

  const toggleCamera = async () => {
    const next = !isCameraOff;
    setIsCameraOff(next);
    try { localStreamRef.current?.getVideoTracks()?.forEach((t) => { t.enabled = !next; }); } catch {}
  };

  // ---------- MESSAGES (body only) ----------

  const persistMessage = async (text) => {
    const mid = await ensureMatchId();
    const uid = userIdRef.current;
    if (!mid || !uid) return false;
    const { data, error } = await supabase.from('messages')
      .insert({ match_id: mid, sender_id: uid, body: text })
      .select('id, match_id, sender_id, body, created_at')
      .single();
    if (error) {
      console.log('[ChatDetail] SEND FAILED:', error.message);
      Alert.alert('Message not sent', error.message);
      return false;
    }
    console.log('[ChatDetail] SEND OK — saved id:', data?.id, 'using column: body');
    setTimeout(() => refetchMessages(), 500);
    return true;
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText('');
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, text, sender: 'me', time: 'Just now' }]);
    setSending(true);
    try {
      const ok = await persistMessage(text);
      if (!ok) setMessages((prev) => prev.filter((x) => x.id !== optimisticId));
    } finally { setSending(false); }
  };

  const handleSendIcebreaker = async (icebreakerText) => {
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, text: icebreakerText, sender: 'me', time: 'Just now' }]);
    const ok = await persistMessage(icebreakerText);
    if (!ok) setMessages((prev) => prev.filter((x) => x.id !== optimisticId));
  };

  // ---------- DATES ----------

  const persistDateProposal = async ({ venueName, venueAddr, dateTimeInput }) => {
    const mid = matchIdRef.current || await ensureMatchId();
    const uid = userIdRef.current;
    const other = otherUserIdRef.current;
    if (!mid || !uid || !other) return { ok: false, error: 'No match found' };
    const attempts = [
      { match_id: mid, proposer_id: uid, invitee_id: other, venue_name: venueName, venue_address: venueAddr, proposed_time: dateTimeInput, status: 'proposed' },
      { match_id: mid, user_a: uid, user_b: other, venue_name: venueName, venue_address: venueAddr, proposed_time: dateTimeInput, status: 'proposed' },
      { match_id: mid, proposer_id: uid, invitee_id: other, venue: venueName, address: venueAddr, date_time: dateTimeInput, status: 'proposed' },
    ];
    for (const payload of attempts) {
      const { data, error } = await supabase.from('dates').insert(payload).select().single();
      if (!error) {
        console.log('[Dates] SAVE OK — id:', data?.id);
        return { ok: true, data };
      }
      console.log('[Dates] try failed:', error.message);
      if (!error.message.includes('Could not find') && !error.message.includes('column') && !error.message.includes('schema cache')) {
        return { ok: false, error: error.message };
      }
    }
    return { ok: false, error: 'dates table columns do not match any known schema — check Supabase dates columns' };
  };

  const handleProposeDate = async () => {
    setShowShowDateModal(false);
    const venueName = selectedVenue?.name || FALLBACK_VENUE.name;
    const venueAddr = selectedVenue?.address || FALLBACK_VENUE.address;
    const venuePerk = selectedVenue?.perk || '';
    const text = `📍 PROPOSED DATE: ${venueName} (${venueAddr})\n📅 ${dateTimeInput}\n${venuePerk}`;
    const res = await persistDateProposal({ venueName, venueAddr, dateTimeInput });
    if (!res.ok) {
      Alert.alert('Date not saved', res.error + '\n\nCheck Supabase → dates table columns + RLS.');
      return;
    }
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, text, sender: 'me', isProposal: true, time: 'Just now' }]);
    const ok = await persistMessage(text);
    if (!ok) setMessages((prev) => prev.filter((x) => x.id !== optimisticId));
    else Alert.alert('Date Proposed 📍', `${venueName} — ${dateTimeInput}\n\n${chat?.name || 'They'} will see it in chat.`);
  };

  const handleSubmitReport = async () => {
    setShowReportModal(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('customer_support').insert({
          user_id: user.id,
          user_email: user.email,
          ticket_type: 'complaint',
          subject: `Report: ${chat?.name || 'User'} — ${reportReason}`,
          message: `Reported ${chat?.name || ''} (ID: ${otherUserId || paramId}) for: ${reportReason}. From chat ${matchId || paramId}.`,
          status: 'under_review',
        });
      }
    } catch {}
    Alert.alert('Report Received 🛡️', `Thank you. Your report against ${chat?.name || 'this user'} has been submitted.`);
  };

  const filteredVenues = (RECOMMENDED_DATE_SPOTS || []).filter((v) => selectedVibeCategory === 'all' || v?.category === selectedVibeCategory);
  const isRingingOut = activeCall && activeCall.status === 'ringing' && !incomingCall;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#F97316" size="large" />
        <Text style={{ color: '#94A3B8', marginTop: 12 }}>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ActiveChats')} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#F8FAFC" /></TouchableOpacity>
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
        ref={listRef}
        data={messages || []}
        keyExtractor={(item) => String(item?.id || Math.random().toString())}
        contentContainerStyle={styles.msgList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👋</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySub}>You matched with {chat?.name || 'Vio'}. Say hi — send your first intentional message below.</Text>
          </View>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item?.sender === 'me';
          if (item?.isCallLog) return (<View style={styles.callLogCard}><Ionicons name="call" size={16} color="#FBBF24" /><Text style={styles.callLogText}>{item?.text || ''}</Text></View>);
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
        <TextInput style={styles.input} placeholder="Type intentional message..." placeholderTextColor="#64748B" value={inputText} onChangeText={setInputText} onSubmitEditing={handleSend} />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}><Ionicons name="send" size={18} color="#FFFFFF" /></TouchableOpacity>
      </View>

      {incomingCall && (
        <Modal visible transparent animationType="fade">
          <View style={styles.callOverlay}>
            <SafeAreaView style={styles.callContainer}>
              <View style={styles.callTopHeader}>
                <View style={styles.encryptionBadge}><Text style={styles.encryptionText}>{incomingCall.type === 'video' ? '📹 Video Call' : '📞 Voice Call'} • P2P</Text></View>
                <Text style={styles.callTimerText}>Incoming...</Text>
              </View>
              <View style={styles.audioCallBox}>
                <Image source={{ uri: chat?.avatar || FALLBACK_PHOTO }} style={styles.audioCallAvatar} />
                <Text style={styles.callPartnerName}>{chat?.name || 'Intent User'}</Text>
                <Text style={{ color: '#94A3B8', marginTop: 8 }}>{incomingCall.type === 'video' ? 'Video Call' : 'Voice Call'} • Tap Accept to answer</Text>
              </View>
              <View style={styles.callControlsRow}>
                <TouchableOpacity style={[styles.controlCircle, { backgroundColor: '#EF4444' }]} onPress={handleDeclineCall}><Ionicons name="call" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} /></TouchableOpacity>
                <TouchableOpacity style={[styles.controlCircle, { backgroundColor: '#22C55E' }]} onPress={handleAnswerCall}><Ionicons name="call" size={24} color="#FFFFFF" /></TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {activeCall && !incomingCall && (
        <Modal visible transparent animationType="fade">
          <View style={styles.callOverlay}>
            <SafeAreaView style={styles.callContainer}>
              <View style={styles.callTopHeader}>
                <View style={styles.encryptionBadge}><Text style={styles.encryptionText}>{remoteStream ? '🔒 P2P Encrypted • DTLS-SRTP' : 'Connecting P2P...'}</Text></View>
                <Text style={styles.callTimerText}>{isRingingOut ? 'Ringing...' : formatTimer(callDuration)}</Text>
                {isRingingOut && <Text style={{ color: '#94A3B8', marginTop: 6 }}>Waiting for {chat?.name} to answer...</Text>}
                {isConnecting && !isRingingOut && <Text style={{ color: '#94A3B8', marginTop: 6 }}>Connecting directly phone-to-phone...</Text>}
              </View>
              {activeCall.type === 'video' ? (
                <View style={styles.videoFeedBox}>
                  {remoteStream && RTCViewComp ? (
                    <RTCViewComp streamURL={remoteStream.toURL()} style={{ flex: 1 }} objectFit="cover" />
                  ) : (
                    <View style={styles.cameraOffPlaceholder}>
                      <Text style={{ color: '#94A3B8' }}>{isConnecting ? 'Connecting peer-to-peer...' : 'Waiting for video...'}</Text>
                    </View>
                  )}
                  {localStream && RTCViewComp && (
                    <RTCViewComp streamURL={localStream.toURL()} style={{ position: 'absolute', width: 100, height: 140, bottom: 12, right: 12, borderRadius: 12 }} objectFit="cover" />
                  )}
                </View>
              ) : (
                <View style={styles.audioCallBox}>
                  <Image source={{ uri: chat?.avatar || FALLBACK_PHOTO }} style={styles.audioCallAvatar} />
                  <Text style={styles.callPartnerName}>{chat?.name || 'Intent User'}</Text>
                  <Text style={{ color: '#94A3B8', marginTop: 8 }}>{remoteStream ? '🔒 P2P Encrypted • Connected' : isRingingOut ? 'Ringing...' : 'Connecting...'}</Text>
                </View>
              )}
              <View style={styles.callControlsRow}>
                <TouchableOpacity style={[styles.controlCircle, isMuted && styles.controlCircleActive]} onPress={toggleMute}><Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFFFFF" /></TouchableOpacity>
                {activeCall.type === 'video' && (
                  <TouchableOpacity style={[styles.controlCircle, isCameraOff && styles.controlCircleActive]} onPress={toggleCamera}><Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color="#FFFFFF" /></TouchableOpacity>
                )}
                <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}><Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} /></TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      <Modal visible={showDateModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <SafeAreaView style={styles.dateModalCard}>
            <View style={styles.recommenderHeader}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="location" size={20} color="#FBBF24" /><Text style={styles.modalTitle}>Date Venue & Vibe Recommender</Text></View><TouchableOpacity onPress={() => setShowShowDateModal(false)} style={{ padding: 4 }}><Ionicons name="close" size={20} color="#94A3B8" /></TouchableOpacity></View>
            <Text style={styles.modalSub}>Pick a top-rated date spot and time to invite {chat?.name || 'them'}.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vibeChipsRow}>
              {['all', 'coffee', 'dining', 'art', 'parks'].map((c) => (
                <TouchableOpacity key={c} style={[styles.vibeChip, selectedVibeCategory === c && styles.vibeChipActive]} onPress={() => setSelectedVibeCategory(c)}><Text style={[styles.vibeChipText, selectedVibeCategory === c && styles.vibeChipTextActive]}>{c === 'all' ? '✨ All Vibes' : c === 'coffee' ? '☕ Coffee & Tea' : c === 'dining' ? '🍷 Fine Dining' : c === 'art' ? '🎨 Art Galleries' : '🌳 Parks & Walks'}</Text></TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator>
              {(filteredVenues || []).map((spot) => {
                const isSelected = selectedVenue?.id === spot?.id;
                return (
                  <View key={spot?.id} style={[styles.spotCard, isSelected && styles.spotCardSelected]}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelectedVenue(spot)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={styles.spotName}>{spot?.name || ''}</Text><Text style={styles.spotRating}>⭐ {spot?.rating || ''}</Text></View>
                      <Text style={styles.spotAddress}>📍 {spot?.address || ''}</Text>
                      <Text style={styles.spotPerk}>{spot?.perk || ''}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mapsBtn} onPress={() => openGoogleMaps(spot?.address)}><Ionicons name="navigate-outline" size={16} color="#FBBF24" /></TouchableOpacity>
                  </View>
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
  videoFeedBox: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1E293B', marginVertical: 20, position: 'relative' },
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