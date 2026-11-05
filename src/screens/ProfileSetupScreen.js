import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';

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

  // Auto-detect Age Category
  const userAgeCategory = getAgeCategory(age);

  const handleFinish = () => {
    navigation.navigate('Discovery');
  };

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
          style={[
            styles.button,
            (!fullName || !age || !selectedIntent || !userAgeCategory) && styles.buttonDisabled,
          ]}
          disabled={!fullName || !age || !selectedIntent || !userAgeCategory}
          onPress={handleFinish}
        >
          <Text style={styles.buttonText}>Complete Profile</Text>
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
});