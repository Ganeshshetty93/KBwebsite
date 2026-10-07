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

export const builtInAssignableRoles = ['member', 'admin', 'superadmin', 'welcomeDesk', 'teacher', 'volunteer', 'treasurer'];

export const adminPageCatalog = [
  { path: '/admin', label: 'Dashboard', fields: ['summary', 'registrations', 'events', 'announcements'] },
  { path: '/admin/profile', label: 'Profile', fields: ['name', 'email', 'phone', 'children', 'externalLogins'] },
  { path: '/admin/checkin', label: 'Welcome Desk check-in', fields: ['program', 'studentName', 'email', 'phone', 'status', 'action'] },
  { path: '/admin/guest-checkin', label: 'Guest check-in', fields: ['name', 'email', 'phone', 'event', 'seat'] },
  { path: '/admin/seats', label: 'Seat Management', fields: ['eventId', 'seatNumber', 'registration', 'assignedTo', 'action'] },
  { path: '/admin/expense', label: 'Volunteer Expense', fields: ['title', 'category', 'amount', 'receipt', 'status'] },
  { path: '/admin/teacher', label: 'Teacher Class Area', fields: ['program', 'studentName', 'email', 'phone', 'status', 'paid'] },
  { path: '/admin/teacher-attendance', label: 'Teacher Attendance', fields: ['className', 'studentName', 'status', 'notes', 'attendanceDate'] },
  { path: '/admin/treasurer', label: 'Treasurer Expense Review', fields: ['title', 'amount', 'submittedBy', 'receipt', 'status', 'action'] },
  { path: '/admin/users', label: 'Users', fields: ['createdAt', 'email', 'firstName', 'lastName', 'phone', 'role', 'enabled'] },
  { path: '/admin/user-search', label: 'Find User', fields: ['email', 'profile', 'children', 'registrations'] },
  { path: '/admin/classes', label: 'Class Management', fields: ['title', 'category', 'status', 'date', 'time', 'fee', 'location', 'actions'] },
  { path: '/admin/events', label: 'Event Management', fields: ['eventId', 'title', 'eventType', 'startOn', 'location', 'capacity', 'enabled', 'actions'] },
  { path: '/admin/event-settings', label: 'Event Settings', fields: ['eventTypes', 'recurrences', 'volunteerForm'] },
  { path: '/admin/event-hero', label: 'Event Hero Photos', fields: ['image', 'alt', 'caption', 'position', 'enabled', 'order'] },
  { path: '/admin/teacher-allotments', label: 'Teacher Allotment', fields: ['classTitle', 'teacherEmail', 'teacherName', 'notes', 'enabled', 'actions'] },
  { path: '/admin/role-access', label: 'Role & Access', fields: ['role', 'pages', 'fields', 'actions'] },
  { path: '/admin/announcements', label: 'Announcements', fields: ['text', 'ctaText', 'startOn', 'endOn', 'enabled', 'actions'] },
  { path: '/admin/about', label: 'About Us', fields: ['committee', 'sponsors', 'pastCommittees'] },
  { path: '/admin/paata-teachers', label: 'Paata Teachers', fields: ['name', 'role', 'level', 'email', 'phone', 'photo'] },
  { path: '/admin/fundraising', label: 'Fund Raising', fields: ['title', 'category', 'goal', 'raised', 'status', 'actions'] },
  { path: '/admin/donations', label: 'Donations', fields: ['name', 'email', 'amount', 'cause', 'paymentStatus'] },
  { path: '/admin/messages', label: 'Messages', fields: ['audience', 'subject', 'message'] },
  { path: '/admin/volunteer-interest', label: 'Volunteer Interest', fields: ['name', 'email', 'interest', 'message'] },
  { path: '/admin/student-view', label: 'Student View', fields: ['registrations', 'classes', 'events'] },
  { path: '/admin/email-outbox', label: 'Email Outbox', fields: ['to', 'subject', 'status', 'sentAt', 'actions'] },
  { path: '/admin/developer', label: 'Developer Tools', fields: ['diagnostics', 'templates', 'cache'] },
  { path: '/admin/registrations', label: 'Event Details', fields: ['status', 'paid', 'studentName', 'email', 'amount', 'phone', 'action'] },
  { path: '/admin/registration-classes', label: 'Class Details', fields: ['status', 'paid', 'program', 'studentName', 'email', 'phone', 'action'] },
  { path: '/admin/registration-payments', label: 'Payment Details', fields: ['program', 'email', 'amount', 'paymentStatus', 'paymentReference'] }
];

export function normalizeRoleId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function getRoleDefinitions() {
  return readJson('kb-role-definitions', []).map((role) => ({
    id: normalizeRoleId(role.id || role.name),
    name: String(role.name || role.id || '').trim(),
    description: String(role.description || '').trim(),
    pages: Array.isArray(role.pages) ? role.pages : [],
    fields: role.fields && typeof role.fields === 'object' ? role.fields : {}
  })).filter((role) => role.id && role.name);
}

export function getAssignableRoles() {
  return [...new Set([...builtInAssignableRoles, ...getRoleDefinitions().map((role) => role.id)])];
}

function matchingAdminPath(pathname = '/admin') {
  const normalizedPath = String(pathname || '/admin').replace(/\/+$/, '') || '/admin';
  return adminPageCatalog
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find((page) => normalizedPath === page.path || normalizedPath.startsWith(`${page.path}/`));
}

export function customRoleAccessForPath(user, pathname = '/admin') {
  const path = matchingAdminPath(pathname)?.path || '/admin';
  const definitions = getRoleDefinitions();
  const roles = userRoles(user);
  return definitions.filter((role) => roles.includes(role.id) && role.pages.includes(path));
}

export function getAllowedFieldKeysForPath(user, pathname = '/admin') {
  if (!user || isAdmin(user)) return null;
  const path = matchingAdminPath(pathname)?.path || '/admin';
  const allowed = customRoleAccessForPath(user, pathname).flatMap((role) => role.fields?.[path] || []);
  const cleaned = [...new Set(allowed.map((field) => String(field || '').trim()).filter(Boolean))];
  return cleaned.length ? cleaned : null;
}

export function canUseAdminArea(user) {
  return Boolean(user);
}

const adminOnlyPaths = [
  '/admin/users',
  '/admin/user-search',
  '/admin/classes',
  '/admin/events',
  '/admin/event-settings',
  '/admin/event-hero',
  '/admin/teacher-allotments',
  '/admin/role-access',
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
  { path: '/admin/checkin', roles: ['welcomeDesk', 'welcomedesk', 'receptionist'] },
  { path: '/admin/guest-checkin', roles: ['welcomeDesk', 'welcomedesk', 'receptionist'] },
  { path: '/admin/seats', roles: ['welcomeDesk', 'welcomedesk', 'receptionist'] },
  { path: '/admin/expense', roles: ['volunteer'] },
  { path: '/admin/teacher', roles: ['teacher'] },
  { path: '/admin/teacher-attendance', roles: ['teacher'] },
  { path: '/admin/treasurer', roles: ['treasurer'] },
  ...adminOnlyPaths.map((path) => ({ path, roles: ['admin', 'superadmin'] }))
];

export function canAccessAdminPath(user, pathname = '/admin') {
  if (!canUseAdminArea(user)) return false;
  if (isAdmin(user)) return true;
  if (customRoleAccessForPath(user, pathname).length) return true;

  const normalizedPath = String(pathname || '/admin').replace(/\/+$/, '') || '/admin';
  const rule = rolePathRules.find((item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`));
  if (!rule) return true;
  return hasAnyRole(user, rule.roles);
}

export function defaultAdminPath(user) {
  if (isAdmin(user)) return '/admin';
  const firstCustomPage = getRoleDefinitions().find((role) => userRoles(user).includes(role.id) && role.pages.length)?.pages?.[0];
  if (firstCustomPage) return firstCustomPage;
  if (hasAnyRole(user, ['welcomeDesk', 'welcomedesk', 'receptionist'])) return '/admin/checkin';
  if (hasAnyRole(user, ['teacher'])) return '/admin/teacher';
  if (hasAnyRole(user, ['treasurer'])) return '/admin/treasurer';
  if (hasAnyRole(user, ['volunteer'])) return '/admin/expense';
  return '/admin';
}
