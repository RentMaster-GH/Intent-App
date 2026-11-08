import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BottomNavBar({ navigation, currentRoute }) {
  const navItems = [
    { key: 'Discovery', label: 'Explore', icon: 'compass-outline', activeIcon: 'compass' },
    { key: 'ActiveChats', label: 'Chats', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
    { key: 'Dates', label: 'Dates', icon: 'calendar-outline', activeIcon: 'calendar' },
    { key: 'Profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navInner}>
        {navItems.map((item) => {
          const isActive = currentRoute === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.navButton}
              activeOpacity={0.7}
              onPress={() => {
                if (isActive) return;
                // FIX: Was navigation.navigate(item.key) — navigate STACKS screens, so DATES header flashed behind CHATS at 39s, Dates behind Profile at 41s
                // reset kills the stack, so old screen can't ghost behind new one
                navigation.reset({ index: 0, routes: [{ name: item.key }] });
              }}
            >
              <View style={styles.iconWrapper}>
                <Ionicons
                  name={isActive ? item.activeIcon : item.icon}
                  size={22}
                  color={isActive ? '#F97316' : '#64748B'}
                />
                {item.badge && !isActive ? (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingBottom: 20,
    paddingTop: 8,
  },
  navInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  iconWrapper: {
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: '#F97316',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  navLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#F97316',
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FBBF24',
    marginTop: 2,
  },
});