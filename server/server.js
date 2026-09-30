import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireSupabase } from './supabaseClient.js';
import { submissionTables } from './tableMap.js';

const app = express();
const port = process.env.PORT || 4000;
const adminEmail = (process.env.ADMIN_EMAIL || 'test@gmail.com').toLowerCase();
const jwtSecret = process.env.JWT_SECRET || 'dev-only-change-this-secret';
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN,
  'http://127.0.0.1:5173',
  'http://localhost:5173'
].filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  }
}));
app.use(express.json({ limit: '12mb' }));

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone
  };
}

function tokenFor(user) {
  return jwt.sign(publicUser(user), jwtSecret, { expiresIn: '7d' });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Login required.' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid login token.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  return next();
}

async function insertRecord(table, payload) {
  const supabase = requireSupabase();
  let normalizedPayload = normalizePayload(table, payload);
  let result = await supabase
    .from(table)
    .insert({ ...normalizedPayload, created_at: new Date().toISOString() })
    .select('*')
    .single();

  if (result.error && table === 'kb_donations' && /cause_id|cause_title|payment_status/i.test(result.error.message || '')) {
    normalizedPayload = {
      name: payload.name,
      email: payload.email,
      amount: Number(payload.amount || 0)
    };
    result = await supabase
      .from(table)
      .insert({ ...normalizedPayload, created_at: new Date().toISOString() })
      .select('*')
      .single();
  }

  const { data, error } = result;
  if (error) throw error;
  return data;
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1', 'on', 'paid', 'enabled'].includes(normalized)) return true;
    if (['false', 'no', '0', 'off', 'unpaid', 'disabled'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizePayload(table, payload) {
  if (table === 'kb_registrations') {
    const adults = numberValue(payload.adults ?? payload.adultCount, 1);
    const kids = numberValue(payload.kids ?? payload.kidCount, 0);
    const youngKids = numberValue(payload.youngKids ?? payload.young_kids ?? payload.youngKidCount, 0);
    const totalMembers = numberValue(payload.totalMembers ?? payload.total_members ?? payload.seats, adults + kids + youngKids);

    return {
      parent_name: payload.parent_name || payload.parentName || payload.name,
      student_name: payload.student_name || payload.studentName || '-',
      email: payload.email,
      phone: payload.phone || null,
      program: payload.program,
      family_member: payload.family_member || payload.familyMember || null,
      paid: booleanValue(payload.paid, false),
      email_status: payload.email_status || payload.emailStatus || null,
      birth_year: payload.birth_year || payload.birthYear || null,
      status: payload.status || 'Submitted',
      event_id: payload.event_id || payload.eventId || null,
      fee: payload.fee || null,
      amount: numberValue(payload.amount, 0),
      seats: numberValue(payload.seats, totalMembers || 1),
      adults,
      kids,
      young_kids: youngKids,
      total_members: totalMembers || 1
    };
  }

  if (table === 'kb_donations') {
    return {
      name: payload.name,
      email: payload.email,
      amount: numberValue(payload.amount, 0),
      cause_id: payload.causeId || payload.cause_id || null,
      cause_title: payload.cause || payload.causeTitle || payload.cause_title || null,
      payment_status: payload.paymentStatus || payload.payment_status || 'Pending'
    };
  }

  if (table === 'kb_volunteers') {
    return {
      name: payload.name,
      email: payload.email,
      interest: payload.interest,
      message: payload.message
    };
  }

  if (table === 'kb_contacts') {
    return {
      name: payload.name,
      email: payload.email,
      topic: payload.topic,
      message: payload.message
    };
  }

  if (table === 'kb_logins') {
    return {
      email: payload.email,
      role: payload.role
    };
  }

  if (table === 'kb_events') {
    return {
      event_id: payload.event_id || payload.eventId || null,
      url_key: payload.url_key || payload.urlKey || null,
      event_type: payload.event_type || payload.eventType || null,
      month: payload.month,
      title: payload.title,
      body: payload.body,
      location: payload.location,
      start_on: payload.start_on || payload.startOn || null,
      end_on: payload.end_on || payload.endOn || null,
      recurrence: payload.recurrence || null,
      capacity: numberValue(payload.capacity, 0),
      is_all_day: booleanValue(payload.is_all_day ?? payload.isAllDay, false),
      is_age_restricted: booleanValue(payload.is_age_restricted ?? payload.isAgeRestricted, false),
      is_payment_required: booleanValue(payload.is_payment_required ?? payload.isPaymentRequired, false),
      enable_defaulter_fine: booleanValue(payload.enable_defaulter_fine ?? payload.enableDefaulterFine, false),
      is_open_for_registration: booleanValue(payload.is_open_for_registration ?? payload.isOpenForRegistration, false),
      is_auto_approved: booleanValue(payload.is_auto_approved ?? payload.isAutoApproved, false),
      enabled: booleanValue(payload.enabled, true),
      display_seat_numbers: booleanValue(payload.display_seat_numbers ?? payload.displaySeatNumbers, false),
      free_for_volunteers: booleanValue(payload.free_for_volunteers ?? payload.freeForVolunteers, false),
      enable_check_in: booleanValue(payload.enable_check_in ?? payload.enableCheckIn, false),
      enable_volunteer_discount: booleanValue(payload.enable_volunteer_discount ?? payload.enableVolunteerDiscount, false),
      photo: payload.photo || null
    };
  }

  if (table === 'kb_announcements') {
    return {
      text: payload.text || payload.announcementText,
      cta_text: payload.cta_text || payload.ctaText || null,
      cta_url: payload.cta_url || payload.ctaUrl || null,
      start_on: payload.start_on || payload.startOn || null,
      end_on: payload.end_on || payload.endOn || null,
      enabled: booleanValue(payload.enabled, true)
    };
  }

  if (table === 'kb_expenses') {
    return {
      title: payload.title || payload.name || 'Expense',
      category: payload.category || null,
      amount: numberValue(payload.amount, 0),
      expense_date: payload.expense_date || payload.expenseDate || payload.date || null,
      description: payload.description || payload.notes || null,
      status: payload.status || 'Submitted',
      submitted_by: payload.submitted_by || payload.submittedBy || payload.email || null
    };
  }

  if (table === 'kb_checkins') {
    return {
      registration_id: payload.registration_id || payload.registrationId || null,
      registration_key: payload.registration_key || payload.registrationKey || null,
      event_id: payload.event_id || payload.eventId || null,
      checked_in: booleanValue(payload.checked_in ?? payload.checkedIn, true),
      checked_in_at: payload.checked_in_at || payload.checkedInAt || new Date().toISOString(),
      checked_in_by: payload.checked_in_by || payload.checkedInBy || payload.email || null
    };
  }

  return payload;
}

function normalizePatch(table, payload) {
  if (table !== 'kb_registrations') return payload;

  const patch = {};
  const assign = (sourceKey, targetKey = sourceKey) => {
    if (Object.prototype.hasOwnProperty.call(payload, sourceKey)) patch[targetKey] = payload[sourceKey];
  };

  assign('parentName', 'parent_name');
  assign('parent_name');
  assign('studentName', 'student_name');
  assign('student_name');
  assign('email');
  assign('phone');
  assign('program');
  assign('familyMember', 'family_member');
  assign('family_member');
  if (Object.prototype.hasOwnProperty.call(payload, 'paid')) patch.paid = booleanValue(payload.paid, false);
  assign('emailStatus', 'email_status');
  assign('email_status');
  assign('birthYear', 'birth_year');
  assign('birth_year');
  assign('status');
  assign('eventId', 'event_id');
  assign('event_id');
  assign('fee');
  if (Object.prototype.hasOwnProperty.call(payload, 'amount')) patch.amount = numberValue(payload.amount, 0);
  if (Object.prototype.hasOwnProperty.call(payload, 'seats')) patch.seats = numberValue(payload.seats, 1);
  if (Object.prototype.hasOwnProperty.call(payload, 'adults')) patch.adults = numberValue(payload.adults, 1);
  if (Object.prototype.hasOwnProperty.call(payload, 'kids')) patch.kids = numberValue(payload.kids, 0);
  if (Object.prototype.hasOwnProperty.call(payload, 'youngKids')) patch.young_kids = numberValue(payload.youngKids, 0);
  if (Object.prototype.hasOwnProperty.call(payload, 'young_kids')) patch.young_kids = numberValue(payload.young_kids, 0);
  if (Object.prototype.hasOwnProperty.call(payload, 'totalMembers')) patch.total_members = numberValue(payload.totalMembers, 1);
  if (Object.prototype.hasOwnProperty.call(payload, 'total_members')) patch.total_members = numberValue(payload.total_members, 1);

  return patch;
}

function normalizeFundraiserPayload(payload) {
  return {
    title: payload.title,
    category: payload.category,
    beneficiary: payload.beneficiary,
    purpose: payload.purpose || payload.details || payload.description || null,
    details: payload.details || payload.purpose || payload.description || null,
    goal: numberValue(payload.goal ?? payload.goalAmount ?? payload.goal_amount, 0),
    goal_amount: numberValue(payload.goal_amount ?? payload.goalAmount ?? payload.goal, 0),
    raised: numberValue(payload.raised ?? payload.raisedAmount ?? payload.raised_amount, 0),
    raised_amount: numberValue(payload.raised_amount ?? payload.raisedAmount ?? payload.raised, 0),
    deadline: payload.deadline || payload.neededBy || payload.needed_by || null,
    needed_by: payload.needed_by || payload.neededBy || payload.deadline || null,
    status: payload.status || 'Active',
    enabled: booleanValue(payload.enabled, true),
    photo: payload.photo || null
  };
}

async function listTable(table) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function listOptionalTable(table) {
  try {
    return await listTable(table);
  } catch (error) {
    if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
      return [];
    }

    throw error;
  }
}

async function updateRecord(table, id, payload) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(table)
    .update(normalizePatch(table, payload))
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function deleteRecord(table, id) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Kannada Bharati API' });
});

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const name = req.body.name || `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim() || email.split('@')[0];
  const passwordHash = await bcrypt.hash(password, 10);
  const role = email === adminEmail ? 'admin' : 'member';

  const { data: user, error: userError } = await supabase
    .from('kb_users')
    .upsert({
      email,
      name,
      phone: req.body.phone || null,
      role,
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' })
    .select('*')
    .single();

  if (userError) throw userError;

  await insertRecord('kb_registrations', {
    parent_name: name,
    student_name: req.body.studentName || '-',
    email,
    phone: req.body.phone || null,
    program: req.body.program || 'General membership'
  });

  const cleanUser = publicUser(user);
  res.status(201).json({ user: cleanUser, token: tokenFor(user) });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const { data: existing, error: selectError } = await supabase
    .from('kb_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (selectError) throw selectError;

  let user = existing;

  if (user?.password_hash && email !== adminEmail) {
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!user) {
    const { data: created, error: createError } = await supabase
      .from('kb_users')
      .insert({
        email,
        name: email === adminEmail ? 'Admin' : email.split('@')[0],
        role: email === adminEmail ? 'admin' : 'member',
        password_hash: password ? await bcrypt.hash(password, 10) : null
      })
      .select('*')
      .single();

    if (createError) throw createError;
    user = created;
  }

  await insertRecord('kb_logins', {
    email,
    role: user.role
  });

  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.get('/api/submissions/:type', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const table = submissionTables[req.params.type];
  if (!table) return res.status(404).json({ error: 'Unknown submission type.' });
  res.json(await listTable(table));
}));

app.post('/api/submissions/:type', asyncHandler(async (req, res) => {
  const table = submissionTables[req.params.type];
  if (!table) return res.status(404).json({ error: 'Unknown submission type.' });
  res.status(201).json(await insertRecord(table, req.body));
}));

app.patch('/api/submissions/:type/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const table = submissionTables[req.params.type];
  if (!table) return res.status(404).json({ error: 'Unknown submission type.' });
  res.json(await updateRecord(table, req.params.id, req.body));
}));

app.delete('/api/submissions/:type/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const table = submissionTables[req.params.type];
  if (!table) return res.status(404).json({ error: 'Unknown submission type.' });
  await deleteRecord(table, req.params.id);
  res.json({ ok: true });
}));

app.get('/api/classes', asyncHandler(async (req, res) => {
  res.json(await listTable('kb_classes'));
}));

app.post('/api/classes', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await insertRecord('kb_classes', req.body));
}));

app.get('/api/events', asyncHandler(async (req, res) => {
  res.json(await listTable('kb_events'));
}));

app.post('/api/events', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await insertRecord('kb_events', req.body));
}));

app.get('/api/fundraisers', asyncHandler(async (req, res) => {
  res.json(await listOptionalTable('kb_fundraisers'));
}));

app.post('/api/fundraisers', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await insertRecord('kb_fundraisers', normalizeFundraiserPayload(req.body)));
}));

app.get('/api/admin/dashboard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const [users, registrations, donations, volunteers, contacts, logins, classes, events, fundraisers, announcements, expenses, checkins] = await Promise.all([
    listTable('kb_users'),
    listTable('kb_registrations'),
    listTable('kb_donations'),
    listTable('kb_volunteers'),
    listTable('kb_contacts'),
    listTable('kb_logins'),
    listTable('kb_classes'),
    listTable('kb_events'),
    listOptionalTable('kb_fundraisers'),
    listOptionalTable('kb_announcements'),
    listOptionalTable('kb_expenses'),
    listOptionalTable('kb_checkins')
  ]);

  res.json({ users, registrations, donations, volunteers, contacts, logins, classes, events, fundraisers, announcements, expenses, checkins });
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || 'Server error.'
  });
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Kannada Bharati API running on http://localhost:${port}`);
  });
}

export default app;
