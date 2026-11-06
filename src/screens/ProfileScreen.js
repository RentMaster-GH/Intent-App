import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Switch, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';

const INTENTS = ['Long-term Relationship 💛', 'Activity & Event Buddy 🎟️', 'Friendship First 🤝', 'Marriage Minded 💍'];

export default function ProfileScreen({ navigation, route }) {
  const previousRoute = route?.params?.from || 'Discovery';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);

  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [intent, setIntent] = useState(INTENTS[0]);
  const [location, setLocation] = useState('');
  const [age, setAge] = useState('');
  const [photos, setPhotos] = useState([]);
  const [notifications, setNotifications] = useState(true);
  const [showOnDiscovery, setShowOnDiscovery] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] }); return; }
      setUserId(user.id);
      setEmail(user.email || '');

      // FIX: Only select columns that actually exist. photo_url / avatar_url do not exist and made this query fail.
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('name, bio, intent, location, age, photos, notifications, show_on_discovery')
        .eq('id', user.id).maybeSingle();

      if (profileError) throw profileError;

      if (profile) {
        setName(profile.name || '');
        setBio(profile.bio || '');
        if (profile.intent) setIntent(profile.intent);
        setLocation(profile.location || '');
        setAge(profile.age ? String(profile.age) : '');
        setPhotos(Array.isArray(profile.photos) ? profile.photos.filter(Boolean) : []);
        setNotifications(profile.notifications ?? true);
        setShowOnDiscovery(profile.show_on_discovery ?? true);
      }

      try {
        const { data: blocked } = await supabase.from('blocked_users').select('id, blocked_id, reason, created_at').eq('blocker_id', user.id);
        if (blocked) {
          const ids = blocked.map(b => b.blocked_id).filter(Boolean);
          let nameMap = {};
          if (ids.length) {
            const { data: names } = await supabase.from('profiles').select('id, name').in('id', ids);
            (names || []).forEach(n => nameMap[n.id] = n.name);
          }
          setBlockedUsers(blocked.map(b => ({ id: b.id, blocked_id: b.blocked_id, name: nameMap[b.blocked_id] || 'User', reason: b.reason || '' })));
        }
      } catch { setBlockedUsers([]); }
    } catch (e) { Alert.alert('Could not load profile', e.message || 'Check connection and try again.'); }
    finally { setLoading(false); }
  }, [navigation]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const completeness = (() => {
    let s = 0;
    if (name.trim()) s += 20;
    if (bio.trim().length > 10) s += 20;
    if (photos.length >= 1) s += 20;
    if (photos.length >= 3) s += 20;
    if (location.trim()) s += 10;
    if (intent) s += 10;
    return s;
  })();

  const handleBack = () => {
    if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: previousRoute || 'Discovery' }] });
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await supabase.auth.signOut(); } catch {}
    navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] });
  };

  // FIX: Removed stray duplicate lines after this function that broke compilation.
  const saveToggle = async (column, value, setFn) => {
    if (!userId) return;
    setFn(value);
    const { error } = await supabase.from('profiles').upsert({ id: userId, email, [column]: value }, { onConflict: 'id' });
    if (error) { setFn(!value); Alert.alert('Could not save', error.message || 'Setting not saved.'); }
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    if (!name.trim()) { Alert.alert('Name required', 'Enter your name.'); return; }
    if (bio.trim().length > 0 && bio.trim().length < 10) { Alert.alert('Bio too short', 'Write at least 10 characters so people know your intent.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        name: name.trim(),
        bio: bio.trim(),
        intent,
        location: location.trim(),
        age: age ? parseInt(age, 10) : null,
        photos,
        notifications,
        show_on_discovery: showOnDiscovery,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) throw error;
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) { Alert.alert('Save failed', e.message || 'Could not save profile.'); }
    finally { setSaving(false); }
  };

  const addPhotoFromUrl = () => {
    const url = photoUrlInput.trim();
    if (!url.startsWith('http')) { Alert.alert('Photo URL', 'Paste a valid https:// image URL.'); return; }
    if (photos.length >= 6) { Alert.alert('Limit', 'You can upload up to 6 photos.'); return; }
    setPhotos([...photos, url]); setPhotoUrlInput('');
  };

  // FIX: Allow removing last photo. Old code blocked it, so a bad photo could never be removed.
  const removePhoto = (idx) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const handleUnblock = async (blockedId, blockedRowId, nameLabel) => {
    try {
      const { error } = await supabase.from('blocked_users').delete().eq('id', blockedRowId);
      if (error) throw error;
      setBlockedUsers(prev => prev.filter(b => b.id !== blockedRowId));
      Alert.alert('Unblocked', `${nameLabel} unblocked.`);
    } catch { Alert.alert('Failed', 'Could not unblock.'); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { Alert.alert('Password', 'New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmNewPassword) { Alert.alert('Password', 'Passwords do not match.'); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Done', 'Password updated.'); setNewPassword(''); setConfirmNewPassword('');
    } catch (e) { Alert.alert('Failed', e.message || 'Could not update password.'); }
  };

  const handleDeleteAccount = async () => {
    if (deleteText.trim().toUpperCase() !== 'DELETE') { Alert.alert('Confirm', 'Type DELETE to confirm.'); return; }
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Delete failed');
      try { await supabase.auth.signOut(); } catch {}
      setShowDeleteConfirm(false);
      navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] });
    } catch (e) { Alert.alert('Delete failed', e.message || 'Could not delete account.'); }
    finally { setDeleting(false); }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#0F172A' }]}>
        <ActivityIndicator color="#F97316" size="large" />
        <Text style={{ color: '#94A3B8', marginTop: 12 }}>Loading profile...</Text>
      </View>
    );
  }

  const mainPhoto = photos[0] || null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.c} showsVerticalScrollIndicator={true}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
          <Text style={styles.title}>PROFILE</Text>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('SettingsPortal')}><Text style={styles.settingsText}>⚙️ Settings</Text></TouchableOpacity>
        </View>

        <View style={styles.section}>
          {mainPhoto ? (
            <Image source={{ uri: mainPhoto }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.avatarPlaceholderText}>{name ? name[0].toUpperCase() : '?'}</Text></View>
          )}
          <Text style={styles.name}>{name || 'Your Name'} ✓</Text>
          <Text style={styles.intent}>{intent}</Text>
          <Text style={styles.meta}>{age ? `${age} • ` : ''}{location || 'Add location'}</Text>
          <View style={styles.completeBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={styles.completeLabel}>Profile Completeness</Text><Text style={styles.completePct}>{completeness}%</Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completeness}%` }]} /></View>
            <Text style={styles.completeHint}>{completeness >= 100 ? '🎉 Complete — you show up more on Discovery.' : photos.length < 3 ? `Add ${3 - photos.length} more photo${3 - photos.length === 1 ? '' : 's'} to reach 100% and get more matches.` : 'Almost there — finish your bio to reach 100%.'}</Text>
          </View>
          <View style={styles.card}><Text style={styles.label}>BIO</Text><Text style={styles.value}>{bio || 'No bio yet — add one below.'}</Text></View>
          <View style={styles.card}><Text style={styles.label}>EMAIL</Text><Text style={styles.value}>{email || 'Not available'}</Text></View>
          <View style={styles.card}><Text style={styles.label}>GLOBAL RULE</Text><Text style={styles.value}>✅ 3 active chats max worldwide</Text></View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' }}>
            <TouchableOpacity style={[styles.miniBtn, { flex: 1 }]} onPress={() => Alert.alert('Verification', 'Verification is coming soon. You will be notified when it opens.')}><Text style={styles.miniBtnText}>✓ Get Verified</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.miniBtn, { flex: 1 }]} onPress={() => navigation.navigate('CustomerSupport')}><Text style={styles.miniBtnText}>💬 Help & Support</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { alignSelf: 'flex-start' }]}>PHOTOS ({photos.length}/6)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoWrap}>
                <Image source={{ uri: p }} style={styles.photoThumb} contentFit="cover" />
                {i === 0 && <Text style={styles.mainBadge}>MAIN</Text>}
                <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(i)}><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>✕</Text></TouchableOpacity>
              </View>
            ))}
            <View style={{ gap: 8 }}>
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Paste photo URL</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1, minWidth: 180 }]} value={photoUrlInput} onChangeText={setPhotoUrlInput} placeholder="https://..." placeholderTextColor="#64748B" autoCapitalize="none" />
                <TouchableOpacity style={[styles.secondaryBtn, { height: 48, paddingHorizontal: 14, marginTop: 0, width: 60 }]} onPress={addPhotoFromUrl}><Text style={styles.secondaryBtnText}>Add</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
          {photos.length === 0 && <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 8, alignSelf: 'flex-start' }}>No photos yet. Paste a URL above, then tap Save Profile.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Edit Details</Text>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#64748B" />
          <Text style={styles.inputLabel}>Bio</Text>
          <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} multiline placeholder="Tell your intent..." placeholderTextColor="#64748B" />
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Text style={styles.inputLabel}>Age</Text><TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="28" placeholderTextColor="#64748B" /></View>
            <View style={{ flex: 2, marginLeft: 10 }}><Text style={styles.inputLabel}>Location</Text><TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Accra, Ghana" placeholderTextColor="#64748B" /></View>
          </View>
          <Text style={styles.inputLabel}>Intent</Text>
          <View style={styles.intentWrap}>
            {INTENTS.map((it) => (
              <TouchableOpacity key={it} style={[styles.intentChip, intent === it && styles.intentChipActive]} onPress={() => setIntent(it)}><Text style={[styles.intentChipText, intent === it && styles.intentChipTextActive]}>{it}</Text></TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}</TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.toggleRow}><Text style={styles.toggleLabel}>🔔 Notifications</Text><Switch value={notifications} onValueChange={(v) => saveToggle('notifications', v, setNotifications)} trackColor={{ false: '#334155', true: '#F97316' }} thumbColor="#FFF" /></View>
          <View style={styles.toggleRow}><Text style={styles.toggleLabel}>🌍 Show me on Discovery</Text><Switch value={showOnDiscovery} onValueChange={(v) => saveToggle('show_on_discovery', v, setShowOnDiscovery)} trackColor={{ false: '#334155', true: '#F97316' }} thumbColor="#FFF" /></View>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowBlocked(true)}><Text style={styles.secondaryBtnText}>🚫 Blocked Users ({blockedUsers.length})</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('SettingsPortal')}><Text style={styles.secondaryBtnText}>⚙️ Open Full Settings Portal →</Text></TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password (6+ chars)" placeholderTextColor="#64748B" secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <TextInput style={[styles.input, { marginTop: 10 }]} value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="Confirm new password" placeholderTextColor="#64748B" secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleChangePassword}><Text style={styles.secondaryBtnText}>Update Password</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Export Data', 'Export is not available yet. Contact support if you need a copy of your data.')}><Text style={styles.secondaryBtnText}>📥 Export My Data</Text></TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#FCA5A5' }]}>Danger Zone</Text>
          <View style={styles.dangerBox}>
            <Text style={styles.dangerText}>Delete Account — this permanently removes your profile, photos, chats and dates. This cannot be undone.</Text>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => setShowDeleteConfirm(true)}><Text style={styles.deleteBtnText}>🗑️ Delete My Account</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.logout} onPress={handleLogout} disabled={loggingOut}>
            {loggingOut ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>Log Out</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showBlocked} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: 380 }]}>
            <Text style={styles.modalTitle}>🚫 Blocked Users</Text>
            {blockedUsers.length === 0 ? <Text style={{ color: '#94A3B8', marginTop: 12 }}>No blocked users.</Text> : blockedUsers.map((u) => (
              <View key={u.id} style={styles.toggleRow}><View><Text style={{ color: '#FFF', fontWeight: '700' }}>{u.name}</Text><Text style={{ color: '#94A3B8', fontSize: 12 }}>{u.reason}</Text></View><TouchableOpacity onPress={() => handleUnblock(u.blocked_id, u.id, u.name)}><Text style={{ color: '#FBBF24', fontWeight: '700' }}>Unblock</Text></TouchableOpacity></View>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBlocked(false)}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: 380 }]}>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={{ color: '#CBD5E1', marginTop: 8, lineHeight: 20 }}>Type <Text style={{ fontWeight: '800', color: '#FFF' }}>DELETE</Text> to confirm. Your profile, photos, chats and dates will be permanently removed.</Text>
            <TextInput style={[styles.input, { marginTop: 16 }]} value={deleteText} onChangeText={setDeleteText} placeholder="Type DELETE" placeholderTextColor="#64748B" autoCapitalize="characters" />
            <TouchableOpacity style={[styles.deleteBtn, { marginTop: 16 }]} onPress={handleDeleteAccount} disabled={deleting}>{deleting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.deleteBtnText}>Yes, Delete Forever</Text>}</TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowDeleteConfirm(false); setDeleteText(''); }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1, backgroundColor: '#0F172A' },
  c: { backgroundColor: '#0F172A', padding: 20, alignItems: 'center', width: '100%', maxWidth: 480, alignSelf: 'center', paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 },
  backBtn: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  backText: { color: '#FBBF24', fontWeight: '800', fontSize: 13 },
  title: { color: '#F8FAFC', fontWeight: '900', letterSpacing: 3 },
  settingsBtn: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  settingsText: { color: '#FBBF24', fontWeight: '800', fontSize: 13 },
  section: { width: '100%', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 110, height: 110, borderRadius: 55, marginTop: 8, borderWidth: 3, borderColor: '#F97316' },
  avatarPlaceholder: { backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#FBBF24', fontSize: 44, fontWeight: '800' },
  name: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 12 },
  intent: { color: '#FBBF24', marginTop: 4 },
  meta: { color: '#94A3B8', marginTop: 4, fontSize: 13 },
  completeBox: { width: '100%', backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginTop: 14 },
  completeLabel: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  completePct: { color: '#FBBF24', fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: '#0F172A', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#F97316', borderRadius: 4 },
  completeHint: { color: '#94A3B8', fontSize: 12, marginTop: 8 },
  card: { width: '100%', backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginTop: 14 },
  label: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  value: { color: '#FFF', marginTop: 4 },
  miniBtn: { backgroundColor: '#1E293B', paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  miniBtnText: { color: '#FBBF24', fontWeight: '700', fontSize: 12 },
  photoRow: { marginTop: 10, alignSelf: 'flex-start', maxWidth: '100%' },
  photoWrap: { position: 'relative', marginRight: 10 },
  photoThumb: { width: 72, height: 96, borderRadius: 12 },
  mainBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#F97316', color: '#FFF', fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  removePhoto: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  logout: { backgroundColor: '#EF4444', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 12, minWidth: 120, alignItems: 'center', justifyContent: 'center', width: '100%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#1E293B', borderRadius: 24, padding: 20, width: '100%', maxWidth: 440, maxHeight: '88%', borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#F8FAFC' },
  sectionTitle: { color: '#FBBF24', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, alignSelf: 'flex-start' },
  inputLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8, alignSelf: 'flex-start' },
  input: { backgroundColor: '#0F172A', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#F8FAFC', paddingHorizontal: 14, height: 48, width: '100%' },
  row2: { flexDirection: 'row', width: '100%' },
  intentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignSelf: 'flex-start' },
  intentChip: { backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  intentChipActive: { borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.15)' },
  intentChipText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  intentChipTextActive: { color: '#FBBF24', fontWeight: '700' },
  saveBtn: { backgroundColor: '#F97316', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16, width: '100%' },
  saveBtnText: { color: '#FFF', fontWeight: '800' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 8, width: '100%' },
  toggleLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#1E293B', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginTop: 10, width: '100%' },
  secondaryBtnText: { color: '#FBBF24', fontWeight: '700' },
  dangerBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: '#EF4444', borderRadius: 14, padding: 14, width: '100%' },
  dangerText: { color: '#FCA5A5', fontSize: 13, lineHeight: 18 },
  deleteBtn: { backgroundColor: '#EF4444', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 12, width: '100%' },
  deleteBtnText: { color: '#FFF', fontWeight: '800' },
  cancelBtn: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  cancelText: { color: '#94A3B8', fontWeight: '600' },
});