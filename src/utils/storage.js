import { apiAppendRecord, clearApiSession } from './api.js';

export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'ganeshshetty93@gmail.com').toLowerCase();

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

export async function appendAdminRecordAsync(key, payload) {
  try {
    const saved = await apiAppendRecord(key, payload);
    if (!saved) {
      throw new Error('Record was not saved to the database.');
    }

    const existing = readJson(key, []);
    writeJson(key, [...existing, saved]);
    window.dispatchEvent(new Event('kb-data-change'));
    return saved;
  } catch (error) {
    if (key !== 'kb-admin-fundraisers') {
      throw error;
    }

    return saveLocalRecord(key, {
      ...payload,
      id: `local-fundraiser-${Date.now()}`
    });
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
  return user?.email?.toLowerCase() === ADMIN_EMAIL || hasAnyRole(user, ['admin', 'superadmin']);
}

export function userRoles(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : String(user?.role || 'member').split(',');
  return [...new Set(roles.map((role) => String(role || '').trim().toLowerCase()).filter(Boolean))];
}

export function hasAnyRole(user, roles = []) {
  const normalized = roles.map((role) => String(role).toLowerCase());
  const current = userRoles(user);
  return current.some((role) => normalized.includes(role));
}

export function canUseAdminArea(user) {
  return Boolean(user);
}
