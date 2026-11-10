import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getAgeCategory } from '../utils/ageGroups';

const INTENT_OPTIONS = [
  'Long-term Relationship 💍',
  'Casual Dating / Seeing where it goes ☕',
  'Activity & Event Buddy 🎟️',
  'Strictly Dates, No Texting Forever 🥂',
];

export default function ProfileSetupScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [selectedIntent, setSelectedIntent] = useState('');
  const [photos, setPhotos] = useState([]); // <-- ARRAY of up to 6 urls
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-detect Age Category
  const userAgeCategory = getAgeCategory(age);

  // --- PICK + UPLOAD A PHOTO ---
  const pickImage = async () => {
    if (photos.length >= 6) {
      Alert.alert('Max 6 photos', 'Delete one to add another.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled) return;

    const localUri = result.assets[0].uri;
    setUploading(true);
    try {
      // Upload to Supabase Storage bucket "photos" (create it if you haven't)
      const fileExt = localUri.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const response = await fetch(localUri);
      const blob = await response.blob();
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      setPhotos((prev) => [...prev, publicUrl]);
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (indexToDelete) => {
    Alert.alert('Remove photo?', 'Delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setPhotos(photos.filter((_, i) => i !== indexToDelete)) },
    ]);
  };

  const handleFinish = async () => {
    if (!fullName || !age || !selectedIntent || !userAgeCategory) return;
    if (photos.length === 0) {
      Alert.alert('Add at least 1 photo', 'Potential matches need to see you. Add at least 1 photo (up to 6).');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: fullName.trim(),
      full_name: fullName.trim(),
      age: parseInt(age, 10),
      age_category: userAgeCategory.badge,
      bio: bio.trim(),
      intent: selectedIntent,
      photos: photos, // <-- all 6 photos
      avatar_url: photos[0], // <-- first photo = main photo
      updated_at: new Date().toISOString(),
    });

      if (error) throw error;
      navigation.navigate('Discovery');
    } catch (e) {
      Alert.alert('Could not save profile', e.message);
    } finally {
      setSaving(false);
    }
  };

  const canFinish = fullName && age && selectedIntent && userAgeCategory && photos.length > 0 && !saving;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Create Your Profile</Text>
        <Text style={styles.subTitle}>Be clear about who you are and what you want.</Text>

        {/* Name & Age Input */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 2, marginRight: 10 }]}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Sarah"
              placeholderTextColor="#64748B"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Age (18-100)</Text>
            <TextInput
              style={styles.input}
              placeholder="26"
              placeholderTextColor="#64748B"
              keyboardType="number-pad"
              maxLength={3}
              value={age}
              onChangeText={setAge}
            />
          </View>
        </View>

        {/* AUTO-ASSIGNED AGE CATEGORY BADGE */}
        {userAgeCategory && (
          <View style={styles.categoryBadgeContainer}>
            <Text style={styles.categoryBadgeLabel}>Assigned Age Category:</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{userAgeCategory.badge}</Text>
            </View>
          </View>
        )}

        {/* --- NEW: 6 PHOTOS --- */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Photos ({photos.length}/6)</Text>
          <Text style={styles.photoHint}>Add up to 6. First photo is your main photo. Matches can tap to zoom.</Text>
          <View style={styles.photoGrid}>
            {[...Array(6)].map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.photoSlot, photos[i] && styles.photoSlotFilled]}
                onPress={() => (photos[i] ? removePhoto(i) : pickImage())}
                disabled={uploading}
              >
                {photos[i] ? (
                  <>
                    <Image source={{ uri: photos[i] }} style={styles.photoImage} />
                    <View style={styles.photoBadge}>
                      <Text style={styles.photoBadgeText}>{i === 0 ? 'MAIN' : `${i + 1}`}</Text>
                    </View>
                    <View style={styles.deleteBadge}><Text style={styles.deleteText}>✕</Text></View>
                  </>
                ) : (
                  <View style={styles.addPhotoInner}>
                    <Text style={styles.addPhotoPlus}>+</Text>
                    <Text style={styles.addPhotoText}>{i === 0 ? 'Add main photo' : `Add photo ${i + 1}`}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          {uploading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>Uploading photo...</Text>
            </View>
          )}
          {photos.length > 0 && <Text style={styles.photoCount}>Tap a photo to delete it • Tap + to add</Text>}
        </View>

        {/* Intent Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>My Primary Intent</Text>
          {INTENT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.intentChip,
                selectedIntent === option && styles.selectedIntentChip,
              ]}
              onPress={() => setSelectedIntent(option)}
            >
              <Text
                style={[
                  styles.intentText,
                  selectedIntent === option && styles.selectedIntentText,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bio Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Short Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="What makes a great first date for you?"
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={3}
            value={bio}
            onChangeText={setBio}
          />
        </View>

        {/* Finish Button */}
        <TouchableOpacity
          style={[styles.button, !canFinish && styles.buttonDisabled]}
          disabled={!canFinish}
          onPress={handleFinish}
        >
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Complete Profile</Text>}
        </TouchableOpacity>
        {photos.length === 0 && <Text style={styles.requirePhoto}>* Add at least 1 photo to continue</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subTitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
  },
  categoryBadgeContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryBadgeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: '#312E81',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  categoryBadgeText: {
    color: '#E0E7FF',
    fontSize: 13,
    fontWeight: '700',
  },
  bioInput: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  intentChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  selectedIntentChip: {
    backgroundColor: '#312E81',
    borderColor: '#6366F1',
  },
  intentText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedIntentText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#6366F1',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#312E81',
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // --- NEW PHOTO STYLES ---
  photoHint: { fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 17 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoSlot: {
    width: '31%',
    aspectRatio: 3 / 4,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoSlotFilled: { borderStyle: 'solid', borderColor: '#6366F1' },
  photoImage: { width: '100%', height: '100%' },
  photoBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#6366F1', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  photoBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  deleteBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  deleteText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  addPhotoInner: { alignItems: 'center', padding: 6 },
  addPhotoPlus: { fontSize: 28, color: '#6366F1', fontWeight: '300' },
  addPhotoText: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  photoCount: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
  requirePhoto: { color: '#F87171', fontSize: 12, textAlign: 'center', marginTop: 10 },
});