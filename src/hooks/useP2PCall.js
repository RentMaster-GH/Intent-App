import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const IS_WEB = Platform.OS === 'web';

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: [
      'turn:global.turn.metered.ca:80',
      'turn:global.turn.metered.ca:80?transport=tcp',
      'turns:global.turn.metered.ca:443?transport=tcp',
    ],
    username: 'a4c2c35204beeb3c11a57ab6',
    credential: 'CLbp4Y73gh5PW0oT',
  },
];

let cachedWebRTC = null;
const getWebRTC = async () => {
  if (cachedWebRTC) return cachedWebRTC;
  if (Platform.OS === 'web') {
    cachedWebRTC = {
      RTCPeerConnection: window?.RTCPeerConnection,
      RTCSessionDescription: window?.RTCSessionDescription,
      RTCIceCandidate: window?.RTCIceCandidate,
      mediaDevices: navigator?.mediaDevices,
      RTCView: null,
    };
    return cachedWebRTC;
  }
  const mod = await import('@livekit/react-native-webrtc');
  cachedWebRTC = {
    RTCPeerConnection: mod?.RTCPeerConnection || mod?.default?.RTCPeerConnection,
    RTCSessionDescription: mod?.RTCSessionDescription || mod?.default?.RTCSessionDescription,
    RTCIceCandidate: mod?.RTCIceCandidate || mod?.default?.RTCIceCandidate,
    mediaDevices: mod?.mediaDevices || mod?.default?.mediaDevices,
    RTCView: mod?.RTCView || mod?.default?.RTCView || null,
  };
  return cachedWebRTC;
};

const startAudioMode = async (isVideo) => {
  try {
    const m = await import('react-native-incall-manager');
    const ICM = m?.default || m;
    ICM?.start?.({ media: isVideo ? 'video' : 'audio' });
    ICM?.setSpeakerphoneOn?.(true);
    ICM?.setForceSpeakerphoneOn?.(true);
  } catch {}
};
const stopAudioMode = async () => {
  try {
    const m = await import('react-native-incall-manager');
    (m?.default || m)?.stop?.();
  } catch {}
};

export const formatTimer = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function useP2PCall({ matchId, userId, userIdRef, otherUserIdRef, ensureMatchId, onCallEnded }) {
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [RTCViewComp, setRTCViewComp] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const signalChannelRef = useRef(null);
  const mountedRef = useRef(true);
  // FIX: guards against double-tap / double-start (video getUserMedia is slow)
  const answeringRef = useRef(false);
  const startingRef = useRef(false);
  const answeredOfferRef = useRef(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { try { localStreamRef.current?.getAudioTracks?.()?.forEach(t => { t.enabled = !isMuted; }); } catch {} }, [isMuted]);
  useEffect(() => { try { localStreamRef.current?.getVideoTracks?.()?.forEach(t => { t.enabled = !isCameraOff; }); } catch {} }, [isCameraOff]);

  const cleanupCall = useCallback(async () => {
    try { if (signalChannelRef.current) await supabase.removeChannel(signalChannelRef.current); } catch {}
    signalChannelRef.current = null;
    try { await pcRef.current?.close?.(); } catch {}
    pcRef.current = null;
    try { localStreamRef.current?.getTracks?.()?.forEach(t => { try { t?.stop?.(); } catch {} }); } catch {}
    localStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    answeringRef.current = false;
    startingRef.current = false;
    answeredOfferRef.current = null;
    await stopAudioMode();
    if (mountedRef.current) { setLocalStream(null); setRemoteStream(null); setIsConnecting(false); setIsMuted(false); setIsCameraOff(false); }
  }, []);

  useEffect(() => () => { cleanupCall(); }, [cleanupCall]);

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pendingCandidatesRef.current.length) return;
    const wrtc = await getWebRTC();
    const q = [...pendingCandidatesRef.current]; pendingCandidatesRef.current = [];
    for (const c of q) { try { await pc.addIceCandidate(new wrtc.RTCIceCandidate(c)); } catch {} }
  }, []);

  const createPeerConnection = useCallback(async (callId) => {
    // FIX: if a PC already exists for this call, reuse it instead of creating pc 0 + pc 1
    if (pcRef.current) return pcRef.current;
    const wrtc = await getWebRTC();
    if (wrtc?.RTCView && !RTCViewComp) setRTCViewComp(() => wrtc.RTCView);
    const pc = new wrtc.RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.onicecandidate = async (e) => {
      if (e?.candidate && signalChannelRef.current) {
        try { await signalChannelRef.current.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: e.candidate, from: userIdRef.current } }); } catch {}
      }
    };
    pc.ontrack = (e) => {
      const track = e?.track; const stream = e?.streams?.[0];
      if (!track || !stream) return;
      console.log('[P2P] Remote track:', track.kind, track.enabled);
      try { if (track.kind === 'audio') track.enabled = true; } catch {}
      setRemoteStream((prev) => {
        if (prev) {
          if (!prev.getTracks().find(x => x.id === track.id)) { try { prev.addTrack(track); } catch {} }
          return prev;
        }
        return stream;
      });
      setIsConnecting(false);
    };
    pc.onconnectionstatechange = () => {
      console.log('[P2P] connectionState:', pc?.connectionState);
      if (pc?.connectionState === 'connected') setIsConnecting(false);
    };
    return pc;
  }, [RTCViewComp]);

  const subscribeSignaling = useCallback((callId) => {
    if (!callId || signalChannelRef.current) return signalChannelRef.current;
    const ch = supabase.channel(`call-signal-${callId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (!payload || payload.from === userIdRef.current) return;
        const pc = pcRef.current;
        // FIX: ignore duplicate / re-sent offers after we already answered.
        // This was the "re-offer error: cannot create an answer in a state other than have-remote-offer"
        if (pc?.remoteDescription && pc?.signalingState === 'stable') return;
        if (answeredOfferRef.current && JSON.stringify(payload.offer) === answeredOfferRef.current) return;
        pendingOfferRef.current = payload.offer;
        if (pc && payload.offer) {
          try {
            const wrtc = await getWebRTC();
            await pc.setRemoteDescription(new wrtc.RTCSessionDescription(payload.offer));
            await flushPendingCandidates();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            answeredOfferRef.current = JSON.stringify(payload.offer);
            pendingOfferRef.current = null;
            await signalChannelRef.current?.send?.({ type: 'broadcast', event: 'answer', payload: { answer, from: userIdRef.current } });
          } catch (e) { console.log('[P2P] re-offer error:', e?.message); }
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!payload || payload.from === userIdRef.current) return;
        if (pcRef.current && payload.answer) {
          try {
            const wrtc = await getWebRTC();
            // FIX: caller should only set remote answer once
            if (pcRef.current.signalingState !== 'have-local-offer') return;
            await pcRef.current.setRemoteDescription(new wrtc.RTCSessionDescription(payload.answer));
            await flushPendingCandidates();
          } catch {}
        }
      })
      .on('broadcast', { event: 'need-offer' }, async ({ payload }) => {
        if (!payload || payload.from === userIdRef.current) return;
        const pc = pcRef.current;
        if (pc?.localDescription) {
          try { await signalChannelRef.current?.send?.({ type: 'broadcast', event: 'offer', payload: { offer: pc.localDescription, from: userIdRef.current } }); } catch {}
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (!payload || payload.from === userIdRef.current) return;
        if (pcRef.current && payload.candidate) {
          try {
            const wrtc = await getWebRTC();
            if (!pcRef.current.remoteDescription) pendingCandidatesRef.current.push(payload.candidate);
            else await pcRef.current.addIceCandidate(new wrtc.RTCIceCandidate(payload.candidate));
          } catch {}
        }
      })
      .subscribe((s) => console.log('[P2P] signal:', s));
    signalChannelRef.current = ch;
    return ch;
  }, [flushPendingCandidates]);

  // Calls table realtime - ringing / answered / ended
  useEffect(() => {
    if (!userId || !matchId) return;
    const ch = supabase.channel(`calls-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `match_id=eq.${matchId}` }, (p) => {
        const row = p?.new;
        if (row?.callee_id === userId && row?.status === 'ringing') setIncomingCall(row);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `match_id=eq.${matchId}` }, (p) => {
        const row = p?.new;
        if (row?.status === 'answered') {
          setActiveCall((prev) => prev ? { ...prev, status: 'answered' } : { ...row, status: 'answered' });
          setIsConnecting(false);
          return;
        }
        if (row && ['declined', 'ended', 'missed'].includes(row.status)) { setIncomingCall(null); setActiveCall(null); cleanupCall(); }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [userId, matchId, cleanupCall]);

  useEffect(() => {
    let t;
    if (activeCall?.status === 'answered') t = setInterval(() => setCallDuration(v => v + 1), 1000);
    else setCallDuration(0);
    return () => clearInterval(t);
  }, [activeCall]);

  const requestPerms = async () => {
    if (IS_WEB) return false;
    try {
      const { AudioModule } = await import('expo-audio');
      const mic = await AudioModule.requestRecordingPermissionsAsync();
      if (mic?.status !== 'granted') { Alert.alert('Microphone needed', 'Allow microphone access to make calls.'); return false; }
      return true;
    } catch { return true; }
  };

  const getStream = async (isVideo) => {
    const wrtc = await getWebRTC();
    if (wrtc?.RTCView) setRTCViewComp(() => wrtc.RTCView);
    await startAudioMode(isVideo);
    const stream = await wrtc.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: isVideo ? { facingMode: 'user' } : false,
    });
    stream.getAudioTracks().forEach(t => { try { t.enabled = true; } catch {} });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return { wrtc, stream };
  };

  const handleStartCall = async (type) => {
    if (IS_WEB) { Alert.alert('Use mobile app', 'Calls work in the Intent mobile app, not web preview.'); return; }
    // FIX: block double-tap on call button too
    if (startingRef.current) return;
    startingRef.current = true;
    const isVideo = type === 'video';
    if (!(await requestPerms())) { startingRef.current = false; return; }
    const mid = await ensureMatchId();
    if (!userIdRef.current || !otherUserIdRef.current || !mid) { Alert.alert('Call unavailable', 'Start a chat first.'); startingRef.current = false; return; }
    setIsMuted(false); setIsCameraOff(false); setIsConnecting(true);
    try {
      const { stream } = await getStream(isVideo);
      await supabase.from('calls').update({ status: 'missed' }).eq('match_id', mid).eq('status', 'ringing');
      const { data: callRow, error } = await supabase.from('calls').insert({ match_id: mid, caller_id: userIdRef.current, callee_id: otherUserIdRef.current, type, status: 'ringing' }).select().single();
      if (error || !callRow) throw new Error(error?.message || 'Could not create call');
      setActiveCall(callRow);
      subscribeSignaling(callRow.id);
      await new Promise(r => setTimeout(r, 400));
      const pc = await createPeerConnection(callRow.id);
      stream.getTracks().forEach(t => { try { pc?.addTrack?.(t, stream); } catch {} });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await signalChannelRef.current?.send?.({ type: 'broadcast', event: 'offer', payload: { offer, from: userIdRef.current } });
    } catch (e) {
      Alert.alert('Call failed', e.message || 'Could not start call.');
      setIsConnecting(false); await cleanupCall(); setActiveCall(null);
    } finally {
      startingRef.current = false;
    }
  };

  const handleAnswerCall = async () => {
    if (!incomingCall) return;
    // FIX: THE MAIN BUG — block 2nd tap while camera is still opening (video is slow)
    if (answeringRef.current) return;
    answeringRef.current = true;
    const isVideo = incomingCall.type === 'video';
    if (!(await requestPerms())) { answeringRef.current = false; return; }
    setIsConnecting(true);
    try {
      const { wrtc, stream } = await getStream(isVideo);
      const { error } = await supabase.from('calls').update({ status: 'answered' }).eq('id', incomingCall.id);
      if (error) throw new Error(error.message);
      const answeredCall = { ...incomingCall, status: 'answered' };
      setActiveCall(answeredCall);
      setIncomingCall(null); setCallDuration(0);
      subscribeSignaling(incomingCall.id);
      await new Promise(r => setTimeout(r, 400));
      const pc = await createPeerConnection(incomingCall.id);
      stream.getTracks().forEach(t => { try { pc?.addTrack?.(t, stream); } catch {} });
      if (pendingOfferRef.current) {
        const offerToAnswer = pendingOfferRef.current;
        await pc.setRemoteDescription(new wrtc.RTCSessionDescription(offerToAnswer));
        await flushPendingCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        answeredOfferRef.current = JSON.stringify(offerToAnswer);
        pendingOfferRef.current = null;
        await signalChannelRef.current?.send?.({ type: 'broadcast', event: 'answer', payload: { answer, from: userIdRef.current } });
      } else {
        await signalChannelRef.current?.send?.({ type: 'broadcast', event: 'need-offer', payload: { from: userIdRef.current } });
        setTimeout(async () => {
          if (!pcRef.current?.remoteDescription) await signalChannelRef.current?.send?.({ type: 'broadcast', event: 'need-offer', payload: { from: userIdRef.current } });
        }, 1500);
      }
    } catch (e) {
      Alert.alert('Answer failed', e.message || 'Could not answer call.');
      setIsConnecting(false); await cleanupCall(); setActiveCall(null);
    } finally {
      answeringRef.current = false;
    }
  };

  const handleDeclineCall = async () => {
    try { if (incomingCall) await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', incomingCall.id); } catch {}
    await cleanupCall(); setIncomingCall(null); setActiveCall(null);
  };

  const handleEndCall = async () => {
    const callRow = activeCall || incomingCall;
    const dur = formatTimer(callDuration);
    const title = (callRow?.type || 'audio') === 'video' ? 'Video Call' : 'Voice Call';
    try { if (callRow?.id) await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callRow.id); } catch {}
    await cleanupCall();
    onCallEnded?.(`📞 ${title} Ended (${dur})`);
    setActiveCall(null); setIncomingCall(null); setCallDuration(0);
  };

  const toggleMute = () => {
    const next = !isMuted; setIsMuted(next);
    try { localStreamRef.current?.getAudioTracks?.()?.forEach(t => { t.enabled = !next; }); } catch {}
  };
  const toggleCamera = () => {
    const next = !isCameraOff; setIsCameraOff(next);
    try { localStreamRef.current?.getVideoTracks?.()?.forEach(t => { t.enabled = !next; }); } catch {}
  };

  return {
    activeCall, incomingCall, callDuration, isMuted, isCameraOff, isConnecting,
    localStream, remoteStream, RTCViewComp,
    isRingingOut: activeCall && activeCall.status === 'ringing' && !incomingCall,
    handleStartCall, handleAnswerCall, handleDeclineCall, handleEndCall, toggleMute, toggleCamera,
  };
}