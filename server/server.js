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
const configuredJwtSecret = process.env.JWT_SECRET || '';
if (process.env.NODE_ENV === 'production' && configuredJwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
}
const jwtSecret = configuredJwtSecret || crypto.randomBytes(48).toString('hex');
if (!configuredJwtSecret) {
  console.warn('JWT_SECRET is not set. A temporary development secret was generated; existing logins will expire when the server restarts.');
}
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
const azureStorageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.StorageAccount || '';
const smtpHost = process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.EMAIL_SMTP_PORT || process.env.SMTP_PORT || 587);
const smtpUser = process.env.EMAIL_SMTP_USER || process.env.SMTP_USER || '';
const smtpPass = (process.env.EMAIL_SMTP_PASS || process.env.SMTP_PASS || '').replace(/\s+/g, '');
const emailFromAddress = process.env.EMAIL_FROM_ADDRESS || smtpUser || 'no-reply@kannadabharati.org';
const emailFromHeader = /<.+@.+>/.test(emailFromAddress) ? emailFromAddress : `"Kannada Bharati" <${emailFromAddress}>`;
const recaptchaSecret = process.env.GOOGLE_RECAPTCHA_SECRET || '';
const defaultVolunteerGoogleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSc1etxiGQgKR7XKhpSBd5UuLR-9-_0KDmxg7Zxd98RXK1w2Kg/viewform?embedded=true';
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioFromPhone = process.env.TWILIO_FROM_PHONE || '';
const paypalBaseUrl = (process.env.PAYPAL_ENV || 'live').toLowerCase() === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';
const appBaseUrl = process.env.APP_BASE_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174';
const kbPaypalDonateUrl = process.env.KB_PAYPAL_DONATE_URL || 'https://www.paypal.com/donate?token=yXa3TfA1QxdZl-dL-PRMtJzuNTDf_55QcI_FQp48Twwc1UBYepRrXg79VpA_BqL2NoCnFjuGg9CrKgMJ';
const roleNames = ['member', 'admin', 'superadmin', 'welcomedesk', 'receptionist', 'teacher', 'volunteer', 'treasurer'];
const isProduction = process.env.NODE_ENV === 'production';
const configuredAllowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN,
  process.env.APP_BASE_URL,
  'https://k-bwebsite-two.vercel.app',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  ...configuredAllowedOrigins
].filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    const isLocalDevOrigin = !isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  }
}));
app.use(express.json({ limit: '12mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const rateLimitBuckets = new Map();

function rateLimit({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    return next();
  };
}

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

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
    phoneConfirmed: booleanValue(user.phone_confirmed, false),
    emailConfirmed: booleanValue(user.email_confirmed, false),
    twoFactorEnabled: booleanValue(user.two_factor_enabled, false),
    isVolunteeringDefaulter: booleanValue(user.is_volunteering_defaulter, false)
  };
}

function profileResponse(row, user) {
  const [fallbackFirstName = '', ...fallbackLastName] = String(user?.name || '').trim().split(/\s+/).filter(Boolean);
  const profile = row || {};
  const firstName = profile.first_name || profile.firstName || fallbackFirstName || '';
  const lastName = profile.last_name || profile.lastName || fallbackLastName.join(' ') || '';
  const phone = profile.phone || user?.phone || '';
  return {
    id: profile.id || null,
    email: profile.email || user?.email || '',
    first_name: firstName,
    last_name: lastName,
    firstName,
    lastName,
    birth_date: profile.birth_date || profile.birthDate || '',
    birthDate: profile.birth_date || profile.birthDate || '',
    phone,
    gender: profile.gender || 'Male',
    company: profile.company || 'NA',
    description: profile.description || '',
    address1: profile.address1 || '',
    address2: profile.address2 || '',
    city: profile.city || '',
    state: profile.state || '',
    zip_code: profile.zip_code || profile.zipCode || '',
    zipCode: profile.zip_code || profile.zipCode || '',
    spouse_first_name: profile.spouse_first_name || profile.spouseFirstName || '',
    spouseFirstName: profile.spouse_first_name || profile.spouseFirstName || '',
    spouse_last_name: profile.spouse_last_name || profile.spouseLastName || '',
    spouseLastName: profile.spouse_last_name || profile.spouseLastName || '',
    spouse_birth_date: profile.spouse_birth_date || profile.spouseBirthDate || '',
    spouseBirthDate: profile.spouse_birth_date || profile.spouseBirthDate || '',
    photo: profile.photo || '',
    created_at: profile.created_at || null,
    updated_at: profile.updated_at || null,
    isSaved: Boolean(row?.id)
  };
}

function tokenFor(user) {
  return jwt.sign(publicUser(user), jwtSecret, { expiresIn: '7d' });
}

function twoFactorTokenFor(user, providers = twoFactorProvidersFor(user)) {
  return jwt.sign({
    purpose: 'two-factor',
    email: String(user.email || '').toLowerCase(),
    providers: providers.map((provider) => provider.id)
  }, jwtSecret, { expiresIn: '10m' });
}

function readTwoFactorToken(token) {
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload?.purpose !== 'two-factor' || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

function codeHash(code) {
  return crypto.createHash('sha256').update(String(code || '')).digest('hex');
}

function twoFactorVerificationTokenFor({ email, provider, code, challengeId }) {
  return jwt.sign({
    purpose: 'two-factor-code',
    email: String(email || '').toLowerCase(),
    provider,
    challengeId: challengeId || '',
    codeHash: codeHash(code)
  }, jwtSecret, { expiresIn: '10m' });
}

function readTwoFactorVerificationToken(token) {
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload?.purpose !== 'two-factor-code' || !payload.email || !payload.provider || !payload.codeHash) return null;
    return payload;
  } catch {
    return null;
  }
}

function oneTimeCodeTokenFor({ purpose, email, code, challengeId = '' }) {
  return jwt.sign({
    purpose,
    email: String(email || '').toLowerCase(),
    codeHash: codeHash(code),
    challengeId
  }, jwtSecret, { expiresIn: '10m' });
}

function readOneTimeCodeToken(token, purpose) {
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload?.purpose !== purpose || !payload.email || !payload.codeHash) return null;
    return payload;
  } catch {
    return null;
  }
}

function oneTimeCodeMatches(payload, code) {
  if (!payload?.codeHash || !code) return false;
  const expected = Buffer.from(payload.codeHash, 'hex');
  const received = Buffer.from(codeHash(code), 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function normalizePhoneNumber(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

async function consumeOneTimeCodeChallenge(payload, provider) {
  if (!payload?.challengeId) return true;
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('kb_two_factor_challenges')
    .select('*')
    .eq('id', payload.challengeId)
    .eq('email', payload.email)
    .eq('provider', provider)
    .eq('verified', false)
    .maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at) < new Date()) return false;
  const { error: updateError } = await supabase
    .from('kb_two_factor_challenges')
    .update({ verified: true })
    .eq('id', data.id);
  if (updateError) throw updateError;
  return true;
}

function twoFactorProvidersFor(user) {
  const providers = [];
  if (booleanValue(user.email_confirmed, false) || user.email) {
    providers.push({ id: 'email', label: 'Email', destination: user.email });
  }
  if (booleanValue(user.phone_confirmed, false) && user.phone) {
    providers.push({ id: 'phone', label: 'Text message', destination: user.phone });
  }
  return providers;
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Login required.' });
  }

  try {
    const tokenUser = jwt.verify(token, jwtSecret);
    req.user = tokenUser;
    try {
      const supabase = requireSupabase();
      const { data: freshUser, error } = await supabase
        .from('kb_users')
        .select('*')
        .eq('email', String(tokenUser.email || '').toLowerCase())
        .maybeSingle();
      if (!error && freshUser) req.user = publicUser(freshUser);
    } catch {
      // Fall back to the signed token when Supabase is unavailable.
    }
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

function requireSubmissionCreateAccess(req, res, next) {
  const type = String(req.params.type || '').toLowerCase();
  if (['registration', 'donation', 'volunteer', 'contact'].includes(type)) return next();
  if (type === 'expense') return authenticate(req, res, () => requireRole('volunteer', 'treasurer')(req, res, next));
  if (type === 'attendance') return authenticate(req, res, () => requireRole('teacher')(req, res, next));
  if (type === 'checkin') return authenticate(req, res, () => requireRole('welcomedesk', 'receptionist')(req, res, next));
  if (['event', 'class', 'fundraiser', 'announcement'].includes(type)) return authenticate(req, res, () => requireAdmin(req, res, next));
  return res.status(403).json({ error: 'This submission type cannot be created directly.' });
}

function canManagePayment(user) {
  return hasAnyRole(user, ['admin', 'superadmin', 'welcomedesk', 'receptionist', 'treasurer']);
}

function canAccessRegistrationPayment(user, registration) {
  if (!user || !registration) return false;
  if (canManagePayment(user)) return true;
  return String(user.email || '').toLowerCase() === String(registration.email || '').toLowerCase();
}

function requirePaymentKindAccess(req, res, next) {
  const kind = String(req.params.kind || req.body.kind || '').toLowerCase();
  if (['guest', 'guest-event'].includes(kind)) return next();
  return authenticate(req, res, next);
}

function normalizeRoles(value) {
  const values = Array.isArray(value) ? value : String(value || 'member').split(',');
  const roles = values
    .map((role) => String(role || '').trim().toLowerCase())
    .filter((role) => roleNames.includes(role) || /^[a-z0-9_-]{2,40}$/.test(role));
  return [...new Set(roles.length ? roles : ['member'])];
}

function normalizeProvider(value) {
  const provider = String(value || '').trim();
  if (!provider) return '';
  if (provider.toLowerCase() === 'google') return 'Google';
  return provider.slice(0, 1).toUpperCase() + provider.slice(1).toLowerCase();
}

function friendlyConstraintError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const text = `${message} ${details}`.toLowerCase();

  if (code === '23505' || /duplicate key value|unique constraint/i.test(message)) {
    if (text.includes('kb_external_logins') || text.includes('external_logins') || text.includes('email_provider')) {
      return { status: 409, message: 'This external login is already connected to your account.' };
    }
    if (text.includes('kb_users') || text.includes('email')) {
      return { status: 409, message: 'An account already exists for this email. Please log in or reset your password.' };
    }
    if (text.includes('kb_seats')) {
      return { status: 409, message: 'This seat already exists for the selected event.' };
    }
    if (text.includes('kb_attendance')) {
      return { status: 409, message: 'Attendance for this student has already been saved for the selected class and date.' };
    }
    return { status: 409, message: 'This record already exists. Please update the existing record instead.' };
  }

  if (code === '23502' || /null value in column/i.test(message)) {
    return { status: 400, message: 'Please fill all required fields before saving.' };
  }

  if (code === '23503' || /foreign key constraint/i.test(message)) {
    return { status: 400, message: 'The selected related record no longer exists. Refresh and try again.' };
  }

  if (code === '23514' || /check constraint/i.test(message)) {
    return { status: 400, message: 'One or more values are outside the allowed range.' };
  }

  if (/invalid input syntax for type uuid/i.test(message)) {
    return { status: 400, message: 'A selected record id is invalid. Refresh the page and try again.' };
  }

  return null;
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

  if (result.error && table === 'kb_registrations' && /payment_status|invoice_id|paypal_order_id|paypal_capture_id|paypal_order|paypal_payment|payment_completed_at|payment_cancelled_at/i.test(result.error.message || '')) {
    normalizedPayload = normalizePayload(table, payload);
    delete normalizedPayload.payment_status;
    delete normalizedPayload.invoice_id;
    delete normalizedPayload.paypal_order_id;
    delete normalizedPayload.paypal_capture_id;
    delete normalizedPayload.paypal_order;
    delete normalizedPayload.paypal_payment;
    delete normalizedPayload.payment_completed_at;
    delete normalizedPayload.payment_cancelled_at;
    result = await supabase
      .from(table)
      .insert({ ...normalizedPayload, created_at: new Date().toISOString() })
      .select('*')
      .single();
  }

  if (result.error && table === 'kb_events' && /min_age|max_age|registration_info|teachers/i.test(result.error.message || '')) {
    normalizedPayload = normalizePayload(table, payload);
    delete normalizedPayload.min_age;
    delete normalizedPayload.max_age;
    delete normalizedPayload.registration_info;
    delete normalizedPayload.teachers;
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
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'].includes(contentType)) {
    const error = new Error('Only png, jpg, jpeg, webp, and PDF files can be uploaded.');
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

  const extensionFromType = parsed.contentType === 'image/png' ? 'png' : parsed.contentType === 'image/webp' ? 'webp' : parsed.contentType === 'application/pdf' ? 'pdf' : 'jpg';
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
      payment_status: payload.paymentStatus || payload.payment_status || (booleanValue(payload.paymentReceived ?? payload.payment_received, false) ? 'Paid' : 'Pending'),
      invoice_id: payload.invoiceId || payload.invoice_id || null,
      paypal_order_id: payload.paypalOrderId || payload.paypal_order_id || null,
      paypal_capture_id: payload.paypalCaptureId || payload.paypal_capture_id || null,
      paypal_order: payload.paypalOrder || payload.paypal_order || null,
      paypal_payment: payload.paypalPayment || payload.paypal_payment || null,
      payment_completed_at: payload.paymentCompletedAt || payload.payment_completed_at || null,
      payment_cancelled_at: payload.paymentCancelledAt || payload.payment_cancelled_at || null,
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
      price: numberValue(payload.price, 0),
      is_all_day: booleanValue(payload.is_all_day ?? payload.isAllDay, false),
      is_age_restricted: booleanValue(payload.is_age_restricted ?? payload.isAgeRestricted, false),
      min_age: payload.minAge || payload.min_age ? numberValue(payload.minAge ?? payload.min_age, 0) : null,
      max_age: payload.maxAge || payload.max_age ? numberValue(payload.maxAge ?? payload.max_age, 0) : null,
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
      registration_info: payload.registrationInfo || payload.registration_info || null,
      teachers: Array.isArray(payload.teachers) ? payload.teachers : String(payload.teachers || '').split(',').map((item) => item.trim()).filter(Boolean),
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
      vendor: payload.vendor || null,
      payment_method: payload.payment_method || payload.paymentMethod || null,
      reimbursement_to: payload.reimbursement_to || payload.reimbursementTo || null,
      receipt_url: payload.receipt_url || payload.receiptUrl || null,
      receipt_name: payload.receipt_name || payload.receiptName || null,
      receipt_type: payload.receipt_type || payload.receiptType || null,
      receipt_size: numberValue(payload.receipt_size ?? payload.receiptSize, 0),
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

  if (table === 'kb_attendance') {
    const registrationId = payload.registration_id || payload.registrationId || null;
    return {
      class_key: payload.class_key || payload.classKey || payload.className || null,
      class_name: payload.class_name || payload.className || payload.classKey || null,
      attendance_date: payload.attendance_date || payload.attendanceDate || new Date().toISOString().slice(0, 10),
      registration_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(registrationId || '')) ? registrationId : null,
      registration_key: payload.registration_key || payload.registrationKey || null,
      student_name: payload.student_name || payload.studentName || payload.familyMember || 'Student',
      family_member: payload.family_member || payload.familyMember || payload.studentName || null,
      email: payload.email || null,
      status: payload.status || 'Present',
      notes: payload.notes || null,
      taken_by: payload.taken_by || payload.takenBy || payload.email || null,
      updated_at: payload.updated_at || payload.updatedAt || new Date().toISOString()
    };
  }

  if (table === 'kb_seats') {
    return {
      event_id: payload.event_id || payload.eventId || null,
      seat_number: payload.seat_number || payload.seatNumber || null,
      registration_id: payload.registration_id || payload.registrationId || null,
      assigned_to: payload.assigned_to || payload.assignedTo || null,
      status: payload.status || (payload.registration_id || payload.registrationId ? 'Assigned' : 'Available'),
      updated_at: payload.updated_at || payload.updatedAt || new Date().toISOString()
    };
  }

  if (table === 'kb_external_logins') {
    return {
      email: String(payload.email || '').trim().toLowerCase(),
      provider: normalizeProvider(payload.provider),
      provider_key: payload.provider_key || payload.providerKey || null,
      display_name: payload.display_name || payload.displayName || null
    };
  }

  return payload;
}

function normalizePatch(table, payload) {
  if (table === 'kb_events') {
    const patch = {};
    if (payload.eventId !== undefined || payload.event_id !== undefined) patch.event_id = payload.eventId ?? payload.event_id;
    if (payload.urlKey !== undefined || payload.url_key !== undefined) patch.url_key = payload.urlKey ?? payload.url_key;
    if (payload.eventType !== undefined || payload.event_type !== undefined) patch.event_type = payload.eventType ?? payload.event_type;
    if (payload.month !== undefined) patch.month = payload.month;
    if (payload.title !== undefined) patch.title = payload.title;
    if (payload.body !== undefined) patch.body = payload.body;
    if (payload.location !== undefined) patch.location = payload.location;
    if (payload.startOn !== undefined || payload.start_on !== undefined) patch.start_on = payload.startOn ?? payload.start_on;
    if (payload.endOn !== undefined || payload.end_on !== undefined) patch.end_on = payload.endOn ?? payload.end_on;
    if (payload.recurrence !== undefined) patch.recurrence = payload.recurrence;
    if (payload.capacity !== undefined) patch.capacity = numberValue(payload.capacity, 0);
    if (payload.price !== undefined) patch.price = numberValue(payload.price, 0);
    if (payload.isAllDay !== undefined || payload.is_all_day !== undefined) patch.is_all_day = booleanValue(payload.isAllDay ?? payload.is_all_day, false);
    if (payload.isAgeRestricted !== undefined || payload.is_age_restricted !== undefined) patch.is_age_restricted = booleanValue(payload.isAgeRestricted ?? payload.is_age_restricted, false);
    if (payload.minAge !== undefined || payload.min_age !== undefined) patch.min_age = payload.minAge || payload.min_age ? numberValue(payload.minAge ?? payload.min_age, 0) : null;
    if (payload.maxAge !== undefined || payload.max_age !== undefined) patch.max_age = payload.maxAge || payload.max_age ? numberValue(payload.maxAge ?? payload.max_age, 0) : null;
    if (payload.isPaymentRequired !== undefined || payload.is_payment_required !== undefined) patch.is_payment_required = booleanValue(payload.isPaymentRequired ?? payload.is_payment_required, false);
    if (payload.enableDefaulterFine !== undefined || payload.enable_defaulter_fine !== undefined) patch.enable_defaulter_fine = booleanValue(payload.enableDefaulterFine ?? payload.enable_defaulter_fine, false);
    if (payload.isOpenForRegistration !== undefined || payload.is_open_for_registration !== undefined) patch.is_open_for_registration = booleanValue(payload.isOpenForRegistration ?? payload.is_open_for_registration, false);
    if (payload.isAutoApproved !== undefined || payload.is_auto_approved !== undefined) patch.is_auto_approved = booleanValue(payload.isAutoApproved ?? payload.is_auto_approved, false);
    if (payload.enabled !== undefined) patch.enabled = booleanValue(payload.enabled, true);
    if (payload.displaySeatNumbers !== undefined || payload.display_seat_numbers !== undefined) patch.display_seat_numbers = booleanValue(payload.displaySeatNumbers ?? payload.display_seat_numbers, false);
    if (payload.freeForVolunteers !== undefined || payload.free_for_volunteers !== undefined) patch.free_for_volunteers = booleanValue(payload.freeForVolunteers ?? payload.free_for_volunteers, false);
    if (payload.enableCheckIn !== undefined || payload.enable_check_in !== undefined) patch.enable_check_in = booleanValue(payload.enableCheckIn ?? payload.enable_check_in, false);
    if (payload.enableVolunteerDiscount !== undefined || payload.enable_volunteer_discount !== undefined) patch.enable_volunteer_discount = booleanValue(payload.enableVolunteerDiscount ?? payload.enable_volunteer_discount, false);
    if (payload.volunteerDiscountPercentage !== undefined || payload.volunteer_discount_percentage !== undefined) patch.volunteer_discount_percentage = numberValue(payload.volunteerDiscountPercentage ?? payload.volunteer_discount_percentage, 0);
    if (payload.defaulterFineAmount !== undefined || payload.defaulter_fine_amount !== undefined) patch.defaulter_fine_amount = numberValue(payload.defaulterFineAmount ?? payload.defaulter_fine_amount, 0);
    if (payload.registrationInfo !== undefined || payload.registration_info !== undefined) patch.registration_info = payload.registrationInfo ?? payload.registration_info;
    if (payload.teachers !== undefined) patch.teachers = Array.isArray(payload.teachers) ? payload.teachers : String(payload.teachers || '').split(',').map((item) => item.trim()).filter(Boolean);
    if (payload.rsvp !== undefined) patch.rsvp = payload.rsvp || null;
    if (payload.priceMenu !== undefined || payload.price_menu !== undefined) patch.price_menu = payload.priceMenu ?? payload.price_menu;
    if (payload.photo !== undefined) patch.photo = payload.photo || null;
    return patch;
  }

  if (['kb_announcements', 'kb_checkins', 'kb_attendance'].includes(table)) {
    return normalizePayload(table, payload);
  }

  if (table === 'kb_registrations') {
    const patch = {};
    if (payload.parentName !== undefined || payload.parent_name !== undefined) patch.parent_name = payload.parentName ?? payload.parent_name;
    if (payload.studentName !== undefined || payload.student_name !== undefined) patch.student_name = payload.studentName ?? payload.student_name;
    if (payload.familyMember !== undefined || payload.family_member !== undefined) patch.family_member = payload.familyMember ?? payload.family_member;
    if (payload.email !== undefined) patch.email = payload.email;
    if (payload.phone !== undefined) patch.phone = payload.phone || null;
    if (payload.program !== undefined) patch.program = payload.program;
    if (payload.registrationType !== undefined || payload.registration_type !== undefined) patch.registration_type = payload.registrationType ?? payload.registration_type;
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.amount !== undefined) patch.amount = numberValue(payload.amount, 0);
    if (payload.paid !== undefined) patch.paid = booleanValue(payload.paid, false);
    if (payload.paymentReceived !== undefined || payload.payment_received !== undefined) patch.payment_received = booleanValue(payload.paymentReceived ?? payload.payment_received, false);
    if (payload.paymentStatus !== undefined || payload.payment_status !== undefined) patch.payment_status = payload.paymentStatus ?? payload.payment_status;
    if (payload.invoiceId !== undefined || payload.invoice_id !== undefined) patch.invoice_id = payload.invoiceId ?? payload.invoice_id;
    if (payload.paypalOrderId !== undefined || payload.paypal_order_id !== undefined) patch.paypal_order_id = payload.paypalOrderId ?? payload.paypal_order_id;
    if (payload.paypalCaptureId !== undefined || payload.paypal_capture_id !== undefined) patch.paypal_capture_id = payload.paypalCaptureId ?? payload.paypal_capture_id;
    if (payload.paypalOrder !== undefined || payload.paypal_order !== undefined) patch.paypal_order = payload.paypalOrder ?? payload.paypal_order;
    if (payload.paypalPayment !== undefined || payload.paypal_payment !== undefined) patch.paypal_payment = payload.paypalPayment ?? payload.paypal_payment;
    if (payload.paymentCompletedAt !== undefined || payload.payment_completed_at !== undefined) patch.payment_completed_at = payload.paymentCompletedAt ?? payload.payment_completed_at;
    if (payload.paymentCancelledAt !== undefined || payload.payment_cancelled_at !== undefined) patch.payment_cancelled_at = payload.paymentCancelledAt ?? payload.payment_cancelled_at;
    if (payload.enabled !== undefined) patch.enabled = booleanValue(payload.enabled, true);
    if (payload.birthYear !== undefined || payload.birth_year !== undefined) patch.birth_year = payload.birthYear ?? payload.birth_year;
    if (payload.totalMembers !== undefined || payload.total_members !== undefined) patch.total_members = numberValue(payload.totalMembers ?? payload.total_members, 1);
    if (payload.seats !== undefined) patch.seats = numberValue(payload.seats, 1);
    if (payload.rsvp !== undefined) patch.rsvp = payload.rsvp || null;
    if (payload.priceSelection !== undefined) patch.price_menu = mergePaymentDetails(payload.priceMenu || payload.price_menu, { priceSelection: payload.priceSelection });
    if (payload.emailStatus !== undefined || payload.email_status !== undefined) patch.email_status = payload.emailStatus ?? payload.email_status;
    return patch;
  }

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
    if (payload.payload !== undefined) patch.payload = payload.payload;
    return patch;
  }

  if (table === 'kb_sms_outbox') {
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
    if (payload.vendor !== undefined) patch.vendor = payload.vendor;
    if (payload.paymentMethod !== undefined || payload.payment_method !== undefined) patch.payment_method = payload.paymentMethod ?? payload.payment_method;
    if (payload.reimbursementTo !== undefined || payload.reimbursement_to !== undefined) patch.reimbursement_to = payload.reimbursementTo ?? payload.reimbursement_to;
    if (payload.receiptUrl !== undefined || payload.receipt_url !== undefined) patch.receipt_url = payload.receiptUrl ?? payload.receipt_url;
    if (payload.receiptName !== undefined || payload.receipt_name !== undefined) patch.receipt_name = payload.receiptName ?? payload.receipt_name;
    if (payload.receiptType !== undefined || payload.receipt_type !== undefined) patch.receipt_type = payload.receiptType ?? payload.receipt_type;
    if (payload.receiptSize !== undefined || payload.receipt_size !== undefined) patch.receipt_size = numberValue(payload.receiptSize ?? payload.receipt_size, 0);
    if (payload.approvedBy !== undefined || payload.approved_by !== undefined) patch.approved_by = payload.approvedBy ?? payload.approved_by;
    if (payload.approvedAt !== undefined || payload.approved_at !== undefined) patch.approved_at = payload.approvedAt ?? payload.approved_at;
    return patch;
  }

  if (table === 'kb_donations') {
    const patch = {};
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.email !== undefined) patch.email = payload.email;
    if (payload.amount !== undefined) patch.amount = numberValue(payload.amount, 0);
    if (payload.causeId !== undefined || payload.cause_id !== undefined) {
      const causeId = payload.causeId ?? payload.cause_id;
      patch.cause_id = isUuid(causeId) ? causeId : null;
    }
    if (payload.cause !== undefined || payload.causeTitle !== undefined || payload.cause_title !== undefined) {
      patch.cause_title = payload.cause ?? payload.causeTitle ?? payload.cause_title;
    }
    if (payload.paymentStatus !== undefined || payload.payment_status !== undefined) patch.payment_status = payload.paymentStatus ?? payload.payment_status;
    if (payload.paypalOrderId !== undefined || payload.paypal_order_id !== undefined) patch.paypal_order_id = payload.paypalOrderId ?? payload.paypal_order_id;
    if (payload.paypalCaptureId !== undefined || payload.paypal_capture_id !== undefined) patch.paypal_capture_id = payload.paypalCaptureId ?? payload.paypal_capture_id;
    if (payload.paymentPayload !== undefined || payload.payment_payload !== undefined) patch.payment_payload = payload.paymentPayload ?? payload.payment_payload;
    patch.updated_at = new Date().toISOString();
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
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }
}

function isMissingTableError(error) {
  return ['42P01', 'PGRST205'].includes(error?.code) || /does not exist|could not find the table/i.test(error?.message || '');
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
    if (isMissingTableError(error)) return fallback;
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
  if (error) {
    error.status = 400;
    error.message = `Could not save setting "${key}". ${error.message || 'Database rejected the update.'}`;
    throw error;
  }
  return data.value;
}

function normalizeAboutSetting(value = {}) {
  const normalizeRows = (rows, fields) => (Array.isArray(rows) ? rows : []).slice(0, 80).map((row, index) => {
    const normalized = { id: String(row.id || `about-${Date.now()}-${index}`) };
    fields.forEach((field) => {
      normalized[field] = String(row[field] || '').trim();
    });
    return normalized;
  });

  return {
    currentCommittee: normalizeRows(value.currentCommittee, ['name', 'role', 'email', 'phone', 'bio', 'photo']),
    sponsors: normalizeRows(value.sponsors, ['name', 'level', 'website', 'note', 'photo']),
    pastCommittees: normalizeRows(value.pastCommittees, ['term', 'title', 'members', 'photo'])
  };
}

async function getAboutContent() {
  const fallback = { currentCommittee: [], sponsors: [], pastCommittees: [] };
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('kb_about_content')
      .select('section,value');
    if (error) throw error;
    const next = { ...fallback };
    (data || []).forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(next, row.section)) {
        next[row.section] = Array.isArray(row.value) ? row.value : [];
      }
    });
    const hasAnyRows = Object.values(next).some((rows) => rows.length);
    if (hasAnyRows) return normalizeAboutSetting(next);
    return normalizeAboutSetting(await getSiteSetting('about-content', fallback));
  } catch (error) {
    if (isMissingTableError(error)) {
      return normalizeAboutSetting(await getSiteSetting('about-content', fallback));
    }
    throw error;
  }
}

async function saveAboutContent(value) {
  const normalized = normalizeAboutSetting(value);
  try {
    const supabase = requireSupabase();
    const rows = [
      { section: 'currentCommittee', value: normalized.currentCommittee, updated_at: new Date().toISOString() },
      { section: 'sponsors', value: normalized.sponsors, updated_at: new Date().toISOString() },
      { section: 'pastCommittees', value: normalized.pastCommittees, updated_at: new Date().toISOString() }
    ];
    const { error } = await supabase
      .from('kb_about_content')
      .upsert(rows, { onConflict: 'section' });
    if (error) throw error;
    await saveSiteSetting('about-content', normalized).catch(() => null);
    return normalized;
  } catch (error) {
    if (isMissingTableError(error)) {
      return saveSiteSetting('about-content', normalized);
    }
    error.status = 400;
    error.message = `Could not save About Us content. ${error.message || 'Database rejected the update.'}`;
    throw error;
  }
}

function normalizePaataTeacherSetting(value = []) {
  return (Array.isArray(value) ? value : []).slice(0, 80).map((row, index) => ({
    id: String(row.id || `paata-teacher-${Date.now()}-${index}`),
    name: String(row.name || '').trim(),
    role: String(row.role || '').trim(),
    level: String(row.level || '').trim(),
    email: String(row.email || '').trim(),
    phone: String(row.phone || '').trim(),
    bio: String(row.bio || '').trim(),
    photo: String(row.photo || '').trim()
  }));
}

function normalizeSiteMessageSetting(value = {}) {
  return {
    enabled: booleanValue(value.enabled, false),
    title: String(value.title || '').trim().slice(0, 90),
    message: String(value.message || '').trim().slice(0, 700),
    ctaText: String(value.ctaText || '').trim().slice(0, 40),
    ctaUrl: String(value.ctaUrl || '').trim().slice(0, 500),
    updatedAt: value.updatedAt || new Date().toISOString()
  };
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

  if (result.error && table === 'kb_events' && /min_age|max_age|registration_info|teachers/i.test(result.error.message || '')) {
    patch = normalizePatch(table, payload);
    delete patch.min_age;
    delete patch.max_age;
    delete patch.registration_info;
    delete patch.teachers;
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

async function createPayPalRegistrationOrder({ kind, registrationId, amount, description, returnUrl, cancelUrl }) {
  const token = await paypalAccessToken();
  const order = await fetchJson(`${paypalBaseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        description,
        custom_id: registrationId || undefined,
        amount: {
          currency_code: 'USD',
          value: Number(amount || 0).toFixed(2)
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

  return {
    registrationId,
    orderId: order.id,
    approvalUrl: order.links?.find((link) => link.rel === 'approve')?.href,
    kind,
    order
  };
}

function paypalPaymentDetails({ kind, order, payment, capture, phase, amount, registration }) {
  return {
    method: 'PayPal',
    provider: 'PayPal',
    kind,
    phase,
    status: payment?.status || order?.status || phase,
    reference: capture?.id || payment?.id || order?.id || '',
    orderId: payment?.id || order?.id || '',
    captureId: capture?.id || '',
    invoiceId: registration?.invoice_id || registration?.id || '',
    amount: numberValue(amount ?? registration?.amount, 0),
    payerEmail: payment?.payer?.email_address || '',
    updatedAt: new Date().toISOString()
  };
}

async function updateRegistrationPaymentState(registrationId, patch, fallbackDetails = {}) {
  try {
    return await updateRecord('kb_registrations', registrationId, patch);
  } catch (error) {
    if (!/paypal_|payment_status|invoice_id|payment_completed_at|payment_cancelled_at|column .* does not exist/i.test(error.message || '')) throw error;
    const existing = await getRegistrationById(registrationId);
    if (!existing) throw error;
    return updateRecord('kb_registrations', registrationId, {
      paid: patch.paid,
      paymentReceived: patch.paymentReceived ?? patch.payment_received,
      status: patch.status,
      emailStatus: patch.emailStatus || patch.email_status,
      priceMenu: mergePaymentDetails(existing.price_menu, fallbackDetails)
    });
  }
}

async function eventForRegistration(registration) {
  if (!registration) return null;
  const supabase = requireSupabase();
  const eventId = registration.event_id || registration.eventId;
  const program = registration.program;
  let query = supabase.from('kb_events').select('*').limit(1);
  if (eventId) query = query.or(`id.eq.${eventId},event_id.eq.${eventId},url_key.eq.${eventId}`);
  else if (program) query = query.eq('title', program);
  else return null;
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

function completedRegistrationStatus(registration, event) {
  if (String(registration?.registration_type || '').toLowerCase() === 'class') return 'Confirmed';
  if (event && !booleanValue(event.is_auto_approved, false)) return 'Submitted';
  return 'Confirmed';
}

async function resetDefaulterAfterPayment(registration, event, actor = 'payment') {
  if (!registration?.email || !event || !booleanValue(event.enable_defaulter_fine, false)) return;
  try {
    const supabase = requireSupabase();
    const email = String(registration.email).toLowerCase();
    const { data: user, error } = await supabase
      .from('kb_users')
      .select('id, email, is_volunteering_defaulter')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    if (!user?.is_volunteering_defaulter) return;
    const note = `${new Date().toISOString()}: Paid defaulter fine for event '${event.title || event.event_id || registration.program}'.`;
    await updateRecord('kb_users', user.id, {
      isVolunteeringDefaulter: false,
      defaulterNotes: note
    });
    await insertDefaulterHistory({
      user_email: email,
      is_defaulter: false,
      notes: note,
      set_by: null,
      reset_by: actor,
      set_date: new Date().toISOString(),
      reset_date: new Date().toISOString()
    });
  } catch {
    // Payment success should not be rolled back if optional defaulter tracking is unavailable.
  }
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
  if (result.data?.email) {
    await sendEmailOrQueue({
      to: result.data.email,
      subject: 'Kannada Bharati donation confirmation',
      template: 'donation-confirmation',
      payload: { donation: result.data, payment: { orderId, captureId, status: 'Paid', paymentPayload } }
    });
  }
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

async function markRegistrationPaid({ registrationId, orderId, captureId, paymentPayload, paypalOrder = null, kind = 'event', status }) {
  if (!registrationId || !isUuid(registrationId)) {
    const error = new Error('Registration id is required to complete payment.');
    error.status = 400;
    throw error;
  }
  const existing = await getRegistrationById(registrationId);
  if (!existing) {
    const error = new Error('Registration was not found for this payment.');
    error.status = 404;
    throw error;
  }
  const event = await eventForRegistration(existing);
  const capture = paymentPayload?.purchase_units?.[0]?.payments?.captures?.[0] || null;
  const completedAt = new Date().toISOString();
  const nextStatus = status || completedRegistrationStatus(existing, event);
  const fallbackDetails = paypalPaymentDetails({
    kind,
    order: paypalOrder,
    payment: paymentPayload,
    capture,
    phase: 'Paid',
    registration: existing
  });
  const patch = {
    paid: true,
    paymentReceived: true,
    status: nextStatus,
    emailStatus: 'Payment sent',
    paymentStatus: 'Paid',
    invoiceId: existing.invoice_id || existing.id,
    paypalOrderId: orderId,
    paypalCaptureId: captureId,
    paypalOrder,
    paypalPayment: paymentPayload,
    paymentCompletedAt: completedAt,
    priceMenu: mergePaymentDetails(existing.price_menu, fallbackDetails)
  };
  const registration = await updateRegistrationPaymentState(registrationId, patch, fallbackDetails);
  await sendEmailOrQueue({
    to: registration.email,
    subject: String(registration.registration_type || '').toLowerCase() === 'class'
      ? 'Kannada Bharati class payment confirmation'
      : 'Kannada Bharati event payment confirmation',
    template: 'payment-confirmation',
    payload: { registration, payment: { orderId, captureId, status: 'Paid', paypalOrder, paypalPayment: paymentPayload } }
  });

  await resetDefaulterAfterPayment(registration, event, 'payment');
  return registration;
}

async function findEventByRegistrationPayload(payload) {
  const supabase = requireSupabase();
  const program = payload.program || payload.eventTitle || payload.classTitle;
  const eventId = payload.eventId || payload.event_id;
  let query = supabase.from('kb_events').select('*').limit(1);
  if (eventId) query = query.eq('event_id', eventId);
  else if (program) query = query.eq('title', program);
  else return null;
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

function priceFromMenu(priceMenu, selection) {
  const values = Array.isArray(priceMenu) ? priceMenu : priceMenu?.items || priceMenu?.options || [];
  const selected = String(selection || '').toLowerCase();
  const match = values.find((item) => String(item.id || item.key || item.name || item.label || '').toLowerCase() === selected);
  return numberValue(match?.price ?? match?.amount, 0);
}

function mergePaymentDetails(priceMenu, details = {}) {
  const base = priceMenu && typeof priceMenu === 'object' && !Array.isArray(priceMenu)
    ? priceMenu
    : { items: Array.isArray(priceMenu) ? priceMenu : [] };
  return {
    ...base,
    paymentDetails: {
      ...(base.paymentDetails || {}),
      ...details,
      updatedAt: new Date().toISOString()
    }
  };
}

function registrationKindLabel(registration = {}) {
  const type = String(registration.registration_type || registration.registrationType || '').toLowerCase();
  if (type === 'class') return 'class registration';
  if (type === 'guest') return 'guest event registration';
  if (type === 'event') return 'event registration';
  return 'registration';
}

function registrationPaymentKind(registration = {}) {
  const type = String(registration.registration_type || registration.registrationType || '').toLowerCase();
  if (type === 'class') return 'class';
  if (type === 'guest') return 'guest-event';
  return 'event';
}

function registrationPaymentUrls(registration = {}) {
  const kind = registrationPaymentKind(registration);
  const registrationId = registration.id || '';
  const encodedKind = encodeURIComponent(kind);
  const encodedId = encodeURIComponent(registrationId);
  if (kind === 'class') {
    return {
      returnUrl: `${appBaseUrl}/admin/profile?payment=complete&kind=${encodedKind}&registrationId=${encodedId}`,
      cancelUrl: `${appBaseUrl}/admin/profile?payment=cancel&registrationId=${encodedId}`
    };
  }

  return {
    returnUrl: `${appBaseUrl}/events?payment=complete&kind=${encodedKind}&registrationId=${encodedId}`,
    cancelUrl: `${appBaseUrl}/events?payment=cancel&registrationId=${encodedId}`
  };
}

async function sendRegistrationEmail(registration, reason = 'submitted') {
  if (!registration?.email) return null;
  const label = registrationKindLabel(registration);
  const amountDue = numberValue(registration.amount, 0);
  const paid = registration.paid === true || registration.payment_received === true;
  let payUrl = '';
  if (amountDue > 0 && !paid && registration.id && reason !== 'paid') {
    const kind = registrationPaymentKind(registration);
    payUrl = `${appBaseUrl}${kind === 'class' ? '/admin/profile' : '/events'}?openPayment=1&kind=${encodeURIComponent(kind)}&registrationId=${encodeURIComponent(registration.id)}`;
  }
  const subjectByReason = {
    submitted: `Kannada Bharati ${label} received`,
    confirmed: `Kannada Bharati ${label} confirmed`,
    updated: `Kannada Bharati ${label} updated`,
    paid: 'Kannada Bharati payment confirmation'
  };
  return sendEmailOrQueue({
    to: registration.email,
    subject: subjectByReason[reason] || subjectByReason.updated,
    template: reason === 'paid' ? 'payment-confirmation' : (registration.registration_type === 'class' || registration.registrationType === 'class' ? 'class-registration' : 'registration-update'),
    payload: { registration, payUrl }
  });
}

async function createRegistrationRecord(payload, { sendEmail = true } = {}) {
  const supabase = requireSupabase();
  const email = String(payload.email || '').toLowerCase();
  const member = String(payload.familyMember || payload.studentName || payload.student_name || '').toLowerCase();
  if (email && member && payload.program) {
    const { data: existingRows, error: existingError } = await supabase
      .from('kb_registrations')
      .select('*')
      .eq('email', email)
      .eq('program', payload.program)
      .order('created_at', { ascending: false });
    if (existingError) throw existingError;
    const reusable = (existingRows || []).find((row) => (
      String(row.family_member || row.student_name || '').toLowerCase() === member
      && (row.enabled === false || ['deleted', 'disabled', 'cancelled', 'payment cancelled'].includes(String(row.status || '').toLowerCase()))
    ));
    if (reusable?.id) {
      const revived = await updateRecord('kb_registrations', reusable.id, {
        ...payload,
        enabled: true,
        status: payload.status || 'Submitted',
        paid: false,
        paymentReceived: false,
        emailStatus: null
      });
      if (sendEmail) await sendRegistrationEmail(revived, revived.status === 'Confirmed' ? 'confirmed' : 'submitted');
      return revived;
    }
  }
  const registration = await insertRecord('kb_registrations', payload);
  if (sendEmail) {
    await sendRegistrationEmail(registration, registration.status === 'Confirmed' ? 'confirmed' : 'submitted');
    if (registration.email_status !== 'Sent') {
      try {
        return await updateRecord('kb_registrations', registration.id, { emailStatus: 'Sent' });
      } catch {
        // Email was sent; do not fail registration if optional update fails.
      }
    }
  }
  return registration;
}

async function calculateRegistrationPayload(payload) {
  const event = await findEventByRegistrationPayload(payload);
  const capacity = numberValue(event?.capacity, 0);
  const registrations = event
    ? (await listOptionalTable('kb_registrations')).filter((registration) => (
      registration.event_id === event.event_id || registration.program === event.title
    ) && registration.enabled !== false && registration.status !== 'Deleted')
    : [];
  const alreadyRegistered = registrations.some((registration) => (
    String(registration.email || '').toLowerCase() === String(payload.email || '').toLowerCase()
    && String(registration.family_member || registration.student_name || '').toLowerCase() === String(payload.familyMember || payload.studentName || payload.student_name || '').toLowerCase()
  ));
  if (alreadyRegistered) {
    const error = new Error('This member is already registered for this event or class.');
    error.status = 409;
    throw error;
  }

  const requestedSeats = numberValue(payload.totalMembers ?? payload.total_members ?? payload.seats, 1);
  const usedSeats = registrations.reduce((sum, registration) => sum + numberValue(registration.total_members ?? registration.seats, 1), 0);
  const isWaitlist = capacity > 0 && usedSeats + requestedSeats > capacity;
  let amount = numberValue(payload.amount ?? payload.fee, 0);
  if (event?.price_menu) {
    amount = priceFromMenu(event.price_menu, payload.priceSelection || payload.price_selection) || amount;
  }
  if (booleanValue(event?.free_for_volunteers, false) && booleanValue(payload.isVolunteer, false)) amount = 0;
  if (booleanValue(event?.enable_volunteer_discount, false) && booleanValue(payload.isVolunteer, false)) {
    amount = Math.max(0, amount - (amount * numberValue(event.volunteer_discount_percentage, 0) / 100));
  }
  if (booleanValue(event?.enable_defaulter_fine, false) && booleanValue(payload.isDefaulter, false)) {
    amount += numberValue(event.defaulter_fine_amount, 0);
  }

  return {
    ...payload,
    eventId: payload.eventId || event?.event_id || null,
    program: payload.program || event?.title,
    amount,
    status: isWaitlist ? 'Waitlist' : (booleanValue(event?.is_auto_approved, false) ? 'Confirmed' : (payload.status || 'Submitted')),
    rsvp: payload.rsvp || event?.rsvp || null,
    priceMenu: payload.priceMenu || event?.price_menu || null
  };
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

async function saveExternalLogin(payload) {
  const supabase = requireSupabase();
  const record = normalizePayload('kb_external_logins', payload);
  if (!record.email) {
    const error = new Error('Email is required to connect an external login.');
    error.status = 400;
    throw error;
  }
  if (!record.provider) {
    const error = new Error('Provider is required to connect an external login.');
    error.status = 400;
    throw error;
  }

  const existing = await supabase
    .from('kb_external_logins')
    .select('id')
    .eq('email', record.email)
    .ilike('provider', record.provider)
    .maybeSingle();
  if (existing.error && !['42P01', 'PGRST205', 'PGRST116'].includes(existing.error.code)) throw existing.error;

  if (existing.data?.id) {
    const { data, error } = await supabase
      .from('kb_external_logins')
      .update({
        provider: record.provider,
        provider_key: record.provider_key,
        display_name: record.display_name
      })
      .eq('id', existing.data.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('kb_external_logins')
    .insert({ ...record, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function insertDefaulterHistory(payload) {
  const saved = await insertOptionalRecord('kb_defaulter_history', payload);
  if (saved) return saved;
  return insertOptionalRecord('kb_defaulter_history', {
    user_email: payload.user_email,
    is_defaulter: payload.is_defaulter,
    notes: payload.notes,
    set_by: payload.set_by || payload.reset_by || null
  });
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmail({ subject, template, payload = {} }) {
  const registration = payload.registration || {};
  const donation = payload.donation || {};
  const bulkMessage = payload.message || {};
  const amountDue = Number(registration.amount || 0);
  const registrationPaid = registration.paid === true || registration.payment_received === true;
  const payUrl = amountDue > 0 && !registrationPaid ? payload.payUrl || '' : '';
  const registrationRows = [
    ['Program', registration.program],
    ['Registered member', registration.family_member || registration.student_name || registration.parent_name],
    ['Status', registration.status],
    ['Amount', registration.amount !== undefined ? `$${Number(registration.amount || 0).toFixed(2)}` : ''],
    ['Payment', registration.paid || registration.payment_received ? 'Paid' : 'Pending'],
    ['Registered by', registration.email]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  const donationRows = [
    ['Name', donation.name],
    ['Email', donation.email],
    ['Cause', donation.cause_title || donation.cause],
    ['Amount', donation.amount !== undefined ? `$${Number(donation.amount || 0).toFixed(2)}` : ''],
    ['Payment', donation.payment_status || 'Paid']
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  const rows = template === 'donation-confirmation' ? donationRows : registrationRows;
  const cta = template === 'confirm-email' ? payload.confirmUrl : template === 'forgot-password' ? payload.resetUrl : payUrl;
  const ctaLabel = payUrl ? 'Pay Registration Fee' : 'Open link';
  const introByTemplate = {
    'confirm-email': 'Please confirm your Kannada Bharati account.',
    'forgot-password': 'Use the link below to reset your Kannada Bharati password.',
    'two-factor-code': `Use this code to finish signing in: ${payload.code || ''}`,
    'registration-update': 'Your Kannada Bharati registration has been updated.',
    'class-registration': 'Your class registration details are below.',
    'bulk-message': bulkMessage.intro || 'Kannada Bharati has sent you an update.',
    'payment-confirmation': 'Thank you. Your payment has been received.',
    'donation-confirmation': 'Thank you for supporting Kannada Bharati.'
  };
  const intro = introByTemplate[template] || 'Kannada Bharati notification.';
  const bodyText = template === 'bulk-message' ? String(bulkMessage.body || '').trim() : '';
  const footerText = template === 'bulk-message' ? String(bulkMessage.footer || '').trim() : '';
  const text = [
    subject,
    '',
    intro,
    bodyText,
    cta ? `Link: ${cta}` : '',
    payUrl ? `Pay online: ${cta}` : '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    footerText,
    '',
    'Kannada Bharati'
  ].filter(Boolean).join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;color:#102a26;line-height:1.5;max-width:680px">
      <h2 style="color:#004d46">${escapeHtml(subject)}</h2>
      <p>${escapeHtml(intro)}</p>
      ${bodyText ? `<div style="white-space:pre-line;margin:16px 0">${escapeHtml(bodyText)}</div>` : ''}
      ${payUrl ? `<p style="margin:16px 0 8px"><strong>Payment is pending.</strong> Use the button below to open your account and pay this registration fee.</p>` : ''}
      ${cta ? `<p><a style="display:inline-block;background:#edae13;color:#111;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:700" href="${escapeHtml(cta)}">${escapeHtml(ctaLabel)}</a></p>` : ''}
      ${rows.length ? `<table style="border-collapse:collapse;width:100%;margin-top:16px">${rows.map(([label, value]) => `<tr><th style="text-align:left;background:#f4f7f2;border:1px solid #d7dfda;padding:8px">${escapeHtml(label)}</th><td style="border:1px solid #d7dfda;padding:8px">${escapeHtml(value)}</td></tr>`).join('')}</table>` : ''}
      ${footerText ? `<p style="margin-top:18px;color:#51615d">${escapeHtml(footerText)}</p>` : ''}
      <p style="margin-top:18px">Kannada Bharati</p>
    </div>
  `;
  return { text, html };
}

function sampleTemplateMessage(template) {
  const registration = {
    id: 'sample-registration',
    program: 'Kannada Bharati Paata Shaale',
    family_member: 'Sample Student',
    student_name: 'Sample Student',
    parent_name: 'Sample Parent',
    email: adminEmail,
    status: 'Submitted',
    amount: 25,
    paid: false,
    payment_received: false
  };
  const donation = {
    name: 'Sample Donor',
    email: adminEmail,
    cause_title: 'Kannada Bharati community programs',
    amount: 101,
    payment_status: 'Paid'
  };
  const messages = {
    'confirm-email': {
      subject: 'Confirm your Kannada Bharati account',
      template: 'confirm-email',
      payload: { confirmUrl: `${appBaseUrl}/login?confirmToken=sample-token` }
    },
    'forgot-password': {
      subject: 'Reset your Kannada Bharati password',
      template: 'forgot-password',
      payload: { resetUrl: `${appBaseUrl}/login?resetToken=sample-token` }
    },
    registration: {
      subject: 'Kannada Bharati registration received',
      template: 'registration-update',
      payload: { registration, payUrl: `${appBaseUrl}/events?openPayment=1&registrationId=sample-registration` }
    },
    'class-registration': {
      subject: 'Kannada Bharati class registration received',
      template: 'class-registration',
      payload: { registration: { ...registration, registration_type: 'class' }, payUrl: `${appBaseUrl}/admin/profile?openPayment=1&registrationId=sample-registration` }
    },
    donation: {
      subject: 'Kannada Bharati donation confirmation',
      template: 'donation-confirmation',
      payload: { donation }
    }
  };
  return messages[template] || messages.registration;
}

async function sendEmailOrQueue(message) {
  const queued = await queueEmail(message);
  if (!smtpHost || !smtpUser || !smtpPass) return queued;

  try {
    const smtp = await sendEmailNow(message);
    if (queued?.id) {
      await updateRecord('kb_email_outbox', queued.id, {
        status: 'Sent',
        sent_at: new Date().toISOString(),
        payload: attachSmtpDelivery(queued.payload || message.payload, smtp)
      });
    }
  } catch (error) {
    if (queued?.id) {
      try {
        await updateRecord('kb_email_outbox', queued.id, { status: 'Failed' });
      } catch {
        // Keep original send error.
      }
    }
    throw error;
  }

  return queued;
}

async function sendEmailNow(message) {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP is not configured.');
  }

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
  const info = await transporter.sendMail({
    from: emailFromHeader,
    replyTo: emailFromAddress,
    to: message.to,
    subject: message.subject,
    text: rendered.text,
    html: rendered.html
  });
  return {
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    response: info.response || '',
    messageId: info.messageId || '',
    envelope: info.envelope || {}
  };
}

function uniqueEmailRows(rows = []) {
  const seen = new Set();
  return rows
    .map((row) => ({
      email: String(row.email || row.to_email || '').trim().toLowerCase(),
      name: row.name || row.parent_name || row.family_member || row.student_name || row.email || ''
    }))
    .filter((row) => {
      if (!/.+@.+\..+/.test(row.email) || seen.has(row.email)) return false;
      seen.add(row.email);
      return true;
    });
}

function matchesProgram(row, target) {
  const value = String(target || '').trim().toLowerCase();
  if (!value) return false;
  return [row.program, row.event_id, row.eventId, row.class_key, row.className]
    .some((item) => String(item || '').trim().toLowerCase() === value);
}

async function resolveBulkEmailRecipients({ audience, target }) {
  const scope = String(audience || '').toLowerCase();
  if (scope === 'all-users') {
    return uniqueEmailRows(await listTable('kb_users'));
  }

  if (scope === 'event' || scope === 'class') {
    const registrations = await listOptionalTable('kb_registrations');
    return uniqueEmailRows(registrations.filter((row) => {
      const enabled = row.enabled !== false;
      const notDeleted = String(row.status || '').toLowerCase() !== 'deleted';
      const type = String(row.registration_type || row.registrationType || '').toLowerCase();
      const typeMatches = scope === 'class'
        ? type === 'class' || /class|paata|shaale|guitar|dance|music|kannada/i.test(row.program || '')
        : type !== 'class';
      return enabled && notDeleted && typeMatches && matchesProgram(row, target);
    }));
  }

  const error = new Error('Choose all users, an event, or a class audience.');
  error.status = 400;
  throw error;
}

function attachSmtpDelivery(payload = {}, smtp = {}) {
  return {
    ...payload,
    smtpDelivery: {
      accepted: smtp.accepted || [],
      rejected: smtp.rejected || [],
      response: smtp.response || '',
      messageId: smtp.messageId || '',
      sentAt: new Date().toISOString()
    }
  };
}

async function sendSmsOrStore({ to, body, payload }) {
  const stored = await insertOptionalRecord('kb_sms_outbox', {
    to_phone: to,
    body,
    payload,
    status: twilioAccountSid && twilioAuthToken && twilioFromPhone ? 'Queued' : 'Stored'
  });
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromPhone) return stored;

  const credentials = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      From: twilioFromPhone,
      To: to,
      Body: body
    })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.message || 'SMS delivery failed.');
    error.status = response.status;
    throw error;
  }
  if (stored?.id) {
    try {
      await updateRecord('kb_sms_outbox', stored.id, { status: 'Sent', sent_at: new Date().toISOString() });
    } catch {
      // SMS was delivered; outbox status is best-effort.
    }
  }
  return stored;
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

app.post('/api/auth/register', authRateLimit, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const phone = req.body.phone ? normalizePhoneNumber(req.body.phone) : '';
  await verifyRecaptcha(req.body.recaptchaToken || req.body.recaptcha);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  if (req.body.phone && !phone) {
    return res.status(400).json({ error: 'Enter a valid phone number.' });
  }

  const { data: existingUser, error: existingUserError } = await supabase
    .from('kb_users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (existingUserError) throw existingUserError;
  if (existingUser) {
    return res.status(409).json({ error: 'An account already exists for this email. Please log in or reset your password.' });
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
      phone: phone || null,
      phone_confirmed: false,
      role: primaryRole(roles),
      roles,
      password_hash: passwordHash,
      email_confirmation_token: emailConfirmToken,
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' })
    .select('*')
    .single();

  if (userResult.error && /roles|email_confirmation_token|email_confirmed|phone_confirmed|two_factor_enabled/i.test(userResult.error.message || '')) {
    userResult = await supabase
      .from('kb_users')
      .upsert({
        email,
        name,
        phone: phone || null,
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
    phone: phone || null,
    program: req.body.program || 'General membership'
  });

  const cleanUser = publicUser(user);
  res.status(201).json({ user: cleanUser, token: tokenFor(user) });
}));

app.post('/api/auth/login', authRateLimit, asyncHandler(async (req, res) => {
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

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

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

  if (booleanValue(user.two_factor_enabled, false)) {
    const providers = twoFactorProvidersFor(user);
    if (!providers.length) {
      return res.status(403).json({ error: 'Two-factor authentication is enabled, but no verified delivery method is available. Contact an administrator.' });
    }
    return res.json({
      twoFactorRequired: true,
      twoFactorToken: twoFactorTokenFor(user),
      providers,
      rememberMe: booleanValue(req.body.rememberMe || req.body.remember, false)
    });
  }

  await insertRecord('kb_logins', {
    email,
    role: user.role
  });

  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/auth/otp/start', authRateLimit, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const { data: user, error } = await supabase
    .from('kb_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const stored = user ? await insertOptionalRecord('kb_two_factor_challenges', {
    email,
    provider: 'login-email',
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verified: false
  }) : null;
  const otpToken = oneTimeCodeTokenFor({ purpose: 'login-otp', email, code, challengeId: stored?.id || '' });
  if (user) {
    await sendEmailOrQueue({
      to: email,
      subject: 'Your Kannada Bharati login code',
      template: 'two-factor-code',
      payload: { code, email, purpose: 'otp-login' }
    });
  }

  res.json({
    ok: true,
    otpToken,
    destination: email,
    message: 'If an account exists, a login code was sent.',
    devCode: process.env.NODE_ENV === 'production' || !user ? undefined : code
  });
}));

app.post('/api/auth/otp/verify', authRateLimit, asyncHandler(async (req, res) => {
  const token = String(req.body.otpToken || req.body.token || '').trim();
  const code = String(req.body.code || '').trim();
  const challenge = readOneTimeCodeToken(token, 'login-otp');
  if (!challenge) return res.status(401).json({ error: 'OTP session expired. Request a new code.' });
  if (!/^\d{6}$/.test(code) || !oneTimeCodeMatches(challenge, code)) {
    return res.status(400).json({ error: 'OTP code is invalid or expired.' });
  }
  if (!await consumeOneTimeCodeChallenge(challenge, 'login-email')) {
    return res.status(400).json({ error: 'OTP code is invalid, expired, or already used.' });
  }

  const supabase = requireSupabase();
  const { data: existing, error } = await supabase
    .from('kb_users')
    .select('*')
    .eq('email', challenge.email)
    .maybeSingle();
  if (error) throw error;
  if (!existing) return res.status(401).json({ error: 'Account was not found.' });

  let user = existing;
  if (!booleanValue(existing.email_confirmed, false)) {
    const { data: confirmed, error: confirmError } = await supabase
      .from('kb_users')
      .update({ email_confirmed: true, email_confirmation_token: null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (confirmError) throw confirmError;
    user = confirmed;
  }

  if (booleanValue(user.two_factor_enabled, false)) {
    const providers = twoFactorProvidersFor(user);
    if (!providers.length) {
      return res.status(403).json({ error: 'Two-factor authentication is enabled, but no verified delivery method is available.' });
    }
    return res.json({
      twoFactorRequired: true,
      twoFactorToken: twoFactorTokenFor(user, providers),
      providers
    });
  }

  await insertRecord('kb_logins', { email: user.email, role: user.role });
  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/auth/phone-otp/start', authRateLimit, asyncHandler(async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number.' });
  if (isProduction && (!twilioAccountSid || !twilioAuthToken || !twilioFromPhone)) {
    return res.status(503).json({ error: 'Phone OTP is temporarily unavailable because SMS delivery is not configured.' });
  }

  const supabase = requireSupabase();
  const { data: users, error } = await supabase
    .from('kb_users')
    .select('*')
    .eq('phone_confirmed', true);
  if (error) throw error;

  const user = (users || []).find((candidate) => normalizePhoneNumber(candidate.phone) === phone);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const challengeEmail = user?.email || `missing-${codeHash(phone).slice(0, 16)}@phone.invalid`;
  const stored = user ? await insertOptionalRecord('kb_two_factor_challenges', {
    email: user.email,
    provider: 'login-phone',
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verified: false
  }) : null;
  const otpToken = oneTimeCodeTokenFor({
    purpose: 'login-phone-otp',
    email: challengeEmail,
    code,
    challengeId: stored?.id || ''
  });

  if (user) {
    await sendSmsOrStore({
      to: normalizePhoneNumber(user.phone),
      body: `Your Kannada Bharati login code is: ${code}`,
      payload: { email: user.email, purpose: 'phone-otp-login' }
    });
  }

  res.json({
    ok: true,
    otpToken,
    destination: phone,
    message: 'If a verified account exists, a login code was sent.',
    devCode: process.env.NODE_ENV === 'production' || !user ? undefined : code
  });
}));

app.post('/api/auth/phone-otp/verify', authRateLimit, asyncHandler(async (req, res) => {
  const token = String(req.body.otpToken || req.body.token || '').trim();
  const code = String(req.body.code || '').trim();
  const challenge = readOneTimeCodeToken(token, 'login-phone-otp');
  if (!challenge) return res.status(401).json({ error: 'OTP session expired. Request a new code.' });
  if (!/^\d{6}$/.test(code) || !oneTimeCodeMatches(challenge, code)) {
    return res.status(400).json({ error: 'OTP code is invalid or expired.' });
  }
  if (!await consumeOneTimeCodeChallenge(challenge, 'login-phone')) {
    return res.status(400).json({ error: 'OTP code is invalid, expired, or already used.' });
  }

  const supabase = requireSupabase();
  const { data: user, error } = await supabase
    .from('kb_users')
    .select('*')
    .eq('email', challenge.email)
    .eq('phone_confirmed', true)
    .maybeSingle();
  if (error) throw error;
  if (!user) return res.status(401).json({ error: 'Account was not found or the phone number is not verified.' });

  if (booleanValue(user.two_factor_enabled, false)) {
    const providers = twoFactorProvidersFor(user).filter((provider) => provider.id !== 'phone');
    if (!providers.length) {
      return res.status(403).json({ error: 'Two-factor authentication requires a verified method other than this phone number.' });
    }
    return res.json({
      twoFactorRequired: true,
      twoFactorToken: twoFactorTokenFor(user, providers),
      providers
    });
  }

  await insertRecord('kb_logins', { email: user.email, role: user.role });
  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/auth/google', authRateLimit, asyncHandler(async (req, res) => {
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

  await saveExternalLogin({
    email: user.email,
    provider: 'Google',
    provider_key: googleProfile.sub || googleProfile.email,
    display_name: googleProfile.name || user.name
  });

  if (booleanValue(user.two_factor_enabled, false)) {
    const providers = twoFactorProvidersFor(user);
    if (!providers.length) {
      return res.status(403).json({ error: 'Two-factor authentication is enabled, but no verified delivery method is available. Contact an administrator.' });
    }
    return res.json({
      twoFactorRequired: true,
      twoFactorToken: twoFactorTokenFor(user),
      providers
    });
  }

  await insertRecord('kb_logins', {
    email: user.email,
    role: user.role
  });

  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/auth/two-factor/send', authRateLimit, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const token = String(req.body.twoFactorToken || req.body.token || '').trim();
  const provider = String(req.body.provider || '').trim().toLowerCase();
  const challenge = readTwoFactorToken(token);
  if (!challenge) return res.status(401).json({ error: 'Two-factor session expired. Please log in again.' });
  if (!['email', 'phone'].includes(provider)) return res.status(400).json({ error: 'Choose email or text message.' });
  if (!challenge.providers?.includes(provider)) return res.status(400).json({ error: 'Selected two-factor provider is not available for this account.' });

  const { data: user, error } = await supabase
    .from('kb_users')
    .select('*')
    .eq('email', challenge.email)
    .maybeSingle();
  if (error) throw error;
  if (!user || !booleanValue(user.two_factor_enabled, false)) return res.status(400).json({ error: 'Two-factor authentication is not enabled for this account.' });

  const providers = twoFactorProvidersFor(user);
  const selected = providers.find((item) => item.id === provider);
  if (!selected) return res.status(400).json({ error: 'Selected two-factor provider is not verified for this account.' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const stored = await insertOptionalRecord('kb_two_factor_challenges', {
    email: user.email,
    provider,
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verified: false
  });

  if (provider === 'phone') {
    await sendSmsOrStore({
      to: user.phone,
      body: `Your Kannada Bharati login code is: ${code}`,
      payload: { email: user.email, purpose: 'two-factor', challengeId: stored?.id || null }
    });
  } else {
    await sendEmailOrQueue({
      to: user.email,
      subject: 'Your Kannada Bharati login code',
      template: 'two-factor-code',
      payload: { code, email: user.email, challengeId: stored?.id || null }
    });
  }

  res.json({
    ok: true,
    challengeId: stored?.id || '',
    verificationToken: twoFactorVerificationTokenFor({ email: user.email, provider, code, challengeId: stored?.id || '' }),
    provider,
    destination: selected.destination,
    devCode: process.env.NODE_ENV === 'production' ? undefined : code
  });
}));

app.post('/api/auth/two-factor/verify', authRateLimit, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const token = String(req.body.twoFactorToken || req.body.token || '').trim();
  const verificationToken = String(req.body.verificationToken || '').trim();
  const provider = String(req.body.provider || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const challenge = readTwoFactorToken(token);
  if (!challenge) return res.status(401).json({ error: 'Two-factor session expired. Please log in again.' });
  if (!code) return res.status(400).json({ error: 'Verification code is required.' });

  const { data: user, error: userError } = await supabase
    .from('kb_users')
    .select('*')
    .eq('email', challenge.email)
    .maybeSingle();
  if (userError) throw userError;
  if (!user) return res.status(401).json({ error: 'Account was not found.' });

  let verified = false;
  const signedCode = readTwoFactorVerificationToken(verificationToken);
  if (signedCode
    && signedCode.email === user.email
    && signedCode.provider === provider
    && signedCode.codeHash === codeHash(code)) {
    verified = true;
  }

  if (!verified) {
    const { data, error } = await supabase
      .from('kb_two_factor_challenges')
      .select('*')
      .eq('email', user.email)
      .eq('provider', provider)
      .eq('code', code)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error && !['42P01', 'PGRST205'].includes(error.code)) throw error;
    if (!data || new Date(data.expires_at) < new Date()) return res.status(400).json({ error: 'Verification code is invalid or expired.' });
    await supabase.from('kb_two_factor_challenges').update({ verified: true }).eq('id', data.id);
  }

  await insertRecord('kb_logins', { email: user.email, role: user.role });
  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/auth/forgot-password', authRateLimit, asyncHandler(async (req, res) => {
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

app.post('/api/auth/reset-password', authRateLimit, asyncHandler(async (req, res) => {
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

app.post('/api/auth/confirm-email', authRateLimit, asyncHandler(async (req, res) => {
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

app.post('/api/auth/two-factor/setup/send', authRateLimit, authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const { data: user, error } = await supabase
    .from('kb_users')
    .select('*')
    .eq('email', req.user.email.toLowerCase())
    .single();
  if (error) throw error;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const stored = await insertOptionalRecord('kb_two_factor_challenges', {
    email: user.email,
    provider: 'two-factor-setup',
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verified: false
  });
  const setupToken = oneTimeCodeTokenFor({ purpose: 'two-factor-setup', email: user.email, code, challengeId: stored?.id || '' });
  await sendEmailOrQueue({
    to: user.email,
    subject: 'Verify Kannada Bharati two-factor authentication',
    template: 'two-factor-code',
    payload: { code, email: user.email, purpose: 'two-factor-setup' }
  });

  res.json({
    ok: true,
    setupToken,
    destination: user.email,
    devCode: process.env.NODE_ENV === 'production' ? undefined : code
  });
}));

app.post('/api/auth/two-factor/setup/verify', authRateLimit, authenticate, asyncHandler(async (req, res) => {
  const token = String(req.body.setupToken || req.body.token || '').trim();
  const code = String(req.body.code || '').trim();
  const challenge = readOneTimeCodeToken(token, 'two-factor-setup');
  if (!challenge || challenge.email !== req.user.email.toLowerCase()) {
    return res.status(401).json({ error: 'Two-factor setup session expired. Request a new code.' });
  }
  if (!/^\d{6}$/.test(code) || !oneTimeCodeMatches(challenge, code)) {
    return res.status(400).json({ error: 'Verification code is invalid or expired.' });
  }
  if (!await consumeOneTimeCodeChallenge(challenge, 'two-factor-setup')) {
    return res.status(400).json({ error: 'Verification code is invalid, expired, or already used.' });
  }

  const supabase = requireSupabase();
  const { data: user, error } = await supabase
    .from('kb_users')
    .update({
      two_factor_enabled: true,
      email_confirmed: true,
      email_confirmation_token: null,
      updated_at: new Date().toISOString()
    })
    .eq('email', challenge.email)
    .select('*')
    .single();
  if (error) throw error;
  res.json({ user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/auth/two-factor', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const enabled = booleanValue(req.body.enabled, false);
  if (enabled) {
    return res.status(400).json({ error: 'Verify the emailed OTP before enabling two-factor authentication.' });
  }
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
  res.json({ profile: profileResponse(profile.data, req.user), children: children.data || [] });
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

app.get('/api/about-content', asyncHandler(async (req, res) => {
  res.json(await getAboutContent());
}));

app.put('/api/about-content', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  res.json(await saveAboutContent(req.body));
}));

app.get('/api/settings/:key', asyncHandler(async (req, res) => {
  const allowedSettings = new Set(['volunteer-google-form', 'about-content', 'paata-teachers', 'site-message', 'role-definitions', 'teacher-allotments', 'events-hero-slides']);
  if (!allowedSettings.has(req.params.key)) return res.status(404).json({ error: 'Unknown setting.' });
  if (req.params.key === 'about-content') {
    return res.json(await getAboutContent());
  }
  if (req.params.key === 'paata-teachers') {
    return res.json(await getSiteSetting(req.params.key, []));
  }
  if (req.params.key === 'site-message') {
    return res.json(await getSiteSetting(req.params.key, { enabled: false, title: '', message: '', ctaText: '', ctaUrl: '' }));
  }
  if (req.params.key === 'role-definitions' || req.params.key === 'teacher-allotments' || req.params.key === 'events-hero-slides') {
    return res.json(await getSiteSetting(req.params.key, []));
  }
  const value = await getSiteSetting(req.params.key, req.params.key === 'volunteer-google-form' ? { enabled: false, url: defaultVolunteerGoogleFormUrl } : null);
  if (req.params.key === 'volunteer-google-form' && !value.url) value.url = defaultVolunteerGoogleFormUrl;
  res.json(value);
}));

app.put('/api/settings/:key', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const allowedSettings = new Set(['volunteer-google-form', 'about-content', 'paata-teachers', 'site-message', 'role-definitions', 'teacher-allotments', 'events-hero-slides']);
  if (!allowedSettings.has(req.params.key)) return res.status(404).json({ error: 'Unknown setting.' });
  if (req.params.key === 'about-content') {
    return res.json(await saveAboutContent(req.body));
  }
  if (req.params.key === 'paata-teachers') {
    return res.json(await saveSiteSetting(req.params.key, normalizePaataTeacherSetting(req.body)));
  }
  if (req.params.key === 'site-message') {
    const value = normalizeSiteMessageSetting(req.body);
    if (value.enabled && (!value.title || !value.message)) {
      return res.status(400).json({ error: 'Title and message are required when the popup is enabled.' });
    }
    return res.json(await saveSiteSetting(req.params.key, value));
  }
  if (req.params.key === 'role-definitions' || req.params.key === 'teacher-allotments') {
    const value = Array.isArray(req.body) ? req.body : [];
    return res.json(await saveSiteSetting(req.params.key, value));
  }
  if (req.params.key === 'events-hero-slides') {
    const value = (Array.isArray(req.body) ? req.body : [])
      .slice(0, 12)
      .map((slide, index) => ({
        id: String(slide?.id || `event-hero-${index + 1}`).slice(0, 100),
        image: String(slide?.image || '').trim(),
        alt: String(slide?.alt || '').trim().slice(0, 180),
        caption: String(slide?.caption || '').trim().slice(0, 180),
        position: ['top', 'center', 'bottom'].includes(slide?.position) ? slide.position : 'center',
        enabled: booleanValue(slide?.enabled, true)
      }))
      .filter((slide) => slide.image);
    if (!value.length || !value.some((slide) => slide.enabled)) {
      return res.status(400).json({ error: 'At least one visible event hero photo is required.' });
    }
    if (value.some((slide) => !slide.alt)) {
      return res.status(400).json({ error: 'Accessible image text is required for every event hero photo.' });
    }
    return res.json(await saveSiteSetting(req.params.key, value));
  }
  const value = {
    enabled: booleanValue(req.body.enabled, false),
    url: String(req.body.url || '').trim()
  };
  if (value.enabled && !value.url) {
    return res.status(400).json({ error: 'Google Form URL is required when registration is enabled.' });
  }
  res.json(await saveSiteSetting(req.params.key, value));
}));

app.patch('/api/admin/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const user = await updateRecord('kb_users', req.params.id, req.body);
  if (req.body.isVolunteeringDefaulter !== undefined || req.body.is_volunteering_defaulter !== undefined) {
    const isDefaulter = booleanValue(req.body.isVolunteeringDefaulter ?? req.body.is_volunteering_defaulter, false);
    await insertDefaulterHistory({
      user_email: user.email,
      is_defaulter: isDefaulter,
      notes: req.body.defaulterNotes || req.body.defaulter_notes || null,
      set_by: isDefaulter ? req.user.email : null,
      reset_by: isDefaulter ? null : req.user.email,
      set_date: new Date().toISOString(),
      reset_date: isDefaulter ? null : new Date().toISOString()
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

app.get('/api/users/phone', authenticate, requireRole('welcomedesk', 'receptionist'), asyncHandler(async (req, res) => {
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
  const [userResult, externalResult] = await Promise.all([
    supabase
    .from('kb_users')
    .select('email, password_hash, email_confirmed')
    .eq('email', req.user.email.toLowerCase())
      .maybeSingle(),
    supabase
      .from('kb_external_logins')
      .select('*')
      .eq('email', req.user.email.toLowerCase())
  ]);
  const { data: user, error } = userResult;
  if (error) throw error;
  if (externalResult.error && !['42P01', 'PGRST205'].includes(externalResult.error.code)) throw externalResult.error;
  const linkedProviders = new Set((externalResult.data || []).map((login) => String(login.provider || '').toLowerCase()));
  res.json({
    email: req.user.email,
    logins: [
      user?.password_hash ? { provider: 'Local password', connected: true } : { provider: 'Local password', connected: false },
      { provider: 'Google', connected: linkedProviders.has('google') }
    ]
  });
}));

app.post('/api/auth/external-logins', authenticate, asyncHandler(async (req, res) => {
  const provider = normalizeProvider(req.body.provider || 'Google');
  if (!provider) return res.status(400).json({ error: 'Provider is required.' });
  let providerKey = req.user.email.toLowerCase();
  let displayName = req.user.name || req.user.email;
  if (provider.toLowerCase() === 'google') {
    const googleProfile = await readGoogleProfile({
      accessToken: req.body.accessToken,
      credential: req.body.credential
    });
    if (googleProfile.email !== req.user.email.toLowerCase()) {
      return res.status(400).json({ error: `This Google account belongs to ${googleProfile.email}. Sign in with ${req.user.email} to connect it.` });
    }
    providerKey = googleProfile.sub || googleProfile.email;
    displayName = googleProfile.name || displayName;
  }
  const data = await saveExternalLogin({
    email: req.user.email.toLowerCase(),
    provider,
    provider_key: providerKey,
    display_name: displayName
  });
  res.status(201).json(data || { provider, connected: true });
}));

app.delete('/api/auth/external-logins/:provider', authenticate, asyncHandler(async (req, res) => {
  const provider = String(req.params.provider || '').trim();
  if (!provider || provider.toLowerCase() === 'local password') {
    return res.status(400).json({ error: 'Only external providers can be removed here.' });
  }
  const supabase = requireSupabase();
  const [userResult, externalResult] = await Promise.all([
    supabase.from('kb_users').select('password_hash').eq('email', req.user.email.toLowerCase()).maybeSingle(),
    supabase.from('kb_external_logins').select('*').eq('email', req.user.email.toLowerCase())
  ]);
  if (userResult.error) throw userResult.error;
  if (externalResult.error && !['42P01', 'PGRST205'].includes(externalResult.error.code)) throw externalResult.error;
  const remainingExternal = (externalResult.data || []).filter((login) => String(login.provider || '').toLowerCase() !== provider.toLowerCase());
  if (!userResult.data?.password_hash && remainingExternal.length === 0) {
    return res.status(400).json({ error: 'Create a local password before removing your last external login.' });
  }
  const { error } = await supabase
    .from('kb_external_logins')
    .delete()
    .eq('email', req.user.email.toLowerCase())
    .ilike('provider', provider);
  if (error && !['42P01', 'PGRST205'].includes(error.code)) throw error;
  res.json({ ok: true });
}));

app.post('/api/auth/verify-phone/start', authRateLimit, authenticate, asyncHandler(async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Phone number is required.' });
  if (isProduction && (!twilioAccountSid || !twilioAuthToken || !twilioFromPhone)) {
    return res.status(503).json({ error: 'Phone verification is temporarily unavailable because SMS delivery is not configured.' });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await insertOptionalRecord('kb_phone_verifications', {
    email: req.user.email,
    phone,
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verified: false
  });
  await sendSmsOrStore({
    to: phone,
    body: `Your Kannada Bharati security code is: ${code}`,
    payload: { email: req.user.email, purpose: 'phone-verification' }
  });
  res.json({ ok: true, message: 'Verification code generated.', devCode: process.env.NODE_ENV === 'production' ? undefined : code });
}));

app.post('/api/auth/verify-phone/confirm', authRateLimit, authenticate, asyncHandler(async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);
  const code = String(req.body.code || '').trim();
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number.' });
  const supabase = requireSupabase();
  const { data: confirmedUsers, error: confirmedUsersError } = await supabase
    .from('kb_users')
    .select('email, phone')
    .eq('phone_confirmed', true);
  if (confirmedUsersError) throw confirmedUsersError;
  const phoneOwner = (confirmedUsers || []).find((candidate) => (
    candidate.email !== req.user.email && normalizePhoneNumber(candidate.phone) === phone
  ));
  if (phoneOwner) return res.status(409).json({ error: 'This phone number is already verified for another account.' });

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
  const { data: user, error: updateError } = await supabase
    .from('kb_users')
    .update({ phone, phone_confirmed: true, updated_at: new Date().toISOString() })
    .eq('email', req.user.email)
    .select('*')
    .single();
  if (updateError) throw updateError;
  res.json({ ok: true, user: publicUser(user), token: tokenFor(user) });
}));

app.delete('/api/auth/phone', authenticate, asyncHandler(async (req, res) => {
  const supabase = requireSupabase();
  const { data: user, error } = await supabase
    .from('kb_users')
    .update({ phone: null, phone_confirmed: false, updated_at: new Date().toISOString() })
    .eq('email', req.user.email)
    .select('*')
    .single();
  if (error) throw error;
  res.json({ ok: true, user: publicUser(user), token: tokenFor(user) });
}));

app.post('/api/registrations/:id/action', authenticate, requireRole('welcomedesk', 'receptionist'), asyncHandler(async (req, res) => {
  const action = String(req.body.action || '').toLowerCase();
  const existingRegistration = action === 'paid' ? await getRegistrationById(req.params.id) : null;
  const paymentDetails = req.body.paymentDetails || null;
  const patchByAction = {
    confirm: { status: 'Confirmed' },
    reset: { status: 'Submitted' },
    paid: {
      paid: true,
      paymentReceived: true,
      status: 'Confirmed',
      emailStatus: 'Payment sent',
      ...(paymentDetails ? {
        priceMenu: mergePaymentDetails(existingRegistration?.price_menu, {
          method: paymentDetails.method || 'PayPal',
          reference: paymentDetails.reference || '',
          notes: paymentDetails.notes || '',
          amount: numberValue(paymentDetails.amount ?? existingRegistration?.amount, 0),
          program: existingRegistration?.program || '',
          registrationType: existingRegistration?.registration_type || '',
          markedBy: req.user.email
        })
      } : {})
    },
    delete: { enabled: false, status: 'Deleted' },
    enable: { enabled: true, status: 'Submitted' },
    checkin: { checkedIn: true, checkedInAt: new Date().toISOString() },
    emailstatus: { emailStatus: 'Sent' }
  };
  const patch = patchByAction[action];
  if (!patch) return res.status(400).json({ error: 'Unknown registration action.' });
  const registration = await updateRecord('kb_registrations', req.params.id, patch);
  if (['confirm', 'emailstatus', 'paid'].includes(action)) {
    await sendRegistrationEmail(registration, action === 'confirm' ? 'confirmed' : action === 'paid' ? 'paid' : 'updated');
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

const requireWelcomeDesk = requireRole('welcomedesk', 'receptionist');

async function listWelcomeDeskEvents(req, res) {
  const events = await listTable('kb_events');
  res.json(events.filter((event) => booleanValue(event.enable_check_in, true) && booleanValue(event.enabled, true)));
}

async function listWelcomeDeskRegistrations(req, res) {
  const supabase = requireSupabase();
  let query = supabase.from('kb_registrations').select('*').order('created_at', { ascending: false });
  if (req.query.eventId) query = query.eq('event_id', req.query.eventId);
  if (!booleanValue(req.query.includeDeletedItems, false)) query = query.neq('status', 'Deleted').eq('enabled', true);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data || []);
}

async function createWelcomeDeskCheckIn(req, res) {
  const registrationId = req.body.registrationId || req.body.registration_id;
  const existingRegistration = registrationId ? await getRegistrationById(registrationId) : null;
  if (!existingRegistration) return res.status(404).json({ error: 'Registration was not found.' });
  if (booleanValue(existingRegistration.checked_in, false) || existingRegistration.checked_in_at) {
    return res.status(403).json({ error: 'Already checked in.' });
  }
  const registration = await updateRecord('kb_registrations', registrationId, {
    checkedIn: true,
    checkedInAt: new Date().toISOString()
  });
  const checkin = await insertOptionalRecord('kb_checkins', {
    registrationId,
    registrationKey: req.body.registrationKey,
    eventId: req.body.eventId || registration?.event_id,
    checkedIn: true,
    checkedInBy: req.user.email
  });
  res.status(201).json({ registration, checkin });
}

app.get('/api/welcome-desk/events', authenticate, requireWelcomeDesk, asyncHandler(listWelcomeDeskEvents));
app.get('/api/welcome-desk/registrations', authenticate, requireWelcomeDesk, asyncHandler(listWelcomeDeskRegistrations));
app.post('/api/welcome-desk/checkin', authenticate, requireWelcomeDesk, asyncHandler(createWelcomeDeskCheckIn));
app.get('/api/reception/events', authenticate, requireWelcomeDesk, asyncHandler(listWelcomeDeskEvents));
app.get('/api/reception/registrations', authenticate, requireWelcomeDesk, asyncHandler(listWelcomeDeskRegistrations));
app.post('/api/reception/checkin', authenticate, requireWelcomeDesk, asyncHandler(createWelcomeDeskCheckIn));

app.post('/api/payments/paypal/orders', asyncHandler(async (req, res) => {
  const amount = numberValue(req.body.amount, 0);
  if (amount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
  }

  const token = await paypalAccessToken();
  const returnUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}/donate`;
  const cancelUrl = req.body.cancelUrl || returnUrl;
  const invoiceId = req.body.donationId && isUuid(req.body.donationId) ? req.body.donationId : undefined;
  const landingPage = ['LOGIN', 'BILLING'].includes(String(req.body.landingPage || '').toUpperCase())
    ? String(req.body.landingPage).toUpperCase()
    : 'LOGIN';

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
        landing_page: landingPage,
        payment_method: {
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        },
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    })
  });

  const approvalUrl = order.links?.find((link) => link.rel === 'approve')?.href;
  res.status(201).json({ orderId: order.id, approvalUrl });
}));

app.get('/api/payments/paypal/donate-link', asyncHandler(async (req, res) => {
  res.json({
    donateUrl: kbPaypalDonateUrl,
    legacyHostedButtonId: process.env.KB_PAYPAL_HOSTED_BUTTON_ID || 'EY5YVURQPDWEE',
    legacyFormUrl: 'https://www.paypal.com/cgi-bin/webscr'
  });
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

async function startRegistrationPaymentFlow(kind, body = {}, actor = null) {
  if (!['event', 'class', 'guest-event', 'guest'].includes(kind)) {
    const error = new Error('Unknown payment type.');
    error.status = 404;
    throw error;
  }
  const isGuestPayment = ['guest-event', 'guest'].includes(kind);
  const amount = numberValue(body.amount || body.totalPrice || body.TotalPrice || body.fee, 0);
  if (amount <= 0) {
    const error = new Error('Payment amount must be greater than zero.');
    error.status = 400;
    throw error;
  }

  let registrationId = body.registrationId || body.invoiceId || body.InvoiceId;
  if (!isGuestPayment && !actor) {
    const error = new Error('Login required to start this payment.');
    error.status = 401;
    throw error;
  }
  if (!registrationId && body.email) {
    if (!isGuestPayment && !canManagePayment(actor) && String(actor?.email || '').toLowerCase() !== String(body.email || '').toLowerCase()) {
      const error = new Error('You can only create payments for your own registration.');
      error.status = 403;
      throw error;
    }
    const calculated = await calculateRegistrationPayload({
      parentName: body.parentName || body.name || body.email,
      studentName: body.studentName || body.familyMember || body.name || '-',
      familyMember: body.familyMember || body.studentName || body.name || '-',
      email: String(body.email).toLowerCase(),
      phone: body.phone || null,
      program: body.program || body.eventTitle || body.classTitle || 'Guest registration',
      eventId: body.eventId || body.EventId || null,
      amount,
      paid: false,
      paymentReceived: false,
      registrationType: kind.includes('guest') ? 'guest' : kind,
      status: 'Submitted',
      adults: body.adults,
      kids: body.kids,
      youngKids: body.youngKids,
      seats: body.seats,
      totalMembers: body.totalMembers || body.membersCount || body.MembersCount,
      priceSelection: body.priceSelection,
      isVolunteer: body.isVolunteer,
      isDefaulter: body.isDefaulter,
      rsvp: body.rsvp || body.Rsvp
    });
    const registration = await createRegistrationRecord(calculated);
    registrationId = registration.id;
  }

  const returnUrl = body.returnUrl || `${appBaseUrl}/profile?payment=complete`;
  const cancelUrl = body.cancelUrl || `${appBaseUrl}/profile?payment=cancel`;
  const created = await createPayPalRegistrationOrder({
    kind,
    registrationId,
    amount,
    description: body.description || `Kannada Bharati ${kind} registration`,
    returnUrl,
    cancelUrl
  });

  if (registrationId) {
    const existing = await getRegistrationById(registrationId);
    if (existing) {
      if (!isGuestPayment && !canAccessRegistrationPayment(actor, existing)) {
        const error = new Error('You can only pay for your own registration.');
        error.status = 403;
        throw error;
      }
      const fallbackDetails = paypalPaymentDetails({
        kind,
        order: created.order,
        phase: 'Created',
        amount,
        registration: existing
      });
      await updateRegistrationPaymentState(registrationId, {
        status: 'Created',
        paymentStatus: 'Created',
        invoiceId: existing.invoice_id || registrationId,
        paypalOrderId: created.orderId,
        paypalOrder: created.order,
        priceMenu: mergePaymentDetails(existing.price_menu, fallbackDetails)
      }, fallbackDetails);
    }
  }

  return {
    registrationId,
    invoiceId: registrationId,
    orderId: created.orderId,
    approvalUrl: created.approvalUrl,
    paypalOrder: created.order
  };
}

async function completeRegistrationPaymentFlow(kind, body = {}, actor = null) {
  if (!['event', 'class', 'guest-event', 'guest'].includes(kind)) {
    const error = new Error('Unknown payment type.');
    error.status = 404;
    throw error;
  }
  const isGuestPayment = ['guest-event', 'guest'].includes(kind);
  if (!isGuestPayment && !actor) {
    const error = new Error('Login required to complete this payment.');
    error.status = 401;
    throw error;
  }
  const orderId = body.orderId || body.token || body.PaypalOrder?.id || body.paypalOrder?.id;
  if (!orderId) {
    const error = new Error('PayPal order id is required.');
    error.status = 400;
    throw error;
  }
  const registrationId = body.registrationId || body.invoiceId || body.InvoiceId;
  const existingRegistration = registrationId ? await getRegistrationById(registrationId) : null;
  if (existingRegistration && !isGuestPayment && !canAccessRegistrationPayment(actor, existingRegistration)) {
    const error = new Error('You can only complete payment for your own registration.');
    error.status = 403;
    throw error;
  }
  const token = await paypalAccessToken();
  const payment = body.paypalPayment || body.PaypalPayment || await fetchJson(`${paypalBaseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const capture = payment.purchase_units?.[0]?.payments?.captures?.[0];
  const customId = payment.purchase_units?.[0]?.custom_id;
  const effectiveRegistrationId = registrationId || customId;
  if (!customId || String(customId) !== String(effectiveRegistrationId)) {
    const error = new Error('PayPal order does not match this registration.');
    error.status = 403;
    throw error;
  }
  const registration = await markRegistrationPaid({
    registrationId: effectiveRegistrationId,
    orderId: payment.id || orderId,
    captureId: capture?.id || body.captureId || null,
    paymentPayload: payment,
    paypalOrder: body.paypalOrder || body.PaypalOrder || existingRegistration?.paypal_order || null,
    kind,
    status: body.status
  });
  return { paymentStatus: payment.status || 'COMPLETED', orderId: payment.id || orderId, captureId: capture?.id || body.captureId || null, registration };
}

async function cancelRegistrationPaymentFlow(kind, body = {}, actor = null) {
  const isGuestPayment = ['guest-event', 'guest'].includes(kind);
  const registrationId = body.registrationId || body.invoiceId || body.InvoiceId;
  let registration = null;
  if (registrationId) {
    const existing = await getRegistrationById(registrationId);
    if (existing && !isGuestPayment && !canAccessRegistrationPayment(actor, existing)) {
      const error = new Error('You can only cancel payment for your own registration.');
      error.status = 403;
      throw error;
    }
    if (existing && String(existing.status || '').toLowerCase() === 'created') {
      await deleteRecord('kb_registrations', registrationId);
    } else if (existing) {
      const fallbackDetails = paypalPaymentDetails({
        kind,
        order: body.paypalOrder || body.PaypalOrder || existing.paypal_order,
        phase: 'Cancelled',
        registration: existing
      });
      registration = await updateRegistrationPaymentState(registrationId, {
        status: 'Payment Cancelled',
        paymentStatus: 'Cancelled',
        paymentReceived: false,
        paymentCancelledAt: new Date().toISOString(),
        priceMenu: mergePaymentDetails(existing.price_menu, fallbackDetails)
      }, fallbackDetails);
    }
  }
  return { ok: true, registration };
}

app.post('/api/payment/event/create', authenticate, asyncHandler(async (req, res) => {
  res.status(201).json(await startRegistrationPaymentFlow('event', req.body, req.user));
}));

app.post('/api/payment/event/complete', authenticate, asyncHandler(async (req, res) => {
  res.json(await completeRegistrationPaymentFlow('event', req.body, req.user));
}));

app.post('/api/payment/event/cancel', authenticate, asyncHandler(async (req, res) => {
  res.json(await cancelRegistrationPaymentFlow('event', req.body, req.user));
}));

app.post('/api/payment/classevent/create', authenticate, asyncHandler(async (req, res) => {
  res.status(201).json(await startRegistrationPaymentFlow('class', req.body, req.user));
}));

app.post('/api/payment/classevent/complete', authenticate, asyncHandler(async (req, res) => {
  res.json(await completeRegistrationPaymentFlow('class', req.body, req.user));
}));

app.post('/api/payment/classevent/cancel', authenticate, asyncHandler(async (req, res) => {
  res.json(await cancelRegistrationPaymentFlow('class', req.body, req.user));
}));

app.post('/api/guestpayment/guestevent/create', asyncHandler(async (req, res) => {
  res.status(201).json(await startRegistrationPaymentFlow('guest-event', req.body));
}));

app.post('/api/guestpayment/guestevent/complete', asyncHandler(async (req, res) => {
  res.json(await completeRegistrationPaymentFlow('guest-event', req.body));
}));

app.post('/api/guestpayment/guestevent/cancel', asyncHandler(async (req, res) => {
  res.json(await cancelRegistrationPaymentFlow('guest-event', req.body));
}));

app.post('/payment/event/create', authenticate, asyncHandler(async (req, res) => {
  res.status(201).json(await startRegistrationPaymentFlow('event', req.body, req.user));
}));

app.post('/payment/event/complete', authenticate, asyncHandler(async (req, res) => {
  res.json(await completeRegistrationPaymentFlow('event', req.body, req.user));
}));

app.post('/payment/event/cancel', authenticate, asyncHandler(async (req, res) => {
  res.json(await cancelRegistrationPaymentFlow('event', req.body, req.user));
}));

app.post('/payment/classevent/create', authenticate, asyncHandler(async (req, res) => {
  res.status(201).json(await startRegistrationPaymentFlow('class', req.body, req.user));
}));

app.post('/payment/classevent/complete', authenticate, asyncHandler(async (req, res) => {
  res.json(await completeRegistrationPaymentFlow('class', req.body, req.user));
}));

app.post('/payment/classevent/cancel', authenticate, asyncHandler(async (req, res) => {
  res.json(await cancelRegistrationPaymentFlow('class', req.body, req.user));
}));

app.post('/guestpayment/guestevent/create', asyncHandler(async (req, res) => {
  res.status(201).json(await startRegistrationPaymentFlow('guest-event', req.body));
}));

app.post('/guestpayment/guestevent/complete', asyncHandler(async (req, res) => {
  res.json(await completeRegistrationPaymentFlow('guest-event', req.body));
}));

app.post('/guestpayment/guestevent/cancel', asyncHandler(async (req, res) => {
  res.json(await cancelRegistrationPaymentFlow('guest-event', req.body));
}));

app.post('/api/payments/:kind/create', requirePaymentKindAccess, asyncHandler(async (req, res) => {
  const kind = String(req.params.kind || '').toLowerCase();
  res.status(201).json(await startRegistrationPaymentFlow(kind, req.body, req.user));
}));

app.post('/api/payments/:kind/complete', requirePaymentKindAccess, asyncHandler(async (req, res) => {
  const kind = String(req.params.kind || '').toLowerCase();
  res.json(await completeRegistrationPaymentFlow(kind, req.body, req.user));
}));

app.post('/api/payments/:kind/cancel', requirePaymentKindAccess, asyncHandler(async (req, res) => {
  res.json(await cancelRegistrationPaymentFlow(String(req.params.kind || '').toLowerCase(), req.body, req.user));
}));

app.get('/api/eventmgmt/seats', authenticate, requireRole('welcomedesk', 'receptionist'), asyncHandler(async (req, res) => {
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

app.post('/api/eventmgmt/seats', authenticate, requireRole('welcomedesk', 'receptionist'), asyncHandler(async (req, res) => {
  const eventId = String(req.body.eventId || '').trim();
  const seatNumber = String(req.body.seatNumber || req.body.seat_number || '').trim();
  if (!eventId || !seatNumber) return res.status(400).json({ error: 'Event id and seat number are required.' });
  const payload = normalizePayload('kb_seats', {
    event_id: eventId,
    seat_number: seatNumber,
    registration_id: req.body.registrationId || null,
    assigned_to: req.body.assignedTo || null,
    status: req.body.status || (req.body.registrationId ? 'Assigned' : 'Available')
  });
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('kb_seats')
      .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: 'event_id,seat_number' })
      .select('*')
      .single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) {
    if (error.code === '42P01' || /does not exist|column .* does not exist/i.test(error.message || '')) {
      return res.status(201).json({ ...payload, id: `${eventId}-${seatNumber}` });
    }
    throw error;
  }
}));

app.patch('/api/eventmgmt/seats/:id', authenticate, requireRole('welcomedesk', 'receptionist'), asyncHandler(async (req, res) => {
  res.json(await updateRecord('kb_seats', req.params.id, {
    ...req.body,
    updatedAt: new Date().toISOString()
  }));
}));

app.get('/api/attendance', authenticate, requireRole('teacher'), asyncHandler(async (req, res) => {
  const rows = await listOptionalTable('kb_attendance');
  res.json(rows);
}));

app.post('/api/attendance', authenticate, requireRole('teacher'), asyncHandler(async (req, res) => {
  const records = Array.isArray(req.body.records) ? req.body.records : [req.body];
  if (!records.length) return res.json({ records: [] });
  const normalized = records.map((record) => normalizePayload('kb_attendance', {
    ...record,
    takenBy: record.takenBy || req.user?.email
  }));

  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('kb_attendance')
      .upsert(normalized, { onConflict: 'class_key,attendance_date,registration_key' })
      .select('*');
    if (error) throw error;
    return res.json({ records: data || [] });
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error.code) || /does not exist|could not find/i.test(error.message || '')) {
      return res.json({
        records: normalized.map((record) => ({
          id: `${record.class_key}-${record.attendance_date}-${record.registration_key}`,
          created_at: new Date().toISOString(),
          ...record
        }))
      });
    }
    throw error;
  }
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
  try {
    const smtp = await sendEmailNow({
      to: message.to_email,
      subject: message.subject,
      template: message.template,
      payload: message.payload
    });
    const updated = await updateRecord('kb_email_outbox', req.params.id, {
      status: 'Sent',
      sent_at: new Date().toISOString(),
      payload: attachSmtpDelivery(message.payload, smtp)
    });
    res.json(updated);
  } catch (sendError) {
    await updateRecord('kb_email_outbox', req.params.id, { status: 'Failed' });
    throw sendError;
  }
}));

app.post('/api/email-outbox/test', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const to = req.body.to || req.user.email || adminEmail;
  const message = {
    to,
    subject: 'Kannada Bharati email test',
    template: 'test-email',
    payload: {
      registration: {
        program: 'SMTP configuration',
        student_name: 'Email test',
        status: 'Sent',
        email: to
      }
    }
  };
  const queued = await queueEmail(message);
  try {
    const smtp = await sendEmailNow(message);
    const updated = queued?.id
      ? await updateRecord('kb_email_outbox', queued.id, {
          status: 'Sent',
          sent_at: new Date().toISOString(),
          payload: attachSmtpDelivery(queued.payload || message.payload, smtp)
        })
      : queued;
    res.json({ ok: true, email: updated });
  } catch (sendError) {
    if (queued?.id) await updateRecord('kb_email_outbox', queued.id, { status: 'Failed' });
    throw sendError;
  }
}));

app.post('/api/email-outbox/bulk', authenticate, requireAdmin, authRateLimit, asyncHandler(async (req, res) => {
  const audience = String(req.body.audience || '').trim();
  const target = String(req.body.target || '').trim();
  const subject = String(req.body.subject || '').trim();
  const body = String(req.body.body || '').trim();
  const intro = String(req.body.intro || '').trim();
  const footer = String(req.body.footer || '').trim();

  if (!subject || subject.length < 4) return res.status(400).json({ error: 'Subject is required.' });
  if (!body || body.length < 10) return res.status(400).json({ error: 'Message body is required.' });

  const recipients = await resolveBulkEmailRecipients({ audience, target });
  if (!recipients.length) return res.status(400).json({ error: 'No recipients found for the selected audience.' });

  const results = [];
  for (const recipient of recipients) {
    const queued = await sendEmailOrQueue({
      to: recipient.email,
      subject,
      template: 'bulk-message',
      payload: {
        message: {
          intro: intro || `Hello ${recipient.name || 'Kannada Bharati member'},`,
          body,
          footer,
          audience,
          target,
          sentBy: req.user.email
        }
      }
    });
    results.push({ email: recipient.email, outboxId: queued?.id || null, status: queued?.status || 'Sent' });
  }

  res.status(201).json({
    ok: true,
    audience,
    target,
    count: recipients.length,
    sent: results.filter((item) => item.status === 'Sent').length,
    queued: results.filter((item) => item.status !== 'Sent').length,
    recipients: results
  });
}));

app.get('/api/developer/email-templates/:template', asyncHandler(async (req, res) => {
  const message = sampleTemplateMessage(String(req.params.template || '').toLowerCase());
  const rendered = renderEmail(message);
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>${message.subject}</title></head><body>${rendered.html}</body></html>`);
}));

app.get('/admin/developer/:template', asyncHandler(async (req, res) => {
  const aliases = {
    confirmemail: 'confirm-email',
    forgotpassword: 'forgot-password',
    registration: 'registration',
    classregistration: 'class-registration',
    donation: 'donation'
  };
  const key = aliases[String(req.params.template || '').toLowerCase()] || String(req.params.template || '').toLowerCase();
  const message = sampleTemplateMessage(key);
  const rendered = renderEmail(message);
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>${message.subject}</title></head><body>${rendered.html}</body></html>`);
}));

app.get('/api/submissions/:type', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const table = submissionTables[req.params.type];
  if (!table) return res.status(404).json({ error: 'Unknown submission type.' });
  res.json(await listTable(table));
}));

app.post('/api/submissions/:type', requireSubmissionCreateAccess, asyncHandler(async (req, res) => {
  const table = submissionTables[req.params.type];
  if (!table) return res.status(404).json({ error: 'Unknown submission type.' });
  const payload = table === 'kb_registrations' ? await calculateRegistrationPayload(req.body) : req.body;
  const record = table === 'kb_registrations'
    ? await createRegistrationRecord(payload)
    : await insertRecord(table, payload);
  res.status(201).json(record);
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

app.get('/api/announcements', asyncHandler(async (req, res) => {
  res.json(await listOptionalTable('kb_announcements'));
}));

app.post('/api/announcements', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await insertRecord('kb_announcements', req.body));
}));

app.get('/api/fundraisers', asyncHandler(async (req, res) => {
  res.json(await listOptionalTable('kb_fundraisers'));
}));

app.post('/api/fundraisers', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await insertRecord('kb_fundraisers', normalizeFundraiserPayload(req.body)));
}));

app.get('/api/admin/dashboard', authenticate, asyncHandler(async (req, res) => {
  const fullAdmin = hasAnyRole(req.user, ['admin', 'superadmin']);
  const staff = hasAnyRole(req.user, ['welcomedesk', 'receptionist', 'teacher', 'volunteer', 'treasurer']);
  if (!fullAdmin && !staff) {
    const supabase = requireSupabase();
    const email = String(req.user.email || '').toLowerCase();
    const [user, registrations, donations, classes, events, announcements, expenses] = await Promise.all([
      supabase.from('kb_users').select('*').eq('email', email).maybeSingle(),
      supabase.from('kb_registrations').select('*').eq('email', email).order('created_at', { ascending: false }),
      supabase.from('kb_donations').select('*').eq('email', email).order('created_at', { ascending: false }),
      supabase.from('kb_classes').select('*').order('created_at', { ascending: false }),
      supabase.from('kb_events').select('*').order('created_at', { ascending: false }),
      supabase.from('kb_announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('kb_expenses').select('*').eq('submitted_by', email).order('created_at', { ascending: false })
    ]);
    if (user.error) throw user.error;
    if (registrations.error) throw registrations.error;
    if (donations.error) throw donations.error;
    if (classes.error) throw classes.error;
    if (events.error) throw events.error;
    if (announcements.error) throw announcements.error;
    if (expenses.error) throw expenses.error;
    return res.json({
      users: user.data ? [user.data] : [],
      registrations: registrations.data || [],
      donations: donations.data || [],
      volunteers: [],
      contacts: [],
      logins: [],
      classes: classes.data || [],
      events: events.data || [],
      fundraisers: [],
      announcements: announcements.data || [],
      expenses: expenses.data || [],
      attendance: [],
      checkins: [],
      emailOutbox: [],
      defaulterHistory: []
    });
  }

  if (!fullAdmin) {
    const email = String(req.user.email || '').toLowerCase();
    const roles = normalizeRoles(req.user.roles || req.user.role);
    const canWelcomeDesk = roles.includes('welcomedesk') || roles.includes('receptionist');
    const canTeacher = roles.includes('teacher');
    const canVolunteer = roles.includes('volunteer');
    const canTreasurer = roles.includes('treasurer');
    const [ownUser, classes, events, announcements] = await Promise.all([
      listTable('kb_users').then((rows) => rows.filter((row) => String(row.email || '').toLowerCase() === email)),
      listTable('kb_classes'),
      listTable('kb_events'),
      listOptionalTable('kb_announcements')
    ]);
    const [registrations, donations, volunteers, contacts, expenses, checkins, attendance] = await Promise.all([
      (canWelcomeDesk || canTeacher) ? listTable('kb_registrations') : listTable('kb_registrations').then((rows) => rows.filter((row) => String(row.email || '').toLowerCase() === email)),
      canTreasurer ? listTable('kb_donations') : Promise.resolve([]),
      canWelcomeDesk ? listTable('kb_volunteers') : Promise.resolve([]),
      Promise.resolve([]),
      (canTreasurer || canVolunteer)
        ? listOptionalTable('kb_expenses').then((rows) => canTreasurer ? rows : rows.filter((row) => String(row.submitted_by || row.submittedBy || '').toLowerCase() === email))
        : Promise.resolve([]),
      canWelcomeDesk ? listOptionalTable('kb_checkins') : Promise.resolve([]),
      canTeacher ? listOptionalTable('kb_attendance') : Promise.resolve([])
    ]);

    return res.json({
      users: ownUser,
      registrations,
      donations,
      volunteers,
      contacts,
      logins: [],
      classes,
      events,
      fundraisers: [],
      announcements,
      expenses,
      attendance,
      checkins,
      emailOutbox: [],
      defaulterHistory: []
    });
  }

  const [users, registrations, donations, volunteers, contacts, logins, classes, events, fundraisers, announcements, expenses, checkins, attendance, emailOutbox, defaulterHistory] = await Promise.all([
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
    listOptionalTable('kb_attendance'),
    listOptionalTable('kb_email_outbox'),
    listOptionalTable('kb_defaulter_history')
  ]);

  res.json({ users, registrations, donations, volunteers, contacts, logins, classes, events, fundraisers, announcements, expenses, checkins, attendance, emailOutbox, defaulterHistory });
}));

app.use((error, req, res, next) => {
  console.error(error);
  const friendly = friendlyConstraintError(error);
  const status = error.status || friendly?.status || 500;
  res.status(status).json({
    error: friendly?.message || (status >= 500 ? 'Server error. Please try again later.' : error.message || 'Request failed.')
  });
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Kannada Bharati API running on http://localhost:${port}`);
  });
}

export default app;
