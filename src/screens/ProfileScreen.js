import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Switch, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

// Never render a full email. v***@gmail.com only.
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return 'Not available';
  const [name, domain] = email.split('@');
  return `${name[0]}***@${domain}`;
};

const INTENTS = [
  'Long-term Relationship',
  'Activity & Event Buddy',
  'Friendship First',
  'Marriage Minded',
];

const withTimeout = (promise, ms = 8000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Check your connection and try again.')), ms)
    ),
  ]);

export default function ProfileScreen({ navigation, route, session }) {
  const previousRoute = route?.params?.from || 'Discovery';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

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

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadBlocked = useCallback(async (uid) => {
    try {
      const { data: blocked } = await withTimeout(
        supabase.from('blocked_users').select('id, blocked_id, reason, created_at').eq('blocker_id', uid),
        5000
      );
      if (!blocked || !mountedRef.current) return;
      const ids = blocked.map((b) => b.blocked_id).filter(Boolean);
      let nameMap = {};
      if (ids.length) {
        const { data: names } = await withTimeout(
          supabase.from('profiles').select('id, name').in('id', ids),
          5000
        );
        (names || []).forEach((n) => { nameMap[n.id] = n.name; });
      }
      if (mountedRef.current) {
        setBlockedUsers(blocked.map((b) => ({
          id: b.id,
          blocked_id: b.blocked_id,
          name: nameMap[b.blocked_id] || 'User',
          reason: b.reason || '',
        })));
      }
    } catch {
      if (mountedRef.current) setBlockedUsers([]);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const user = session?.user;
      if (!user) {
        navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] });
        return;
      }
      if (mountedRef.current) {
        setUserId(user.id);
        setEmail(user.email || '');
      }

      let profile = null;
      const { data: full, error: fullError } = await withTimeout(
        supabase.from('profiles')
          .select('name, bio, intent, location, age, photos, notifications, show_on_discovery')
          .eq('id', user.id)
          .maybeSingle(),
        8000
      );
      if (fullError) {
        const { data: core, error: coreError } = await withTimeout(
          supabase.from('profiles')
            .select('name, bio, intent, location, age, photos')
            .eq('id', user.id)
            .maybeSingle(),
          8000
        );
        if (coreError) throw coreError;
        profile = core;
      } else {
        profile = full;
      }

      if (profile && mountedRef.current) {
        setName(profile.name || '');
        setBio(profile.bio || '');
        if (profile.intent) setIntent(profile.intent);
        setLocation(profile.location || '');
        setAge(profile.age ? String(profile.age) : '');
        setPhotos(Array.isArray(profile.photos) ? profile.photos.filter(Boolean) : []);
        if (typeof profile.notifications === 'boolean') setNotifications(profile.notifications);
        if (typeof profile.show_on_discovery === 'boolean') setShowOnDiscovery(profile.show_on_discovery);
      }
      if (mountedRef.current) setLoading(false);
      loadBlocked(user.id);
      return;
    } catch (e) {
      Alert.alert('Could not load profile', e.message || 'Check connection and try again.');
    }
    if (mountedRef.current) setLoading(false);
  }, [navigation, session, loadBlocked]);

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

  const saveToggle = async (column, value, setFn) => {
    if (!userId) return;
    setFn(value);
    try {
      const { error } = await withTimeout(
        supabase.from('profiles').update({ [column]: value }).eq('id', userId),
        8000
      );
      if (error) throw error;
    } catch (e) {
      setFn(!value);
      Alert.alert('Could not save', e.message || 'Try again.');
    }
  };

  const saveProfile = async () => {
    if (!userId) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        bio: bio.trim(),
        intent,
        location: location.trim(),
        age: age ? parseInt(age, 10) : null,
        photos,
      };
      const { error } = await withTimeout(
        supabase.from('profiles').update(payload).eq('id', userId),
        8000
      );
      if (error) throw error;
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Could not save profile', e.message || 'Check connection and try again.');
    }
    setSaving(false);
  };

  const addPhotoFromUrl = async () => {
    const url = photoUrlInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) {
      Alert.alert('Invalid URL', 'Please paste a full image URL starting with http.');
      return;
    }
    if (photos.length >= 6) {
      Alert.alert('Limit reached', 'You can have up to 6 photos.');
      return;
    }
    const newPhotos = [...photos, url];
    setPhotos(newPhotos);
    setPhotoUrlInput('');
    if (userId) {
      try {
        await withTimeout(
          supabase.from('profiles').update({ photos: newPhotos }).eq('id', userId),
          8000
        );
      } catch (e) {
        Alert.alert('Could not save photo', e.message || 'Try again.');
      }
    }
  };

  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to upload a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      if (photos.length >= 6) {
        Alert.alert('Limit reached', 'You can have up to 6 photos.');
        return;
      }
      setUploadingPhoto(true);
      const newPhotos = [...photos, uri];
      setPhotos(newPhotos);
      if (userId) {
        try {
          await withTimeout(
            supabase.from('profiles').update({ photos: newPhotos }).eq('id', userId),
            8000
          );
        } catch (e) {
          Alert.alert('Could not save photo', e.message || 'Try again.');
        }
      }
      setUploadingPhoto(false);
    } catch (e) {
      setUploadingPhoto(false);
      Alert.alert('Could not pick photo', e.message || 'Try again.');
    }
  };

  const removePhoto = async (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    if (userId) {
      try {
        await withTimeout(
          supabase.from('profiles').update({ photos: newPhotos }).eq('id', userId),
          8000
        );
      } catch {}
    }
  };

  const unblockUser = async (blockedId) => {
    if (!userId) return;
    try {
      const { error } = await withTimeout(
        supabase.from('blocked_users').delete().eq('blocker_id', userId).eq('blocked_id', blockedId),
        8000
      );
      if (error) throw error;
      setBlockedUsers((prev) => prev.filter((b) => b.blocked_id !== blockedId));
    } catch (e) {
      Alert.alert('Could not unblock', e.message || 'Try again.');
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Password too short', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter the same password.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.updateUser({ password: newPassword }),
        8000
      );
      if (error) throw error;
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (e) {
      Alert.alert('Could not change password', e.message || 'Try again.');
    }
    setSaving(false);
  };

  const deleteAccount = async () => {
    if (deleteText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Type DELETE', 'Type DELETE in the box to confirm.');
      return;
    }
    if (!userId) return;
    setDeleting(true);
    try {
      const { error } = await withTimeout(
        supabase.from('profiles').delete().eq('id', userId),
        8000
      );
      if (error) throw error;
      await supabase.auth.signOut();
      navigation.reset({ index: 0, routes: [{ name: 'AuthPortal' }] });
    } catch (e) {
      Alert.alert('Could not delete account', e.message || 'Try again.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={{ color: '#94A3B8', marginTop: 12 }}>Loading profile...</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={handleLogout} disabled={loggingOut}>
          <Text style={styles.logoutText}>{loggingOut ? 'Logging out...' : 'Log Out'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile completeness: {completeness}%</Text>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${completeness}%` }]} />
        </View>
        {completeness < 100 && (
          <Text style={styles.hint}>Add a bio and at least 3 photos to reach 100%.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#64748B" />
        <Text style={styles.label}>Bio</Text>
        <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} placeholder="Tell people about you..." placeholderTextColor="#64748B" multiline numberOfLines={4} />
        <Text style={styles.label}>Intent</Text>
        <View style={styles.chipWrap}>
          {INTENTS.map((item) => (
            <TouchableOpacity key={item} style={[styles.chip, intent === item && styles.chipActive]} onPress={() => setIntent(item)}>
              <Text style={[styles.chipText, intent === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Accra" placeholderTextColor="#64748B" />
        <Text style={styles.label}>Age</Text>
        <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="e.g. 28" placeholderTextColor="#64748B" keyboardType="numeric" />
        <TouchableOpacity onPress={() => setShowEmail((v) => !v)}>
          <Text style={styles.emailToggle}>{showEmail ? maskEmail(email) : 'Show my email'} </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Photos ({photos.length}/6)</Text>
        <View style={styles.photoGrid}>
          {photos.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.photoBox}>
              <Image source={{ uri }} style={styles.photo} contentFit="cover" />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
                <Text style={styles.removeText}>x</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.secondaryBtn} onPress={pickPhoto} disabled={uploadingPhoto}>
          <Text style={styles.secondaryText}>{uploadingPhoto ? 'Adding...' : 'Add Photo from Gallery'}</Text>
        </TouchableOpacity>
        <TextInput style={styles.input} value={photoUrlInput} onChangeText={setPhotoUrlInput} placeholder="Or paste image URL" placeholderTextColor="#64748B" autoCapitalize="none" />
        <TouchableOpacity style={styles.secondaryBtn} onPress={addPhotoFromUrl}>
          <Text style={styles.secondaryText}>Add Photo from URL</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Switch value={notifications} onValueChange={(v) => saveToggle('notifications', v, setNotifications)} trackColor={{ false: '#334155', true: '#F97316' }} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Show me on Discovery</Text>
          <Switch value={showOnDiscovery} onValueChange={(v) => saveToggle('show_on_discovery', v, setShowOnDiscovery)} trackColor={{ false: '#334155', true: '#F97316' }} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Blocked users ({blockedUsers.length})</Text>
        {!showBlocked ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowBlocked(true)}>
            <Text style={styles.secondaryText}>View blocked users</Text>
          </TouchableOpacity>
        ) : blockedUsers.length === 0 ? (
          <Text style={styles.muted}>No blocked users.</Text>
        ) : (
          blockedUsers.map((b) => (
            <View key={b.id} style={styles.row}>
              <Text style={styles.rowLabel}>{b.name}</Text>
              <TouchableOpacity onPress={() => unblockUser(b.blocked_id)}>
                <Text style={styles.unblockText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#64748B" secureTextEntry />
        <TextInput style={styles.input} value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="Confirm new password" placeholderTextColor="#64748B" secureTextEntry />
        <TouchableOpacity style={styles.secondaryBtn} onPress={changePassword} disabled={saving}>
          <Text style={styles.secondaryText}>Update password</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={() => setShowDeleteConfirm(true)}>
        <Text style={styles.deleteText}>Delete Account</Text>
      </TouchableOpacity>

      <Modal visible={showDeleteConfirm} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account?</Text>
            <Text style={styles.muted}>This removes your profile. Type DELETE to confirm.</Text>
            <TextInput style={styles.input} value={deleteText} onChangeText={setDeleteText} placeholder="DELETE" placeholderTextColor="#64748B" autoCapitalize="characters" />
            <TouchableOpacity style={styles.deleteBtn} onPress={deleteAccount} disabled={deleting}>
              <Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete my account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setShowDeleteConfirm(false); setDeleteText(''); }}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 40 },
  loadingWrap: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText: { color: '#FBBF24', fontWeight: '700' },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },
  logoutText: { color: '#F87171', fontWeight: '700' },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  label: { color: '#CBD5E1', fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#334155' },
  bioInput: { minHeight: 90, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  chipText: { color: '#CBD5E1', fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  hint: { color: '#94A3B8', fontSize: 13, marginTop: 8 },
  emailToggle: { color: '#FBBF24', fontWeight: '700', marginTop: 12 },
  progressBg: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#F97316' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoBox: { width: 100, height: 130, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0F172A' },
  photo: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: '#EF4444', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  removeText: { color: '#fff', fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowLabel: { color: '#F8FAFC', fontWeight: '700' },
  muted: { color: '#94A3B8' },
  unblockText: { color: '#FBBF24', fontWeight: '700' },
  saveBtn: { backgroundColor: '#F97316', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  saveText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  secondaryText: { color: '#FBBF24', fontWeight: '700' },
  deleteBtn: { backgroundColor: '#7F1D1D', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  deleteText: { color: '#FECACA', fontWeight: '800' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1E293B', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 8 },
});