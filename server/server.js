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

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173' }));
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
  const { data, error } = await supabase
    .from(table)
    .insert({ ...normalizePayload(table, payload), created_at: new Date().toISOString() })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

function normalizePayload(table, payload) {
  if (table === 'kb_registrations') {
    return {
      parent_name: payload.parent_name || payload.parentName || payload.name,
      student_name: payload.student_name || payload.studentName || '-',
      email: payload.email,
      phone: payload.phone || null,
      program: payload.program
    };
  }

  if (table === 'kb_donations') {
    return {
      name: payload.name,
      email: payload.email,
      amount: Number(payload.amount || 0)
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

  return payload;
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

app.get('/api/admin/dashboard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const [registrations, donations, volunteers, contacts, logins, classes, events] = await Promise.all([
    listTable('kb_registrations'),
    listTable('kb_donations'),
    listTable('kb_volunteers'),
    listTable('kb_contacts'),
    listTable('kb_logins'),
    listTable('kb_classes'),
    listTable('kb_events')
  ]);

  res.json({ registrations, donations, volunteers, contacts, logins, classes, events });
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || 'Server error.'
  });
});

app.listen(port, () => {
  console.log(`Kannada Bharati API running on http://localhost:${port}`);
});
