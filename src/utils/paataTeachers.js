export const defaultPaataTeachers = [
  {
    id: 'paata-lead-teacher',
    name: 'Paata Shaale Lead',
    role: 'Lead teacher',
    level: 'Level 1',
    email: 'kannada@kannadabharati.org',
    bio: 'Guides early learners through Kannada sounds, letters, reading, writing, and weekly practice.',
    photo: '/assets/kannada-bharati-logo.png'
  },
  {
    id: 'paata-intermediate-teacher',
    name: 'Intermediate Teacher',
    role: 'Kannada instructor',
    level: 'Levels 2-3',
    email: 'kannada@kannadabharati.org',
    bio: 'Supports sentence building, vocabulary, conversation practice, homework, and exam readiness.',
    photo: '/assets/kannada-bharati-logo.png'
  },
  {
    id: 'paata-advanced-teacher',
    name: 'Advanced Teacher',
    role: 'Kannada instructor',
    level: 'Levels 4-6',
    email: 'kannada@kannadabharati.org',
    bio: 'Helps students grow fluency with reading comprehension, speaking confidence, and culture-rich lessons.',
    photo: '/assets/kannada-bharati-logo.png'
  }
];

export function normalizePaataTeachers(rows = defaultPaataTeachers) {
  const source = Array.isArray(rows) && rows.length ? rows : defaultPaataTeachers;
  return source.map((row, index) => ({
    id: row.id || row.localId || `paata-teacher-${index}-${Date.now()}`,
    name: String(row.name || '').trim(),
    role: String(row.role || '').trim(),
    level: String(row.level || '').trim(),
    email: String(row.email || '').trim(),
    phone: String(row.phone || '').trim(),
    bio: String(row.bio || '').trim(),
    photo: String(row.photo || '').trim()
  }));
}
