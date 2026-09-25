import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, HandCoins, Megaphone, Plus, ReceiptText, UsersRound, X } from 'lucide-react';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import { culturalClasses, events, paataShaaleLevels } from '../data/siteData.js';
import { appendRecord, getCurrentUser, readJson, writeJson } from '../utils/storage.js';
import { apiAdminDashboard } from '../utils/api.js';
import { cleanText, firstError, validateAmount, validateDateOrder, validateImageFile, validatePhone, validateRequired, validateUrl } from '../utils/validation.js';

const fallbackPrograms = [
  ...paataShaaleLevels.map((item) => ({ ...item, category: 'Language', date: 'Sep 13, 2026 - Jun 20, 2027' })),
  ...culturalClasses
];

const seedAnnouncements = [
  {
    text: 'Kannada Bharati Paata Shaale registrations are open',
    ctaText: 'Register today',
    ctaUrl: '/kannada-shaale',
    startOn: '2026-09-01',
    endOn: '2026-10-15',
    enabled: 'Yes'
  },
  {
    text: 'Kannada Rajyotsava volunteer signup',
    ctaText: 'Join in',
    ctaUrl: '/volunteer',
    startOn: '2026-10-01',
    endOn: '2026-11-02',
    enabled: 'Yes'
  }
];

function uniqueOptions(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort();
}

function toCellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toCellText).join(', ');
  return String(value.props?.children ? toCellText(value.props.children) : '');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function makeCsv(rows, columns) {
  const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const header = columns.map((column) => escape(column.label)).join(',');
  const body = rows.map((row, rowIndex) => columns.map((column) => {
    const value = column.render ? column.render(row, rowIndex) : row[column.key];
    return escape(toCellText(value) || '-');
  }).join(','));
  return [header, ...body].join('\n');
}

function makeHtmlTable(title, rows, columns) {
  const cells = rows.map((row, rowIndex) => `<tr>${columns.map((column) => {
    const value = column.render ? column.render(row, rowIndex) : row[column.key];
    return `<td>${toCellText(value) || '-'}</td>`;
  }).join('')}</tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd5d2;padding:8px;text-align:left}th{background:#eef4f1}</style></head><body><h1>${title}</h1><table><thead><tr>${columns.map((column) => `<th>${column.label}</th>`).join('')}</tr></thead><tbody>${cells || `<tr><td colspan="${columns.length}">No records</td></tr>`}</tbody></table></body></html>`;
}

function openPrintableTable(title, rows, columns) {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) return;
  popup.document.write(makeHtmlTable(title, rows, columns));
  popup.document.close();
  popup.focus();
  popup.print();
}

function AdminTable({ title, rows, columns, filters = [], emptyText = 'No records yet.', action }) {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const visibleRows = useMemo(() => rows.filter((row) => {
    const text = Object.values(row).join(' ').toLowerCase();
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesFilters = filters.every((filter) => {
      const selected = activeFilters[filter.key] || 'All';
      return selected === 'All' || String(row[filter.key] || '') === selected;
    });
    return matchesQuery && matchesFilters;
  }), [activeFilters, filters, query, rows]);
  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'table';

  async function handleCopy() {
    const text = makeCsv(visibleRows, columns);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      downloadFile(`${filename}.txt`, text, 'text/plain;charset=utf-8');
    }
  }

  return (
    <section className="admin-page-panel">
      <div className="admin-page-panel-heading">
        <h2>{title}</h2>
        <div>
          {action}
          <span>{visibleRows.length}</span>
        </div>
      </div>
      <div className="admin-page-filters">
        {filters.map((filter) => (
          <label key={filter.key}>
            {filter.label}
            <select value={activeFilters[filter.key] || 'All'} onChange={(event) => setActiveFilters((current) => ({ ...current, [filter.key]: event.target.value }))}>
              <option>All</option>
              {filter.options.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        ))}
        <label>
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
        </label>
      </div>
      <div className="admin-table-actions">
        <button type="button" onClick={handleCopy}>Copy</button>
        <button type="button" onClick={() => downloadFile(`${filename}.csv`, makeCsv(visibleRows, columns), 'text/csv;charset=utf-8')}>CSV</button>
        <button type="button" onClick={() => downloadFile(`${filename}.xls`, makeHtmlTable(title, visibleRows, columns), 'application/vnd.ms-excel;charset=utf-8')}>Excel</button>
        <button type="button" onClick={() => openPrintableTable(title, visibleRows, columns)}>PDF</button>
        <button type="button" onClick={() => openPrintableTable(title, visibleRows, columns)}>Print</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row, index) => (
              <tr key={`${row.email || row.title || row.text || index}-${index}`}>
                {columns.map((column) => <td key={column.key}>{column.render ? column.render(row, index) : row[column.key] || '-'}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={columns.length}>{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PageHeader({ root = 'Admin', area, title, action }) {
  return (
    <div className="admin-page-header">
      <div>
        <p><span>{root}</span> / {area}</p>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

function getProgramImage(item = {}) {
  if (item.photo) return item.photo;
  if (item.image) return item.image;

  const title = String(item.title || '').toLowerCase();
  if (title.includes('guitar')) return '/assets/classes/guitar-class-photo.png';
  if (title.includes('sandalwood')) return '/assets/classes/sandalwood-dance-photo.png';
  if (title.includes('bharatanatya')) return '/assets/culture-feature/classical-dance-feature.png';
  if (title.includes('hindustani') || title.includes('carnatic') || title.includes('music')) return '/assets/culture-feature/music-traditions-feature.png';
  if (title.includes('event') || title.includes('rajyotsava') || title.includes('showcase')) return '/assets/feature/events-feature.png';
  return '/assets/classes/kannada-language-class.png';
}

function getFeeText(item = {}) {
  const value = item.fee ?? item.registrationFee ?? item.price ?? item.donationAmount;
  if (value === null || value === undefined || value === '') return 'the listed donation/fee';
  if (typeof value === 'number') return `$${value}`;
  return String(value);
}

function makeEventId(title, index = 0) {
  const seed = String(title || '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return String(100 + ((seed + index) % 900));
}

function getBirthYear(row) {
  if (row.birthYear) return Number(row.birthYear);
  if (row.childBirthDate) return Number(String(row.childBirthDate).slice(0, 4));
  if (row.birthDate) return Number(String(row.birthDate).slice(0, 4));
  return null;
}

function getRegistrationSummary(rows) {
  const currentYear = new Date().getFullYear();
  return rows.reduce((summary, row) => {
    const birthYear = getBirthYear(row);
    if (!birthYear) {
      summary.adults += 1;
      return summary;
    }

    const age = currentYear - birthYear;
    if (age >= 13) summary.adults += 1;
    else if (age >= 6) summary.kids += 1;
    else summary.youngKids += 1;
    return summary;
  }, { adults: 0, kids: 0, youngKids: 0 });
}

function EventDetailModal({ item, onClose }) {
  const feeText = getFeeText(item);
  const detailRows = [
    ['Event ID', item.eventId || '-'],
    ['URL key', item.urlKey || '-'],
    ['Type', item.eventType || item.category || '-'],
    ['Start on', item.startOn || item.date || item.month || '-'],
    ['End on', item.endOn || '-'],
    ['Time', item.time || '-'],
    ['Age', item.age || '-'],
    ['Donation/Fee', feeText],
    ['Location', item.location || '-'],
    ['Recurrence', item.recurrence || '-'],
    ['Capacity', item.capacity || '-'],
    ['All day', item.isAllDay ? 'Yes' : 'No'],
    ['Age restricted', item.isAgeRestricted ? 'Yes' : 'No'],
    ['Payment required', item.isPaymentRequired ? 'Yes' : 'No'],
    ['Open for registration', item.isOpenForRegistration ? 'Yes' : 'No'],
    ['Auto approved', item.isAutoApproved ? 'Yes' : 'No'],
    ['Enabled', item.enabled === false ? 'No' : 'Yes'],
    ['Check-in enabled', item.enableCheckIn ? 'Yes' : 'No'],
    ['Free for volunteers', item.freeForVolunteers ? 'Yes' : 'No'],
    ['Volunteer discount', item.enableVolunteerDiscount ? 'Yes' : 'No']
  ];

  return (
    <div className="popup-backdrop" role="presentation">
      <div className="popup-panel detail-popup" role="dialog" aria-modal="true" aria-label={`${item.title} details`}>
        <button className="popup-close" type="button" aria-label="Close popup" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="detail-popup-hero">
          <img src={getProgramImage(item)} alt={item.title} />
          <div>
            <span>{item.eventType || item.category || 'Kannada Bharati'}</span>
            <h2>{item.title}</h2>
            <p>{item.focus || item.body || item.description || 'Program details are available below.'}</p>
          </div>
        </div>
        <div className="detail-popup-grid">
          {detailRows.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value || '-'}</strong>
            </article>
          ))}
        </div>
        <section className="detail-process">
          <h3>Registration process</h3>
          <ol>
            <li>Submit registration.</li>
            <li>Wait for approved email as confirmation.</li>
            <li>After receiving Approved email, complete donation/payment of {feeText} when required.</li>
            <li>Receive payment confirmation as proof of registration.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}

function useAdminData() {
  const [dashboard, setDashboard] = useState(() => ({
    registrations: readJson('kb-registration-submissions', []),
    donations: readJson('kb-donation-submissions', []),
    volunteers: readJson('kb-volunteer-submissions', []),
    contacts: readJson('kb-contact-submissions', []),
    expenses: readJson('kb-expense-submissions', []),
    announcements: readJson('kb-announcement-submissions', seedAnnouncements),
    classes: [],
    events: [],
    fundraisers: readJson('kb-admin-fundraisers', [])
  }));
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    apiAdminDashboard()
      .then((records) => {
        if (!ignore) {
          setDashboard((current) => ({
            ...current,
            ...records,
            expenses: readJson('kb-expense-submissions', []),
            announcements: readJson('kb-announcement-submissions', seedAnnouncements),
            fundraisers: records.fundraisers?.length ? records.fundraisers : readJson('kb-admin-fundraisers', [])
          }));
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  return { dashboard, setDashboard, refresh: () => setRefreshKey((key) => key + 1) };
}

export default function AdminSectionPage({ view }) {
  const [searchParams] = useSearchParams();
  const user = getCurrentUser();
  const { dashboard, setDashboard, refresh } = useAdminData();
  const [modalType, setModalType] = useState(null);
  const [expenseError, setExpenseError] = useState('');
  const [expenseSaved, setExpenseSaved] = useState(false);
  const [announcementError, setAnnouncementError] = useState('');
  const [announcementSaved, setAnnouncementSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationSaved, setRegistrationSaved] = useState(false);
  const [checkinProgram, setCheckinProgram] = useState('');
  const [checkinEventId, setCheckinEventId] = useState('');
  const [checkinApplied, setCheckinApplied] = useState(false);
  const [checkinError, setCheckinError] = useState('');
  const [detailRecord, setDetailRecord] = useState(null);
  const registrations = dashboard.registrations || [];
  const donations = dashboard.donations || [];
  const expenses = dashboard.expenses || [];
  const programs = dashboard.classes?.length ? dashboard.classes : fallbackPrograms;
  const allEvents = dashboard.events?.length ? dashboard.events : events;
  const announcements = dashboard.announcements || [];
  const fundraisers = dashboard.fundraisers || [];
  const profile = readJson('kb-member-profile', {});
  const profileChildren = readJson('kb-member-children', []);
  const eventOptions = [...new Map([
    ...allEvents.map((item) => [item.title, item]),
    ...programs.map((item) => [item.title, item]),
    ...registrations.filter((item) => item.program).map((item) => [item.program, { title: item.program }])
  ].filter(([title]) => title).map(([title, item], index) => [title, { ...item, title, eventId: item.eventId || makeEventId(title, index) }])).values()];
  const selectedCheckinEvent = eventOptions.find((item) => item.title === checkinProgram) || eventOptions[0] || {};
  const expectedEventId = selectedCheckinEvent.eventId || '';
  const checkinRows = checkinApplied
    ? registrations.filter((item) => item.program === selectedCheckinEvent.title || item.eventId === expectedEventId)
    : registrations;
  const checkinSummary = getRegistrationSummary(checkinRows);
  const requestedProgram = cleanText(searchParams.get('program'));
  const selectedProgram = [...programs, ...allEvents].find((item) => item.title === requestedProgram) || programs[0] || allEvents[0] || {};
  const memberOptions = [
    `${profile.firstName || user.firstName || user.name || user.email} ${profile.lastName || ''}`.trim(),
    ...profileChildren.map((child) => `${child.childFirstName} ${child.childLastName}`.trim()).filter(Boolean)
  ].filter(Boolean);

  function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError('');
    setProfileSaved(false);

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const imageError = validateImageFile(form.elements.profilePhoto?.files?.[0]);
    const error = firstError([
      validateRequired(payload.firstName, 'First name'),
      validateRequired(payload.lastName, 'Last name'),
      validateRequired(payload.birthDate, 'Date of birth'),
      validatePhone(payload.phone),
      validateRequired(payload.gender, 'Gender'),
      validateRequired(payload.company, 'Company'),
      validateDateOrder(payload.birthDate, payload.spouseBirthDate, 'Spouse date of birth cannot be before member date of birth.'),
      imageError
    ]);

    if (error) {
      setProfileError(error);
      return;
    }

    const savedProfile = {
      firstName: cleanText(payload.firstName),
      lastName: cleanText(payload.lastName),
      birthDate: payload.birthDate,
      phone: cleanText(payload.phone),
      gender: payload.gender,
      company: cleanText(payload.company),
      description: cleanText(payload.description),
      address1: cleanText(payload.address1),
      address2: cleanText(payload.address2),
      city: cleanText(payload.city),
      state: cleanText(payload.state),
      zipCode: cleanText(payload.zipCode),
      spouseFirstName: cleanText(payload.spouseFirstName),
      spouseLastName: cleanText(payload.spouseLastName),
      spouseBirthDate: payload.spouseBirthDate,
      updatedAt: new Date().toISOString()
    };

    writeJson('kb-member-profile', savedProfile);
    setProfileSaved(true);
  }

  function handleAddChild() {
    const nextChild = {
      childFirstName: 'New child',
      childLastName: profile.lastName || user.lastName || '',
      childGender: 'Prefer not to say',
      childBirthDate: ''
    };
    writeJson('kb-member-children', [...profileChildren, nextChild]);
    setProfileSaved(true);
  }

  function handleMemberRegistrationSubmit(event) {
    event.preventDefault();
    setRegistrationError('');
    setRegistrationSaved(false);

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const error = firstError([
      validateRequired(payload.memberName, 'Member'),
      validateRequired(selectedProgram.title, 'Program')
    ]);

    if (error) {
      setRegistrationError(error);
      return;
    }

    const record = appendRecord('kb-registration-submissions', {
      parentName: `${profile.firstName || user.firstName || user.name || 'Member'} ${profile.lastName || ''}`.trim(),
      studentName: cleanText(payload.memberName),
      email: user.email,
      phone: profile.phone || user.phone || '-',
      program: selectedProgram.title,
      status: 'Submitted'
    });
    setDashboard((current) => ({ ...current, registrations: [...(current.registrations || []), record] }));
    setRegistrationSaved(true);
  }

  function handleCheckinSubmit(event) {
    event.preventDefault();
    setCheckinError('');
    const id = cleanText(checkinEventId);
    if (!selectedCheckinEvent.title) {
      setCheckinError('Please select an event.');
      return;
    }
    if (expectedEventId && id && id !== expectedEventId) {
      setCheckinError(`Enter the valid event ID for ${selectedCheckinEvent.title}.`);
      return;
    }
    setCheckinApplied(true);
  }

  function handleExpenseSubmit(event) {
    event.preventDefault();
    setExpenseError('');
    setExpenseSaved(false);
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const error = firstError([
      validateRequired(payload.title, 'Expense title'),
      validateRequired(payload.category, 'Category'),
      validateAmount(payload.amount, 'Amount', { min: 1 }),
      validateRequired(payload.expenseDate, 'Expense date'),
      validateRequired(payload.description, 'Description')
    ]);
    if (error) {
      setExpenseError(error);
      return;
    }
    const record = appendRecord('kb-expense-submissions', {
      title: cleanText(payload.title),
      category: cleanText(payload.category),
      amount: Number(payload.amount),
      expenseDate: payload.expenseDate,
      description: cleanText(payload.description),
      status: 'Submitted',
      submittedBy: user.email
    });
    setDashboard((current) => ({ ...current, expenses: [...(current.expenses || []), record] }));
    form.reset();
    setExpenseSaved(true);
  }

  function handleAnnouncementSubmit(event) {
    event.preventDefault();
    setAnnouncementError('');
    setAnnouncementSaved(false);
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const text = cleanText(payload.text);
    const ctaText = cleanText(payload.ctaText);
    const ctaUrl = cleanText(payload.ctaUrl);
    const error = firstError([
      validateRequired(text, 'Announcement text'),
      text.length < 5 ? 'Announcement text must be at least 5 characters.' : '',
      text.length > 160 ? 'Announcement text must be 160 characters or fewer.' : '',
      validateRequired(ctaText, 'CTA text'),
      ctaText.length > 40 ? 'CTA text must be 40 characters or fewer.' : '',
      validateUrl(ctaUrl, 'CTA URL'),
      validateRequired(payload.startOn, 'Start date'),
      validateRequired(payload.endOn, 'End date'),
      validateDateOrder(payload.startOn, payload.endOn, 'Announcement end date cannot be before start date.')
    ]);
    if (error) {
      setAnnouncementError(error);
      return;
    }
    const record = appendRecord('kb-announcement-submissions', {
      text,
      ctaText,
      ctaUrl,
      startOn: payload.startOn,
      endOn: payload.endOn,
      enabled: payload.enabled ? 'Yes' : 'No'
    });
    setDashboard((current) => ({ ...current, announcements: [...(current.announcements || []), record] }));
    form.reset();
    setAnnouncementSaved(true);
    setModalType(null);
  }

  if (view === 'profile') {
    return (
      <>
        <PageHeader root="Account" area="Profile" title="Manage your account" />
        <section className="admin-page-panel profile-info-panel">
          <div className="admin-page-panel-heading"><h2>Login information</h2></div>
          <div className="profile-info-table">
            <strong>User name</strong><span>{user.email}</span>
            <strong>Password</strong><a href="/register">Create</a>
            <strong>External logins</strong><a href="/login">Manage</a>
          </div>
        </section>

        <form className="admin-create-form profile-form-panel" onSubmit={handleProfileSubmit}>
          <h2>Profile information</h2>
          <label>
            Profile picture <small>(only jpg/jpeg/png files)</small>
            <input name="profilePhoto" type="file" accept="image/png,image/jpeg" />
          </label>
          <div className="admin-form-grid">
            <label>First name <input name="firstName" defaultValue={profile.firstName || user.firstName || user.name?.split(' ')[0] || ''} required /></label>
            <label>Last name <input name="lastName" defaultValue={profile.lastName || user.lastName || user.name?.split(' ').slice(1).join(' ') || ''} required /></label>
            <label>Date of birth <input name="birthDate" type="date" defaultValue={profile.birthDate || ''} required /></label>
            <label>Phone number <input name="phone" type="tel" defaultValue={profile.phone || user.phone || ''} /></label>
            <label>Gender <select name="gender" defaultValue={profile.gender || 'Male'} required><option>Male</option><option>Female</option><option>Prefer not to say</option></select></label>
            <label>Company <small>(NA - if not applicable)</small><input name="company" defaultValue={profile.company || 'NA'} required /></label>
          </div>
          <label>Description<textarea name="description" defaultValue={profile.description || ''} maxLength="500" /></label>

          <h3>Address</h3>
          <div className="admin-form-grid">
            <label>Address line1 <input name="address1" defaultValue={profile.address1 || ''} /></label>
            <label>Address line2 <input name="address2" defaultValue={profile.address2 || ''} /></label>
            <label>City <input name="city" defaultValue={profile.city || ''} /></label>
            <label>State <input name="state" defaultValue={profile.state || ''} /></label>
            <label>Zip code <input name="zipCode" defaultValue={profile.zipCode || ''} /></label>
          </div>

          <h3>Spouse info</h3>
          <div className="admin-form-grid">
            <label>First name <input name="spouseFirstName" defaultValue={profile.spouseFirstName || ''} /></label>
            <label>Last name <input name="spouseLastName" defaultValue={profile.spouseLastName || ''} /></label>
            <label>Date of birth <input name="spouseBirthDate" type="date" defaultValue={profile.spouseBirthDate || ''} /></label>
          </div>
          <button className="button primary" type="submit">Save</button>
          {profileError && <p className="form-error">{profileError}</p>}
          {profileSaved && <p className="success">Profile details saved.</p>}
        </form>

        <section className="admin-page-panel">
          <div className="admin-page-panel-heading">
            <h2>Children info</h2>
            <button className="button compact" type="button" onClick={handleAddChild}>Add child</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>First name</th><th>Last name</th><th>Gender</th><th>Date of birth</th></tr></thead>
              <tbody>
                {profileChildren.length ? profileChildren.map((child, index) => (
                  <tr key={`${child.childFirstName}-${index}`}><td>{child.childFirstName}</td><td>{child.childLastName}</td><td>{child.childGender}</td><td>{child.childBirthDate || '-'}</td></tr>
                )) : <tr><td colSpan="4">No children added yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  if (view === 'register-member') {
    return (
      <>
        <PageHeader root="Member" area="Register" title="Member registration" />
        <section className="member-register-layout">
          <article className="member-program-card">
            <img src={getProgramImage(selectedProgram)} alt={selectedProgram.title || 'Kannada Bharati program'} />
            <div>
              <h2>{selectedProgram.title || 'Kannada Bharati program'}</h2>
              <p>{selectedProgram.focus || selectedProgram.body || selectedProgram.description || 'Register for a Kannada Bharati class or event.'}</p>
              <ul>
                <li>{selectedProgram.date || selectedProgram.month || 'Dates will be announced'}</li>
                <li>{selectedProgram.time || 'Schedule will be announced'}</li>
                <li>{selectedProgram.location || 'Kannada Bharati venue'}</li>
              </ul>
            </div>
          </article>

          <form className="admin-create-form member-register-form" onSubmit={handleMemberRegistrationSubmit}>
            <p className="profile-alert">Please complete your <a href="/admin/profile">account profile</a> to continue.</p>
            <label>Please select the member(s) to register
              <select name="memberName" required defaultValue="">
                <option value="" disabled>Select member</option>
                {memberOptions.map((member) => <option key={member}>{member}</option>)}
              </select>
            </label>
            <button className="button primary" type="submit">Register</button>
            {registrationError && <p className="form-error">{registrationError}</p>}
            {registrationSaved && <p className="success">Registration submitted for {selectedProgram.title}.</p>}
          </form>
        </section>
      </>
    );
  }

  if (view === 'expense') {
    return (
      <>
        <PageHeader area="Volunteer / Expense" title="Expense Submission" />
        <form className="admin-create-form admin-route-form" onSubmit={handleExpenseSubmit}>
          <h2>Kannada Bharati Expense Submission</h2>
          <div className="admin-form-grid">
            <label>Expense title<input name="title" required /></label>
            <label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose category</option><option>Event supplies</option><option>Food</option><option>Venue</option><option>Printing</option><option>Travel</option><option>Other</option></select></label>
            <label>Amount<input name="amount" type="number" min="1" step="0.01" required /></label>
            <label>Expense date<input name="expenseDate" type="date" required /></label>
          </div>
          <label>Description<textarea name="description" required minLength="10" maxLength="320" /></label>
          <button className="button primary" type="submit">Save</button>
          {expenseError && <p className="form-error">{expenseError}</p>}
          {expenseSaved && <p className="success">Expense submitted for admin review.</p>}
        </form>
        <AdminTable
          title="Expense submissions"
          rows={expenses}
          filters={[
            { key: 'category', label: 'Category', options: uniqueOptions(expenses, 'category') },
            { key: 'status', label: 'Status', options: uniqueOptions(expenses, 'status') }
          ]}
          columns={[
            { key: 'title', label: 'Expense' },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` },
            { key: 'expenseDate', label: 'Date' },
            { key: 'submittedBy', label: 'Submitted by' },
            { key: 'status', label: 'Status' }
          ]}
        />
      </>
    );
  }

  if (view === 'events') {
    return (
      <>
        <PageHeader area="Event" title="Manage events" action={<button className="button primary" type="button" onClick={() => setModalType('event')}>Create</button>} />
        <AdminTable
          title="Events"
          rows={allEvents}
          columns={[
            { key: 'eventId', label: 'Event ID', render: (row, index) => row.eventId || makeEventId(row.title, index) },
            { key: 'urlKey', label: 'URL key' },
            { key: 'title', label: 'Name' },
            { key: 'eventType', label: 'Type' },
            { key: 'body', label: 'Description' },
            { key: 'startOn', label: 'Start on', render: (row) => row.startOn || row.month || '-' },
            { key: 'endOn', label: 'End on' },
            { key: 'location', label: 'Location' },
            { key: 'capacity', label: 'Capacity' },
            { key: 'enabled', label: 'Enabled', render: (row) => row.enabled === false ? '-' : '✓' }
          ]}
        />
        {modalType === 'event' && <CreateModal type="event" onClose={() => setModalType(null)} onCreated={() => { refresh(); setModalType(null); }} />}
      </>
    );
  }

  if (view === 'announcements') {
    return (
      <>
        <PageHeader area="Announcement" title="Manage announcements" action={<button className="button primary" type="button" onClick={() => { setAnnouncementError(''); setAnnouncementSaved(false); setModalType('announcement'); }}>Create</button>} />
        {announcementSaved && <p className="success admin-floating-message">Announcement saved.</p>}
        <AdminTable
          title="Announcements"
          rows={announcements}
          columns={[
            { key: 'text', label: 'Text' },
            { key: 'ctaText', label: 'CTA text' },
            { key: 'ctaUrl', label: 'CTA URL' },
            { key: 'startOn', label: 'Start on' },
            { key: 'endOn', label: 'End on' },
            { key: 'enabled', label: 'Enabled' }
          ]}
        />
        {modalType === 'announcement' && (
          <div className="popup-backdrop" role="presentation">
            <div className="popup-panel" role="dialog" aria-modal="true" aria-label="Create announcement">
              <button className="popup-close" type="button" aria-label="Close popup" onClick={() => setModalType(null)}>
                <X size={20} />
              </button>
              <form className="admin-create-form" onSubmit={handleAnnouncementSubmit}>
                <h2>Create announcement</h2>
                <p className="admin-form-note">Add a short message with a clear action link and valid display dates.</p>
                <label>Announcement text<input name="text" required minLength="5" maxLength="160" /></label>
                <label>CTA text<input name="ctaText" required maxLength="40" placeholder="Register today" /></label>
                <label>CTA URL<input name="ctaUrl" required placeholder="/register or https://example.com" /></label>
                <div className="admin-form-grid">
                  <label>Start on<input name="startOn" type="date" required /></label>
                  <label>End on<input name="endOn" type="date" required /></label>
                </div>
                <label className="admin-checkbox"><input name="enabled" type="checkbox" defaultChecked /> Enabled</label>
                <button className="button primary" type="submit">Save</button>
                {announcementError && <p className="form-error">{announcementError}</p>}
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  if (view === 'fundraising') {
    return (
      <>
        <PageHeader area="Fund Raising" title="Manage fundraising causes" action={<button className="button primary" type="button" onClick={() => setModalType('fundraiser')}>Create</button>} />
        <section className="admin-dashboard-hero-grid">
          <article><HandCoins size={24} /><span>Total causes</span><strong>{fundraisers.length}</strong></article>
          <article><ReceiptText size={24} /><span>Target amount</span><strong>${fundraisers.reduce((sum, item) => sum + Number(item.goal || 0), 0).toLocaleString()}</strong></article>
          <article><UsersRound size={24} /><span>Raised</span><strong>${fundraisers.reduce((sum, item) => sum + Number(item.raised || 0), 0).toLocaleString()}</strong></article>
          <article><CalendarDays size={24} /><span>Active</span><strong>{fundraisers.filter((item) => item.status !== 'Completed').length}</strong></article>
        </section>
        <AdminTable
          title="Fundraising causes"
          rows={fundraisers}
          emptyText="No fundraising causes yet."
          filters={[
            { key: 'category', label: 'Category', options: uniqueOptions(fundraisers, 'category') },
            { key: 'status', label: 'Status', options: uniqueOptions(fundraisers, 'status') }
          ]}
          columns={[
            { key: 'title', label: 'Cause' },
            { key: 'category', label: 'Category' },
            { key: 'beneficiary', label: 'Beneficiary' },
            { key: 'purpose', label: 'Details' },
            { key: 'raised', label: 'Raised', render: (row) => `$${Number(row.raised || 0).toLocaleString()}` },
            { key: 'goal', label: 'Goal', render: (row) => `$${Number(row.goal || 0).toLocaleString()}` },
            { key: 'deadline', label: 'Needed by' },
            { key: 'status', label: 'Status' }
          ]}
        />
        {modalType === 'fundraiser' && <CreateModal type="fundraiser" onClose={() => setModalType(null)} onCreated={() => { refresh(); setModalType(null); }} />}
      </>
    );
  }

  if (view === 'registrations') {
    return (
      <>
        <PageHeader root="Reception" area="CheckInNew" title="Event check-in" action={<span className="received-count">Recieved {checkinRows.length} registration(s)</span>} />
        <section className="checkin-control-panel">
          <form className="checkin-filter-form" onSubmit={handleCheckinSubmit}>
            <label>Events:
              <select value={selectedCheckinEvent.title || ''} onChange={(event) => { setCheckinProgram(event.target.value); setCheckinApplied(false); setCheckinError(''); setCheckinEventId(''); }} required>
                {eventOptions.map((item) => <option key={item.title} value={item.title}>{item.title}</option>)}
              </select>
            </label>
            <span>/</span>
            <label className="event-id-field">
              <input value={checkinEventId} onChange={(event) => setCheckinEventId(event.target.value)} placeholder="Event id optional" />
            </label>
            <button className="button primary" type="submit">Go</button>
          </form>
          <div className="checkin-summary-table" aria-label="Registration summary">
            <span>Registrations</span><span>Adults (13 yrs and above)</span><span>Kids (6-12 yrs)</span><span>Kids (5 yrs and below)</span><span>Total Members</span>
            <strong>{checkinRows.length}</strong><strong>{checkinSummary.adults}</strong><strong>{checkinSummary.kids}</strong><strong>{checkinSummary.youngKids}</strong><strong>{checkinRows.length}</strong>
          </div>
        </section>
        {checkinError && <p className="form-error">{checkinError}</p>}
        <AdminTable
          title="Registrations"
          rows={checkinRows}
          filters={[{ key: 'program', label: 'Events', options: uniqueOptions(checkinRows, 'program') }]}
          columns={[
            { key: 'eventId', label: 'Event ID', render: (row, index) => row.eventId || makeEventId(row.program, index) },
            { key: 'createdAt', label: 'Registered on' },
            { key: 'parentName', label: 'Registered Name' },
            { key: 'email', label: 'Registered by' },
            { key: 'studentName', label: 'Family Member' },
            { key: 'phone', label: 'Phone Number' },
            { key: 'program', label: 'Program' },
            { key: 'status', label: 'Status', render: () => 'Submitted' }
          ]}
        />
      </>
    );
  }

  if (view === 'student-view') {
    const students = registrations.length ? registrations : [
      { studentName: 'Aadhya Prabhakar', parentName: 'Aadhya Prabhakar', program: 'Kannada Bharati Paata Shaale Registrations (Level 5)', status: 'Confirmed' },
      { studentName: 'Aadhya Bhandi', parentName: 'Aadhya Bhandi', program: 'Bharatanatya Class for Seniors', status: 'Confirmed' },
      { studentName: 'Aanya Gujjar', parentName: 'Aanya Gujjar', program: 'Kannada Bharati Paata Shaale Registrations (Level 4)', status: 'Submitted' }
    ];
    return (
      <>
        <PageHeader area="Student view" title="Student View" />
        <section className="admin-page-panel">
          <div className="student-matrix-scroll">
            <table className="student-matrix">
              <thead>
                <tr>
                  <th>Name</th>
                  {programs.slice(0, 12).map((program) => <th key={program.title}>{program.title}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={`${student.email || student.parentName || index}`}>
                    <td>{student.studentName !== '-' ? student.studentName : student.parentName}</td>
                    {programs.slice(0, 12).map((program) => {
                      const active = student.program === program.title || student.program?.includes(program.title);
                      return <td key={program.title}>{active ? <span className="confirmed-badge">Confirmed ✓</span> : '--'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  if (view === 'users') {
    return (
      <>
        <PageHeader area="User" title="Manage users" />
        <AdminTable
          title="Users"
          rows={registrations}
          filters={[{ key: 'program', label: 'Roles', options: uniqueOptions(registrations, 'program') }]}
          columns={[
            { key: 'createdAt', label: 'Created on' },
            { key: 'email', label: 'Email' },
            { key: 'parentName', label: 'First name' },
            { key: 'studentName', label: 'Last name' },
            { key: 'phone', label: 'Phone number' },
            { key: 'defaulter', label: 'Defaulter', render: () => 'No' },
            { key: 'role', label: 'Role', render: () => 'Member' },
            { key: 'enabled', label: 'Enabled', render: () => '✓' }
          ]}
        />
      </>
    );
  }

  const dashboardRows = [...programs.slice(0, 4), ...allEvents.slice(0, 3)];

  return (
    <>
      <PageHeader area="Dashboard" title="Member dashboard" />
      <section className="admin-dashboard-hero-grid">
        <article><UsersRound size={24} /><span>Registrations</span><strong>{registrations.length}</strong></article>
        <article><CalendarDays size={24} /><span>Current Events</span><strong>{allEvents.length}</strong></article>
        <article><ReceiptText size={24} /><span>Expenses</span><strong>{expenses.length}</strong></article>
        <article><Megaphone size={24} /><span>Announcements</span><strong>{announcements.length}</strong></article>
      </section>
      <AdminTable
        title="Current events"
        rows={dashboardRows}
        columns={[
          { key: 'title', label: 'Name' },
          { key: 'summary', label: 'Details', render: (row) => (
            <div className="dashboard-row-summary">
              <strong>{row.date || row.month || row.startOn || 'Date to be announced'}</strong>
              <span>{row.time || row.location || row.eventType || '-'}</span>
              <button className="mini-action-link secondary" type="button" onClick={() => setDetailRecord(row)}>Details</button>
            </div>
          ) },
          { key: 'register', label: 'Register', render: (row) => <a className="mini-action-link" href={`/admin/register-member?program=${encodeURIComponent(row.title)}`}>Register</a> }
        ]}
      />
      <section className="history-card-grid admin-route-history">
        <article><h3>Your Event Registrations History</h3><p>Not registered yet!</p></article>
        <article><h3>Your Class Registrations History</h3><p>{registrations.length ? `${registrations.length} registration record${registrations.length === 1 ? '' : 's'} found.` : 'Not registered yet!'}</p></article>
      </section>
      {detailRecord && <EventDetailModal item={detailRecord} onClose={() => setDetailRecord(null)} />}
    </>
  );
}

function CreateModal({ type, onClose, onCreated }) {
  return (
    <div className="popup-backdrop" role="presentation">
      <div className="popup-panel" role="dialog" aria-modal="true" aria-label={`Add ${type}`}>
        <button className="popup-close" type="button" aria-label="Close popup" onClick={onClose}>
          <X size={20} />
        </button>
        <AdminCreateForm type={type} onCreated={onCreated} />
      </div>
    </div>
  );
}
