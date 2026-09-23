const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const storageMap = {
  'kb-registration-submissions': { path: '/submissions/registration', normalize: normalizeRegistration },
  'kb-donation-submissions': { path: '/submissions/donation', normalize: normalizeDonation },
  'kb-volunteer-submissions': { path: '/submissions/volunteer', normalize: normalizeVolunteer },
  'kb-contact-submissions': { path: '/submissions/contact', normalize: normalizeContact },
  'kb-login-submissions': { path: '/submissions/login', normalize: normalizeLogin },
  'kb-admin-classes': { path: '/classes', normalize: normalizeClass },
  'kb-admin-events': { path: '/events', normalize: normalizeEvent }
};

function getToken() {
  try {
    return JSON.parse(localStorage.getItem('kb-auth-token') || 'null');
  } catch {
    return null;
  }
}

function headers() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function normalizeBase(row) {
  return {
    id: row.id,
    createdAt: row.created_at || row.createdAt
  };
}

function normalizeRegistration(row) {
  return {
    ...normalizeBase(row),
    parentName: row.parent_name || row.parentName || row.name,
    studentName: row.student_name || row.studentName || '-',
    email: row.email,
    phone: row.phone || '-',
    program: row.program
  };
}

function normalizeDonation(row) {
  return {
    ...normalizeBase(row),
    name: row.name,
    email: row.email,
    amount: Number(row.amount || 0)
  };
}

function normalizeVolunteer(row) {
  return {
    ...normalizeBase(row),
    name: row.name,
    email: row.email,
    interest: row.interest,
    message: row.message
  };
}

function normalizeContact(row) {
  return {
    ...normalizeBase(row),
    name: row.name,
    email: row.email,
    topic: row.topic,
    message: row.message
  };
}

function normalizeLogin(row) {
  return {
    ...normalizeBase(row),
    email: row.email,
    role: row.role
  };
}

export function normalizeClass(row) {
  return {
    ...normalizeBase(row),
    title: row.title,
    category: row.category,
    status: row.status,
    date: row.date,
    time: row.time,
    age: row.age,
    fee: row.fee,
    location: row.location,
    focus: row.focus,
    photo: row.photo
  };
}

export function normalizeEvent(row) {
  return {
    ...normalizeBase(row),
    month: row.month,
    title: row.title,
    body: row.body,
    location: row.location,
    photo: row.photo
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || 'API request failed.');
  }

  return payload;
}

export async function apiAppendRecord(key, payload) {
  const config = storageMap[key];
  if (!config) return null;

  const data = await request(config.path, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return config.normalize(data);
}

export async function apiReadRecords(key) {
  const config = storageMap[key];
  if (!config) return [];

  const data = await request(config.path);
  return data.map(config.normalize);
}

export async function apiRegister(payload) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  localStorage.setItem('kb-auth-token', JSON.stringify(data.token));
  return data.user;
}

export async function apiLogin(payload) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  localStorage.setItem('kb-auth-token', JSON.stringify(data.token));
  return data.user;
}

export async function apiAdminDashboard() {
  const data = await request('/admin/dashboard');

  return {
    registrations: data.registrations.map(normalizeRegistration),
    donations: data.donations.map(normalizeDonation),
    volunteers: data.volunteers.map(normalizeVolunteer),
    contacts: data.contacts.map(normalizeContact),
    logins: data.logins.map(normalizeLogin),
    classes: data.classes.map(normalizeClass),
    events: data.events.map(normalizeEvent)
  };
}

export function clearApiSession() {
  localStorage.removeItem('kb-auth-token');
}
