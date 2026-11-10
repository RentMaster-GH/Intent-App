import React, { useState, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions, FlatList, Image } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function ZoomableImage({ url }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 4));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.page}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.zoomWrap, animatedStyle]}>
          <Image source={{ uri: url }} style={styles.fullImage} resizeMode="contain" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function PhotoViewer({ visible, photos = [], index = 0, onClose, onChangeIndex }) {
  const [current, setCurrent] = useState(index);
  const listRef = useRef(null);

  // When ProfileCard opens at photo 3, start viewer at photo 3
  React.useEffect(() => {
    if (visible) {
      setCurrent(index);
      setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 50);
    }
  }, [visible, index]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.counter}>{current + 1} / {photos.length}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrent(i);
            onChangeIndex?.(i);
          }}
          renderItem={({ item }) => <ZoomableImage url={item} />}
        />

        <Text style={styles.hint}>Pinch to zoom in / out • Double-tap to zoom • Swipe to see next photo</Text>
        <TouchableOpacity style={styles.closeBar} onPress={onClose}>
          <Text style={styles.closeBarText}>✕ Close</Text>
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18 },
  counter: { color: '#FFF', fontSize: 15, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, overflow: 'hidden' },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  page: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  zoomWrap: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.78, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%' },
  hint: { position: 'absolute', bottom: 78, alignSelf: 'center', color: '#94A3B8', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 },
  closeBar: { position: 'absolute', bottom: 28, alignSelf: 'center', backgroundColor: '#F97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  closeBarText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});