import { apiAppendRecord, clearApiSession } from './api.js';

export function readJson(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveLocalRecord(key, payload) {
  const existing = readJson(key, []);
  const record = { ...payload, createdAt: new Date().toISOString() };
  writeJson(key, [...existing, record]);
  window.dispatchEvent(new Event('kb-data-change'));
  return record;
}

function replaceLocalRecord(key, original, saved) {
  const current = readJson(key, []);
  writeJson(key, [...current.filter((item) => item.createdAt !== original.createdAt), saved]);
  window.dispatchEvent(new Event('kb-data-change'));
}

export function appendRecord(key, payload) {
  const record = saveLocalRecord(key, payload);
  apiAppendRecord(key, payload)
    .then((saved) => {
      if (!saved) return;
      replaceLocalRecord(key, record, saved);
    })
    .catch(() => {
      // Local fallback keeps the demo usable when Supabase is not configured.
    });
  return record;
}

export async function appendRecordAsync(key, payload) {
  const record = saveLocalRecord(key, payload);

  try {
    const saved = await apiAppendRecord(key, payload);
    if (!saved) return record;
    replaceLocalRecord(key, record, saved);
    return saved;
  } catch {
    return record;
  }
}

export function getCurrentUser() {
  return readJson('kb-current-user', null);
}

export function setCurrentUser(user) {
  if (user) {
    writeJson('kb-current-user', user);
  } else {
    localStorage.removeItem('kb-current-user');
    clearApiSession();
  }
  window.dispatchEvent(new Event('kb-auth-change'));
}

export function isAdmin(user) {
  return user?.email?.toLowerCase() === 'test@gmail.com';
}
