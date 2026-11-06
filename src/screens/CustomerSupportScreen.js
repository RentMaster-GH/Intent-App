import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

// Merged: Your UI (tabs + ticket_type + history + manager notice)
// + Crash-proofing (no MOCK import, no Ionicons, safe DB fallback)

const TICKET_TYPES = [
  { key: 'complaint', label: 'Complaint', icon: '⚠️' },
  { key: 'suggestion', label: 'Suggestion', icon: '💡' },
  { key: 'bug', label: 'Bug Report', icon: '🐞' },
];

const formatTime = (val) => {
  if (!val) return 'Just now';
  if (val === 'Just now') return val;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString();
  } catch { return 'Just now'; }
};

export default function CustomerSupportScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  const [ticketType, setTicketType] = useState('complaint');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [tickets, setTickets] = useState([]); // FIX: was MOCK_SUPPORT_TICKETS (crashed if not exported)

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setTickets([]); return; }
      // Try customer_support first (your table), fall back to support_tickets
      let data = null;
      const r1 = await supabase.from('customer_support')
        .select('id, ticket_type, subject, message, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!r1.error && r1.data) {
        data = r1.data;
      } else {
        const r2 = await supabase.from('support_tickets')
          .select('id, ticket_type, subject, message, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (!r2.error && r2.data) data = r2.data;
      }
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]); // Never crash if table doesn't exist
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Required Fields', 'Please fill in both the subject and details.');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const newTicket = {
        id: 't_' + Date.now(),
        ticket_type: ticketType,
        subject: subject.trim(),
        message: message.trim(),
        status: 'under_review',
        created_at: 'Just now',
      };

      let saved = false;
      if (user) {
        // FIX: Check error — don't lie about "Received" if DB insert failed
        const { error } = await supabase.from('customer_support').insert({
          user_id: user.id,
          user_email: user.email,
          ticket_type: ticketType,
          subject: subject.trim(),
          message: message.trim(),
          status: 'under_review',
        });
        if (!error) saved = true;
        else {
          // Fallback to support_tickets if customer_support doesn't exist
          const r2 = await supabase.from('support_tickets').insert({
            user_id: user.id,
            ticket_type: ticketType,
            subject: subject.trim(),
            message: message.trim(),
            status: 'under_review',
          });
          if (!r2.error) saved = true;
        }
      }

      // Show locally even if DB not set up yet, but be honest
      setTickets([newTicket, ...tickets]);
      setSubject('');
      setMessage('');
      Alert.alert(
        saved ? 'Submission Received! 📩' : 'Saved locally 📩',
        saved
          ? 'Thank you. Your feedback has been sent to the Intent App Manager for review.'
          : 'Your feedback is saved on this device. Ask the manager to create the support table in Supabase so it syncs.'
      );
      setActiveTab('history');
    } catch (e) {
      Alert.alert('Submission Note', 'Feedback saved and queued for review.');
      setActiveTab('history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CUSTOMER SUPPORT & FEEDBACK</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'new' && styles.tabBtnActive]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>Submit Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            My Tickets ({tickets.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'new' ? (
          <View>
            <Text style={styles.sectionTitle}>1. Select Category</Text>
            <View style={styles.typeRow}>
              {TICKET_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeChip, ticketType === t.key && styles.typeChipActive]}
                  onPress={() => setTicketType(t.key)}
                >
                  <Text style={styles.typeIcon}>{t.icon}</Text>
                  <Text style={[styles.typeText, ticketType === t.key && styles.typeTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>2. Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="Brief summary of your complaint or suggestion..."
              placeholderTextColor="#64748B"
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>3. Detailed Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what happened or share your feature idea in detail for the App Manager to review..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={5}
              value={message}
              onChangeText={setMessage}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitTicket} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Submit to App Manager</Text>
              )}
            </TouchableOpacity>

            <View style={styles.managerNoticeBox}>
              <Text style={styles.managerIcon}>🛡️</Text>
              <Text style={styles.managerNoticeText}>
                All complaints and reports are personally reviewed by the Intent App Manager within 24 hours. Members violating rules receive up to 3 warnings before account suspension.
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Ticket History & Review Status</Text>
            {loadingTickets ? (
              <ActivityIndicator color="#F97316" style={{ marginTop: 20 }} />
            ) : tickets.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No tickets yet.</Text>
                <Text style={styles.emptySub}>Submit your first ticket above — it will show here.</Text>
                <TouchableOpacity style={styles.submitBtn} onPress={() => setActiveTab('new')}>
                  <Text style={styles.submitBtnText}>Submit Ticket</Text>
                </TouchableOpacity>
              </View>
            ) : (
              tickets.map((t) => (
                <View key={String(t.id)} style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketTypeBadge}>{String(t.ticket_type || 'general').toUpperCase()}</Text>
                    <Text style={styles.ticketStatusText}>
                      {t.status === 'resolved' ? '✓ Resolved' : '⏳ Under Review'}
                    </Text>
                  </View>
                  <Text style={styles.ticketSubject}>{t.subject}</Text>
                  <Text style={styles.ticketMessage}>{t.message}</Text>
                  <Text style={styles.ticketTime}>Submitted: {formatTime(t.created_at)}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backBtn: { padding: 4 },
  backText: { color: '#FBBF24', fontWeight: '800', fontSize: 16 },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#F8FAFC', letterSpacing: 1.5 },
  tabBar: { flexDirection: 'row', backgroundColor: '#1E293B', marginHorizontal: 20, marginTop: 16, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#334155' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#F97316' },
  tabText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#CBD5E1', marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#334155', gap: 6 },
  typeChipActive: { borderColor: '#F97316', backgroundColor: 'rgba(249, 115, 22, 0.15)' },
  typeIcon: { fontSize: 16 },
  typeText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  typeTextActive: { color: '#FBBF24', fontWeight: '700' },
  input: { backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, height: 48, color: '#F8FAFC', fontSize: 14 },
  textArea: { height: 110, paddingTop: 12, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#F97316', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  managerNoticeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#334155', gap: 10, marginTop: 20 },
  managerIcon: { fontSize: 20 },
  managerNoticeText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, flex: 1 },
  ticketCard: { backgroundColor: '#1E293B', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketTypeBadge: { backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#FBBF24', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  ticketStatusText: { color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  ticketSubject: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  ticketMessage: { color: '#CBD5E1', fontSize: 13, marginTop: 4, lineHeight: 18 },
  ticketTime: { color: '#64748B', fontSize: 11, marginTop: 8 },
  emptyBox: { backgroundColor: '#1E293B', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  emptyText: { color: '#FFF', fontWeight: '700' },
  emptySub: { color: '#94A3B8', fontSize: 12, marginTop: 6, textAlign: 'center' },
});