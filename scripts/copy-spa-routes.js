// Copy index.html to every SPA route so Vercel static deploy serves real files
// No rewrites / routes needed — Vercel just serves the file that exists
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
if (!fs.existsSync(index)) { console.error('dist/index.html missing — run expo export first'); process.exit(1); }
const html = fs.readFileSync(index);

const routes = [
  'auth', 'onboarding', 'discovery', 'chats', 'dates', 'profile', 'settings', 'support',
  'chat/1', 'chat/2', 'chat/3',
];

for (const r of routes) {
  const dir = path.join(dist, r);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`✅ dist/${r}/index.html`);
}
console.log('SPA routes copied — Vercel will serve real files, no rewrite needed');