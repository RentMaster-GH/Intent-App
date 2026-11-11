const { withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = `
# LiveKit WebRTC - fix R8 Missing class JniZeroJni
-keep class livekit.org.jni_zero.** { *; }
-dontwarn livekit.org.jni_zero.**
-keep class livekit.** { *; }
-dontwarn livekit.**
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
-keep class com.cloudwebrtc.webrtc.** { *; }
-dontwarn com.cloudwebrtc.webrtc.**
`;

function withLiveKitProguard(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      let existing = '';
      try { existing = fs.readFileSync(file, 'utf8'); } catch {}
      if (!existing.includes('livekit.org.jni_zero')) {
        fs.writeFileSync(file, existing + '\n' + RULES);
      }
      return config;
    },
  ]);

  config = withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (!gradle.includes('proguard-rules.pro')) {
      gradle = gradle.replace(
        /proguardFiles getDefaultProguardFile\('proguard-android-optimize.txt'\)/,
        `proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`
      );
    }
    config.modResults.contents = gradle;
    return config;
  });

  return config;
}

module.exports = withLiveKitProguard;