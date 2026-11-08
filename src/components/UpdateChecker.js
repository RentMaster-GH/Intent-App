import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

const OWNER = 'RentMaster-GH';
const REPO = 'Intent-App';
const CURRENT_VERSION = Constants.expoConfig?.version || '1.1.0';

function isNewer(latest, current) {
  const a = latest.replace('v','').split('.').map(Number);
  const b = current.replace('v','').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

export default function UpdateChecker() {
  const shownRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || shownRef.current) return;
    const check = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`);
        if (!res.ok) return;
        const data = await res.json();
        const latest = (data.tag_name || '').replace('v','');
        if (!latest || !isNewer(latest, CURRENT_VERSION)) return;
        const apk = data.assets?.find(a => a.name.endsWith('.apk'));
        const url = apk?.browser_download_url || data.html_url;
        if (!url) return;
        shownRef.current = true;
        Alert.alert(
          'New version of Intent available',
          `You're on v${CURRENT_VERSION}. v${latest} is out. Update now?`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update', onPress: () => Linking.openURL(url) },
          ]
        );
      } catch (e) {
        console.log('[UpdateChecker]', e?.message);
      }
    };
    const t = setTimeout(check, 3000);
    return () => clearTimeout(t);
  }, []);

  return null;
}