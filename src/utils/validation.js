const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+()\-\s\d]{7,20}$/;
const maxImageSize = 2 * 1024 * 1024;

export function cleanText(value) {
  return String(value || '').trim();
}

export function isValidEmail(value) {
  return emailPattern.test(cleanText(value).toLowerCase());
}

export function validateRequired(value, label) {
  if (!cleanText(value)) return `${label} is required.`;
  return '';
}

export function validateEmail(value) {
  if (!cleanText(value)) return 'Email is required.';
  if (!isValidEmail(value)) return 'Enter a valid email address.';
  return '';
}

export function validatePhone(value) {
  if (!cleanText(value)) return '';
  if (!phonePattern.test(cleanText(value))) return 'Enter a valid phone number.';
  return '';
}

export function validatePassword(value, label = 'Password') {
  if (!value) return `${label} is required.`;
  if (String(value).length < 6) return `${label} must be at least 6 characters.`;
  return '';
}

export function validateAmount(value, label = 'Amount', { min = 0 } = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${label} must be a number.`;
  if (amount < min) return `${label} must be at least ${min}.`;
  return '';
}

export function validateDateOrder(startDate, endDate, message) {
  if (startDate && endDate && endDate < startDate) return message;
  return '';
}

export function validateTimeOrder(startTime, endTime, message) {
  if (startTime && endTime && endTime <= startTime) return message;
  return '';
}

export function validateImageFile(file) {
  if (!file || file.size === 0) return '';
  if (!file.type?.startsWith('image/')) return 'Photo upload must be an image file.';
  if (file.size > maxImageSize) return 'Photo upload must be 2 MB or smaller.';
  return '';
}

export function firstError(errors) {
  return errors.find(Boolean) || '';
}
