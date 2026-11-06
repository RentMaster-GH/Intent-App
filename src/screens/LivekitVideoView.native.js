import React from 'react';
import { Track } from 'livekit-client';
import { useTracks } from '@livekit/react-native';
import { RTCView } from '@livekit/react-native-webrtc';

export default function LivekitVideoView({ room }) {
  const tracks = useTracks([Track.Source.Camera]);
  const remote = tracks.find((t) => t.participant.identity !== room.localParticipant.identity);
  const local = tracks.find((t) => t.participant.identity === room.localParticipant.identity);
  const trackRef = remote || local;
  const stream = trackRef?.publication?.track?.mediaStream;
  if (!stream) return null;
  const streamURL = typeof stream.toURL === 'function' ? stream.toURL() : stream;
  return <RTCView streamURL={streamURL} style={{ width: '100%', height: '100%' }} objectFit="cover" mirror={trackRef.participant.identity === room.localParticipant.identity} />;
}