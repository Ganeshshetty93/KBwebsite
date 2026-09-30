import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { BlobServiceClient } from '@azure/storage-blob';
import { requireSupabase } from './supabaseClient.js';
import { submissionTables } from './tableMap.js';

const app = express();
const port = process.env.PORT || 4000;
const adminEmail = (process.env.ADMIN_EMAIL || 'ganeshshetty93@gmail.com').toLowerCase();
const jwtSecret = process.env.JWT_SECRET || 'dev-only-change-this-secret';
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
const azureStorageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.StorageAccount || '';
const smtpHost = process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.EMAIL_SMTP_PORT || process.env.SMTP_PORT || 587);
const smtpUser = process.env.EMAIL_SMTP_USER || process.env.SMTP_USER || '';
const smtpPass = process.env.EMAIL_SMTP_PASS || process.env.SMTP_PASS || '';
const emailFromAddress = process.env.EMAIL_FROM_ADDRESS || smtpUser || 'no-reply@kannadabharati.org';
const recaptchaSecret = process.env.GOOGLE_RECAPTCHA_SECRET || '';
const paypalBaseUrl = (process.env.PAYPAL_ENV || 'live').toLowerCase() === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';
const appBaseUrl = process.env.APP_BASE_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174';
const roleNames = ['member', 'admin', 'superadmin', 'receptionist', 'teacher', 'volunteer', 'treasurer'];
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
  const roles = normalizeRoles(user.roles || user.role);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: roles.includes('admin') || roles.includes('superadmin') ? 'admin' : roles[0] || 'member',
    roles,
    phone: user.phone,
    emailConfirmed: booleanValue(user.email_confirmed, false),
    twoFactorEnabled: booleanValue(user.two_factor_enabled, false),
    isVolunteeringDefaulter: booleanValue(user.is_volunteering_defaulter, false)
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
  const roles = normalizeRoles(req.user?.roles || req.user?.role);
  if (!roles.some((role) => ['admin', 'superadmin'].includes(role)) && req.user?.email?.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  return next();
}

function hasAnyRole(user, allowedRoles = []) {
  const roles = normalizeRoles(user?.roles || user?.role);
  const allowed = allowedRoles.map((role) => String(role).toLowerCase());
  return roles.some((role) => allowed.includes(role)) || user?.email?.toLowerCase() === adminEmail;
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!hasAnyRole(req.user, ['admin', 'superadmin', ...allowedRoles])) {
      return res.status(403).json({ error: 'Access denied for this role.' });
    }

    return next();
  };
}

function normalizeRoles(value) {
  const values = Array.isArray(value) ? value : String(value || 'member').split(',');
  const roles = values
    .map((role) => String(role || '').trim().toLowerCase())
    .filter((role) => roleNames.includes(role));
  return [...new Set(roles.length ? roles : ['member'])];
}

function primaryRole(roles) {
  if (roles.includes('superadmin')) return 'admin';
  if (roles.includes('admin')) return 'admin';
  return roles[0] || 'member';
}

async function insertRecord(table, payload) {
  const supabase = requireSupabase();
  let normalizedPayload = normalizePayload(table, payload);
  let result = await supabase
    .from(table)
    .insert({ ...normalizedPayload, created_at: new Date().toISOString() })
    .select('*')
    .single();

  if (result.error && table === 'kb_donations' && /cause_id|cause_title|payment_status|paypal_order_id|paypal_capture_id|payment_payload/i.test(result.error.message || '')) {
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function safePathPart(value, fallback = 'upload') {
  return String(value || fallback)
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[^a-z0-9._-]/gi, '-').replace(/-+/g, '-').slice(0, 80))
    .filter(Boolean)
    .join('/') || fallback;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    const error = new Error('Upload must be a base64 data URL.');
    error.status = 400;
    throw error;
  }

  const contentType = match[1].toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(contentType)) {
    const error = new Error('Only png, jpg, jpeg, and webp images can be uploaded.');
    error.status = 400;
    throw error;
  }

  return {
    contentType: contentType === 'image/jpg' ? 'image/jpeg' : contentType,
    buffer: Buffer.from(match[2], 'base64')
  };
}

async function uploadImageFile({ dataUrl, fileName, container = 'users', directory = '' }) {
  const parsed = parseDataUrl(dataUrl);
  if (parsed.buffer.length > 8 * 1024 * 1024) {
    const error = new Error('Image must be smaller than 8 MB.');
    error.status = 400;
    throw error;
  }

  if (!azureStorageConnectionString) {
    return {
      url: dataUrl,
      storage: 'inline'
    };
  }

  const extensionFromType = parsed.contentType === 'image/png' ? 'png' : parsed.contentType === 'image/webp' ? 'webp' : 'jpg';
  const safeContainer = safePathPart(container, 'users').split('/')[0].toLowerCase();
  const safeDirectory = directory ? safePathPart(directory, '') : '';
  const safeFileName = safePathPart(fileName || `upload-${Date.now()}.${extensionFromType}`, `upload.${extensionFromType}`);
  const fileExtension = /\.[a-z0-9]+$/i.test(safeFileName) ? '' : `.${extensionFromType}`;
  const blobName = [safeDirectory, `${Date.now()}-${crypto.randomUUID()}-${safeFileName}${fileExtension}`].filter(Boolean).join('/');

  const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
  const containerClient = blobServiceClient.getContainerClient(safeContainer);
  await containerClient.createIfNotExists({ access: 'blob' });
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(parsed.buffer, {
    blobHTTPHeaders: {
      blobContentType: parsed.contentType
    }
  });

  return {
    url: blockBlobClient.url,
    storage: 'azure',
    container: safeContainer,
    path: blobName
  };
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
      total_members: totalMembers || 1,
      registration_type: payload.registrationType || payload.registration_type || 'member',
      rsvp: payload.rsvp || null,
      price_menu: payload.priceMenu || payload.price_menu || null,
      payment_received: booleanValue(payload.paymentReceived ?? payload.payment_received, false),
      checked_in: booleanValue(payload.checkedIn ?? payload.checked_in, false),
      checked_in_at: payload.checkedInAt || payload.checked_in_at || null,
      enabled: booleanValue(payload.enabled, true)
    };
  }

  if (table === 'kb_donations') {
    return {
      name: payload.name,
      email: payload.email,
      amount: numberValue(payload.amount, 0),
      cause_id: isUuid(payload.causeId || payload.cause_id) ? (payload.causeId || payload.cause_id) : null,
      cause_title: payload.cause || payload.causeTitle || payload.cause_title || null,
      payment_status: payload.paymentStatus || payload.payment_status || 'Pending',
      paypal_order_id: payload.paypalOrderId || payload.paypal_order_id || null,
      paypal_capture_id: payload.paypalCaptureId || payload.paypal_capture_id || null,
      payment_payload: payload.paymentPayload || payload.payment_payload || null
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
      volunteer_discount_percentage: numberValue(payload.volunteer_discount_percentage ?? payload.volunteerDiscountPercentage, 0),
      defaulter_fine_amount: numberValue(payload.defaulter_fine_amount ?? payload.defaulterFineAmount, 0),
      rsvp: payload.rsvp || null,
      price_menu: payload.priceMenu || payload.price_menu || null,
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
  if (table === 'kb_users') {
    const roles = normalizeRoles(payload.roles || payload.role);
    const patch = {};
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.phone !== undefined) patch.phone = payload.phone;
    if (payload.role !== undefined || payload.roles !== undefined) {
      patch.role = primaryRole(roles);
      patch.roles = roles;
    }
    if (payload.enabled !== undefined) patch.enabled = booleanValue(payload.enabled, true);
    if (payload.emailConfirmed !== undefined || payload.email_confirmed !== undefined) patch.email_confirmed = booleanValue(payload.emailConfirmed ?? payload.email_confirmed, false);
    if (payload.twoFactorEnabled !== undefined || payload.two_factor_enabled !== undefined) patch.two_factor_enabled = booleanValue(payload.twoFactorEnabled ?? payload.two_factor_enabled, false);
    if (payload.isVolunteeringDefaulter !== undefined || payload.is_volunteering_defaulter !== undefined) patch.is_volunteering_defaulter = booleanValue(payload.isVolunteeringDefaulter ?? payload.is_volunteering_defaulter, false);
    if (payload.defaulterNotes !== undefined || payload.defaulter_notes !== undefined) patch.defaulter_notes = payload.defaulterNotes ?? payload.defaulter_notes;
    patch.updated_at = new Date().toISOString();
    return patch;
  }

  if (table === 'kb_email_outbox') {
    const patch = {};
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.sent_at !== undefined || payload.sentAt !== undefined) patch.sent_at = payload.sent_at ?? payload.sentAt;
    return patch;
  }

  if (table === 'kb_seats') {
    const patch = {};
    if (payload.registrationId !== undefined || payload.registration_id !== undefined) patch.registration_id = payload.registrationId ?? payload.registration_id;
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.assignedTo !== undefined || payload.assigned_to !== undefined) patch.assigned_to = payload.assignedTo ?? payload.assigned_to;
    if (payload.updatedAt !== undefined || payload.updated_at !== undefined) patch.updated_at = payload.updatedAt ?? payload.updated_at;
    return patch;
  }

  if (table === 'kb_expenses') {
    const patch = {};
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.notes !== undefined) patch.description = payload.notes;
    if (payload.approvedBy !== undefined || payload.approved_by !== undefined) patch.approved_by = payload.approvedBy ?? payload.approved_by;
    if (payload.approvedAt !== undefined || payload.approved_at !== undefined) patch.approved_at = payload.approvedAt ?? payload.approved_at;
    return patch;
  }

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
  if (Object.prototype.hasOwnProperty.call(payload, 'paymentReceived')) patch.payment_received = booleanValue(payload.paymentReceived, false);
  if (Object.prototype.hasOwnProperty.call(payload, 'payment_received')) patch.payment_received = booleanValue(payload.payment_received, false);
  if (Object.prototype.hasOwnProperty.call(payload, 'checkedIn')) patch.checked_in = booleanValue(payload.checkedIn, false);
  if (Object.prototype.hasOwnProperty.call(payload, 'checked_in')) patch.checked_in = booleanValue(payload.checked_in, false);
  assign('checkedInAt', 'checked_in_at');
  assign('checked_in_at');
  if (Object.prototype.hasOwnProperty.call(payload, 'enabled')) patch.enabled = booleanValue(payload.enabled, true);
  assign('registrationType', 'registration_type');
  assign('registration_type');
  if (Object.prototype.hasOwnProperty.call(payload, 'rsvp')) patch.rsvp = payload.rsvp;
  if (Object.prototype.hasOwnProperty.call(payload, 'priceMenu')) patch.price_menu = payload.priceMenu;
  if (Object.prototype.hasOwnProperty.call(payload, 'price_menu')) patch.price_menu = payload.price_menu;
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

async function getSiteSetting(key, fallback = null) {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('kb_site_settings')
      .select('*')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? fallback;
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error.code) || /does not exist|could not find the table/i.test(error.message || '')) return fallback;
    throw error;
  }
}

async function saveSiteSetting(key, value) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('kb_site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select('*')
    .single();
  if (error) throw error;
  return data.value;
}

async function updateRecord(table, id, payload) {
  const supabase = requireSupabase();
  let patch = normalizePatch(table, payload);
  let result = await supabase
    .from(table)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (result.error && table === 'kb_users' && /roles|enabled|email_confirmed|two_factor_enabled|is_volunteering_defaulter|defaulter_notes/i.test(result.error.message || '')) {
    patch = {
      name: payload.name,
      phone: payload.phone,
      role: primaryRole(normalizeRoles(payload.roles || payload.role || payload.role)),
      updated_at: new Date().toISOString()
    };
    result = await supabase
      .from(table)
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
  }

  const { data, error } = result;
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error_description || payload?.message || payload?.error || 'External service request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function verifyRecaptcha(token) {
  if (!recaptchaSecret) return true;
  if (!token) {
    const error = new Error('reCAPTCHA verification is required.');
    error.status = 400;
    throw error;
  }

  const body = new URLSearchParams({
    secret: recaptchaSecret,
    response: token
  });
  const payload = await fetchJson('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!payload.success) {
    const error = new Error('reCAPTCHA verification failed.');
    error.status = 400;
    throw error;
  }
  return true;
}

async function readGoogleProfile({ accessToken, credential }) {
  if (!googleClientId) {
    const error = new Error('Google login is not configured.');
    error.status = 500;
    throw error;
  }

  let profile;
  if (credential) {
    profile = await fetchJson(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  } else if (accessToken) {
    const tokenInfo = await fetchJson(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (tokenInfo.aud && tokenInfo.aud !== googleClientId) {
      const error = new Error('Google token audience does not match this application.');
      error.status = 401;
      throw error;
    }
    profile = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } else {
    const error = new Error('Google credential is required.');
    error.status = 400;
    throw error;
  }

  if (profile.aud && profile.aud !== googleClientId) {
    const error = new Error('Google token audience does not match this application.');
    error.status = 401;
    throw error;
  }

  if (!profile.email || String(profile.email_verified) === 'false') {
    const error = new Error('Google account email is not verified.');
    error.status = 401;
    throw error;
  }

  return {
    email: String(profile.email).toLowerCase(),
    name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ') || String(profile.email).split('@')[0]
  };
}

async function paypalAccessToken() {
  if (!paypalClientId || !paypalClientSecret) {
    const error = new Error('PayPal payment gateway is not configured.');
    error.status = 500;
    throw error;
  }

  const credentials = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
  const payload = await fetchJson(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  return payload.access_token;
}

async function markDonationPaid({ donationId, orderId, captureId, paymentPayload }) {
  if (!donationId || !isUuid(donationId)) return null;

  const supabase = requireSupabase();
  const fullPatch = {
    payment_status: 'Paid',
    paypal_order_id: orderId,
    paypal_capture_id: captureId,
    payment_payload: paymentPayload,
    updated_at: new Date().toISOString()
  };

  let result = await supabase
    .from('kb_donations')
    .update(fullPatch)
    .eq('id', donationId)
    .select('*')
    .maybeSingle();

  if (result.error && /paypal_order_id|paypal_capture_id|payment_payload|updated_at/i.test(result.error.message || '')) {
    result = await supabase
      .from('kb_donations')
      .update({ payment_status: 'Paid' })
      .eq('id', donationId)
      .select('*')
      .maybeSingle();
  }

  if (result.error) throw result.error;
  return result.data;
}

async function getRegistrationById(id) {
  if (!id || !isUuid(id)) return null;
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('kb_registrations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markRegistrationPaid({ registrationId, orderId, captureId, paymentPayload, status = 'Confirmed' }) {
  if (!registrationId || !isUuid(registrationId)) return null;
  const patch = {
    paid: true,
    paymentReceived: true,
    status,
    emailStatus: 'Payment sent'
  };
  const registration = await updateRecord('kb_registrations', registrationId, patch);
  await sendEmailOrQueue({
    to: registration.email,
    subject: 'Kannada Bharati payment confirmation',
    template: 'payment-confirmation',
    payload: { registration, payment: { orderId, captureId, status: 'Paid', paymentPayload } }
  });

  if (registration.email && /defaulter/i.test(String(registration.program || registration.fee || ''))) {
    await insertOptionalRecord('kb_defaulter_history', {
      user_email: registration.email,
      is_defaulter: false,
      notes: 'Defaulter fine paid through payment flow.',
      set_by: 'payment'
    });
  }
  return registration;
}

async function insertOptionalRecord(table, payload) {
  try {
    return await insertRecord(table, payload);
  } catch (error) {
    if (error.code === '42P01' || /does not exist|column .* does not exist/i.test(error.message || '')) {
      return null;
    }
    throw error;
  }
}

async function queueEmail({ to, subject, template, payload }) {
  return insertOptionalRecord('kb_email_outbox', {
    to_email: to,
    subject,
    template,
    payload,
    status: smtpHost && smtpUser && smtpPass ? 'Queued' : 'Stored'
  });
}

function renderEmail({ subject, template, payload = {} }) {
  const lines = [
    subject,
    '',
    template === 'confirm-email' && payload.confirmUrl ? `Confirm your account: ${payload.confirmUrl}` : '',
    template === 'forgot-password' && payload.resetUrl ? `Reset your password: ${payload.resetUrl}` : '',
    payload.registration ? `Registration: ${payload.registration.program || '-'} for ${payload.registration.family_member || payload.registration.student_name || payload.registration.parent_name || '-'}` : '',
    payload.payment ? `Payment status: ${payload.payment.status || payload.paymentStatus || 'Paid'}` : '',
    '',
    'Kannada Bharati'
  ].filter(Boolean);
  const text = lines.join('\n');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>${subject}</h2>${lines.slice(2).map((line) => `<p>${String(line).replace(/</g, '&lt;')}</p>`).join('')}</div>`;
  return { text, html };
}

async function sendEmailOrQueue(message) {
  const queued = await queueEmail(message);
  if (!smtpHost || !smtpUser || !smtpPass) return queued;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
  const rendered = renderEmail(message);
  await transporter.sendMail({
    from: emailFromAddress,
    to: message.to,
    subject: message.subject,
    text: rendered.text,
    html: rendered.html
  });

  if (queued?.id) {
    try {
      await updateRecord('kb_email_outbox', queued.id, { status: 'Sent', sent_at: new Date().toISOString() });
    } catch {
      // Email was delivered; outbox status is best-effort.
    }
  }

  return queued;
}

function makeToken() {
  return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

function normalizeProfilePayload(email, payload) {
  return {
    email,
    first_name: payload.firstName || payload.first_name || null,
    last_name: payload.lastName || payload.last_name || null,
    birth_date: payload.birthDate || payload.birth_date || null,
    phone: payload.phone || null,
    gender: payload.gender || null,
    company: payload.company || null,
    description: payload.description || null,
    address1: payload.address1 || null,
    address2: payload.address2 || null,
    city: payload.city || null,
    state: payload.state || null,
    zip_code: payload.zipCode || payload.zip_code || null,
    spouse_first_name: payload.spouseFirstName || payload.spouse_first_name || null,
    spouse_last_name: payload.spouseLastName || payload.spouse_last_name || null,
    spouse_birth_date: payload.spouseBirthDate || payload.spouse_birth_date || null,
    photo: payload.photo || null,
    updated_at: new Date().toISOString()
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Kannada Bharati API' });
});

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  await verifyRecaptcha(req.body.recaptchaToken || req.body.recaptcha);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const name = req.body.name || `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim() || email.split('@')[0];
  const passwordHash = await bcrypt.hash(password, 10);
  const roles = normalizeRoles(email === adminEmail ? ['admin', 'superadmin'] : ['member']);
  const emailConfirmToken = makeToken();

  let userResult = await supabase
    .from('kb_users')
    .upsert({
      email,
      name,
      phone: req.body.phone || null,
      role: primaryRole(roles),
      roles,
      password_hash: passwordHash,
      email_confirmation_token: emailConfirmToken,
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' })
    .select('*')
    .single();

  if (userResult.error && /roles|email_confirmation_token|email_confirmed|two_factor_enabled/i.test(userResult.error.message || '')) {
    userResult = await supabase
      .from('kb_users')
      .upsert({
        email,
        name,
        phone: req.body.phone || null,
        role: primaryRole(roles),
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
      .select('*')
      .single();
  }

  const { data: user, error: userError } = userResult;
  if (userError) throw userError;

  await sendEmailOrQueue({
    to: email,
    subject: 'Confirm your Kannada Bharati account',
    template: 'confirm-email',
    payload: { confirmUrl: `${appBaseUrl}/login?confirmToken=${encodeURIComponent(emailConfirmToken)}` }
  });

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

  if (user && email === adminEmail && user.role !== 'admin') {
    const { data: updatedUser, error: updateError } = await supabase
      .from('kb_users')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*')
      .single();

    if (updateError) throw updateError;
    user = updatedUser;
  }

  if (!user) {
    const { data: created, error: createError } = await supabase
      .from('kb_users')
      .insert({
        email,
        name: email === adminEmail ? 'Admin' : email.split('@')[0],
        role: email === adminEmail ? 'admin' : 'member',
        roles: normalizeRoles(email === adminEmail ? ['admin', 'superadmin'] : ['member']),
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

app.post('/api/auth/google', asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const googleProfile = await readGoogleProfile({
    accessToken: req.body.accessToken,
    credential: req.body.credential
  });
  const roles = normalizeRoles(googleProfile.email === adminEmail ? ['admin', 'superadmin'] : ['member']);

  let userResult = await supabase
    .from('kb_users')
    .upsert({
      email: googleProfile.email,
      name: googleProfile.name,
      role: primaryRole(roles),
      roles,
      email_confirmed: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' })
    .select('*')
    .single();

  if (userResult.error && /roles|email_confirmed/i.test(userResult.error.message || '')) {
    userResult = await supabase
      .from('kb_users')
      .upsert({
        email: googleProfile.email,
        name: googleProfile.name,
        role: primaryRole(roles),
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
      .select('*')
      .single();
  }

  const { data: user, error: userError } = userResult;
  if (userError) throw userError;

  await insertRecord('kb_logins', {
    email: user.email,
    role: user.role
  });

  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const resetToken = makeToken();
  const { data: user } = await supabase
    .from('kb_users')
    .update({ password_reset_token: resetToken, password_reset_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
    .eq('email', email)
    .select('*')
    .maybeSingle();

  if (user) {
    await sendEmailOrQueue({
      to: email,
      subject: 'Reset your Kannada Bharati password',
      template: 'forgot-password',
      payload: { resetUrl: `${appBaseUrl}/login?resetToken=${encodeURIComponent(resetToken)}` }
    });
  }

  res.json({ ok: true, message: 'If an account exists, reset instructions were queued.' });
}));

app.post('/api/auth/change-password', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || req.body.password || '');
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });

  const { data: user, error } = await supabase
    .from('kb_users')
    .select('*')
    .eq('email', req.user.email.toLowerCase())
    .single();
  if (error) throw error;
  if (user.password_hash) {
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is not correct.' });
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('kb_users')
    .update({ password_hash: await bcrypt.hash(newPassword, 10), updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('*')
    .single();
  if (updateError) throw updateError;
  res.json({ user: publicUser(updatedUser), token: tokenFor(updatedUser) });
}));

app.post('/api/auth/set-password', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const password = String(req.body.password || req.body.newPassword || '');
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const { data: updatedUser, error } = await supabase
    .from('kb_users')
    .update({ password_hash: await bcrypt.hash(password, 10), updated_at: new Date().toISOString() })
    .eq('email', req.user.email.toLowerCase())
    .select('*')
    .single();
  if (error) throw error;
  res.json({ user: publicUser(updatedUser), token: tokenFor(updatedUser) });
}));

app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  if (!token || password.length < 6) return res.status(400).json({ error: 'Valid reset token and password are required.' });

  const { data: user, error: userError } = await supabase
    .from('kb_users')
    .select('*')
    .eq('password_reset_token', token)
    .maybeSingle();
  if (userError) throw userError;
  if (!user || (user.password_reset_expires_at && new Date(user.password_reset_expires_at) < new Date())) {
    return res.status(400).json({ error: 'Reset link is invalid or expired.' });
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('kb_users')
    .update({
      password_hash: await bcrypt.hash(password, 10),
      password_reset_token: null,
      password_reset_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select('*')
    .single();
  if (updateError) throw updateError;
  res.json({ user: publicUser(updatedUser), token: tokenFor(updatedUser) });
}));

app.post('/api/auth/confirm-email', asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const token = String(req.body.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Confirmation token is required.' });

  const { data: user, error } = await supabase
    .from('kb_users')
    .update({ email_confirmed: true, email_confirmation_token: null, updated_at: new Date().toISOString() })
    .eq('email_confirmation_token', token)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!user) return res.status(400).json({ error: 'Confirmation link is invalid.' });
  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/auth/two-factor', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const enabled = booleanValue(req.body.enabled, false);
  const { data: user, error } = await supabase
    .from('kb_users')
    .update({ two_factor_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('email', req.user.email)
    .select('*')
    .single();
  if (error) throw error;
  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.get('/api/profile', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = req.user.email.toLowerCase();
  const [profile, children] = await Promise.all([
    supabase.from('kb_member_profiles').select('*').eq('email', email).maybeSingle(),
    supabase.from('kb_member_children').select('*').eq('profile_email', email).order('created_at', { ascending: false })
  ]);
  if (profile.error && profile.error.code !== 'PGRST116') throw profile.error;
  if (children.error) throw children.error;
  res.json({ profile: profile.data || null, children: children.data || [] });
}));

app.put('/api/profile', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = req.user.email.toLowerCase();
  const { data, error } = await supabase
    .from('kb_member_profiles')
    .upsert(normalizeProfilePayload(email, req.body), { onConflict: 'email' })
    .select('*')
    .single();
  if (error) throw error;

  await supabase
    .from('kb_users')
    .update({
      name: [data.first_name, data.last_name].filter(Boolean).join(' ') || req.user.name,
      phone: data.phone || null,
      updated_at: new Date().toISOString()
    })
    .eq('email', email);

  res.json(data);
}));

app.post('/api/profile/children', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = req.user.email.toLowerCase();
  const { data, error } = await supabase
    .from('kb_member_children')
    .insert({
      profile_email: email,
      first_name: req.body.firstName || req.body.first_name,
      last_name: req.body.lastName || req.body.last_name || null,
      gender: req.body.gender || null,
      birth_date: req.body.birthDate || req.body.birth_date || null,
      created_at: new Date().toISOString()
    })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json(data);
}));

app.delete('/api/profile/children/:id', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('kb_member_children')
    .delete()
    .eq('id', req.params.id)
    .eq('profile_email', req.user.email.toLowerCase());
  if (error) throw error;
  res.json({ ok: true });
}));

app.post('/api/uploads', authenticate, asyncHandler(async (req, res) => {
  const allowedContainers = new Set(['users', 'assets']);
  const container = allowedContainers.has(String(req.body.container || '').toLowerCase())
    ? String(req.body.container).toLowerCase()
    : 'users';
  const upload = await uploadImageFile({
    dataUrl: req.body.dataUrl,
    fileName: req.body.fileName,
    container,
    directory: req.body.directory || (container === 'assets' ? 'uploads' : req.user.email)
  });
  res.status(201).json(upload);
}));

app.get('/api/settings/:key', asyncHandler(async (req, res) => {
  const allowedSettings = new Set(['volunteer-google-form']);
  if (!allowedSettings.has(req.params.key)) return res.status(404).json({ error: 'Unknown setting.' });
  const value = await getSiteSetting(req.params.key, req.params.key === 'volunteer-google-form' ? { enabled: false, url: '' } : null);
  res.json(value);
}));

app.put('/api/settings/:key', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const allowedSettings = new Set(['volunteer-google-form']);
  if (!allowedSettings.has(req.params.key)) return res.status(404).json({ error: 'Unknown setting.' });
  const value = {
    enabled: booleanValue(req.body.enabled, false),
    url: String(req.body.url || '').trim()
  };
  res.json(await saveSiteSetting(req.params.key, value));
}));

app.patch('/api/admin/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const user = await updateRecord('kb_users', req.params.id, req.body);
  if (req.body.isVolunteeringDefaulter !== undefined || req.body.is_volunteering_defaulter !== undefined) {
    await insertOptionalRecord('kb_defaulter_history', {
      user_email: user.email,
      is_defaulter: booleanValue(req.body.isVolunteeringDefaulter ?? req.body.is_volunteering_defaulter, false),
      notes: req.body.defaulterNotes || req.body.defaulter_notes || null,
      set_by: req.user.email
    });
  }
  res.json(user);
}));

app.get('/api/admin/users/find', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const supabase = requireSupabase();
  const [user, profile, children, registrations] = await Promise.all([
    supabase.from('kb_users').select('*').eq('email', email).maybeSingle(),
    supabase.from('kb_member_profiles').select('*').eq('email', email).maybeSingle(),
    supabase.from('kb_member_children').select('*').eq('profile_email', email).order('created_at', { ascending: false }),
    supabase.from('kb_registrations').select('*').eq('email', email).order('created_at', { ascending: false })
  ]);
  if (user.error) throw user.error;
  if (profile.error && profile.error.code !== 'PGRST116') throw profile.error;
  if (children.error) throw children.error;
  if (registrations.error) throw registrations.error;
  res.json({
    user: user.data || null,
    profile: profile.data || null,
    children: children.data || [],
    registrations: registrations.data || []
  });
}));

app.get('/api/users/phone', authenticate, requireRole('receptionist'), asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const supabase = requireSupabase();
  const [user, profile] = await Promise.all([
    supabase.from('kb_users').select('email, phone').eq('email', email).maybeSingle(),
    supabase.from('kb_member_profiles').select('email, phone').eq('email', email).maybeSingle()
  ]);
  if (user.error) throw user.error;
  if (profile.error && profile.error.code !== 'PGRST116') throw profile.error;
  res.json({ email, phone: profile.data?.phone || user.data?.phone || '' });
}));

app.get('/api/auth/external-logins', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const { data: user, error } = await supabase
    .from('kb_users')
    .select('email, password_hash, email_confirmed')
    .eq('email', req.user.email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  res.json({
    email: req.user.email,
    logins: [
      user?.password_hash ? { provider: 'Local password', connected: true } : { provider: 'Local password', connected: false },
      { provider: 'Google', connected: booleanValue(user?.email_confirmed, false) }
    ]
  });
}));

app.post('/api/auth/verify-phone/start', authenticate, asyncHandler(async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Phone number is required.' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await insertOptionalRecord('kb_phone_verifications', {
    email: req.user.email,
    phone,
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verified: false
  });
  res.json({ ok: true, message: 'Verification code generated.', devCode: process.env.NODE_ENV === 'production' ? undefined : code });
}));

app.post('/api/auth/verify-phone/confirm', authenticate, asyncHandler(async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const code = String(req.body.code || '').trim();
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('kb_phone_verifications')
    .select('*')
    .eq('email', req.user.email)
    .eq('phone', phone)
    .eq('code', code)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at) < new Date()) return res.status(400).json({ error: 'Verification code is invalid or expired.' });
  await supabase.from('kb_phone_verifications').update({ verified: true }).eq('id', data.id);
  await supabase.from('kb_users').update({ phone, updated_at: new Date().toISOString() }).eq('email', req.user.email);
  res.json({ ok: true });
}));

app.post('/api/registrations/:id/action', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const action = String(req.body.action || '').toLowerCase();
  const patchByAction = {
    confirm: { status: 'Confirmed' },
    reset: { status: 'Submitted' },
    paid: { paid: true, paymentReceived: true },
    delete: { enabled: false, status: 'Deleted' },
    enable: { enabled: true, status: 'Submitted' },
    checkin: { checkedIn: true, checkedInAt: new Date().toISOString() },
    emailstatus: { emailStatus: 'Sent' }
  };
  const patch = patchByAction[action];
  if (!patch) return res.status(400).json({ error: 'Unknown registration action.' });
  const registration = await updateRecord('kb_registrations', req.params.id, patch);
  if (['confirm', 'emailstatus', 'paid'].includes(action)) {
    await sendEmailOrQueue({
      to: registration.email,
      subject: `Kannada Bharati registration ${registration.status || action}`,
      template: action === 'paid' ? 'payment-confirmation' : 'registration-update',
      payload: { registration }
    });
  }
  res.json(registration);
}));

app.post('/api/expenses/:id/action', authenticate, requireRole('treasurer'), asyncHandler(async (req, res) => {
  const action = String(req.body.action || '').toLowerCase();
  const patchByAction = {
    approve: { status: 'Approved', approvedBy: req.user.email, approvedAt: new Date().toISOString() },
    reject: { status: 'Rejected', approvedBy: req.user.email, approvedAt: new Date().toISOString() },
    paid: { status: 'Paid', approvedBy: req.user.email, approvedAt: new Date().toISOString() },
    reset: { status: 'Submitted', approvedBy: null, approvedAt: null }
  };
  const patch = patchByAction[action];
  if (!patch) return res.status(400).json({ error: 'Unknown expense action.' });
  res.json(await updateRecord('kb_expenses', req.params.id, patch));
}));

app.get('/api/reception/events', authenticate, requireRole('receptionist'), asyncHandler(async (req, res) => {
  const events = await listTable('kb_events');
  res.json(events.filter((event) => booleanValue(event.enable_check_in, true) && booleanValue(event.enabled, true)));
}));

app.get('/api/reception/registrations', authenticate, requireRole('receptionist'), asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  let query = supabase.from('kb_registrations').select('*').order('created_at', { ascending: false });
  if (req.query.eventId) query = query.eq('event_id', req.query.eventId);
  if (!booleanValue(req.query.includeDeletedItems, false)) query = query.neq('status', 'Deleted').eq('enabled', true);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data || []);
}));

app.post('/api/reception/checkin', authenticate, requireRole('receptionist'), asyncHandler(async (req, res) => {
  const registrationId = req.body.registrationId || req.body.registration_id;
  const registration = registrationId ? await updateRecord('kb_registrations', registrationId, {
    checkedIn: true,
    checkedInAt: new Date().toISOString()
  }) : null;
  const checkin = await insertOptionalRecord('kb_checkins', {
    registrationId,
    registrationKey: req.body.registrationKey,
    eventId: req.body.eventId || registration?.event_id,
    checkedIn: true,
    checkedInBy: req.user.email
  });
  res.status(201).json({ registration, checkin });
}));

app.post('/api/payments/paypal/orders', asyncHandler(async (req, res) => {
  const amount = numberValue(req.body.amount, 0);
  if (amount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
  }

  const token = await paypalAccessToken();
  const returnUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}/donate`;
  const cancelUrl = req.body.cancelUrl || returnUrl;
  const invoiceId = req.body.donationId && isUuid(req.body.donationId) ? req.body.donationId : undefined;

  const order = await fetchJson(`${paypalBaseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        description: req.body.cause || 'Kannada Bharati Donation',
        custom_id: req.body.donationId || undefined,
        invoice_id: invoiceId,
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2)
        }
      }],
      application_context: {
        brand_name: 'Kannada Bharati',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    })
  });

  const approvalUrl = order.links?.find((link) => link.rel === 'approve')?.href;
  res.status(201).json({ orderId: order.id, approvalUrl });
}));

app.post('/api/payments/paypal/orders/:orderId/capture', asyncHandler(async (req, res) => {
  const token = await paypalAccessToken();
  const payment = await fetchJson(`${paypalBaseUrl}/v2/checkout/orders/${encodeURIComponent(req.params.orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const capture = payment.purchase_units?.[0]?.payments?.captures?.[0];
  const donation = await markDonationPaid({
    donationId: req.body.donationId,
    orderId: payment.id,
    captureId: capture?.id || null,
    paymentPayload: payment
  });

  res.json({
    paymentStatus: payment.status,
    orderId: payment.id,
    captureId: capture?.id || null,
    donation
  });
}));

app.post('/api/payments/:kind/create', asyncHandler(async (req, res) => {
  const kind = String(req.params.kind || '').toLowerCase();
  if (!['event', 'class', 'guest-event', 'guest'].includes(kind)) return res.status(404).json({ error: 'Unknown payment type.' });
  const amount = numberValue(req.body.amount || req.body.fee, 0);
  if (amount <= 0) return res.status(400).json({ error: 'Payment amount must be greater than zero.' });

  let registrationId = req.body.registrationId;
  if (!registrationId && req.body.email) {
    const registration = await insertRecord('kb_registrations', {
      parentName: req.body.parentName || req.body.name || req.body.email,
      studentName: req.body.studentName || req.body.familyMember || req.body.name || '-',
      familyMember: req.body.familyMember || req.body.studentName || req.body.name || '-',
      email: String(req.body.email).toLowerCase(),
      phone: req.body.phone || null,
      program: req.body.program || req.body.eventTitle || req.body.classTitle || 'Guest registration',
      eventId: req.body.eventId || null,
      amount,
      paid: false,
      paymentReceived: false,
      registrationType: kind.includes('guest') ? 'guest' : kind,
      status: 'Submitted',
      adults: req.body.adults,
      kids: req.body.kids,
      youngKids: req.body.youngKids,
      seats: req.body.seats,
      totalMembers: req.body.totalMembers
    });
    registrationId = registration.id;
  }

  const token = await paypalAccessToken();
  const returnUrl = req.body.returnUrl || `${appBaseUrl}/profile?payment=complete`;
  const cancelUrl = req.body.cancelUrl || `${appBaseUrl}/profile?payment=cancel`;
  const order = await fetchJson(`${paypalBaseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        description: req.body.description || `Kannada Bharati ${kind} registration`,
        custom_id: registrationId || undefined,
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2)
        }
      }],
      application_context: {
        brand_name: 'Kannada Bharati',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    })
  });

  res.status(201).json({
    registrationId,
    orderId: order.id,
    approvalUrl: order.links?.find((link) => link.rel === 'approve')?.href
  });
}));

app.post('/api/payments/:kind/complete', asyncHandler(async (req, res) => {
  const kind = String(req.params.kind || '').toLowerCase();
  if (!['event', 'class', 'guest-event', 'guest'].includes(kind)) return res.status(404).json({ error: 'Unknown payment type.' });
  const orderId = req.body.orderId || req.body.token;
  if (!orderId) return res.status(400).json({ error: 'PayPal order id is required.' });

  const token = await paypalAccessToken();
  const payment = await fetchJson(`${paypalBaseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const capture = payment.purchase_units?.[0]?.payments?.captures?.[0];
  const customId = payment.purchase_units?.[0]?.custom_id;
  const registration = await markRegistrationPaid({
    registrationId: req.body.registrationId || customId,
    orderId: payment.id,
    captureId: capture?.id || null,
    paymentPayload: payment,
    status: req.body.status || 'Confirmed'
  });
  res.json({ paymentStatus: payment.status, orderId: payment.id, captureId: capture?.id || null, registration });
}));

app.post('/api/payments/:kind/cancel', asyncHandler(async (req, res) => {
  const registrationId = req.body.registrationId;
  const registration = registrationId ? await updateRecord('kb_registrations', registrationId, {
    status: 'Payment Cancelled',
    paymentReceived: false
  }) : null;
  res.json({ ok: true, registration });
}));

app.get('/api/eventmgmt/seats', authenticate, requireRole('receptionist'), asyncHandler(async (req, res) => {
  const eventId = String(req.query.eventId || '').trim();
  const supabase = requireSupabase();
  let seats = [];
  try {
    let seatQuery = supabase.from('kb_seats').select('*').order('seat_number', { ascending: true });
    if (eventId) seatQuery = seatQuery.eq('event_id', eventId);
    const seatResult = await seatQuery;
    if (seatResult.error) throw seatResult.error;
    seats = seatResult.data || [];
  } catch (error) {
    if (!['42P01', 'PGRST205'].includes(error.code) && !/does not exist|could not find/i.test(error.message || '')) throw error;
  }

  const registrations = await listOptionalTable('kb_registrations');
  res.json({ seats, registrations: eventId ? registrations.filter((row) => row.event_id === eventId) : registrations });
}));

app.post('/api/eventmgmt/seats', authenticate, requireRole('receptionist'), asyncHandler(async (req, res) => {
  const eventId = String(req.body.eventId || '').trim();
  const seatNumber = String(req.body.seatNumber || req.body.seat_number || '').trim();
  if (!eventId || !seatNumber) return res.status(400).json({ error: 'Event id and seat number are required.' });
  const seat = await insertOptionalRecord('kb_seats', {
    event_id: eventId,
    seat_number: seatNumber,
    registration_id: req.body.registrationId || null,
    assigned_to: req.body.assignedTo || null,
    status: req.body.status || (req.body.registrationId ? 'Assigned' : 'Available')
  });
  res.status(201).json(seat || { event_id: eventId, seat_number: seatNumber, status: 'Available' });
}));

app.patch('/api/eventmgmt/seats/:id', authenticate, requireRole('receptionist'), asyncHandler(async (req, res) => {
  res.json(await updateRecord('kb_seats', req.params.id, {
    ...req.body,
    updatedAt: new Date().toISOString()
  }));
}));

app.post('/api/email-outbox/:id/send', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const { data: message, error } = await supabase
    .from('kb_email_outbox')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!message) return res.status(404).json({ error: 'Email not found.' });
  await sendEmailOrQueue({
    to: message.to_email,
    subject: message.subject,
    template: message.template,
    payload: message.payload
  });
  const updated = await updateRecord('kb_email_outbox', req.params.id, { status: smtpHost && smtpUser && smtpPass ? 'Sent' : 'Stored', sent_at: new Date().toISOString() });
  res.json(updated);
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

app.get('/api/admin/dashboard', authenticate, requireRole('receptionist', 'teacher', 'volunteer', 'treasurer'), asyncHandler(async (req, res) => {
  const [users, registrations, donations, volunteers, contacts, logins, classes, events, fundraisers, announcements, expenses, checkins, emailOutbox, defaulterHistory] = await Promise.all([
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
    listOptionalTable('kb_checkins'),
    listOptionalTable('kb_email_outbox'),
    listOptionalTable('kb_defaulter_history')
  ]);

  res.json({ users, registrations, donations, volunteers, contacts, logins, classes, events, fundraisers, announcements, expenses, checkins, emailOutbox, defaulterHistory });
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
