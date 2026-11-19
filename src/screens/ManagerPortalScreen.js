import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const MANAGER_STORAGE_KEY = 'intent_manager_unlocked_v1';

export default function ManagerPortalScreen({ navigation }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, matches: 0, messages: 0 });
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [statusBanner, setStatusBanner] = useState('');

  useEffect(() => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (window.sessionStorage.getItem(MANAGER_STORAGE_KEY) === 'true') {
          setUnlocked(true);
        }
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, matchRes, msgRes, ticketRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('matches').select('id'),
        supabase.from('messages').select('id'),
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
      ]);
      setTickets(ticketRes.data || []);
      const list = profRes.data || [];
      setProfiles(list);
      const verifiedCount = list.filter((p) => Boolean(p.verified)).length;
      setStats({
        total: list.length,
        verified: verifiedCount,
        pending: list.length - verifiedCount,
        matches: (matchRes.data || []).length,
        messages: (msgRes.data || []).length,
      });
    } catch (e) {
      console.error('[Manager] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) loadData();
  }, [unlocked, loadData]);

  const handleUnlock = () => {
    const expected = process.env.EXPO_PUBLIC_MANAGER_PASSWORD || 'intent123';
    if (pinInput.trim() === expected) {
      setUnlocked(true);
      setAuthError('');
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.sessionStorage.setItem(MANAGER_STORAGE_KEY, 'true');
        }
      } catch {}
    } else {
      setAuthError('Invalid Manager Password.');
    }
  };

  const handleLock = () => {
    setUnlocked(false);
    setPinInput('');
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.sessionStorage.removeItem(MANAGER_STORAGE_KEY);
      }
    } catch {}
  };

  const toggleVerification = async (profile, nextVerified) => {
    setBusyId(profile.id);
    setStatusBanner('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          verified: nextVerified,
          verified_at: nextVerified ? new Date().toISOString() : null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, verified: nextVerified } : p))
      );
      setStats((prev) => ({
        ...prev,
        verified: prev.verified + (nextVerified ? 1 : -1),
        pending: prev.pending + (nextVerified ? -1 : 1),
      }));
      setStatusBanner(
        nextVerified
          ? `Verified badge assigned to ${profile.full_name || profile.name || 'Member'}.`
          : `Verified badge revoked for ${profile.full_name || profile.name || 'Member'}.`
      );
    } catch (e) {
      setStatusBanner('Action failed: ' + (e?.message || 'Error'));
    } finally {
      setBusyId('');
    }
  };

  const deleteProfile = async (profile) => {
    const label = profile.full_name || profile.name || profile.email || 'this user';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!window.confirm(`Remove ${label} from Intent permanently?`)) return;
    }
    setBusyId(profile.id);
    try {
      await supabase.from('profiles').delete().eq('id', profile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      setStatusBanner(`Removed profile for ${label}.`);
    } catch (e) {
      setStatusBanner('Remove failed: ' + (e?.message || 'Error'));
    } finally {
      setBusyId('');
    }
  };

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MANAGER VERIFICATION</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.lockBox}>
          <View style={styles.lockCard}>
            <Ionicons name="shield-checkmark" size={38} color="#FBBF24" style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={styles.lockTitle}>App Manager Console</Text>
            <Text style={styles.lockSub}>
              Review member photos, assign Verified Intent badges, and moderate profiles.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Manager Password"
              placeholderTextColor="#64748B"
              secureTextEntry
              value={pinInput}
              onChangeText={setPinInput}
              onSubmitEditing={handleUnlock}
            />
            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleUnlock}>
              <Text style={styles.primaryBtnText}>Unlock Verification Portal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const filtered = profiles.filter((p) => {
    const isVer = Boolean(p.verified);
    if (filter === 'pending' && isVer) return false;
    if (filter === 'verified' && !isVer) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${p.full_name || ''} ${p.name || ''} ${p.city || ''} ${p.country || ''} ${p.email || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Discovery')}>
          <Text style={styles.back}>‹ Discovery</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>VERIFICATION PORTAL</Text>
        <TouchableOpacity onPress={handleLock}>
          <Text style={styles.lockLink}>Lock</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLbl}>Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#34D399' }]}>{stats.verified}</Text>
            <Text style={styles.statLbl}>Verified</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#FBBF24' }]}>{stats.pending}</Text>
            <Text style={styles.statLbl}>Unverified</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#60A5FA' }]}>{stats.matches}</Text>
            <Text style={styles.statLbl}>Matches</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {[
            { id: 'pending', label: `Pending Review (${stats.pending})` },
            { id: 'verified', label: `Verified (${stats.verified})` },
            { id: 'all', label: `All (${stats.total})` },
            { id: 'tickets', label: `Tickets (${tickets.length})` },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterTab, filter === tab.id && styles.filterTabActive]}
              onPress={() => setFilter(tab.id)}
            >
              <Text style={[styles.filterTabText, filter === tab.id && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Search by name, city, country, or email..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
            <Ionicons name="refresh" size={18} color="#F8FAFC" />
          </TouchableOpacity>
        </View>

        {statusBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{statusBanner}</Text>
          </View>
        ) : null}

        {filter === 'tickets' ? (
          tickets.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No support tickets or reports submitted yet.</Text>
            </View>
          ) : (
            tickets.map((t) => (
              <View key={t.id} style={styles.memberCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.memberName}>{t.subject || t.category || 'Support Ticket'}</Text>
                  <View style={t.status === 'resolved' ? styles.verifiedPill : styles.pendingPill}>
                    <Text style={t.status === 'resolved' ? styles.verifiedPillText : styles.pendingPillText}>
                      {t.status || 'open'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.memberMeta}>{t.category || 'General'} • {t.user_email || t.user_id || 'Member'}</Text>
                <Text style={styles.memberBio}>{t.message || t.description || ''}</Text>
                {t.status !== 'resolved' ? (
                  <TouchableOpacity
                    style={[styles.approveBtn, { marginTop: 12 }]}
                    onPress={async () => {
                      await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', t.id);
                      setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'resolved' } : x)));
                      setStatusBanner('Ticket marked resolved.');
                    }}
                  >
                    <Text style={styles.approveBtnText}>Mark Resolved</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )
        ) : loading ? (
          <ActivityIndicator color="#F97316" size="large" style={{ marginTop: 30 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No member profiles match this filter.</Text>
          </View>
        ) : (
          filtered.map((p) => {
            const photoList = Array.isArray(p.photos) && p.photos.length
              ? p.photos
              : p.avatar_url
              ? [p.avatar_url]
              : [];
            const isVer = Boolean(p.verified);
            const isBusy = busyId === p.id;
            const displayName = p.full_name || p.name || 'Member';
            const metaParts = [p.age ? `${p.age}` : null, p.city, p.country].filter(Boolean);

            return (
              <View key={p.id} style={styles.memberCard}>
                <View style={styles.memberTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{displayName}</Text>
                    {metaParts.length > 0 ? (
                      <Text style={styles.memberMeta}>{metaParts.join(' • ')}</Text>
                    ) : null}
                    {p.email ? <Text style={styles.memberEmail}>{p.email}</Text> : null}
                  </View>
                  {isVer ? (
                    <View style={styles.verifiedPill}>
                      <Ionicons name="checkmark-circle" size={13} color="#34D399" />
                      <Text style={styles.verifiedPillText}>Verified</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>Pending</Text>
                    </View>
                  )}
                </View>

                {p.bio ? <Text style={styles.memberBio}>{p.bio}</Text> : null}

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  {photoList.length > 0 ? (
                    photoList.map((uri, idx) => (
                      <Image key={`${p.id}-${idx}`} source={{ uri }} style={styles.reviewPhoto} resizeMode="cover" />
                    ))
                  ) : (
                    <View style={styles.noPhotoBox}>
                      <Text style={styles.noPhotoText}>No photo uploaded</Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.actionRow}>
                  {!isVer ? (
                    <TouchableOpacity
                      style={[styles.approveBtn, isBusy && { opacity: 0.6 }]}
                      disabled={isBusy}
                      onPress={() => toggleVerification(p, true)}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#064E3B" />
                      <Text style={styles.approveBtnText}>{isBusy ? 'Working...' : 'Approve / Verify'}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.revokeBtn, isBusy && { opacity: 0.6 }]}
                      disabled={isBusy}
                      onPress={() => toggleVerification(p, false)}
                    >
                      <Text style={styles.revokeBtnText}>{isBusy ? 'Working...' : 'Revoke Verification'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.removeBtn, isBusy && { opacity: 0.6 }]}
                    disabled={isBusy}
                    onPress={() => deleteProfile(p)}
                  >
                    <Ionicons name="trash" size={18} color="#F87171" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  back: { color: '#FBBF24', fontSize: 14, fontWeight: '700' },
  headerTitle: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  lockLink: { color: '#F87171', fontSize: 13, fontWeight: '700' },
  lockBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  lockCard: { width: '100%', maxWidth: 400, backgroundColor: '#1E293B', borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#334155' },
  lockTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  lockSub: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 19 },
  input: { backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 14, height: 46, color: '#FFF', borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  errorText: { color: '#F87171', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  primaryBtn: { backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  content: { padding: 18, maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 60 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  statNum: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },
  statLbl: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterTab: { flex: 1, backgroundColor: '#1E293B', paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  filterTabActive: { backgroundColor: 'rgba(249, 115, 22, 0.2)', borderColor: '#F97316' },
  filterTabText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  filterTabTextActive: { color: '#FBBF24' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  refreshBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  banner: { backgroundColor: 'rgba(16, 185, 129, 0.16)', borderColor: 'rgba(16, 185, 129, 0.4)', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14 },
  bannerText: { color: '#6EE7B7', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  emptyBox: { padding: 36, alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 14, borderWidth: 1, borderColor: '#334155' },
  emptyText: { color: '#94A3B8', fontSize: 14 },
  memberCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  memberTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberName: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.16)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  verifiedPillText: { color: '#34D399', fontSize: 11, fontWeight: '700' },
  pendingPill: { backgroundColor: 'rgba(251, 191, 36, 0.16)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pendingPillText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  memberMeta: { color: '#94A3B8', fontSize: 12, marginTop: 3 },
  memberEmail: { color: '#64748B', fontSize: 11, marginTop: 2 },
  memberBio: { color: '#CBD5E1', fontSize: 13, marginTop: 8, lineHeight: 18 },
  reviewPhoto: { width: 130, height: 165, borderRadius: 12, marginRight: 10, backgroundColor: '#0F172A' },
  noPhotoBox: { padding: 14, borderRadius: 10, backgroundColor: '#0F172A' },
  noPhotoText: { color: '#64748B', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  approveBtn: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: '#34D399', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  approveBtnText: { color: '#064E3B', fontWeight: '800', fontSize: 13 },
  revokeBtn: { flex: 1, backgroundColor: 'rgba(251, 191, 36, 0.15)', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.4)', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  revokeBtnText: { color: '#FBBF24', fontWeight: '700', fontSize: 13 },
  removeBtn: { width: 44, backgroundColor: 'rgba(239, 68, 68, 0.14)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.35)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
