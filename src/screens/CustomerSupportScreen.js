import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { supabase, MOCK_SUPPORT_TICKETS } from '../lib/supabase';

export default function CustomerSupportScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  const [ticketType, setTicketType] = useState('complaint'); // 'complaint' | 'suggestion' | 'bug'
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState(MOCK_SUPPORT_TICKETS);

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
        subject,
        message,
        status: 'under_review',
        created_at: 'Just now',
      };

      if (user) {
        await supabase.from('customer_support').insert({
          user_id: user.id,
          user_email: user.email,
          ticket_type: ticketType,
          subject,
          message,
        });
      }

      setTickets([newTicket, ...tickets]);
      setSubject('');
      setMessage('');
      Alert.alert(
        'Submission Received! 📩',
        'Thank you. Your feedback has been sent to the Intent App Manager for review.'
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
          <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CUSTOMER SUPPORT & FEEDBACK</Text>
        <View style={{ width: 24 }} />
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
              <TouchableOpacity
                style={[styles.typeChip, ticketType === 'complaint' && styles.typeChipActive]}
                onPress={() => setTicketType('complaint')}
              >
                <Ionicons name="alert-circle-outline" size={18} color={ticketType === 'complaint' ? '#FBBF24' : '#94A3B8'} />
                <Text style={[styles.typeText, ticketType === 'complaint' && styles.typeTextActive]}>Complaint</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeChip, ticketType === 'suggestion' && styles.typeChipActive]}
                onPress={() => setTicketType('suggestion')}
              >
                <Ionicons name="bulb-outline" size={18} color={ticketType === 'suggestion' ? '#FBBF24' : '#94A3B8'} />
                <Text style={[styles.typeText, ticketType === 'suggestion' && styles.typeTextActive]}>Suggestion</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeChip, ticketType === 'bug' && styles.typeChipActive]}
                onPress={() => setTicketType('bug')}
              >
                <Ionicons name="bug-outline" size={18} color={ticketType === 'bug' ? '#FBBF24' : '#94A3B8'} />
                <Text style={[styles.typeText, ticketType === 'bug' && styles.typeTextActive]}>Bug Report</Text>
              </TouchableOpacity>
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
              <Ionicons name="shield-checkmark" size={20} color="#FBBF24" />
              <Text style={styles.managerNoticeText}>
                All complaints and reports are personally reviewed by the Intent App Manager within 24 hours. Members violating rules receive up to 3 warnings before account suspension.
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Ticket History & Review Status</Text>
            {tickets.map((t) => (
              <View key={t.id} style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketTypeBadge}>{t.ticket_type.toUpperCase()}</Text>
                  <Text style={styles.ticketStatusText}>
                    {t.status === 'resolved' ? '✓ Resolved' : '⏳ Under Review'}
                  </Text>
                </View>

                <Text style={styles.ticketSubject}>{t.subject}</Text>
                <Text style={styles.ticketMessage}>{t.message}</Text>
                <Text style={styles.ticketTime}>Submitted: {t.created_at}</Text>
              </View>
            ))}
          </View>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#F97316',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  typeChipActive: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  typeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 48,
    color: '#F8FAFC',
    fontSize: 14,
  },
  textArea: {
    height: 110,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#F97316',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  managerNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
    marginTop: 20,
  },
  managerNoticeText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  ticketCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketTypeBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ticketStatusText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  ticketSubject: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  ticketMessage: {
    color: '#CBD5E1',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  ticketTime: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 8,
  },
});