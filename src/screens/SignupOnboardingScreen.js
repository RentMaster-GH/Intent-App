import React, { useState, useRef, useEffect } from 'react';
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

const FRESH_SIGNUP_KEY = 'intent_fresh_signup';
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

const clearFreshSignupFlag = () => {
  try { if (typeof window !== 'undefined') window.sessionStorage?.removeItem(FRESH_SIGNUP_KEY); } catch {}
};

export default function SignupOnboardingScreen({ navigation, route }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [noSession, setNoSession] = useState(false);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('Accra');
  const [country, setCountry] = useState('Ghana');
  const [gender, setGender] = useState('Woman');
  const [seeking, setSeeking] = useState('Men');
  const [selectedIntent, setSelectedIntent] = useState(INTENT_OPTIONS[0]);
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState([DEFAULT_PHOTOS[0]]);
  const [pickedFiles, setPickedFiles] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fileInputRef = useRef(null);
  const activeSlotRef = useRef(0);
  const ageCategory = getAgeCategory(age);

  // --- Prefill from existing profile / user_metadata (old account / refresh) ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!user) {
          setNoSession(true);
          setLoadingProfile(false);
          return;
        }
        // If route passed email from AuthPortal, ignore - we use auth user
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (!mounted) return;
        if (profile) {
          setHasExistingProfile(true);
          setFullName(profile.full_name || '');
          setAge(profile.age ? String(profile.age) : '');
          setCity(profile.city || 'Accra');
          setCountry(profile.country || 'Ghana');
          setGender(profile.gender || 'Woman');
          setSeeking(profile.seeking || 'Men');
          setSelectedIntent(profile.intent || INTENT_OPTIONS[0]);
          setBio(profile.bio || '');
          if (profile.photos?.length) setPhotos(profile.photos);
          else if (profile.avatar_url) setPhotos([profile.avatar_url]);
        } else {
          // No profile yet - prefill from user_metadata if any
          const meta = user.user_metadata || {};
          if (meta.full_name || meta.name) setFullName(meta.full_name || meta.name);
          if (meta.age) setAge(String(meta.age));
          if (meta.city) setCity(meta.city);
          if (meta.country) setCountry(meta.country);
          if (meta.gender) setGender(meta.gender);
          if (meta.seeking) setSeeking(meta.seeking);
          if (meta.intent) setSelectedIntent(meta.intent);
          if (meta.bio) setBio(meta.bio);
          if (meta.avatar_url || meta.photo) setPhotos([meta.avatar_url || meta.photo]);
        }
      } catch (e) {
        console.warn('[Onboarding] prefill failed:', e?.message);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const uploadPickedPhoto = async (userId, slotIndex) => {
    const file = pickedFiles[slotIndex];
    const current = photos[slotIndex];
    if (!file) return current;
    try {
      const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/${slotIndex}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data?.publicUrl || current;
    } catch (e) {
      console.warn('[Onboarding] photo upload failed, using fallback:', e.message);
      return current?.startsWith('blob:') ? DEFAULT_PHOTOS[slotIndex % DEFAULT_PHOTOS.length] : current;
    }
  };

  const validateStep1 = () => {
    if (!fullName.trim()) { setSaveError('Please enter your name.'); return false; }
    if (fullName.trim().length < 2) { setSaveError('Name must be at least 2 characters.'); return false; }
    const ageNum = parseInt(age, 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
      setSaveError('Please enter a valid age between 18 and 100.'); return false;
    }
    if (!city.trim()) { setSaveError('Please enter your city.'); return false; }
    setSaveError('');
    return true;
  };

  const handleNext = async () => {
    if (saving) return;
    setSaveError('');

    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!selectedIntent) { setSaveError('Please select your primary dating intent.'); return; }
      if (bio.length > 300) { setSaveError('Bio must be 300 characters or less.'); return; }
      setStep(3);
      return;
    }

    // Step 3 -> Save (also called by Skip)
    await saveProfile();
  };

  const saveProfile = async (skipPhotos = false) => {
    setSaving(true);
    setSaveError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNoSession(true);
        setSaving(false);
        return;
      }
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 18) throw new Error('You must be 18+ to use Intent.');

      // Upload picked photos, or keep existing/defaults
      let finalPhotos = [];
      if (!skipPhotos) {
        for (let i = 0; i < photos.length; i++) {
          if (photos[i]) finalPhotos.push(await uploadPickedPhoto(user.id, i));
        }
        finalPhotos = finalPhotos.filter(Boolean);
      } else {
        // Skip: keep non-blob photos only, fallback to default if none
        finalPhotos = photos.filter((p) => p && !p.startsWith('blob:'));
        if (!finalPhotos.length) finalPhotos = [DEFAULT_PHOTOS[0]];
      }
      const mainPhoto = finalPhotos[0] || DEFAULT_PHOTOS[0];

      // 1. Keep user_metadata in sync
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

      // 2. Persist to profiles table
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

      // 3. Clear fresh-signup flag so refresh goes to Discovery, not Onboarding
      clearFreshSignupFlag();

      navigation.reset({
        index: 0,
        routes: [{ name: 'Discovery', params: { isDemo: false } }],
      });
    } catch (e) {
      console.error('[Onboarding] save failed:', e);
      setSaveError(e.message || 'Could not save profile. Check internet / Supabase tables exist.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 1) { setStep(step - 1); return; }
    // Step 1 Back
    if (hasExistingProfile) {
      // Old account editing -> go back to Discovery, don't sign out
      navigation.reset({ index: 0, routes: [{ name: 'Discovery', params: { isDemo: false } }] });
      return;
    }
    // Fresh signup, no profile yet -> confirm leave, sign out, clear flag
    Alert.alert('Leave setup?', 'Your profile is not saved yet. Go back to Sign In?', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Sign In',
        onPress: async () => {
          clearFreshSignupFlag();
          await supabase.auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'AuthPortal', params: {} }] });
        },
      },
    ]);
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

  const handleRemovePhoto = (slotIndex) => {
    const updated = [...photos];
    updated.splice(slotIndex, 1);
    if (!updated.length) updated.push(DEFAULT_PHOTOS[0]);
    setPhotos(updated);
    setPickedFiles((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate type + size
    if (!file.type?.startsWith('image/')) {
      setSaveError('Please pick an image file (JPG / PNG).');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Photo must be under 5MB.');
      e.target.value = '';
      return;
    }
    setSaveError('');
    const slot = activeSlotRef.current;
    const imageUrl = URL.createObjectURL(file);
    const updated = [...photos];
    updated[slot] = imageUrl;
    setPhotos(updated);
    setPickedFiles((prev) => ({ ...prev, [slot]: file }));
    e.target.value = '';
  };

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator color="#F97316" size="large" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (noSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Text style={styles.stepTitle}>Please sign in first</Text>
          <Text style={styles.stepSub}>You need an account before completing onboarding. If you just signed up, check your email to confirm, then sign in.</Text>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'AuthPortal', params: {} }] })}
          >
            <Text style={styles.nextButtonText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS === 'web' && (
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
      )}

      <View style={styles.topHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step {step} of 3 {hasExistingProfile ? '• Edit' : ''}</Text>
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
            <TextInput style={styles.input} placeholder="e.g. Sarah" placeholderTextColor="#64748B" value={fullName} onChangeText={(v) => { setFullName(v); setSaveError(''); }} autoCapitalize="words" />

            <Text style={[styles.label, { marginTop: 16 }]}>Age (18-100)</Text>
            <TextInput style={styles.input} placeholder="e.g. 26" placeholderTextColor="#64748B" keyboardType="number-pad" maxLength={3} value={age} onChangeText={(v) => { setAge(v.replace(/[^0-9]/g, '')); setSaveError(''); }} />

            {ageCategory ? (
              <View style={styles.categoryBadge}>
                <Ionicons name="sparkles" size={12} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.categoryBadgeText}>Group: {ageCategory.badge}</Text>
              </View>
            ) : null}

            <Text style={[styles.label, { marginTop: 16 }]}>City</Text>
            <TextInput style={styles.input} placeholder="e.g. Accra" placeholderTextColor="#64748B" value={city} onChangeText={setCity} autoCapitalize="words" />

            <Text style={[styles.label, { marginTop: 16 }]}>Country</Text>
            <TextInput style={styles.input} placeholder="e.g. Ghana" placeholderTextColor="#64748B" value={country} onChangeText={setCountry} autoCapitalize="words" />

            <Text style={[styles.label, { marginTop: 16 }]}>I Identify As</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((item) => (
                <TouchableOpacity key={item} style={[styles.chip, gender === item && styles.activeChip]} onPress={() => setGender(item)}>
                  <Text style={[styles.chipText, gender === item && styles.activeChipText]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>I Want to Meet</Text>
            <View style={styles.chipRow}>
              {SEEKING_OPTIONS.map((item) => (
                <TouchableOpacity key={item} style={[styles.chip, seeking === item && styles.activeChip]} onPress={() => setSeeking(item)}>
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
              <TouchableOpacity key={option} style={[styles.intentChip, selectedIntent === option && styles.activeIntentChip]} onPress={() => setSelectedIntent(option)}>
                <Text style={[styles.intentText, selectedIntent === option && styles.activeIntentText]}>{option}</Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.label, { marginTop: 20 }]}>Short Bio ({bio.length}/300)</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="What makes a great first date for you?"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
              maxLength={300}
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
                  <>
                    <Image source={{ uri: photos[0] }} style={styles.photoImg} />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemovePhoto(0)}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={32} color="#FBBF24" />
                    <Text style={{ color: '#F97316', fontSize: 13, marginTop: 4, fontWeight: '700' }}>Tap to Upload Main Photo</Text>
                  </>
                )}
              </TouchableOpacity>

              {[1, 2].map((slot) => (
                <TouchableOpacity key={slot} style={styles.photoBox} onPress={() => handlePickPhoto(slot)}>
                  {photos[slot] ? (
                    <>
                      <Image source={{ uri: photos[slot] }} style={styles.photoImg} />
                      <TouchableOpacity style={styles.removeBtnSmall} onPress={() => handleRemovePhoto(slot)}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Ionicons name="add" size={24} color="#FBBF24" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.photoHint}>Tip: First photo is your main Discovery photo. Max 5MB per photo.</Text>
            {uploadingPhoto ? <Text style={styles.photoHint}>Uploading photo...</Text> : null}
          </View>
        )}

        {saveError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {saveError}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.nextButton, saving && styles.nextButtonDisabled]} onPress={handleNext} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextButtonText}>{step < 3 ? 'Next Step ›' : hasExistingProfile ? 'Save & Go to Discovery' : 'Complete Setup & Launch'}</Text>}
        </TouchableOpacity>

        {step === 3 && (
          <TouchableOpacity style={styles.skipButton} onPress={() => saveProfile(true)} disabled={saving}>
            <Text style={styles.skipButtonText}>Skip photos for now</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { padding: 4 },
  headerTitle: { color: '#FBBF24', fontSize: 14, fontWeight: '700' },
  progressBarRow: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 10 },
  progressSegment: { flex: 1, height: 4, backgroundColor: '#1E293B', borderRadius: 2, marginRight: 6 },
  activeSegment: { backgroundColor: '#F97316' },
  content: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40, maxWidth: 480, width: '100%', alignSelf: 'center' },
  stepTitle: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', textAlign: 'center' },
  stepSub: { color: '#94A3B8', fontSize: 13, marginTop: 4, marginBottom: 20, textAlign: 'center' },
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
  removeBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  removeBtnSmall: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  nextButton: { backgroundColor: '#F97316', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  nextButtonDisabled: { opacity: 0.6 },
  nextButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  skipButton: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  skipButtonText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  errorBanner: { backgroundColor: 'rgba(239,68,68,0.15)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444', marginTop: 16 },
  errorText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600' },
});