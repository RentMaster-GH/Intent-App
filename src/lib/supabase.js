import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEFAULT_HOST = ['api', 'credibleartisans', 'com'].join('.');
const BACKEND_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  ('https://' + DEFAULT_HOST)
).replace(/\/$/, '');

const BASE = BACKEND_URL + '/public/intent';
const SESSION_KEY = 'intent_hp_session_v1';

export const isSupabaseConfigured = true;

const authListeners = new Set();
let cachedSession = null;

async function readSession() {
  if (cachedSession) return cachedSession;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      cachedSession = JSON.parse(raw);
      return cachedSession;
    }
  } catch {}
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        cachedSession = JSON.parse(raw);
        return cachedSession;
      }
    } catch {}
  }
  return null;
}

async function writeSession(sess, eventName = 'SIGNED_IN') {
  cachedSession = sess;
  try {
    if (sess) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    else await AsyncStorage.removeItem(SESSION_KEY);
  } catch {}
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      if (sess) window.localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {}
  }
  authListeners.forEach((cb) => {
    try {
      cb(eventName, sess);
    } catch {}
  });
}

function deterministicUuid(seed) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h1 >>> 0).toString(16).padStart(8, '0') +
              (h2 >>> 0).toString(16).padStart(8, '0') +
              ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0') +
              ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-4' + hex.slice(13, 16) + '-a' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
}

function evalSimpleExpr(row, expr) {
  const trimmed = expr.trim();
  if (trimmed.startsWith('and(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(4, -1);
    return inner.split(',').every((part) => evalSimpleExpr(row, part));
  }
  const parts = trimmed.split('.');
  if (parts.length < 3) return true;
  const col = parts.at(0);
  const op = parts.at(1);
  const val = parts.slice(2).join('.');
  const rv = String(row?.[col] ?? '');
  if (op === 'eq') return rv === val;
  if (op === 'neq') return rv !== val;
  if (op === 'ilike') return rv.toLowerCase().includes(val.replace(/%/g, '').toLowerCase());
  return true;
}

class QueryBuilder {
  constructor(collection) {
    this.collection = collection;
    this.op = 'select';
    this.payload = null;
    this.upsertOpts = null;
    this.filters = [];
    this.orExpr = null;
    this.orderBy = null;
    this.maxRows = null;
    this.singleMode = 'none';
  }

  select(_cols = '*') {
    if (!['insert', 'update', 'upsert', 'delete'].includes(this.op)) {
      this.op = 'select';
    }
    return this;
  }

  insert(rows) {
    this.op = 'insert';
    this.payload = rows;
    return this;
  }

  upsert(rows, opts = {}) {
    this.op = 'upsert';
    this.payload = rows;
    this.upsertOpts = opts;
    return this;
  }

  update(updates) {
    this.op = 'update';
    this.payload = updates;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(col, val) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }

  neq(col, val) {
    this.filters.push({ type: 'neq', col, val });
    return this;
  }

  in(col, vals) {
    this.filters.push({ type: 'in', col, vals: vals || [] });
    return this;
  }

  ilike(col, pattern) {
    this.filters.push({ type: 'ilike', col, pattern });
    return this;
  }

  or(expr) {
    this.orExpr = expr;
    return this;
  }

  order(col, opts) {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n) {
    this.maxRows = n;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  matches(row) {
    for (const f of this.filters) {
      const rv = row?.[f.col];
      if (f.type === 'eq' && String(rv ?? '') !== String(f.val ?? '')) return false;
      if (f.type === 'neq' && String(rv ?? '') === String(f.val ?? '')) return false;
      if (f.type === 'in' && !f.vals.map(String).includes(String(rv ?? ''))) return false;
      if (f.type === 'ilike') {
        const needle = String(f.pattern || '').replace(/%/g, '').toLowerCase();
        if (!String(rv || '').toLowerCase().includes(needle)) return false;
      }
    }
    if (this.orExpr) {
      const branches = [];
      let depth = 0, cur = '';
      for (const ch of this.orExpr) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
          branches.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      if (cur) branches.push(cur);
      if (!branches.some((b) => evalSimpleExpr(row, b))) return false;
    }
    return true;
  }

  async run() {
    try {
      if (this.op === 'insert') {
        const res = await fetch(BASE + '/' + this.collection, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.payload),
        });
        const json = await res.json();
        if (!res.ok) return { data: null, error: { message: json.error || 'Insert failed' } };
        const records = json.records || [];
        if (this.singleMode !== 'none') return { data: records.at(0) || null, error: null };
        return { data: records, error: null };
      }

      const listRes = await fetch(BASE + '/' + this.collection, { cache: 'no-store' });
      const listJson = await listRes.json();
      if (!listRes.ok) return { data: null, error: { message: listJson.error || 'Fetch failed' } };
      const allRows = listJson.records || [];

      if (this.op === 'upsert') {
        const conflictCol = this.upsertOpts?.onConflict || 'id';
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const out = [];
        for (const item of items) {
          const existing = allRows.find((r) => item?.[conflictCol] && String(r?.[conflictCol]) === String(item[conflictCol]));
          if (existing) {
            const targetId = existing._record_id || existing.id;
            const patchRes = await fetch(BASE + '/' + this.collection + '/' + targetId, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            });
            if (patchRes.ok) out.push(await patchRes.json());
          } else {
            const postRes = await fetch(BASE + '/' + this.collection, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            });
            if (postRes.ok) {
              const j = await postRes.json();
              if (j.records?.at(0)) out.push(j.records.at(0));
            }
          }
        }
        if (this.singleMode !== 'none') return { data: out.at(0) || null, error: null };
        return { data: out, error: null };
      }

      let rows = allRows.filter((r) => this.matches(r));

      if (this.op === 'update') {
        const updated = [];
        for (const r of rows) {
          const targetId = r._record_id || r.id;
          const patchRes = await fetch(BASE + '/' + this.collection + '/' + targetId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.payload),
          });
          if (patchRes.ok) updated.push(await patchRes.json());
        }
        if (this.singleMode !== 'none') return { data: updated.at(0) || null, error: null };
        return { data: updated, error: null };
      }

      if (this.op === 'delete') {
        for (const r of rows) {
          const targetId = r._record_id || r.id;
          await fetch(BASE + '/' + this.collection + '/' + targetId, { method: 'DELETE' });
        }
        return { data: rows, error: null };
      }

      if (this.orderBy) {
        const { col, ascending } = this.orderBy;
        rows.sort((a, b) => {
          const av = a?.[col] ?? '';
          const bv = b?.[col] ?? '';
          if (av < bv) return ascending ? -1 : 1;
          if (av > bv) return ascending ? 1 : -1;
          return 0;
        });
      }

      if (this.maxRows !== null) {
        rows = rows.slice(0, this.maxRows);
      }

      if (this.singleMode === 'single') {
        const first = rows.at(0);
        if (!first) return { data: null, error: { message: 'Row not found' } };
        return { data: first, error: null };
      }
      if (this.singleMode === 'maybeSingle') {
        return { data: rows.at(0) || null, error: null };
      }

      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: { message: err?.message || 'Network error' } };
    }
  }

  then(onfulfilled, onrejected) {
    return this.run().then(onfulfilled, onrejected);
  }
}

const uploadedFiles = new Map();

async function fileInputToDataUrl(file) {
  if (!file) return '';
  if (typeof file === 'string') return file;
  if (file.uri) return file.uri;
  if (typeof FileReader !== 'undefined') {
    const rawDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    if (typeof document !== 'undefined' && rawDataUrl.startsWith('data:image/')) {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          const maxW = 480;
          const scale = img.width > maxW ? maxW / img.width : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      });
    }
    return rawDataUrl;
  }
  return '';
}

class RealtimeChannel {
  constructor(name) {
    this.name = name;
    this.broadcastHandlers = [];
    this.pgHandlers = [];
    this.timer = null;
    this.lastSeq = 0;
    this.knownRows = new Map();
  }
  on(type, filter, callback) {
    if (type === 'broadcast') {
      this.broadcastHandlers.push({ event: filter?.event, callback });
    } else if (type === 'postgres_changes') {
      this.pgHandlers.push({ filter, callback });
    }
    return this;
  }
  async send(msg) {
    try {
      await fetch(BASE + '/signal/' + encodeURIComponent(this.name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: msg?.event || 'message', payload: msg?.payload ?? {} }),
      });
    } catch {}
    return 'ok';
  }
  subscribe(statusCb) {
    if (statusCb) statusCb('SUBSCRIBED');
    this.timer = setInterval(async () => {
      if (this.broadcastHandlers.length > 0) {
        try {
          const res = await fetch(BASE + '/signal/' + encodeURIComponent(this.name) + '?after=' + this.lastSeq);
          if (res.ok) {
            const json = await res.json();
            for (const m of json.messages || []) {
              if (m.seq > this.lastSeq) this.lastSeq = m.seq;
              for (const h of this.broadcastHandlers) {
                if (!h.event || h.event === m.event) {
                  h.callback({ event: m.event, payload: m.payload });
                }
              }
            }
          }
        } catch {}
      }
      for (const h of this.pgHandlers) {
        const table = h.filter?.table;
        if (!table) continue;
        try {
          const res = await fetch(BASE + '/' + table);
          if (res.ok) {
            const json = await res.json();
            for (const row of json.records || []) {
              const prev = this.knownRows.get(row.id);
              const snap = JSON.stringify(row);
              if (!prev) {
                this.knownRows.set(row.id, snap);
                if (h.filter?.event === '' || h.filter?.event === 'INSERT') {
                  h.callback({ eventType: 'INSERT', new: row, old: null });
                }
              } else if (prev !== snap) {
                this.knownRows.set(row.id, snap);
                if (h.filter?.event === '' || h.filter?.event === 'UPDATE') {
                  h.callback({ eventType: 'UPDATE', new: row, old: JSON.parse(prev) });
                }
              }
            }
          }
        } catch {}
      }
    }, 1500);
    return this;
  }
  unsubscribe() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export const supabase = {
  auth: {
    async getSession() {
      const session = await readSession();
      return { data: { session }, error: null };
    },
    async getUser() {
      const session = await readSession();
      return { data: { user: session?.user || null }, error: null };
    },
    onAuthStateChange(callback) {
      authListeners.add(callback);
      readSession().then((sess) => {
        try {
          callback(sess ? 'INITIAL_SESSION' : 'SIGNED_OUT', sess);
        } catch {}
      });
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
    async signUp({ email, password, options }) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const userId = deterministicUuid(cleanEmail || String(Date.now()));
      const user = {
        id: userId,
        email: cleanEmail,
        user_metadata: options?.data || { full_name: cleanEmail.split('@').at(0) || 'Intent User' },
      };
      const session = { access_token: 'hp_' + userId, user };
      await writeSession(session, 'SIGNED_IN');
      return { data: { user, session }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const userId = deterministicUuid(cleanEmail || String(Date.now()));
      const user = {
        id: userId,
        email: cleanEmail,
        user_metadata: { full_name: cleanEmail.split('@').at(0) || 'Intent User' },
      };
      const session = { access_token: 'hp_' + userId, user };
      await writeSession(session, 'SIGNED_IN');
      return { data: { user, session }, error: null };
    },
    async signInWithOtp({ phone, email }) {
      const identifier = String(phone || email || '').trim().toLowerCase();
      const userId = deterministicUuid(identifier || String(Date.now()));
      const user = {
        id: userId,
        phone: phone || null,
        email: email || (identifier.replace(/[^a-z0-9]/g, '') + '@intent.local'),
        user_metadata: { phone: phone || '', full_name: 'Intent Member' },
      };
      const session = { access_token: 'hp_' + userId, user };
      await writeSession(session, 'SIGNED_IN');
      return { data: { user, session }, error: null };
    },
    async updateUser({ data }) {
      const current = await readSession();
      if (!current?.user) return { data: { user: null }, error: { message: 'Not signed in' } };
      const updatedUser = {
        ...current.user,
        user_metadata: { ...(current.user.user_metadata || {}), ...(data || {}) },
      };
      const nextSession = { ...current, user: updatedUser };
      await writeSession(nextSession, 'USER_UPDATED');
      return { data: { user: updatedUser }, error: null };
    },
    async signOut() {
      await writeSession(null, 'SIGNED_OUT');
      return { error: null };
    },
  },
  from(collection) {
    return new QueryBuilder(collection);
  },
  storage: {
    from(_bucket) {
      return {
        async upload(path, file) {
          const url = await fileInputToDataUrl(file);
          uploadedFiles.set(path, url);
          return { data: { path }, error: null };
        },
        getPublicUrl(path) {
          return { data: { publicUrl: uploadedFiles.get(path) || '' } };
        },
      };
    },
  },
  channel(name) {
    return new RealtimeChannel(name);
  },
  removeChannel(ch) {
    try {
      ch?.unsubscribe?.();
    } catch {}
  },
};

export const checkProfileExists = async (userId) => {
  if (!userId) return { exists: false, error: null };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (error) return { exists: false, error: error.message };
    return { exists: !!data, error: null };
  } catch (e) {
    return { exists: false, error: e?.message || 'Profile check failed' };
  }
};

const normalizeProfile = (p) => {
  if (!p) return null;
  const photo = p.avatar_url || p.photo || p.photos?.at(0) || p.images?.at(0) || p.avatar || '';
  const photos = p.photos?.length ? p.photos : p.images?.length ? p.images : photo ? [photo] : [];
  return {
    id: p.id || String(Math.random()),
    name: p.name || p.full_name || p.display_name || 'Intent User',
    age: p.age || 24,
    location: p.location || ([p.city, p.country].filter(Boolean).join(', ') || 'Accra, Ghana'),
    title: p.title || p.job || p.occupation || (p.city ? p.city + ' - ' + (p.country || '') : 'Intentional Member'),
    bio: p.bio || p.about || 'Looking for something real.',
    intent: p.intent || 'Long-term Relationship',
    photos,
    photo,
    avatar: photo,
    avatar_url: photo,
    images: photos,
    interests: p.interests || [],
    prompts: p.prompts || [{ question: 'My ideal Sunday morning', answer: p.bio || 'Coffee, good conversation, and no rush.' }],
    verified: p.verified ?? true,
    city: p.city || 'Accra',
    country: p.country || 'Ghana',
  };
};

const RAW_MOCK = [
  { id: '1', full_name: 'Amara', age: 24, city: 'Accra', country: 'Ghana', bio: 'Love art, coffee and deep conversations. Looking for something real.', intent: 'Long-term Relationship', title: 'Artist & Coffee Lover', avatar_url: 'unsplash.com', interests: ['Art', 'Travel', 'Coffee'] },
  { id: '2', full_name: 'Kwame', age: 27, city: 'Kumasi', country: 'Ghana', bio: 'Entrepreneur. Gym, books, building. Family first.', intent: 'Long-term Relationship', title: 'Entrepreneur', avatar_url: 'unsplash.com', interests: ['Business', 'Fitness'] },
  { id: '3', full_name: 'Efua', age: 26, city: 'Cape Town', country: 'South Africa', bio: 'Cape Town nurse, loves amapiano and beach walks.', intent: 'Friendship First', title: 'Nurse & Foodie', avatar_url: 'unsplash.com', interests: ['Amapiano', 'Beach', 'Cooking'] },
  { id: '4', full_name: 'Kofi', age: 29, city: 'Accra', country: 'Ghana', bio: 'Accra dev. Code by day, highlife by night.', intent: 'Marriage Minded', title: 'Software Engineer', avatar_url: 'unsplash.com', interests: ['Tech', 'Highlife', 'Football'] },
  { id: '5', full_name: 'Abena', age: 25, city: 'Lagos', country: 'Nigeria', bio: 'Lagos designer. Ankara, art, and intentional love.', intent: 'Long-term Relationship', title: 'Fashion Designer', avatar_url: 'unsplash.com', interests: ['Fashion', 'Ankara', 'Travel'] },
  { id: '6', full_name: 'Yaw', age: 31, city: 'Tema', country: 'Ghana', bio: 'Tema photographer. Chasing light and real stories.', intent: 'Activity & Event Buddy', title: 'Photographer', avatar_url: 'unsplash.com', interests: ['Photography', 'Hiplife', 'Travel'] },
  { id: '7', full_name: 'Elena', age: 26, city: 'Berlin', country: 'Germany', bio: 'Love ceramic art and sunsets.', intent: 'Friends First', title: 'Ceramic Artist', avatar_url: 'unsplash.com', interests: ['Art', 'Ceramics'] },
  { id: '8', full_name: 'Zara', age: 23, city: 'London', country: 'UK', bio: 'Studying design. New in town.', intent: 'Activity & Event Buddy', title: 'Design Student', avatar_url: 'unsplash.com', interests: ['Design', 'Art'] },
];

export const MOCK_PROFILES = RAW_MOCK.map(normalizeProfile);

export const getAuthenticatedUser = async () => {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@').at(0) || 'Account',
      intent: u.user_metadata?.intent || 'Long-term Relationship',
      avatar: u.user_metadata?.avatar_url || '',
      photos: u.user_metadata?.avatar_url ? [u.user_metadata.avatar_url] : [],
      ...u,
    };
  } catch {
    return null;
  }
};

export const signUpUser = async (email, password) => {
  return supabase.auth.signUp({ email, password });
};

export const signInUser = async (email, password) => {
  return supabase.auth.signInWithPassword({ email, password });
};

export const signOutUser = async () => {
  try {
    return await supabase.auth.signOut();
  } catch (e) {
    return { error: e };
  }
};
