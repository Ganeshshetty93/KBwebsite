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

export function getAuthToken() {
  try {
    return JSON.parse(localStorage.getItem('kb-auth-token') || 'null');
  } catch {
    return null;
  }
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
  if (!getAuthToken()) {
    localStorage.removeItem('kb-current-user');
    return null;
  }
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

const adminOnlyPaths = [
  '/admin/users',
  '/admin/user-search',
  '/admin/events',
  '/admin/event-settings',
  '/admin/announcements',
  '/admin/about',
  '/admin/paata-teachers',
  '/admin/fundraising',
  '/admin/donations',
  '/admin/messages',
  '/admin/volunteer-interest',
  '/admin/email-outbox',
  '/admin/developer',
  '/admin/registrations',
  '/admin/registration-classes',
  '/admin/registration-payments'
];

const rolePathRules = [
  { path: '/admin/checkin', roles: ['receptionist'] },
  { path: '/admin/guest-checkin', roles: ['receptionist'] },
  { path: '/admin/seats', roles: ['receptionist'] },
  { path: '/admin/expense', roles: ['volunteer'] },
  { path: '/admin/teacher', roles: ['teacher'] },
  { path: '/admin/teacher-attendance', roles: ['teacher'] },
  { path: '/admin/treasurer', roles: ['treasurer'] },
  ...adminOnlyPaths.map((path) => ({ path, roles: ['admin', 'superadmin'] }))
];

export function canAccessAdminPath(user, pathname = '/admin') {
  if (!canUseAdminArea(user)) return false;
  if (isAdmin(user)) return true;

  const normalizedPath = String(pathname || '/admin').replace(/\/+$/, '') || '/admin';
  const rule = rolePathRules.find((item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`));
  if (!rule) return true;
  return hasAnyRole(user, rule.roles);
}

export function defaultAdminPath(user) {
  if (isAdmin(user)) return '/admin';
  if (hasAnyRole(user, ['receptionist'])) return '/admin/checkin';
  if (hasAnyRole(user, ['teacher'])) return '/admin/teacher';
  if (hasAnyRole(user, ['treasurer'])) return '/admin/treasurer';
  if (hasAnyRole(user, ['volunteer'])) return '/admin/expense';
  return '/admin';
}
