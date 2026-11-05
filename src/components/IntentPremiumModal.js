import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';

const PAYSTACK_PUBLIC_KEY = 'pk_live_1ce038da68ee109f5e603f5b816613d9cf261be5';

// Rate: $1 USD = GH₵ 15
const GHS_EXCHANGE_RATE = 15;

export default function IntentPremiumModal({ visible, onClose, userEmail = 'user@intent-dating.com' }) {
  const [selectedPlan, setSelectedPlan] = useState('monthly'); // 'monthly' | 'queue_jump' | 'timer_save'
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'momo'

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      document.body.appendChild(script);

      const styleId = 'premium-modal-scrollbar';
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

  const getUsdPrice = () => {
    if (selectedPlan === 'queue_jump') return 2.99;
    if (selectedPlan === 'timer_save') return 1.99;
    return 4.99;
  };

  const getGhsPrice = (usdAmount) => {
    return Math.round(usdAmount * GHS_EXCHANGE_RATE);
  };

  const handlePaystackPayment = () => {
    const usdPrice = getUsdPrice();
    const isMomo = paymentMethod === 'momo';
    
    // Always pass GHS to Paystack API to match Ghana merchant base currency
    const currencyCode = 'GHS';
    const ghsAmount = getGhsPrice(usdPrice);
    const amountInPesewas = ghsAmount * 100; // Paystack expects amount in pesewas

    if (Platform.OS === 'web' && window.PaystackPop) {
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: userEmail,
        amount: amountInPesewas,
        currency: currencyCode,
        channels: isMomo ? ['mobile_money'] : ['card', 'bank_transfer', 'apple_pay'],
        ref: 'INTENT_' + Math.floor(Math.random() * 1000000000 + 1),
        onClose: function () {
          Alert.alert('Payment Cancelled', 'Transaction was not completed.');
        },
        callback: function (response) {
          Alert.alert(
            'Payment Successful! 🎉',
            `Reference: ${response.reference}\nYour account has been upgraded!`
          );
          onClose();
        },
      });
      handler.openIframe();
    } else {
      Alert.alert(
        'Paystack Gateway Ready 💳',
        `Connecting to Paystack for GH₵ ${ghsAmount} ($${usdPrice} USD).`,
        [{ text: 'Simulate Successful Payment', onPress: onClose }]
      );
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContent}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.crownIcon}>👑</Text>
              <Text style={styles.title}>INTENT PREMIUM</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Location Badge */}
          <View style={styles.locationBadge}>
            <Text style={styles.locationBadgeText}>
              🔒 Paystack Merchant: <Text style={styles.locationHighlight}>GHS (Ghanaian Cedis & Cards Supported)</Text>
            </Text>
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
              Skip queues, keep expiring chats alive, and match faster.
            </Text>

            {/* PLAN OPTIONS */}
            <Text style={styles.sectionTitle}>1. Choose Your Option</Text>

            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.selectedPlanCard,
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>POPULAR</Text>
              </View>
              <View style={styles.planHeaderRow}>
                <Text style={styles.planTitle}>Intent Premium</Text>
                <Text style={styles.planPrice}>
                  ${getUsdPrice().toFixed(2)} <Text style={styles.planPriceSub}>(GH₵ {getGhsPrice(4.99)})/mo</Text>
                </Text>
              </View>
              <Text style={styles.planDesc}>
                ✓ Priority Queue Skip on all matches{'\n'}
                ✓ Instant Likes Feed{'\n'}
                ✓ 1x Free Timer Extension every week
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'queue_jump' && styles.selectedPlanCard,
              ]}
              onPress={() => setSelectedPlan('queue_jump')}
            >
              <View style={styles.planHeaderRow}>
                <Text style={styles.planTitle}>🚀 1x Fast Pass Queue Jump</Text>
                <Text style={styles.planPrice}>
                  $2.99 <Text style={styles.planPriceSub}>(GH₵ {getGhsPrice(2.99)})</Text>
                </Text>
              </View>
              <Text style={styles.planDesc}>
                Jump directly to position #1 in your match's queue.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'timer_save' && styles.selectedPlanCard,
              ]}
              onPress={() => setSelectedPlan('timer_save')}
            >
              <View style={styles.planHeaderRow}>
                <Text style={styles.planTitle}>⏳ 1x 24-Hour Timer Save</Text>
                <Text style={styles.planPrice}>
                  $1.99 <Text style={styles.planPriceSub}>(GH₵ {getGhsPrice(1.99)})</Text>
                </Text>
              </View>
              <Text style={styles.planDesc}>
                Add +24 extra hours to an active chat before it expires.
              </Text>
            </TouchableOpacity>

            {/* PAYMENT METHOD SELECTOR */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              2. Select Payment Method
            </Text>

            {/* Option A: Card */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === 'card' && styles.selectedPaymentOption,
              ]}
              onPress={() => setPaymentMethod('card')}
            >
              <Text style={styles.paymentOptionIcon}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentOptionTitle}>Visa / Mastercard / Apple Pay</Text>
                <Text style={styles.paymentOptionSub}>Charged in GH₵ equivalent (${getUsdPrice().toFixed(2)} USD)</Text>
              </View>
              <Text style={styles.radio}>{paymentMethod === 'card' ? '🔘' : '⚪'}</Text>
            </TouchableOpacity>

            {/* Option B: MoMo */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === 'momo' && styles.selectedPaymentOption,
              ]}
              onPress={() => setPaymentMethod('momo')}
            >
              <Text style={styles.paymentOptionIcon}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentOptionTitle}>Mobile Money / MoMo</Text>
                <Text style={styles.paymentOptionSub}>MTN / Telecel / AirtelTigo (GH₵ {getGhsPrice(getUsdPrice())})</Text>
              </View>
              <Text style={styles.radio}>{paymentMethod === 'momo' ? '🔘' : '⚪'}</Text>
            </TouchableOpacity>

            {/* PAYSTACK ACTION BUTTON */}
            <TouchableOpacity style={styles.payButton} onPress={handlePaystackPayment}>
              <Text style={styles.payButtonText}>
                Pay GH₵ {getGhsPrice(getUsdPrice())} (${getUsdPrice().toFixed(2)} USD) with Paystack
              </Text>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              Payments processed securely via Paystack.
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    maxWidth: 480,
    width: '100%',
    maxHeight: '88%',
    padding: 20,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  crownIcon: {
    fontSize: 22,
    marginRight: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 2,
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  locationBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationBadgeText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  locationHighlight: {
    color: '#FBBF24',
    fontWeight: '800',
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
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  planCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    position: 'relative',
  },
  selectedPlanCard: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#F97316',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 15,
  },
  planPrice: {
    color: '#FBBF24',
    fontWeight: '800',
    fontSize: 15,
  },
  planPriceSub: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  planDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  selectedPaymentOption: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  paymentOptionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  paymentOptionTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  paymentOptionSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  radio: {
    fontSize: 16,
    marginLeft: 10,
  },
  payButton: {
    backgroundColor: '#F97316',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  footerNote: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
});