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

export default function SignupOnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Woman');
  const [seeking, setSeeking] = useState('Men');
  const [selectedIntent, setSelectedIntent] = useState(INTENT_OPTIONS[0]);
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState([DEFAULT_PHOTOS[0]]);

  const fileInputRef = useRef(null);
  const activeSlotRef = useRef(0);

  const ageCategory = getAgeCategory(age);

  const handleNext = async () => {
    if (step === 1) {
      if (!fullName.trim() || !age.trim()) {
        Alert.alert('Details Required', 'Please enter your name and age to continue.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedIntent) {
        Alert.alert('Intent Required', 'Please select your primary dating intent.');
        return;
      }
      setStep(3);
    } else {
      try {
        await supabase.auth.updateUser({
          data: {
            name: fullName,
            age,
            gender,
            seeking,
            intent: selectedIntent,
            bio,
            photo: photos[0],
            verified: true,
          }
        });
      } catch (e) {}
      navigation.reset({
        index: 0,
        routes: [{ name: 'Discovery', params: { isDemo: false } }],
      });
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
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      const updated = [...photos];
      updated[activeSlotRef.current] = imageUrl;
      setPhotos(updated);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Hidden File Input for Web */}
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
              onChangeText={setAge}
            />

            {ageCategory && (
              <View style={styles.categoryBadge}>
                <Ionicons name="sparkles" size={12} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.categoryBadgeText}>Group: {ageCategory.badge}</Text>
              </View>
            )}

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
          </View>
        )}

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {step < 3 ? 'Next Step ›' : 'Complete Setup & Launch'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    marginRight: 6,
  },
  activeSegment: {
    backgroundColor: '#F97316',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  stepSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  label: {
    color: '#CBD5E1',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 16,
    height: 50,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  categoryBadgeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeChip: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: '#F97316',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  intentChip: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  activeIntentChip: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: '#F97316',
  },
  intentText: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  activeIntentText: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  bioInput: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoBoxMain: {
    width: '100%',
    height: 180,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F97316',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  photoBox: {
    width: '48%',
    height: 110,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  nextButton: {
    backgroundColor: '#F97316',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});