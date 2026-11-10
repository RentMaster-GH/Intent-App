import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTimer } from '../hooks/useP2PCall';

export default function CallOverlay({ call, chat, avatarUri }) {
  const { activeCall, incomingCall, isRingingOut, isConnecting, callDuration, remoteStream, localStream, RTCViewComp, isMuted, isCameraOff } = call;

  if (incomingCall) {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.container}>
            <View style={styles.top}><View style={styles.badge}><Text style={styles.badgeText}>{incomingCall.type === 'video' ? '📹 Video Call' : '📞 Voice Call'} • P2P</Text></View><Text style={styles.timer}>Incoming...</Text></View>
            <View style={styles.audioBox}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              <Text style={styles.name}>{chat?.name || 'Intent User'}</Text>
              <Text style={styles.sub}>{incomingCall.type === 'video' ? 'Video Call' : 'Voice Call'} • Tap Accept to answer</Text>
            </View>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.circle, { backgroundColor: '#EF4444' }]} onPress={call.handleDeclineCall}><Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} /></TouchableOpacity>
              <TouchableOpacity style={[styles.circle, { backgroundColor: '#22C55E' }]} onPress={call.handleAnswerCall}><Ionicons name="call" size={24} color="#FFF" /></TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  if (!activeCall) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.top}>
            <View style={styles.badge}><Text style={styles.badgeText}>{remoteStream ? '🔒 P2P Encrypted • DTLS-SRTP' : 'Connecting P2P...'}</Text></View>
            <Text style={styles.timer}>{isRingingOut ? 'Ringing...' : formatTimer(callDuration)}</Text>
            {isRingingOut && <Text style={styles.sub}>Waiting for {chat?.name} to answer...</Text>}
            {isConnecting && !isRingingOut && <Text style={styles.sub}>Connecting directly phone-to-phone...</Text>}
          </View>
          {activeCall.type === 'video' ? (
            <View style={styles.videoBox}>
              {remoteStream && RTCViewComp ? <RTCViewComp streamURL={remoteStream?.toURL?.()} style={{ flex: 1 }} objectFit="cover" /> : <View style={styles.center}><Text style={styles.sub}>{isConnecting ? 'Connecting peer-to-peer...' : 'Waiting for video...'}</Text></View>}
              {localStream && RTCViewComp && <RTCViewComp streamURL={localStream?.toURL?.()} style={styles.selfView} objectFit="cover" />}
            </View>
          ) : (
            <View style={styles.audioBox}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              <Text style={styles.name}>{chat?.name || 'Intent User'}</Text>
              <Text style={styles.sub}>{remoteStream ? '🔒 P2P Encrypted • Connected' : isRingingOut ? 'Ringing...' : 'Connecting...'}</Text>
            </View>
          )}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.circle, isMuted && styles.active]} onPress={call.toggleMute}><Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFF" /></TouchableOpacity>
            {activeCall.type === 'video' && <TouchableOpacity style={[styles.circle, isCameraOff && styles.active]} onPress={call.toggleCamera}><Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color="#FFF" /></TouchableOpacity>}
            <TouchableOpacity style={styles.endBtn} onPress={call.handleEndCall}><Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} /></TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#090D16' },
  container: { flex: 1, justifyContent: 'space-between', padding: 24 },
  top: { alignItems: 'center', marginTop: 10 },
  badge: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  badgeText: { color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  timer: { color: '#F8FAFC', fontSize: 28, fontWeight: '900', marginTop: 12, letterSpacing: 2 },
  sub: { color: '#94A3B8', marginTop: 6, textAlign: 'center' },
  audioBox: { alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 16 },
  name: { fontSize: 26, fontWeight: '800', color: '#F8FAFC' },
  videoBox: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1E293B', marginVertical: 20, position: 'relative' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  selfView: { position: 'absolute', width: 100, height: 140, bottom: 12, right: 12, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', marginBottom: 20 },
  circle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  active: { backgroundColor: '#EF4444' },
  endBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
});