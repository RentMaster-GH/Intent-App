import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PhotoViewer from './PhotoViewer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = 520;

export default function ProfileCard({ profile, onLike, onPass }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  // Up to 6 photos. Fallback: photos[] -> img -> avatar_url -> photo_url
  const photos = useMemo(() => {
    if (!profile) return [];
    const raw =
      (Array.isArray(profile.photos) && profile.photos.length > 0 && profile.photos) ||
      [profile.img, profile.avatar_url, profile.photo_url];
    return raw.filter(Boolean).slice(0, 6);
  }, [profile]);

  // Reset to 1/6 when a new person is shown
  useEffect(() => {
    setPhotoIndex(0);
    setViewerVisible(false);
  }, [profile?.id]);

  const nextPhoto = () => setPhotoIndex((i) => Math.min(i + 1, photos.length - 1));
  const prevPhoto = () => setPhotoIndex((i) => Math.max(i - 1, 0));
  const openZoom = () => setViewerVisible(true);

  if (!profile || photos.length === 0) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <Text style={styles.emptyText}>No photos yet</Text>
        <Text style={styles.emptySub}>{profile?.name || 'This person'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.photoArea}>
        <Image source={{ uri: photos[photoIndex] }} style={styles.photo} resizeMode="contain" />

        {/* Tap zones - BEHIND buttons, zIndex 1 */}
        <View style={styles.tapRow} pointerEvents="box-none">
          <TouchableOpacity style={styles.tapZone} onPress={prevPhoto} activeOpacity={1} />
          <TouchableOpacity style={styles.tapZone} onPress={openZoom} activeOpacity={1} />
          <TouchableOpacity style={styles.tapZone} onPress={nextPhoto} activeOpacity={1} />
        </View>

        {/* Progress bars - tappable, ON TOP */}
        <View style={styles.progressRow}>
          {photos.map((_, i) => (
            <TouchableOpacity key={i} style={styles.progressHit} onPress={() => setPhotoIndex(i)} activeOpacity={0.7}>
              <View style={[styles.progressBar, i === photoIndex && styles.progressBarActive, i < photoIndex && styles.progressBarSeen]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Count badge */}
        <View style={styles.countBadge}>
          <Ionicons name="images-outline" size={14} color="#FFF" />
          <Text style={styles.countText}>{photoIndex + 1} / {photos.length}</Text>
        </View>

        {/* Prev / Next arrows */}
        {photoIndex > 0 && (
          <TouchableOpacity style={[styles.arrowBtn, styles.arrowLeft]} onPress={prevPhoto} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
        )}
        {photoIndex < photos.length - 1 && (
          <TouchableOpacity style={[styles.arrowBtn, styles.arrowRight]} onPress={nextPhoto} hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* TAP TO ZOOM - solid orange, zIndex 10, cannot be blocked */}
        <TouchableOpacity style={styles.zoomBtn} onPress={openZoom} activeOpacity={0.8} hitSlop={6}>
          <Ionicons name="expand-outline" size={18} color="#FFF" />
          <Text style={styles.zoomText}>Tap to zoom</Text>
        </TouchableOpacity>

        {/* Info overlay */}
        <View style={styles.infoOverlay} pointerEvents="none">
          <Text style={styles.name}>{profile.name}{profile.age ? `, ${profile.age}` : ''} ✓</Text>
          {profile.intent ? <Text style={styles.intent}>{profile.intent}</Text> : null}
          {profile.bio ? <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text> : null}
          <Text style={styles.location}>📍 {profile.location || 'Ghana'} • {photos.length} photo{photos.length === 1 ? '' : 's'}</Text>
          <Text style={styles.hint}>Tap left / right for photos • Tap middle to zoom</Text>
        </View>
      </View>

      <PhotoViewer
        visible={viewerVisible}
        photos={photos}
        index={photoIndex}
        onClose={() => setViewerVisible(false)}
        onChangeIndex={setPhotoIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: '#000', borderRadius: 20, overflow: 'hidden', alignSelf: 'center' },
  photoArea: { width: CARD_WIDTH, height: CARD_HEIGHT, position: 'relative', backgroundColor: '#000' },
  photo: { width: '100%', height: '100%', backgroundColor: '#000' },
  tapRow: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', zIndex: 1 },
  tapZone: { flex: 1 },
  progressRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 5, zIndex: 10, elevation: 10 },
  progressHit: { flex: 1, justifyContent: 'center', paddingVertical: 4 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  progressBarActive: { backgroundColor: '#FFF' },
  progressBarSeen: { backgroundColor: 'rgba(255,255,255,0.8)' },
  countBadge: { position: 'absolute', top: 24, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, zIndex: 10, elevation: 10 },
  countText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  arrowBtn: { position: 'absolute', top: '45%', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', zIndex: 10, elevation: 10 },
  arrowLeft: { left: 10 },
  arrowRight: { right: 10 },
  zoomBtn: { position: 'absolute', bottom: 118, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F97316', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, zIndex: 10, elevation: 10 },
  zoomText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  infoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingTop: 48, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 5 },
  name: { color: '#FFF', fontSize: 24, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  intent: { color: '#FBBF24', fontSize: 13, fontWeight: '700', marginTop: 4 },
  bio: { color: '#E2E8F0', fontSize: 14, marginTop: 4, lineHeight: 19 },
  location: { color: '#CBD5E1', fontSize: 12, marginTop: 4 },
  hint: { color: '#94A3B8', fontSize: 11, marginTop: 6 },
  emptyCard: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E293B' },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#94A3B8', marginTop: 6 },
});