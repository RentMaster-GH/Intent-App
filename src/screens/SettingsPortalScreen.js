import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function SettingsPortalScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(null);
  const [plan, setPlan] = useState('Free Plan');

  // Privacy & Notifications — persisted to profiles table, not local-only
  const [incognito, setIncognito] = useState(false);
  const [hideDistance, setHideDistance] = useState(false);
  const [timerAlerts, setTimerAlerts] = useState(true);
  const [queueAlerts, setQueueAlerts] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] });
        return;
      }
      setUserId(user.id);
      setEmail(user.email || '');
      setPhone(user.phone || null);

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, incognito_mode, hide_distance, timer_alerts, queue_alerts, subscription_status, plan')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.phone) setPhone(profile.phone);
        setIncognito(!!profile.incognito_mode);
        setHideDistance(!!profile.hide_distance);
        setTimerAlerts(profile.timer_alerts ?? true);
        setQueueAlerts(profile.queue_alerts ?? true);
        // Production: only show Premium if DB actually says so. Never hardcode it.
        const status = (profile.subscription_status || profile.plan || '').toLowerCase();
        if (status.includes('premium') || status.includes('active') || status.includes('paid')) {
          setPlan('Premium — Active');
        } else {
          setPlan('Free Plan');
        }
      }
    } catch (e) {
      Alert.alert('Could not load settings', 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveToggle = async (column, value, setFn) => {
    if (!userId) return;
    setFn(value);
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ [column]: value }).eq('id', userId);
      if (error) throw error;
    } catch (e) {
      // Revert on failure so UI never lies
      setFn(!value);
      Alert.alert('Could not save', 'Your setting was not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!email) { Alert.alert('No email', 'No email found for this account.'); return; }
    Alert.alert(
      'Change Password',
      `We'll send a reset link to ${email}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reset Link',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined,
              });
              if (error) throw error;
              Alert.alert('Check your email', `If an account exists for ${email}, a reset link was sent.`);
            } catch (e) {
              Alert.alert('Could not send', 'Try again in a minute.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch {}
    navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your profile, matches, likes and chats. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            setLoading(true);
            try {
              // 1. Delete user-owned rows. Order matters for FK constraints.
              // If you have RLS that blocks this, add policies: delete own rows in each table.
              await supabase.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
              await supabase.from('likes').delete().or(`liker_id.eq.${userId},liked_id.eq.${userId}`);
              await supabase.from('matches').delete().or(`user_a.eq.${userId},user_b.eq.${userId}`);
              await supabase.from('profiles').delete().eq('id', userId);

              // 2. Sign out. Note: deleting the Auth user itself requires a server-side
              // admin function (supabase.auth.admin.deleteUser). Client SDK cannot do it.
              // The profile is gone, so the user cannot use the app even if the Auth row remains
              // until you add that server function.
              await supabase.auth.signOut();
              navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] });
            } catch (e) {
              Alert.alert('Could not delete', 'Please contact support to complete deletion.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator color="#F97316" size="large" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        {saving ? <Text style={styles.savingText}>Saving...</Text> : null}

        <Text style={styles.sectionHeader}>Account & Security</Text>
        <View style={styles.cardGroup}>
          <View style={styles.rowItem}>
            <Text style={styles.rowLabel}>Phone Number</Text>
            <Text style={styles.rowValue}>{phone || 'Not added'}</Text>
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{email || 'Not available'}</Text>
          </View>
          <TouchableOpacity style={styles.rowItem} onPress={handleChangePassword}>
            <Text style={styles.rowLabel}>Change Password</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Help & Support</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('CustomerSupport')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>🎧 Customer Support & Complaints</Text>
              <Text style={styles.rowSub}>Submit complaints, suggestions or bug reports to Manager</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Privacy & Visibility</Text>
        <View style={styles.cardGroup}>
          <View style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Incognito Mode</Text>
              <Text style={styles.rowSub}>Only show my profile to people I like first</Text>
            </View>
            <Switch value={incognito} onValueChange={(v) => saveToggle('incognito_mode', v, setIncognito)} trackColor={{ false: '#334155', true: '#F97316' }} />
          </View>
          <View style={[styles.rowItem, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Hide My Distance</Text>
              <Text style={styles.rowSub}>Don't show exact distance on my card</Text>
            </View>
            <Switch value={hideDistance} onValueChange={(v) => saveToggle('hide_distance', v, setHideDistance)} trackColor={{ false: '#334155', true: '#F97316' }} />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Notifications & Timers</Text>
        <View style={styles.cardGroup}>
          <View style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Expiring Chat Alerts (48h)</Text>
              <Text style={styles.rowSub}>Notify 6h before an active chat dissolves</Text>
            </View>
            <Switch value={timerAlerts} onValueChange={(v) => saveToggle('timer_alerts', v, setTimerAlerts)} trackColor={{ false: '#334155', true: '#F97316' }} />
          </View>
          <View style={[styles.rowItem, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Intent Queue Unlocks</Text>
              <Text style={styles.rowSub}>Notify when a queued match clears into active 3</Text>
            </View>
            <Switch value={queueAlerts} onValueChange={(v) => saveToggle('queue_alerts', v, setQueueAlerts)} trackColor={{ false: '#334155', true: '#F97316' }} />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Billing & Payments</Text>
        <View style={styles.cardGroup}>
          <View style={[styles.rowItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Current Plan</Text>
            <Text style={[styles.rowValue, { color: plan.includes('Premium') ? '#FBBF24' : '#94A3B8', fontWeight: '800' }]}>{plan}</Text>
          </View>
        </View>
        <Text style={styles.planHint}>Premium is managed via Paystack. If you paid but still see Free Plan, contact support with your receipt.</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>
        <Text style={styles.deleteHint}>Delete removes your profile, likes, matches and chats. It cannot be undone.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { color: '#FBBF24', fontSize: 16, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#F8FAFC', letterSpacing: 2 },
  content: { padding: 20, maxWidth: 480, width: '100%', alignSelf: 'center' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12 },
  savingText: { color: '#FBBF24', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  sectionHeader: { color: '#FBBF24', fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  cardGroup: { backgroundColor: '#1E293B', borderRadius: 16, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  rowLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  rowSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  rowValue: { color: '#94A3B8', fontSize: 13, textAlign: 'right', flexShrink: 1, marginLeft: 12 },
  rowArrow: { color: '#94A3B8', fontSize: 18 },
  planHint: { color: '#64748B', fontSize: 11, marginTop: 8, lineHeight: 16 },
  logoutBtn: { backgroundColor: '#1E293B', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 30, borderWidth: 1, borderColor: '#334155' },
  logoutBtnText: { color: '#F8FAFC', fontWeight: '700' },
  deleteBtn: { height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  deleteBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  deleteHint: { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 16 },
});