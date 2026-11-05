// scripts/add-splash.js
// Injects INTENT splash + title into the exported web bundle.
// Safe to run multiple times. Does NOT break the build if dist is missing.
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.log('[splash] No dist/index.html found — run `npx expo export -p web` first. Skipping.');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('INTENT production bundle splash')) {
  const splash = `
<!-- INTENT production bundle splash -->
<style>
  #intent-splash { position: fixed; inset: 0; z-index: 9999; background: #0F172A; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; }
  #intent-splash .logo { width: 72px; height: 72px; border-radius: 36px; background: #F97316; color: #0F172A; font-size: 32px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
  #intent-splash .title { color: #F8FAFC; font-weight: 900; letter-spacing: 4px; font-size: 24px; margin-top: 16px; }
  #intent-splash .sub { color: #FBBF24; font-size: 13px; font-weight: 700; margin-top: 8px; }
</style>
<div id="intent-splash"><div class="logo">I</div><div class="title">INTENT</div><div class="sub">Three chats. Real dates. No games.</div></div>
<script>
  window.addEventListener('load', function() {
    setTimeout(function() {
      var s = document.getElementById('intent-splash');
      if (s) s.style.display = 'none';
    }, 800);
  });
</script>
`;
  html = html.replace('<body>', '<body>' + splash);
  // Ensure title is INTENT
  html = html.replace(/<title>.*?<\/title>/i, '<title>INTENT - Three chats. Real dates.</title>');
  fs.writeFileSync(indexPath, html);
  console.log('[splash] Injected INTENT splash into dist/index.html');
} else {
  console.log('[splash] Splash already present — skipping.');
}

console.log('INTENT production bundle splash done.');