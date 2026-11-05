import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  SafeAreaView,
  Alert,
} from 'react-native';

import { COUNTRIES } from '../data/countries';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleContinue = async () => {
    const fullPhone = `${selectedCountry.code}${phoneNumber.trim()}`;

    if (phoneNumber.trim().length > 6) {
      try {
        const { error } = await supabase.auth.signInWithOtp({
          phone: fullPhone,
        });

        if (error) {
          console.log('Supabase OTP Note:', error.message);
        } else {
          Alert.alert('OTP Sent 📲', `Verification code sent to ${fullPhone}`);
        }
      } catch (err) {
        console.log('Supabase auth bypass for testing:', err);
      }

      navigation.navigate('ProfileSetup', { fullPhone });
    }
  };

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.includes(searchQuery)
  );

  return (
    <SafeAreaView style={styles.outerContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.innerContainer}>
          {/* Branding Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>INTENT</Text>
            <Text style={styles.tagline}>Three chats. Real dates. No games.</Text>
          </View>

          {/* Input Section */}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Enter your phone number</Text>

            <View style={styles.phoneInputWrapper}>
              {/* Country Dropdown Button */}
              <TouchableOpacity
                style={styles.countryPickerButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                <Text style={styles.dropdownArrow}>▾</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Phone Input */}
              <TextInput
                style={styles.input}
                placeholder="555 000 0000"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                maxLength={12}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                phoneNumber.length < 7 && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={phoneNumber.length < 7}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Notice */}
          <Text style={styles.disclaimer}>
            By continuing, you agree to treat matches with respect and honor the 48-hour response limit.
          </Text>
        </View>

        {/* Country Selector Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <SafeAreaView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Country</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Search country or code..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              <FlatList
                data={filteredCountries}
                keyExtractor={(item, index) => `${item.name}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.countryRow}
                    onPress={() => {
                      setSelectedCountry(item);
                      setModalVisible(false);
                      setSearchQuery('');
                    }}
                  >
                    <Text style={styles.countryRowFlag}>{item.flag}</Text>
                    <Text style={styles.countryRowName}>{item.name}</Text>
                    <Text style={styles.countryRowCode}>{item.code}</Text>
                  </TouchableOpacity>
                )}
              />
            </SafeAreaView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0F172A', // Slate 900
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 440, // Perfectly centers the container on web/desktop!
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 10,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 10,
    fontWeight: '600',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 56,
  },
  countryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 6,
  },
  countryCode: {
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 4,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
    marginHorizontal: 10,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#6366F1',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
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
  disclaimer: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    width: '90%',
    maxWidth: 440,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  closeButton: {
    fontSize: 20,
    color: '#94A3B8',
    padding: 4,
  },
  searchInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 16,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  countryRowFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  countryRowName: {
    flex: 1,
    fontSize: 16,
    color: '#F8FAFC',
  },
  countryRowCode: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
});