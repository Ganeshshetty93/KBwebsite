import { supabase } from './supabase.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const storageMap = {
  'kb-registration-submissions': { path: '/submissions/registration', normalize: normalizeRegistration },
  'kb-donation-submissions': { path: '/submissions/donation', normalize: normalizeDonation },
  'kb-volunteer-submissions': { path: '/submissions/volunteer', normalize: normalizeVolunteer },
  'kb-contact-submissions': { path: '/submissions/contact', normalize: normalizeContact },
  'kb-login-submissions': { path: '/submissions/login', normalize: normalizeLogin },
  'kb-admin-classes': { path: '/classes', normalize: normalizeClass },
  'kb-admin-events': { path: '/events', normalize: normalizeEvent },
  'kb-admin-fundraisers': { path: '/fundraisers', normalize: normalizeFundraiser }
};

function getToken() {
  try {
    return JSON.parse(localStorage.getItem('kb-auth-token') || 'null');
  } catch {
    return null;
  }
}

function getCurrentLocalUser() {
  try {
    return JSON.parse(localStorage.getItem('kb-current-user') || 'null');
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
    amount: Number(row.amount || 0),
    causeId: row.cause_id || row.causeId,
    cause: row.cause_title || row.cause || row.causeTitle,
    paymentStatus: row.payment_status || row.paymentStatus || 'Pending'
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
    eventId: row.event_id || row.eventId,
    urlKey: row.url_key || row.urlKey,
    eventType: row.event_type || row.eventType,
    month: row.month,
    title: row.title,
    body: row.body,
    location: row.location,
    startOn: row.start_on || row.startOn,
    endOn: row.end_on || row.endOn,
    recurrence: row.recurrence,
    capacity: Number(row.capacity || 0),
    isAllDay: row.is_all_day ?? row.isAllDay,
    isAgeRestricted: row.is_age_restricted ?? row.isAgeRestricted,
    isPaymentRequired: row.is_payment_required ?? row.isPaymentRequired,
    enableDefaulterFine: row.enable_defaulter_fine ?? row.enableDefaulterFine,
    isOpenForRegistration: row.is_open_for_registration ?? row.isOpenForRegistration,
    isAutoApproved: row.is_auto_approved ?? row.isAutoApproved,
    enabled: row.enabled,
    displaySeatNumbers: row.display_seat_numbers ?? row.displaySeatNumbers,
    freeForVolunteers: row.free_for_volunteers ?? row.freeForVolunteers,
    enableCheckIn: row.enable_check_in ?? row.enableCheckIn,
    enableVolunteerDiscount: row.enable_volunteer_discount ?? row.enableVolunteerDiscount,
    photo: row.photo
  };
}

export function normalizeFundraiser(row) {
  return {
    ...normalizeBase(row),
    title: row.title,
    category: row.category,
    beneficiary: row.beneficiary,
    purpose: row.purpose,
    goal: Number(row.goal || 0),
    raised: Number(row.raised || 0),
    deadline: row.deadline,
    status: row.status || 'Active',
    photo: row.photo
  };
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers(),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error(`Could not reach API at ${API_BASE}. Make sure npm run server is running.`);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || 'API request failed.');
  }

  return payload;
}

async function ensureAdminToken() {
  if (getToken()) return;

  const user = getCurrentLocalUser();
  if (user?.email?.toLowerCase() !== 'test@gmail.com') return;

  await apiLogin({ email: user.email, password: '' });
}

export async function apiAppendRecord(key, payload) {
  const config = storageMap[key];
  if (!config) return null;

  if (key === 'kb-admin-classes' || key === 'kb-admin-events' || key === 'kb-admin-fundraisers') {
    await ensureAdminToken();
  }

  const data = await request(config.path, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return config.normalize(data);
}

export async function apiReadRecords(key) {
  const config = storageMap[key];
  if (!config) return [];

  try {
    const data = await request(config.path);
    return data.map(config.normalize);
  } catch (error) {
    if (!supabase) throw error;

    const directReadTables = {
      'kb-admin-classes': 'kb_classes',
      'kb-admin-events': 'kb_events',
      'kb-admin-fundraisers': 'kb_fundraisers'
    };
    const table = directReadTables[key];
    if (!table) throw error;

    const { data, error: supabaseError } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (supabaseError) throw supabaseError;
    return (data || []).map(config.normalize);
  }
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
  await ensureAdminToken();
  const data = await request('/admin/dashboard');

  return {
    registrations: data.registrations.map(normalizeRegistration),
    donations: data.donations.map(normalizeDonation),
    volunteers: data.volunteers.map(normalizeVolunteer),
    contacts: data.contacts.map(normalizeContact),
    logins: data.logins.map(normalizeLogin),
    classes: data.classes.map(normalizeClass),
    events: data.events.map(normalizeEvent),
    fundraisers: (data.fundraisers || []).map(normalizeFundraiser)
  };
}

export function clearApiSession() {
  localStorage.removeItem('kb-auth-token');
}
