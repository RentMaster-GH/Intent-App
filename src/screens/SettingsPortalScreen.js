import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';

import { supabase } from '../lib/supabase';

export default function SettingsPortalScreen({ navigation }) {
  const [incognito, setIncognito] = useState(false);
  const [hideDistance, setHideDistance] = useState(false);
  const [timerAlerts, setTimerAlerts] = useState(true);
  const [queueAlerts, setMatchAlerts] = useState(true);

  // Guaranteed Log Out Execution
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    navigation.reset({
      index: 0,
      routes: [{ name: 'AuthPortal' }],
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your Intent profile and matches? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
            } catch (e) {}
            navigation.reset({
              index: 0,
              routes: [{ name: 'AuthPortal' }],
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS & PRIVACY</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* SECTION 1: ACCOUNT & SECURITY */}
        <Text style={styles.sectionHeader}>Account & Security</Text>
        <View style={styles.cardGroup}>
          <View style={styles.rowItem}>
            <Text style={styles.rowLabel}>Phone Number</Text>
            <Text style={styles.rowValue}>+254 712 345 678</Text>
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>alex@example.com</Text>
          </View>
          <TouchableOpacity style={styles.rowItem}>
            <Text style={styles.rowLabel}>Change Security PIN / Password</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 2: HELP & CUSTOMER SUPPORT */}
        <Text style={styles.sectionHeader}>Help & Support</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => navigation.navigate('CustomerSupport')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>🎧 Customer Support & Complaints</Text>
              <Text style={styles.rowSub}>Submit complaints, suggestions or bug reports to Manager</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 3: PRIVACY & INCOGNITO */}
        <Text style={styles.sectionHeader}>Privacy & Visibility</Text>
        <View style={styles.cardGroup}>
          <View style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Incognito Mode</Text>
              <Text style={styles.rowSub}>Only show my profile to people I like first</Text>
            </View>
            <Switch
              value={incognito}
              onValueChange={setIncognito}
              trackColor={{ false: '#334155', true: '#F97316' }}
            />
          </View>

          <View style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Hide My Distance</Text>
              <Text style={styles.rowSub}>Don't show exact distance on my card</Text>
            </View>
            <Switch
              value={hideDistance}
              onValueChange={setHideDistance}
              trackColor={{ false: '#334155', true: '#F97316' }}
            />
          </View>
        </View>

        {/* SECTION 4: NOTIFICATION ALERTS */}
        <Text style={styles.sectionHeader}>Notifications & Timers</Text>
        <View style={styles.cardGroup}>
          <View style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Expiring Chat Alerts (48h)</Text>
              <Text style={styles.rowSub}>Notify 6h before an active chat dissolves</Text>
            </View>
            <Switch
              value={timerAlerts}
              onValueChange={setTimerAlerts}
              trackColor={{ false: '#334155', true: '#F97316' }}
            />
          </View>

          <View style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Intent Queue Unlocks</Text>
              <Text style={styles.rowSub}>Notify when a queued match clears into active 3</Text>
            </View>
            <Switch
              value={queueAlerts}
              onValueChange={setMatchAlerts}
              trackColor={{ false: '#334155', true: '#F97316' }}
            />
          </View>
        </View>

        {/* SECTION 5: BILLING & PAYSTACK */}
        <Text style={styles.sectionHeader}>Billing & Payments</Text>
        <View style={styles.cardGroup}>
          <View style={styles.rowItem}>
            <Text style={styles.rowLabel}>Current Plan</Text>
            <Text style={[styles.rowValue, { color: '#FBBF24', fontWeight: '800' }]}>Paystack Premium Active</Text>
          </View>
          <TouchableOpacity style={styles.rowItem}>
            <Text style={styles.rowLabel}>Payment Receipts & Invoices</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* LOGOUT & DELETE ACCOUNT */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteBtnText}>Delete Account</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 2,
  },
  content: {
    padding: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeader: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 10,
  },
  cardGroup: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  rowLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  rowValue: {
    color: '#94A3B8',
    fontSize: 13,
  },
  rowArrow: {
    color: '#94A3B8',
    fontSize: 18,
  },
  logoutBtn: {
    backgroundColor: '#1E293B',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  deleteBtn: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
});