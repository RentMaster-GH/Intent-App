import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';

const PEOPLE = [
  { id: '1', name: 'Ama', age: 27, location: 'Accra, Ghana', intent: 'Long-term Relationship 💛', bio: 'Intentional. Coffee lover. Looking for something real.', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80' },
  { id: '2', name: 'Kwame', age: 29, location: 'Accra, Ghana', intent: 'Friendship First 🤝', bio: 'Gym, Afrobeats, and good conversation.', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80' },
  { id: '3', name: 'Efua', age: 26, location: 'Kumasi, Ghana', intent: 'Marriage Minded 💍', bio: 'Faith, family, and building something lasting.', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80' },
];

export default function DiscoveryScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const person = PEOPLE[index % PEOPLE.length];

  const next = (msg) => {
    if (msg) Alert.alert('Intent', msg);
    setIndex((i) => i + 1);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.c}>
      <View style={styles.header}>
        <Text style={styles.logo}>INTENT</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.profileBtnText}>👤 Profile</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Discovery</Text>
      <Text style={styles.sub}>People near you — max 3 active chats worldwide.</Text>

      <View style={styles.card}>
        <Image source={{ uri: person.img }} style={styles.img} />
        <Text style={styles.name}>{person.name}, {person.age} ✓</Text>
        <Text style={styles.intent}>{person.intent}</Text>
        <Text style={styles.meta}>{person.location}</Text>
        <Text style={styles.bio}>{person.bio}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.pass]} onPress={() => next()}>
            <Text style={styles.btnText}>✕ Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.like]} onPress={() => next(`You liked ${person.name}.` )}>
            <Text style={styles.btnText}>♥ Like</Text>
          </TouchableOpacity>
        </View>
                <TouchableOpacity style={styles.chatBtn} onPress={() => navigation.navigate('ChatDetail', { id: person.id, name: person.name, avatar: person.img, img: person.img, intent: person.intent, location: person.location })}>
          <Text style={styles.chatText}>💬 Start Chat →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.link}>Profile →</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('SettingsPortal')}><Text style={styles.link}>Settings →</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0F172A' },
  c: { padding: 20, paddingBottom: 40, width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 },
  logo: { color: '#FFF', fontWeight: '900', letterSpacing: 3, fontSize: 18 },
  profileBtn: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  profileBtnText: { color: '#FBBF24', fontWeight: '800', fontSize: 13 },
  title: { color: '#FFF', fontWeight: '900', fontSize: 26, alignSelf: 'flex-start' },
  sub: { color: '#94A3B8', alignSelf: 'flex-start', marginTop: 4, marginBottom: 16 },
  card: { width: '100%', backgroundColor: '#1E293B', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#334155' },
  img: { width: '100%', height: 320, borderRadius: 14 },
  name: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 12 },
  intent: { color: '#FBBF24', marginTop: 4, fontWeight: '700' },
  meta: { color: '#94A3B8', marginTop: 4 },
  bio: { color: '#CBD5E1', marginTop: 8, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  btn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  pass: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  like: { backgroundColor: '#F97316' },
  btnText: { color: '#FFF', fontWeight: '800' },
  chatBtn: { backgroundColor: '#0F172A', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#334155' },
  chatText: { color: '#FBBF24', fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 24, marginTop: 20 },
  link: { color: '#FBBF24', fontWeight: '700' },
});