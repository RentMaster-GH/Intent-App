import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 🔑 Your Live Production Paystack Key
const PAYSTACK_PUBLIC_KEY = 'pk_live_1ce038da68ee109f5e603f5b816613d9cf261be5';
const GHS_EXCHANGE_RATE = 15; // $1 USD = GH₵ 15

const DONATION_PRESETS = [
  { id: 'p1', usd: 5, ghs: 75, label: '🌱 Supporter', desc: 'Sponsors 1 survivor\'s monthly community access' },
  { id: 'p2', usd: 15, ghs: 225, label: '🛡️ Guardian', desc: 'Funds a trauma-informed recovery workshop' },
  { id: 'p3', usd: 50, ghs: 750, label: '👑 Champion', desc: 'Subsidizes 1-on-1 counseling for survivors in need' },
];

export default function EmpathDonateModal({ visible, onClose, donorEmail = 'supporter@intent-dating.com' }) {
  const [selectedPreset, setSelectedPreset] = useState(DONATION_PRESETS[0]);
  const [customUsd, setCustomUsd] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'momo'
  const [showProfileBadge, setShowProfileBadge] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      document.body.appendChild(script);

      const styleId = 'donate-modal-scrollbar';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          ::-webkit-scrollbar {
            width: 8px !important;
          }
          ::-webkit-scrollbar-track {
            background: #0F172A !important;
          }
          ::-webkit-scrollbar-thumb {
            background: #F97316 !important;
            border-radius: 4px !important;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #FBBF24 !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  const getFinalUsdAmount = () => {
    if (customUsd && !isNaN(parseFloat(customUsd))) {
      return parseFloat(customUsd);
    }
    return selectedPreset.usd;
  };

  const getGhsAmount = (usdVal) => {
    return Math.round(usdVal * GHS_EXCHANGE_RATE);
  };

  const handleProcessDonation = () => {
    const usdAmount = getFinalUsdAmount();
    const ghsAmount = getGhsAmount(usdAmount);
    const amountInPesewas = ghsAmount * 100;
    const isMomo = paymentMethod === 'momo';

    if (Platform.OS === 'web' && window.PaystackPop) {
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: donorEmail,
        amount: amountInPesewas,
        currency: 'GHS',
        channels: isMomo ? ['mobile_money'] : ['card', 'bank_transfer', 'apple_pay'],
        ref: 'DONATE_EMPATH_' + Math.floor(Math.random() * 1000000000 + 1),
        onClose: function () {
          Alert.alert('Donation Cancelled', 'Thank you for considering supporting our cause.');
        },
        callback: function (response) {
          Alert.alert(
            'Thank You for Your Generosity! 💛🎉',
            `Reference: ${response.reference}\n\nYour donation of GH₵ ${ghsAmount} ($${usdAmount} USD) directly funds safe spaces and recovery resources for empaths and survivors.`
          );
          onClose();
        },
      });
      handler.openIframe();
    } else {
      Alert.alert(
        'Donation Gateway Ready 💛',
        `Connecting to Paystack to process GH₵ ${ghsAmount} ($${usdAmount} USD) for Empath & Survivor Safe Spaces.`,
        [{ text: 'Simulate Successful Donation', onPress: onClose }]
      );
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContent}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.heartIcon}>💛</Text>
              <Text style={styles.title}>EMPATH & SURVIVOR FUND</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
            indicatorStyle="white"
            scrollEventThrottle={16}
          >
            <Text style={styles.subtitle}>
              Building safe, trauma-informed communities for empaths and survivors of narcissistic abuse.
            </Text>

            {/* Impact Pillars */}
            <View style={styles.impactBox}>
              <Text style={styles.impactTitle}>Where Your Donation Goes:</Text>
              <View style={styles.pillarRow}>
                <Ionicons name="shield-checkmark" size={16} color="#FBBF24" />
                <Text style={styles.pillarText}>Moderated, private safe havens & support groups</Text>
              </View>
              <View style={styles.pillarRow}>
                <Ionicons name="heart" size={16} color="#FBBF24" />
                <Text style={styles.pillarText}>Trauma-informed narcissism recovery workshops</Text>
              </View>
              <View style={styles.pillarRow}>
                <Ionicons name="medical" size={16} color="#FBBF24" />
                <Text style={styles.pillarText}>Subsidizing 1-on-1 counseling for survivors in need</Text>
              </View>
            </View>

            {/* Donation Amount Presets */}
            <Text style={styles.sectionTitle}>1. Choose Donation Amount</Text>
            {DONATION_PRESETS.map((preset) => {
              const isSelected = !customUsd && selectedPreset.id === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.presetCard, isSelected && styles.presetCardActive]}
                  onPress={() => {
                    setSelectedPreset(preset);
                    setCustomUsd('');
                  }}
                >
                  <View style={styles.presetHeader}>
                    <Text style={styles.presetLabel}>{preset.label}</Text>
                    <Text style={styles.presetPrice}>${preset.usd} USD <Text style={styles.priceSub}>(GH₵ {preset.ghs})</Text></Text>
                  </View>
                  <Text style={styles.presetDesc}>{preset.desc}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom Amount Input */}
            <View style={styles.customInputBox}>
              <Text style={styles.customLabel}>Or Enter Custom Amount ($ USD):</Text>
              <TextInput
                style={styles.customInput}
                placeholder="e.g. 25"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                value={customUsd}
                onChangeText={setCustomUsd}
              />
            </View>

            {/* Payment Method Selector */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>2. Select Payment Method</Text>

            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('card')}
            >
              <Text style={styles.paymentIcon}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentTitle}>Visa / Mastercard / Apple Pay</Text>
                <Text style={styles.paymentSub}>Card Checkout (${getFinalUsdAmount()} USD)</Text>
              </View>
              <Text style={styles.radio}>{paymentMethod === 'card' ? '🔘' : '⚪'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'momo' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('momo')}
            >
              <Text style={styles.paymentIcon}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentTitle}>Mobile Money / MoMo</Text>
                <Text style={styles.paymentSub}>MTN / Telecel / AirtelTigo (GH₵ {getGhsAmount(getFinalUsdAmount())})</Text>
              </View>
              <Text style={styles.radio}>{paymentMethod === 'momo' ? '🔘' : '⚪'}</Text>
            </TouchableOpacity>

            {/* Supporter Badge Option */}
            <TouchableOpacity
              style={styles.badgeToggleRow}
              onPress={() => setShowProfileBadge(!showProfileBadge)}
            >
              <Ionicons
                name={showProfileBadge ? 'checkbox' : 'square-outline'}
                size={20}
                color="#FBBF24"
              />
              <Text style={styles.badgeToggleText}>
                Display 💛 Empath Supporter Badge on my dating profile
              </Text>
            </TouchableOpacity>

            {/* Donate Button */}
            <TouchableOpacity style={styles.donateBtn} onPress={handleProcessDonation}>
              <Text style={styles.donateBtnText}>
                Donate GH₵ {getGhsAmount(getFinalUsdAmount())} (${getFinalUsdAmount()} USD) with Paystack
              </Text>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              🔒 Secure 256-bit encrypted donation powered by Paystack.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    maxWidth: 460,
    width: '100%',
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heartIcon: {
    fontSize: 22,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  impactBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 16,
    gap: 8,
  },
  impactTitle: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillarText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  sectionTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  presetCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  presetCardActive: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  presetLabel: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  presetPrice: {
    color: '#FBBF24',
    fontSize: 15,
    fontWeight: '800',
  },
  priceSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  presetDesc: {
    color: '#94A3B8',
    fontSize: 12,
  },
  customInputBox: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  customLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  customInput: {
    backgroundColor: '#1E293B',
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#334155',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  paymentOptionActive: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  paymentIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  paymentTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  radio: {
    fontSize: 16,
    marginLeft: 8,
  },
  badgeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  badgeToggleText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  donateBtn: {
    backgroundColor: '#F97316',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  donateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  footerNote: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
});