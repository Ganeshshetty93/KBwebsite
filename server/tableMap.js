export const submissionTables = {
  registration: 'kb_registrations',
  donation: 'kb_donations',
  volunteer: 'kb_volunteers',
  contact: 'kb_contacts',
  login: 'kb_logins',
  announcement: 'kb_announcements',
  expense: 'kb_expenses',
  event: 'kb_events',
  class: 'kb_classes',
  fundraiser: 'kb_fundraisers',
  checkin: 'kb_checkins',
  attendance: 'kb_attendance'
};

export const storageKeyToResource = {
  'kb-registration-submissions': 'registration',
  'kb-donation-submissions': 'donation',
  'kb-volunteer-submissions': 'volunteer',
  'kb-contact-submissions': 'contact',
  'kb-login-submissions': 'login',
  'kb-admin-classes': 'class',
  'kb-admin-events': 'event',
  'kb-announcement-submissions': 'announcement',
  'kb-expense-submissions': 'expense',
  'kb-attendance-records': 'attendance'
};

export const resourceToStorageKey = Object.fromEntries(
  Object.entries(storageKeyToResource).map(([key, resource]) => [resource, key])
);
