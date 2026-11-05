import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAgeCategory } from '../utils/ageGroups';
import { supabase } from '../lib/supabase';

const GENDER_OPTIONS = ['Woman', 'Man', 'Non-Binary'];
const SEEKING_OPTIONS = ['Women', 'Men', 'Everyone'];
const INTENT_OPTIONS = [
  'Long-term Relationship 💍',
  'Casual Dating / Seeing where it goes ☕',
  'Activity & Event Buddy 🎟️',
  'Strictly Dates, No Texting Forever 🥂',
];

const DEFAULT_PHOTOS = [
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=800',
];

export default function SignupOnboardingScreen({ navigation, route }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('Accra');
  const [country, setCountry] = useState('Ghana');
  const [gender, setGender] = useState('Woman');
  const [seeking, setSeeking] = useState('Men');
  const [selectedIntent, setSelectedIntent] = useState(INTENT_OPTIONS[0]);
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState([DEFAULT_PHOTOS[0]]);
  const [pickedFiles, setPickedFiles] = useState({}); // slotIndex -> File (web only)

  const fileInputRef = useRef(null);
  const activeSlotRef = useRef(0);

  const ageCategory = getAgeCategory(age);

  const uploadPickedPhoto = async (userId, slotIndex) => {
    const file = pickedFiles[slotIndex];
    if (!file) return photos[slotIndex];
    try {
      const ext = file.name?.split('.').pop() || 'jpg';
      const path = `${userId}/${slotIndex}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data?.publicUrl || photos[slotIndex];
    } catch (e) {
      // Bucket missing / RLS -> fall back to default photo, don't block signup
      console.warn('[Onboarding] photo upload failed, using default:', e.message);
      return photos[slotIndex]?.startsWith('blob:') ? DEFAULT_PHOTOS[slotIndex % DEFAULT_PHOTOS.length] : photos[slotIndex];
    }
  };

  const handleNext = async () => {
    if (saving) return;
    setSaveError('');

    if (step === 1) {
      if (!fullName.trim()) {
        Alert.alert('Details Required', 'Please enter your name to continue.');
        return;
      }
      const ageNum = parseInt(age, 10);
      if (!age.trim() || isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
        Alert.alert('Age Required', 'Please enter a valid age between 18 and 100.');
        return;
      }
      if (!city.trim()) {
        Alert.alert('City Required', 'Please enter your city.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!selectedIntent) {
        Alert.alert('Intent Required', 'Please select your primary dating intent.');
        return;
      }
      setStep(3);
      return;
    }

    // Step 3 -> Save to Supabase
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Not signed in', 'Please sign up again.');
        setSaving(false);
        return;
      }

      const ageNum = parseInt(age, 10);

      // Upload any locally picked photos first
      const finalPhotos = [];
      for (let i = 0; i < photos.length; i++) {
        if (photos[i]) finalPhotos.push(await uploadPickedPhoto(user.id, i));
      }
      const mainPhoto = finalPhotos[0] || DEFAULT_PHOTOS[0];

      // 1. Keep user_metadata in sync (ProfileScreen reads this)
      await supabase.auth.updateUser({
        data: {
          name: fullName.trim(),
          full_name: fullName.trim(),
          age: ageNum,
          gender,
          seeking,
          intent: selectedIntent,
          bio: bio.trim(),
          city: city.trim(),
          country: country.trim(),
          photo: mainPhoto,
          avatar_url: mainPhoto,
          verified: true,
        },
      });

      // 2. REAL persistence: upsert into profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email,
            full_name: fullName.trim(),
            age: ageNum,
            city: city.trim(),
            country: country.trim(),
            bio: bio.trim(),
            intent: selectedIntent,
            avatar_url: mainPhoto,
            gender,
            seeking,
            photos: finalPhotos,
          },
          { onConflict: 'id' }
        );

      if (profileError) throw profileError;

      navigation.reset({
        index: 0,
        routes: [{ name: 'Discovery', params: { isDemo: false } }],
      });
    } catch (e) {
      console.error('[Onboarding] save failed:', e);
      setSaveError(e.message || 'Could not save profile. Check internet / Supabase tables exist.');
      Alert.alert('Could not save profile', e.message || 'Check internet / Supabase tables exist.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePickPhoto = (slotIndex) => {
    activeSlotRef.current = slotIndex;
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      const nextPhoto = DEFAULT_PHOTOS[slotIndex % DEFAULT_PHOTOS.length];
      const updated = [...photos];
      updated[slotIndex] = nextPhoto;
      setPhotos(updated);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const slot = activeSlotRef.current;
    const imageUrl = URL.createObjectURL(file);
    const updated = [...photos];
    updated[slot] = imageUrl;
    setPhotos(updated);
    setPickedFiles((prev) => ({ ...prev, [slot]: file }));
    // Reset input so same file can be re-picked
    e.target.value = '';
  };

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />
      )}

      <View style={styles.topHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step {step} of 3</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.progressBarRow}>
        <View style={[styles.progressSegment, step >= 1 && styles.activeSegment]} />
        <View style={[styles.progressSegment, step >= 2 && styles.activeSegment]} />
        <View style={[styles.progressSegment, step >= 3 && styles.activeSegment]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>The Basics</Text>
            <Text style={styles.stepSub}>Let potential matches know who you are.</Text>

            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sarah"
              placeholderTextColor="#64748B"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Age (18-100)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 26"
              placeholderTextColor="#64748B"
              keyboardType="number-pad"
              maxLength={3}
              value={age}
              onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ''))}
            />

            {ageCategory ? (
              <View style={styles.categoryBadge}>
                <Ionicons name="sparkles" size={12} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.categoryBadgeText}>Group: {ageCategory.badge}</Text>
              </View>
            ) : null}

            <Text style={[styles.label, { marginTop: 16 }]}>City</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Accra"
              placeholderTextColor="#64748B"
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Country</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ghana"
              placeholderTextColor="#64748B"
              value={country}
              onChangeText={setCountry}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>I Identify As</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, gender === item && styles.activeChip]}
                  onPress={() => setGender(item)}
                >
                  <Text style={[styles.chipText, gender === item && styles.activeChipText]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>I Want to Meet</Text>
            <View style={styles.chipRow}>
              {SEEKING_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, seeking === item && styles.activeChip]}
                  onPress={() => setSeeking(item)}
                >
                  <Text style={[styles.chipText, seeking === item && styles.activeChipText]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Your Intent</Text>
            <Text style={styles.stepSub}>What are you looking for on Intent?</Text>

            {INTENT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.intentChip, selectedIntent === option && styles.activeIntentChip]}
                onPress={() => setSelectedIntent(option)}
              >
                <Text style={[styles.intentText, selectedIntent === option && styles.activeIntentText]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.label, { marginTop: 20 }]}>Short Bio</Text>
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
        )}

        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Upload Profile Photos</Text>
            <Text style={styles.stepSub}>Upload photos to earn your ✓ Verified Intent Badge.</Text>

            <View style={styles.photoGrid}>
              <TouchableOpacity style={styles.photoBoxMain} onPress={() => handlePickPhoto(0)}>
                {photos[0] ? (
                  <Image source={{ uri: photos[0] }} style={styles.photoImg} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={32} color="#FBBF24" />
                    <Text style={{ color: '#F97316', fontSize: 13, marginTop: 4, fontWeight: '700' }}>
                      Tap to Upload Main Photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.photoBox} onPress={() => handlePickPhoto(1)}>
                {photos[1] ? (
                  <Image source={{ uri: photos[1] }} style={styles.photoImg} />
                ) : (
                  <Ionicons name="add" size={24} color="#FBBF24" />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.photoBox} onPress={() => handlePickPhoto(2)}>
                {photos[2] ? (
                  <Image source={{ uri: photos[2] }} style={styles.photoImg} />
                ) : (
                  <Ionicons name="add" size={24} color="#FBBF24" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.photoHint}>Tip: First photo is your main Discovery photo.</Text>
          </View>
        )}

        {saveError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {saveError}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.nextButton, saving && styles.nextButtonDisabled]} onPress={handleNext} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>{step < 3 ? 'Next Step ›' : 'Complete Setup & Launch'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { padding: 4 },
  headerTitle: { color: '#FBBF24', fontSize: 14, fontWeight: '700' },
  progressBarRow: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 10 },
  progressSegment: { flex: 1, height: 4, backgroundColor: '#1E293B', borderRadius: 2, marginRight: 6 },
  activeSegment: { backgroundColor: '#F97316' },
  content: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40, maxWidth: 480, width: '100%', alignSelf: 'center' },
  stepTitle: { fontSize: 26, fontWeight: '800', color: '#F8FAFC' },
  stepSub: { color: '#94A3B8', fontSize: 13, marginTop: 4, marginBottom: 20 },
  label: { color: '#CBD5E1', fontWeight: '600', fontSize: 13, marginBottom: 8 },
  input: { backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#F8FAFC', paddingHorizontal: 16, height: 50 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' },
  categoryBadgeText: { color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row' },
  chip: { flex: 1, backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  activeChip: { backgroundColor: 'rgba(249, 115, 22, 0.2)', borderColor: '#F97316' },
  chipText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  activeChipText: { color: '#FBBF24', fontWeight: '700' },
  intentChip: { backgroundColor: '#1E293B', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  activeIntentChip: { backgroundColor: 'rgba(249, 115, 22, 0.2)', borderColor: '#F97316' },
  intentText: { color: '#CBD5E1', fontSize: 14 },
  activeIntentText: { color: '#FBBF24', fontWeight: '700' },
  bioInput: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  photoBoxMain: { width: '100%', height: 180, backgroundColor: '#1E293B', borderRadius: 16, borderWidth: 2, borderColor: '#F97316', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
  photoBox: { width: '48%', height: 110, backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoHint: { color: '#64748B', fontSize: 12, marginTop: 4, textAlign: 'center' },
  nextButton: { backgroundColor: '#F97316', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  nextButtonDisabled: { opacity: 0.6 },
  nextButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  errorBanner: { backgroundColor: 'rgba(239,68,68,0.15)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444', marginTop: 16 },
  errorText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600' },
});