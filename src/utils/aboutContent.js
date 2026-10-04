export const defaultAboutContent = {
  currentCommittee: [
    {
      id: 'current-president',
      name: 'Kannada Bharati President',
      role: 'President',
      email: 'info@kannadabharati.org',
      phone: '',
      bio: 'Guides Kannada Bharati programs, community events, partnerships, and yearly planning.',
      photo: '/assets/kannada-bharati-logo.png'
    },
    {
      id: 'current-cultural',
      name: 'Cultural Programs Lead',
      role: 'Cultural Coordinator',
      email: 'events@kannadabharati.org',
      phone: '',
      bio: 'Coordinates stage programs, festival activities, performers, volunteers, and event-day execution.',
      photo: '/assets/kannada-bharati-logo.png'
    },
    {
      id: 'current-paata',
      name: 'Paata Shaale Lead',
      role: 'Education Coordinator',
      email: 'kannada@kannadabharati.org',
      phone: '',
      bio: 'Supports Kannada Paata Shaale teachers, classes, family communication, and student registration.',
      photo: '/assets/kannada-bharati-logo.png'
    }
  ],
  sponsors: [
    {
      id: 'sponsor-community',
      name: 'Community Sponsors',
      level: 'Supporters',
      website: '',
      note: 'Kannada Bharati thanks every family, donor, and partner who supports cultural programming.',
      photo: '/assets/kannada-bharati-logo.png'
    },
    {
      id: 'sponsor-cultural',
      name: 'Cultural Event Partners',
      level: 'Event Partner',
      website: '',
      note: 'Partners helping us bring Kannada language, arts, food, and cultural celebrations to the community.',
      photo: '/assets/kannada-bharati-logo.png'
    },
    {
      id: 'sponsor-education',
      name: 'Education Supporters',
      level: 'Paata Shaale Support',
      website: '',
      note: 'Supporters who help children learn Kannada through classes, materials, and volunteer teaching.',
      photo: '/assets/kannada-bharati-logo.png'
    }
  ],
  pastCommittees: [
    {
      id: 'past-legacy',
      term: '2024 - 2025',
      title: 'Legacy leadership team',
      members: 'Volunteer leaders who supported festivals, classes, donation drives, and community operations.',
      photo: '/assets/kannada-bharati-logo.png'
    },
    {
      id: 'past-growth',
      term: '2022 - 2023',
      title: 'Community growth team',
      members: 'Committee members who expanded family participation, youth programs, and cultural events.',
      photo: '/assets/kannada-bharati-logo.png'
    },
    {
      id: 'past-foundation',
      term: '2020 - 2021',
      title: 'Program foundation team',
      members: 'Past volunteers who helped strengthen event planning, education support, and member services.',
      photo: '/assets/kannada-bharati-logo.png'
    }
  ]
};

function normalizeRows(rows, defaults, fields) {
  const source = Array.isArray(rows) && rows.length ? rows : defaults;
  return source.map((row, index) => {
    const normalized = {
      id: row.id || row.localId || `${fields[0]}-${index}-${Date.now()}`
    };
    fields.forEach((field) => {
      normalized[field] = String(row[field] || '').trim();
    });
    return normalized;
  });
}

export function normalizeAboutContent(content = {}) {
  return {
    currentCommittee: normalizeRows(content.currentCommittee, defaultAboutContent.currentCommittee, ['name', 'role', 'email', 'phone', 'bio', 'photo']),
    sponsors: normalizeRows(content.sponsors, defaultAboutContent.sponsors, ['name', 'level', 'website', 'note', 'photo']),
    pastCommittees: normalizeRows(content.pastCommittees, defaultAboutContent.pastCommittees, ['term', 'title', 'members', 'photo'])
  };
}
