import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, HandCoins, Megaphone, Plus, ReceiptText, UsersRound, X } from 'lucide-react';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import { culturalClasses, events, paataShaaleLevels } from '../data/siteData.js';
import { appendRecord, getCurrentUser, isAdmin, readJson, writeJson } from '../utils/storage.js';
import {
  apiAdminDashboard,
  apiAppendRecord,
  apiCreateSeat,
  apiDeleteSubmission,
  apiExpenseAction,
  apiFindUserByEmail,
  apiLookupUserPhone,
  apiReceptionCheckin,
  apiReadSeats,
  apiReadSiteSetting,
  apiRegistrationAction,
  apiSaveSiteSetting,
  apiSendOutboxEmail,
  apiUpdateSubmission,
  apiUpdateUser
} from '../utils/api.js';
import { cleanText, firstError, validateAmount, validateDateOrder, validateImageFile, validatePhone, validateRequired, validateUrl } from '../utils/validation.js';

const fallbackPrograms = [
  ...paataShaaleLevels.map((item) => ({ ...item, category: 'Language', date: 'Sep 13, 2026 - Jun 20, 2027' })),
  ...culturalClasses
];

const defaultEventTypes = ['Classroom', 'Workshop', 'Seminar', 'Cultural'];
const defaultRecurrences = ['OneTime', 'Daily', 'Weekly', 'Monthly', 'Yearly'];
const referenceVolunteerGoogleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSc1etxiGQgKR7XKhpSBd5UuLR-9-_0KDmxg7Zxd98RXK1w2Kg/viewform?embedded=true';
const defaultVolunteerGoogleForm = {
  enabled: false,
  url: referenceVolunteerGoogleFormUrl
};

function normalizeVolunteerGoogleForm(setting = defaultVolunteerGoogleForm) {
  return {
    enabled: setting.enabled === true || setting.enabled === 'true' || setting.enabled === 'Yes' || setting.enabled === 1,
    url: cleanText(setting.url) || referenceVolunteerGoogleFormUrl
  };
}

const seedAnnouncements = [
  {
    localId: 'seed-paata-registration',
    text: 'Kannada Bharati Paata Shaale registrations are open',
    ctaText: 'Register today',
    ctaUrl: '/kannada-shaale',
    startOn: '2026-09-01',
    endOn: '2026-10-15',
    enabled: 'Yes'
  },
  {
    localId: 'seed-rajyotsava-volunteer',
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

function getRegistrationKey(row, index = 0) {
  return row.id || `${row.email || 'registration'}-${row.program || 'program'}-${row.createdAt || index}`;
}

function getMoneyAmount(row = {}) {
  if (row.amount !== undefined) return Number(row.amount || 0);
  const fee = row.fee ?? row.registrationFee ?? row.price ?? row.donationAmount;
  if (typeof fee === 'number') return fee;
  const parsed = Number(String(fee || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCheckinCounts(row = {}) {
  const adults = Number(row.adults ?? row.adultCount ?? 1);
  const kids = Number(row.kids ?? row.kidCount ?? 0);
  const youngKids = Number(row.youngKids ?? row.youngKidCount ?? 0);
  const total = Number(row.total ?? row.totalMembers ?? row.seats ?? adults + kids + youngKids);
  return { adults, kids, youngKids, total };
}

function statusCount(rows = [], matcher) {
  return rows.filter((row) => matcher(String(row.status || '').toLowerCase(), row)).length;
}

function isPaidRegistration(row = {}) {
  return row.paid === true || row.paymentReceived === true || row.paymentReceived === 'true' || String(row.paid || '').toLowerCase() === 'paid';
}

function summarizeBy(rows = [], key, limit = 4) {
  return Object.values(rows.reduce((groups, row) => {
    const label = row[key] || 'Unassigned';
    groups[label] ||= { label, count: 0, amount: 0, rows: [] };
    groups[label].count += 1;
    groups[label].amount += getMoneyAmount(row);
    groups[label].rows.push(row);
    return groups;
  }, {})).sort((a, b) => b.count - a.count).slice(0, limit);
}

function getExpenseStatus(rows = []) {
  return {
    submitted: statusCount(rows, (status) => status.includes('submitted')),
    approved: statusCount(rows, (status) => status.includes('approved')),
    paid: statusCount(rows, (status) => status.includes('paid')),
    rejected: statusCount(rows, (status) => status.includes('rejected'))
  };
}

function memberProfileKey(email) {
  return `kb-member-profile-${String(email || 'guest').toLowerCase()}`;
}

function memberChildrenKey(email) {
  return `kb-member-children-${String(email || 'guest').toLowerCase()}`;
}

function isEnabledValue(value) {
  return value === true || value === 'Yes' || value === 'yes' || value === 'true' || value === 1;
}

function makeLocalAnnouncementId(row = {}, index = 0) {
  return `local-announcement-${row.createdAt || Date.now()}-${index}-${String(row.text || 'announcement').replace(/\W+/g, '-').slice(0, 36)}`;
}

function withAnnouncementKeys(rows = []) {
  let changed = false;
  const keyed = rows.map((row, index) => {
    if (row.id || row.localId || row.local_id) return row;
    changed = true;
    return { ...row, localId: makeLocalAnnouncementId(row, index) };
  });
  return { rows: keyed, changed };
}

function getAnnouncementKey(row = {}) {
  return row.id || row.localId || row.local_id || '';
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

function RegistrationDetailModal({ row, onClose }) {
  const profile = row.profile || readJson(memberProfileKey(row.email), {});
  const children = row.children || readJson(memberChildrenKey(row.email), []);
  const registrations = row.registrations || [];
  const profileRows = [
    ['Registered name', row.parentName || row.name || '-'],
    ['Email', row.email || '-'],
    ['Phone', profile.phone || row.phone || '-'],
    ['Program', row.program || '-'],
    ['Status', row.status || 'Submitted'],
    ['First name', profile.firstName || '-'],
    ['Last name', profile.lastName || '-'],
    ['Date of birth', profile.birthDate || '-'],
    ['Gender', profile.gender || '-'],
    ['Company', profile.company || '-'],
    ['Address line1', profile.address1 || '-'],
    ['Address line2', profile.address2 || '-'],
    ['City', profile.city || '-'],
    ['State', profile.state || '-'],
    ['Zip code', profile.zipCode || '-'],
    ['Spouse first name', profile.spouseFirstName || '-'],
    ['Spouse last name', profile.spouseLastName || '-'],
    ['Spouse date of birth', profile.spouseBirthDate || '-']
  ];

  return (
    <div className="popup-backdrop" role="presentation">
      <div className="popup-panel detail-popup registration-detail-popup" role="dialog" aria-modal="true" aria-label={`${row.parentName || row.email} registration details`}>
        <button className="popup-close" type="button" aria-label="Close popup" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="registration-detail-heading">
          <div className="member-avatar">
            {profile.photo ? <img src={profile.photo} alt="" /> : <UsersRound size={34} />}
          </div>
          <div>
            <span>Registration profile</span>
            <h2>{profile.firstName || row.parentName || row.email}</h2>
            <p>{profile.description || 'Member profile and registration details are shown below.'}</p>
          </div>
        </div>
        <div className="detail-popup-grid">
          {profileRows.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value || '-'}</strong>
            </article>
          ))}
        </div>
        <section className="registration-children-panel">
          <h3>Children info</h3>
          <div className="table-scroll">
            <table>
              <thead><tr><th>First name</th><th>Last name</th><th>Gender</th><th>Date of birth</th></tr></thead>
              <tbody>
                {children.length ? children.map((child) => (
                  <tr key={child.id || `${child.firstName}-${child.birthDate}`}>
                    <td>{child.firstName || child.childFirstName}</td>
                    <td>{child.lastName || child.childLastName}</td>
                    <td>{child.gender}</td>
                    <td>{child.birthDate}</td>
                  </tr>
                )) : <tr><td colSpan="4">No children added in profile.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {registrations.length > 0 && (
          <section className="registration-children-panel">
            <h3>Registration history</h3>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Program</th><th>Member</th><th>Status</th><th>Paid</th><th>Registered on</th></tr></thead>
                <tbody>
                  {registrations.map((registration) => (
                    <tr key={registration.id || `${registration.program}-${registration.createdAt}`}>
                      <td>{registration.program || '-'}</td>
                      <td>{registration.familyMember || registration.studentName || '-'}</td>
                      <td>{registration.status || 'Submitted'}</td>
                      <td>{registration.paid ? 'Yes' : 'No'}</td>
                      <td>{registration.createdAt || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function useAdminData() {
  const initialAnnouncements = withAnnouncementKeys(readJson('kb-announcement-submissions', seedAnnouncements));
  if (initialAnnouncements.changed) writeJson('kb-announcement-submissions', initialAnnouncements.rows);
  const [dashboard, setDashboard] = useState(() => ({
    users: [],
    registrations: readJson('kb-registration-submissions', []),
    donations: readJson('kb-donation-submissions', []),
    volunteers: readJson('kb-volunteer-submissions', []),
    contacts: readJson('kb-contact-submissions', []),
    expenses: readJson('kb-expense-submissions', []),
    announcements: initialAnnouncements.rows,
    classes: [],
    events: [],
    fundraisers: readJson('kb-admin-fundraisers', []),
    emailOutbox: []
  }));
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    apiAdminDashboard()
      .then((records) => {
        if (!ignore) {
          const localRegistrations = readJson('kb-registration-submissions', []);
          const localAnnouncements = withAnnouncementKeys(readJson('kb-announcement-submissions', seedAnnouncements));
          if (localAnnouncements.changed) writeJson('kb-announcement-submissions', localAnnouncements.rows);
          const dashboardAnnouncements = records.announcements?.length
            ? records.announcements
            : localAnnouncements.rows;
          setDashboard((current) => ({
            ...current,
            ...records,
            registrations: records.registrations?.length ? records.registrations : localRegistrations,
            expenses: readJson('kb-expense-submissions', []),
            announcements: dashboardAnnouncements,
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
  const [phoneLookup, setPhoneLookup] = useState({ email: '', phone: '', error: '' });
  const [detailRecord, setDetailRecord] = useState(null);
  const [registrationDetail, setRegistrationDetail] = useState(null);
  const [checkedInIds, setCheckedInIds] = useState(() => readJson('kb-checkin-records', []));
  const [eventTypes, setEventTypes] = useState(() => readJson('kb-event-types', defaultEventTypes));
  const [recurrences, setRecurrences] = useState(() => readJson('kb-recurrence-options', defaultRecurrences));
  const [volunteerGoogleForm, setVolunteerGoogleForm] = useState(() => readJson('kb-volunteer-google-form', defaultVolunteerGoogleForm));
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [userSearchResult, setUserSearchResult] = useState(null);
  const [userSearchError, setUserSearchError] = useState('');
  const [seatError, setSeatError] = useState('');
  const [seatRecords, setSeatRecords] = useState([]);
  const registrations = dashboard.registrations || [];
  const users = dashboard.users || [];
  const donations = dashboard.donations || [];
  const volunteers = dashboard.volunteers || [];
  const contacts = dashboard.contacts || [];
  const expenses = dashboard.expenses || [];
  const programs = dashboard.classes?.length ? dashboard.classes : fallbackPrograms;
  const allEvents = dashboard.events?.length ? dashboard.events : events;
  const announcements = dashboard.announcements || [];
  const fundraisers = dashboard.fundraisers || [];
  const emailOutbox = dashboard.emailOutbox || [];
  const profile = readJson(memberProfileKey(user.email), {});
  const profileChildren = readJson(memberChildrenKey(user.email), []);
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
  const registeredUsers = users.length ? users.map((row) => {
    const userProfile = readJson(memberProfileKey(row.email), {});
    return {
      ...row,
      parentName: row.name || row.email,
      firstName: userProfile.firstName || row.firstName || row.name?.split(' ')?.[0] || '-',
      lastName: userProfile.lastName || row.lastName || row.name?.split(' ')?.slice(1).join(' ') || '-',
      phone: userProfile.phone || row.phone || '-',
      registrationCount: registrations.filter((item) => String(item.email || '').toLowerCase() === String(row.email || '').toLowerCase()).length
    };
  }) : [...new Map(registrations.map((row) => {
    const email = String(row.email || '').toLowerCase();
    const userProfile = readJson(memberProfileKey(email), {});
    const displayName = [
      userProfile.firstName || row.parentName?.split(' ')?.[0] || row.name || row.email,
      userProfile.lastName || row.parentName?.split(' ')?.slice(1).join(' ')
    ].filter(Boolean).join(' ').trim();
    return [email || getRegistrationKey(row), {
      ...row,
      parentName: displayName || row.parentName || row.email,
      firstName: userProfile.firstName || row.parentName?.split(' ')?.[0] || '-',
      lastName: userProfile.lastName || row.parentName?.split(' ')?.slice(1).join(' ') || '-',
      phone: userProfile.phone || row.phone || '-',
      registrationCount: registrations.filter((item) => String(item.email || '').toLowerCase() === email).length
    }];
  })).values()];
  const requestedProgram = cleanText(searchParams.get('program'));
  const selectedProgram = [...programs, ...allEvents].find((item) => item.title === requestedProgram) || programs[0] || allEvents[0] || {};
  const currentUserEmail = String(user.email || '').toLowerCase();
  const userRegistrations = registrations.filter((item) => String(item.email || '').toLowerCase() === currentUserEmail);
  const userClassRegistrations = userRegistrations.filter((item) => (
    item.registrationType === 'class'
    || programs.some((program) => program.title === item.program)
    || /class|paata|shaale|guitar|dance|music|kannada/i.test(item.program || '')
  ));
  const userEventRegistrations = userRegistrations.filter((item) => !userClassRegistrations.includes(item));
  const memberOptions = [
    `${profile.firstName || user.firstName || user.name || user.email} ${profile.lastName || ''}`.trim(),
    ...profileChildren.map((child) => `${child.firstName || child.childFirstName} ${child.lastName || child.childLastName || ''}`.trim()).filter(Boolean)
  ].filter(Boolean);
  const volunteerGoogleFormSaved = normalizeVolunteerGoogleForm(volunteerGoogleForm);
  const volunteerGoogleFormReady = Boolean(volunteerGoogleFormSaved.enabled && volunteerGoogleFormSaved.url);
  const volunteerGoogleFormStatus = volunteerGoogleFormReady
    ? 'Enabled'
    : volunteerGoogleFormSaved.enabled
      ? 'Needs URL'
      : 'Disabled';

  useEffect(() => {
    if (view !== 'seats') return;
    apiReadSeats(expectedEventId)
      .then((records) => setSeatRecords(records.seats || []))
      .catch(() => setSeatRecords([]));
  }, [expectedEventId, view]);

  useEffect(() => {
    if (view !== 'event-settings') return;
    let ignore = false;
    apiReadSiteSetting('volunteer-google-form')
      .then((setting) => {
        if (ignore) return;
        const normalized = normalizeVolunteerGoogleForm(setting || defaultVolunteerGoogleForm);
        setVolunteerGoogleForm(normalized);
        writeJson('kb-volunteer-google-form', normalized);
        window.dispatchEvent(new Event('kb-data-change'));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [view]);

  function sameRegistration(item, target) {
    if (item.id && target.id) return item.id === target.id;
    return item.createdAt === target.createdAt
      && item.email === target.email
      && item.program === target.program
      && item.studentName === target.studentName;
  }

  function updateLocalRegistrations(nextRegistrations) {
    writeJson('kb-registration-submissions', nextRegistrations);
    setDashboard((current) => ({ ...current, registrations: nextRegistrations }));
  }

  async function updateRegistration(row, patch) {
    const nextRow = { ...row, ...patch };
    const nextRegistrations = registrations.map((item) => (sameRegistration(item, row) ? nextRow : item));
    updateLocalRegistrations(nextRegistrations);

    if (!row.id) return;
    try {
      const saved = await apiUpdateSubmission('registration', row.id, patch);
      updateLocalRegistrations(nextRegistrations.map((item) => (sameRegistration(item, nextRow) ? saved : item)));
    } catch {
      // Keep local admin action result when API is unavailable.
    }
  }

  async function runRegistrationAction(row, action, fallbackPatch = {}) {
    const nextRow = { ...row, ...fallbackPatch };
    const nextRegistrations = registrations.map((item) => (sameRegistration(item, row) ? nextRow : item));
    updateLocalRegistrations(nextRegistrations);

    if (!row.id) return;
    try {
      const saved = await apiRegistrationAction(row.id, action);
      updateLocalRegistrations(nextRegistrations.map((item) => (sameRegistration(item, nextRow) ? saved : item)));
    } catch {
      try {
        const saved = await apiUpdateSubmission('registration', row.id, fallbackPatch);
        updateLocalRegistrations(nextRegistrations.map((item) => (sameRegistration(item, nextRow) ? saved : item)));
      } catch {
        // Keep local admin action result when API is unavailable.
      }
    }
  }

  async function deleteRegistration(row) {
    const nextRegistrations = registrations.filter((item) => !sameRegistration(item, row));
    updateLocalRegistrations(nextRegistrations);

    if (!row.id) return;
    try {
      await apiDeleteSubmission('registration', row.id);
    } catch {
      // Keep local admin action result when API is unavailable.
    }
  }

  async function updateUser(row, patch) {
    const nextUsers = users.map((item) => (item.id === row.id ? { ...item, ...patch } : item));
    setDashboard((current) => ({ ...current, users: nextUsers }));
    if (!row.id) return;

    try {
      const saved = await apiUpdateUser(row.id, patch);
      setDashboard((current) => ({ ...current, users: (current.users || []).map((item) => (item.id === row.id ? saved : item)) }));
    } catch {
      // Keep local role/defaulter update visible if the API is unavailable.
    }
  }

  async function runExpenseAction(row, action, fallbackStatus) {
    const nextExpenses = expenses.map((item) => (item.id === row.id ? { ...item, status: fallbackStatus } : item));
    setDashboard((current) => ({ ...current, expenses: nextExpenses }));
    if (!row.id) return;

    try {
      const saved = await apiExpenseAction(row.id, action);
      setDashboard((current) => ({ ...current, expenses: (current.expenses || []).map((item) => (item.id === row.id ? saved : item)) }));
    } catch {
      // Keep optimistic status if the optional backend table columns have not been applied yet.
    }
  }

  async function handleUserSearch(event) {
    event.preventDefault();
    setUserSearchError('');
    setUserSearchResult(null);
    const email = cleanText(new FormData(event.currentTarget).get('email'));
    if (!email) {
      setUserSearchError('Email is required.');
      return;
    }

    try {
      const result = await apiFindUserByEmail(email);
      if (!result.user) {
        setUserSearchError('No user found for this email.');
        return;
      }
      setUserSearchResult({
        ...result.user,
        profile: result.profile || {},
        children: result.children || [],
        registrations: result.registrations || []
      });
    } catch (error) {
      setUserSearchError(error.message || 'Could not find user.');
    }
  }

  async function handlePhoneLookup(event) {
    event.preventDefault();
    const email = cleanText(new FormData(event.currentTarget).get('email')).toLowerCase();
    setPhoneLookup({ email, phone: '', error: '' });
    if (!email) {
      setPhoneLookup({ email, phone: '', error: 'Email is required.' });
      return;
    }
    try {
      const result = await apiLookupUserPhone(email);
      setPhoneLookup({ email, phone: result.phone || '-', error: '' });
    } catch (error) {
      setPhoneLookup({ email, phone: '', error: error.message || 'Could not find phone number.' });
    }
  }

  function handleGuestRegistrationSubmit(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const record = appendRecord('kb-registration-submissions', {
      parentName: cleanText(payload.name),
      studentName: cleanText(payload.familyMember || payload.name),
      familyMember: cleanText(payload.familyMember || payload.name),
      email: cleanText(payload.email).toLowerCase(),
      phone: cleanText(payload.phone),
      program: cleanText(payload.program || selectedCheckinEvent.title || 'Guest registration'),
      eventId: cleanText(payload.eventId || expectedEventId),
      status: 'Submitted',
      registrationType: 'guest',
      adults: Number(payload.adults || 1),
      kids: Number(payload.kids || 0),
      youngKids: Number(payload.youngKids || 0),
      totalMembers: Number(payload.totalMembers || payload.adults || 1),
      seats: Number(payload.totalMembers || payload.adults || 1),
      amount: Number(payload.amount || 0)
    });
    setDashboard((current) => ({ ...current, registrations: [...(current.registrations || []), record] }));
    event.currentTarget.reset();
  }

  async function handleSeatSubmit(event) {
    event.preventDefault();
    setSeatError('');
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const eventId = cleanText(payload.eventId);
    const seatNumber = cleanText(payload.seatNumber);
    if (!eventId || !seatNumber) {
      setSeatError('Event id and seat number are required.');
      return;
    }

    try {
      await apiCreateSeat({
        eventId,
        seatNumber,
        registrationId: payload.registrationId || null,
        assignedTo: payload.assignedTo || null
      });
      const records = await apiReadSeats(eventId);
      setSeatRecords(records.seats || []);
      event.currentTarget.reset();
      refresh();
    } catch (error) {
      setSeatError(error.message || 'Could not save seat.');
    }
  }

  async function resendOutboxEmail(row) {
    if (!row.id) return;
    try {
      await apiSendOutboxEmail(row.id);
      refresh();
    } catch {
      // Keep the outbox visible if SMTP is not configured.
    }
  }

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

    writeJson(memberProfileKey(user.email), savedProfile);
    setProfileSaved(true);
  }

  function handleAddChild() {
    const nextChild = {
      childFirstName: 'New child',
      childLastName: profile.lastName || user.lastName || '',
      childGender: 'Prefer not to say',
      childBirthDate: ''
    };
    writeJson(memberChildrenKey(user.email), [...profileChildren, nextChild]);
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

  async function markCheckedIn(row, index) {
    const key = getRegistrationKey(row, index);
    const next = checkedInIds.includes(key) ? checkedInIds : [...checkedInIds, key];
    writeJson('kb-checkin-records', next);
    setCheckedInIds(next);
    await runRegistrationAction(row, 'checkin', { checkedIn: true, checkedInAt: new Date().toISOString() });
    if (row.id) {
      apiReceptionCheckin({
        registrationId: row.id,
        registrationKey: key,
        eventId: row.eventId || expectedEventId
      }).catch(() => {});
    }
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

  async function handleAnnouncementSubmit(event) {
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
    const recordPayload = {
      text,
      ctaText,
      ctaUrl,
      startOn: payload.startOn,
      endOn: payload.endOn,
      enabled: Boolean(payload.enabled)
    };

    try {
      const saved = await apiAppendRecord('kb-announcement-submissions', recordPayload);
      const nextAnnouncements = [...announcements, saved || recordPayload];
      writeJson('kb-announcement-submissions', nextAnnouncements);
      setDashboard((current) => ({ ...current, announcements: nextAnnouncements }));
      window.dispatchEvent(new Event('kb-data-change'));
    } catch {
      const localRecord = {
        ...recordPayload,
        localId: makeLocalAnnouncementId(recordPayload, announcements.length),
        createdAt: new Date().toISOString()
      };
      const nextAnnouncements = [...announcements, localRecord];
      writeJson('kb-announcement-submissions', nextAnnouncements);
      setDashboard((current) => ({ ...current, announcements: nextAnnouncements }));
      window.dispatchEvent(new Event('kb-data-change'));
    }

    form.reset();
    setAnnouncementSaved(true);
    setModalType(null);
  }

  async function toggleAnnouncement(row) {
    const enabled = !isEnabledValue(row.enabled);
    const rowKey = getAnnouncementKey(row);
    const nextRow = { ...row, enabled };
    const nextAnnouncements = announcements.map((item) => (
      getAnnouncementKey(item) === rowKey
        ? nextRow
        : item
    ));

    writeJson('kb-announcement-submissions', nextAnnouncements);
    setDashboard((current) => ({ ...current, announcements: nextAnnouncements }));
    window.dispatchEvent(new Event('kb-data-change'));

    if (!row.id) return;
    try {
      const saved = await apiUpdateSubmission('announcement', row.id, { enabled });
      const savedAnnouncements = nextAnnouncements.map((item) => (item.id === row.id ? saved : item));
      writeJson('kb-announcement-submissions', savedAnnouncements);
      setDashboard((current) => ({ ...current, announcements: savedAnnouncements }));
      window.dispatchEvent(new Event('kb-data-change'));
    } catch {
      // Local update keeps the toggle responsive if the optional backend write fails.
    }
  }

  function saveEventSettings(key, setter, values) {
    writeJson(key, values);
    setter(values);
    window.dispatchEvent(new Event('kb-data-change'));
  }

  function handleSettingSubmit(event, key, values, setter, label) {
    event.preventDefault();
    setSettingsError('');
    setSettingsSaved(false);
    const form = event.currentTarget;
    const value = cleanText(new FormData(form).get('value'));
    if (!value) {
      setSettingsError(`${label} is required.`);
      return;
    }
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setSettingsError(`${label} already exists.`);
      return;
    }
    saveEventSettings(key, setter, [...values, value].sort());
    form.reset();
  }

  function removeSetting(key, values, setter, value) {
    saveEventSettings(key, setter, values.filter((item) => item !== value));
  }

  async function handleVolunteerGoogleFormSubmit(event) {
    event.preventDefault();
    setSettingsError('');
    setSettingsSaved(false);
    const draft = normalizeVolunteerGoogleForm(volunteerGoogleForm);
    const enabled = Boolean(draft.enabled);
    const url = cleanText(draft.url);
    const error = enabled ? validateUrl(url, 'Google Form URL') : '';
    if (error) {
      setSettingsError(error);
      return;
    }

    const nextSettings = { enabled, url };
    writeJson('kb-volunteer-google-form', nextSettings);
    setVolunteerGoogleForm(nextSettings);
    try {
      const saved = await apiSaveSiteSetting('volunteer-google-form', nextSettings);
      const normalized = normalizeVolunteerGoogleForm(saved || nextSettings);
      writeJson('kb-volunteer-google-form', normalized);
      setVolunteerGoogleForm(normalized);
    } catch (error) {
      setSettingsError(error.message || 'Could not save Google Form settings.');
      return;
    }
    setSettingsSaved(true);
    window.dispatchEvent(new Event('kb-data-change'));
  }

  function updateVolunteerGoogleFormDraft(patch) {
    setSettingsSaved(false);
    setSettingsError('');
    setVolunteerGoogleForm((current) => ({ ...current, ...patch }));
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
                  <tr key={`${child.firstName || child.childFirstName}-${index}`}><td>{child.firstName || child.childFirstName}</td><td>{child.lastName || child.childLastName}</td><td>{child.gender || child.childGender}</td><td>{child.birthDate || child.childBirthDate || '-'}</td></tr>
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

  if (view === 'event-settings') {
    return (
      <>
        <PageHeader area="Event Settings" title="Manage event dropdowns" />
        {settingsError && <p className="form-error admin-floating-message">{settingsError}</p>}
        {settingsSaved && <p className="success admin-floating-message">Settings saved.</p>}
        <div className="event-settings-grid">
          <section className="admin-page-panel">
            <div className="admin-page-panel-heading"><h2>Event types</h2><span>{eventTypes.length}</span></div>
            <form className="settings-inline-form" onSubmit={(event) => handleSettingSubmit(event, 'kb-event-types', eventTypes, setEventTypes, 'Event type')}>
              <label>New event type<input name="value" placeholder="Competition" /></label>
              <button className="button primary" type="submit">Add</button>
            </form>
            <div className="settings-list">
              {eventTypes.map((item) => (
                <article key={item}>
                  <strong>{item}</strong>
                  <button type="button" onClick={() => removeSetting('kb-event-types', eventTypes, setEventTypes, item)}>Remove</button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-page-panel">
            <div className="admin-page-panel-heading"><h2>Recurrence options</h2><span>{recurrences.length}</span></div>
            <form className="settings-inline-form" onSubmit={(event) => handleSettingSubmit(event, 'kb-recurrence-options', recurrences, setRecurrences, 'Recurrence')}>
              <label>New recurrence<input name="value" placeholder="BiWeekly" /></label>
              <button className="button primary" type="submit">Add</button>
            </form>
            <div className="settings-list">
              {recurrences.map((item) => (
                <article key={item}>
                  <strong>{item}</strong>
                  <button type="button" onClick={() => removeSetting('kb-recurrence-options', recurrences, setRecurrences, item)}>Remove</button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-page-panel google-form-settings-panel">
            <div className="admin-page-panel-heading google-form-heading">
              <h2>Volunteer Google Form</h2>
              <p>Control whether the public Volunteer page opens the Google Form registration.</p>
              <span className={volunteerGoogleFormReady ? 'status-pill is-live' : volunteerGoogleFormSaved.enabled ? 'status-pill is-warning' : 'status-pill'}>
                {volunteerGoogleFormStatus}
              </span>
            </div>
            <form className="google-form-settings" onSubmit={handleVolunteerGoogleFormSubmit}>
              <label className="google-form-toggle">
                <span>
                  <strong>Allow Google Form registration</strong>
                  <small>{volunteerGoogleForm.enabled ? 'Visitors can open the form from the Volunteer page.' : 'Visitors will see the disabled message.'}</small>
                </span>
                <input
                  name="enabled"
                  type="checkbox"
                  checked={Boolean(volunteerGoogleForm.enabled)}
                  onChange={(event) => updateVolunteerGoogleFormDraft({ enabled: event.target.checked })}
                />
              </label>
              <label className="google-form-url-field">
                Google Form URL
                <input
                  name="url"
                  type="url"
                  value={volunteerGoogleForm.url || ''}
                  onChange={(event) => updateVolunteerGoogleFormDraft({ url: event.target.value })}
                  placeholder={referenceVolunteerGoogleFormUrl}
                />
              </label>
              <button className="button primary" type="submit">Save</button>
            </form>
            <div className="google-form-preview">
              <strong>
                {volunteerGoogleFormReady
                  ? 'Google form registration is enabled on the Volunteer page.'
                  : volunteerGoogleFormSaved.enabled
                    ? 'Save a valid Google Form URL to enable public registration.'
                    : 'Google form registration is disabled.'}
              </strong>
              <span>{volunteerGoogleFormSaved.url ? 'URL ready for Volunteer page' : 'No URL saved'}</span>
              {volunteerGoogleFormSaved.url && <a href={volunteerGoogleFormSaved.url} target="_blank" rel="noreferrer">Open form</a>}
            </div>
          </section>
        </div>
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
            {
              key: 'enabled',
              label: 'Enabled',
              render: (row) => (
                <button
                  className={isEnabledValue(row.enabled) ? 'toggle-switch is-on' : 'toggle-switch'}
                  type="button"
                  role="switch"
                  aria-checked={isEnabledValue(row.enabled)}
                  onClick={() => toggleAnnouncement(row)}
                >
                  <span />
                  <strong>{isEnabledValue(row.enabled) ? 'Yes' : 'No'}</strong>
                </button>
              )
            }
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

  if (view === 'donations') {
    const totalDonations = donations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paypalOpened = donations.filter((item) => item.paymentStatus === 'PayPal opened').length;
    return (
      <>
        <PageHeader area="Donations" title="Donation payment details" />
        <section className="admin-dashboard-hero-grid">
          <article><HandCoins size={24} /><span>Total donated</span><strong>${totalDonations.toLocaleString()}</strong></article>
          <article><ReceiptText size={24} /><span>Donation records</span><strong>{donations.length}</strong></article>
          <article><UsersRound size={24} /><span>PayPal opened</span><strong>{paypalOpened}</strong></article>
          <article><CalendarDays size={24} /><span>Causes</span><strong>{uniqueOptions(donations, 'cause').length}</strong></article>
        </section>
        <AdminTable
          title="Donation details"
          rows={donations}
          emptyText="No donation records yet."
          filters={[
            { key: 'cause', label: 'Cause', options: uniqueOptions(donations, 'cause') },
            { key: 'paymentStatus', label: 'Payment status', options: uniqueOptions(donations, 'paymentStatus') }
          ]}
          columns={[
            { key: 'createdAt', label: 'Created on' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'cause', label: 'Donation cause' },
            { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` },
            { key: 'paymentStatus', label: 'Payment status' },
            { key: 'causeId', label: 'Cause ID' }
          ]}
        />
      </>
    );
  }

  if (view === 'messages') {
    return (
      <>
        <PageHeader area="Messages" title="Contact messages" />
        <AdminTable
          title="Contact messages"
          rows={contacts}
          emptyText="No contact messages yet."
          filters={[{ key: 'topic', label: 'Topic', options: uniqueOptions(contacts, 'topic') }]}
          columns={[
            { key: 'createdAt', label: 'Created on' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'topic', label: 'Topic' },
            { key: 'message', label: 'Message' }
          ]}
        />
      </>
    );
  }

  if (view === 'volunteer-interest') {
    return (
      <>
        <PageHeader area="Volunteer Interest" title="Volunteer submissions" />
        <AdminTable
          title="Volunteer submissions"
          rows={volunteers}
          emptyText="No volunteer interest records yet."
          filters={[{ key: 'interest', label: 'Interest', options: uniqueOptions(volunteers, 'interest') }]}
          columns={[
            { key: 'createdAt', label: 'Created on' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'interest', label: 'Volunteer interest' },
            { key: 'message', label: 'Message' }
          ]}
        />
      </>
    );
  }

  if (view === 'checkin') {
    const checkinAmountTotal = checkinRows.reduce((sum, row) => sum + getMoneyAmount(row), 0);
    const checkedInCount = checkinRows.filter((row, index) => checkedInIds.includes(getRegistrationKey(row, index)) || row.checkedIn).length;
    const pendingCheckinCount = Math.max(0, checkinRows.length - checkedInCount);
    const paidCheckinCount = checkinRows.filter(isPaidRegistration).length;
    const submittedCheckinCount = statusCount(checkinRows, (status) => status.includes('submitted'));
    const topCheckinPrograms = summarizeBy(checkinRows, 'program', 3);
    return (
      <>
        <PageHeader root="Reception" area="CheckInNew" title="Event check-in" action={<span className="received-count">Recieved {checkinRows.length} registration(s)</span>} />
        <section className="workflow-hero reception-hero">
          <div>
            <p className="eyebrow">Reception desk</p>
            <h2>{selectedCheckinEvent.title || 'Select an event'}</h2>
            <p>Track arrivals, phone lookups, payments, and member counts from one check-in workspace.</p>
          </div>
          <div className="workflow-action-list">
            <article><strong>{pendingCheckinCount}</strong><span>Waiting to check in</span></article>
            <article><strong>{checkedInCount}</strong><span>Checked in</span></article>
            <article><strong>{paidCheckinCount}</strong><span>Paid registrations</span></article>
          </div>
        </section>
        <section className="admin-dashboard-hero-grid">
          <article><UsersRound size={24} /><span>Total registrations</span><strong>{checkinRows.length}</strong></article>
          <article><CalendarDays size={24} /><span>Submitted</span><strong>{submittedCheckinCount}</strong></article>
          <article><ReceiptText size={24} /><span>Total members</span><strong>{checkinRows.reduce((sum, row) => sum + getCheckinCounts(row).total, 0)}</strong></article>
          <article><HandCoins size={24} /><span>Amount</span><strong>${checkinAmountTotal.toLocaleString()}</strong></article>
        </section>
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
            <span>Registrations</span><span>Adults (13 yrs and above)</span><span>Kids (6-12 yrs)</span><span>Kids (5 yrs and below)</span><span>Total Members</span><span>Amount</span>
            <strong>{checkinRows.length}</strong><strong>{checkinSummary.adults}</strong><strong>{checkinSummary.kids}</strong><strong>{checkinSummary.youngKids}</strong><strong>{checkinRows.reduce((sum, row) => sum + getCheckinCounts(row).total, 0)}</strong><strong>${checkinAmountTotal.toLocaleString()}</strong>
          </div>
          <form className="checkin-filter-form phone-lookup-form" onSubmit={handlePhoneLookup}>
            <label>Phone lookup:
              <input name="email" type="email" placeholder="member@example.com" />
            </label>
            <button className="button secondary-dark" type="submit">Find Phone</button>
            {phoneLookup.phone && <strong>{phoneLookup.email}: {phoneLookup.phone}</strong>}
            {phoneLookup.error && <span className="form-error inline-error">{phoneLookup.error}</span>}
          </form>
        </section>
        {topCheckinPrograms.length > 0 && (
          <section className="insight-grid">
            {topCheckinPrograms.map((program) => (
              <article key={program.label}>
                <span>Program load</span>
                <strong>{program.label}</strong>
                <div className="progress-track"><span style={{ width: `${Math.min(100, (program.count / Math.max(1, checkinRows.length)) * 100)}%` }} /></div>
                <p>{program.count} registration(s), ${program.amount.toLocaleString()}</p>
              </article>
            ))}
          </section>
        )}
        {checkinError && <p className="form-error">{checkinError}</p>}
        <AdminTable
          title="Event check-in details"
          rows={checkinRows}
          filters={[{ key: 'program', label: 'Events', options: uniqueOptions(checkinRows, 'program') }]}
          columns={[
            { key: 'serial', label: 'Sl no.', render: (_row, index) => index + 1 },
            {
              key: 'action',
              label: 'Action',
              render: (row, index) => {
                const checked = checkedInIds.includes(getRegistrationKey(row, index));
                return checked ? <span className="confirmed-badge">Checked</span> : <button className="checkin-action-button" type="button" onClick={() => markCheckedIn(row, index)}>Checkin</button>;
              }
            },
            { key: 'parentName', label: 'Registered Name' },
            { key: 'email', label: 'Registered by' },
            { key: 'seats', label: 'Seats', render: (row) => getCheckinCounts(row).total },
            { key: 'adults', label: 'Adults (13 yrs and above)', render: (row) => getCheckinCounts(row).adults },
            { key: 'kids', label: 'Kids (6-12 yrs)', render: (row) => getCheckinCounts(row).kids },
            { key: 'youngKids', label: 'Kids (5 yrs and below)', render: (row) => getCheckinCounts(row).youngKids },
            { key: 'total', label: 'Total', render: (row) => getCheckinCounts(row).total },
            { key: 'amount', label: 'Amount', render: (row) => `$${getMoneyAmount(row).toLocaleString()}` },
            { key: 'createdAt', label: 'Registered on' },
            { key: 'eventId', label: 'Event ID', render: (row, index) => row.eventId || makeEventId(row.program, index) },
            { key: 'phone', label: 'Phone Number' }
          ]}
        />
      </>
    );
  }

  if (view === 'registrations') {
    return (
      <>
        <PageHeader area="Registration" title="Registered user details" />
        <AdminTable
          title="Registered users"
          rows={registrations}
          emptyText="No registered users yet."
          filters={[{ key: 'program', label: 'Program', options: uniqueOptions(registrations, 'program') }]}
          columns={[
            { key: 'slNo', label: 'Sl no.', render: (_row, index) => index + 1 },
            { key: 'status', label: 'Status', render: (row) => row.status || 'Submitted' },
            { key: 'paid', label: 'Paid', render: (row) => row.paid ? 'Paid' : 'false' },
            { key: 'createdAt', label: 'Registered on' },
            {
              key: 'studentName',
              label: 'Registered Name',
              render: (row) => (
                <div className="registered-user-cell">
                  <strong>{row.studentName && row.studentName !== '-' ? row.studentName : row.parentName || '-'}</strong>
                  <button className="mini-action-link secondary" type="button" onClick={() => setRegistrationDetail(row)}>View details</button>
                </div>
              )
            },
            { key: 'email', label: 'Registered by' },
            { key: 'familyMember', label: 'Family Member', render: (row) => row.familyMember || row.studentName || '-' },
            { key: 'birthYear', label: 'BirthYear', render: (row) => row.birthYear || '-' },
            { key: 'phone', label: 'Phone Number' },
            {
              key: 'action',
              label: 'Action',
              render: (row) => (
                <div className="admin-row-actions">
                  {(row.status || 'Submitted') !== 'Confirmed' ? (
                    <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'confirm', { status: 'Confirmed' })}>Confirm</button>
                  ) : (
                    <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'reset', { status: 'Submitted' })}>Reset</button>
                  )}
                  <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'emailstatus', { emailStatus: 'Sent' })}>EmailStatus</button>
                  <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'paid', { paid: true, paymentReceived: true })}>Paid</button>
                  <button className="mini-action-link danger" type="button" onClick={() => runRegistrationAction(row, 'delete', { enabled: false, status: 'Deleted' })}>Delete</button>
                </div>
              )
            }
          ]}
        />
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  if (view === 'guest-checkin') {
    const guestRows = registrations.filter((row) => row.registrationType === 'guest' || row.email?.includes('guest'));
    const guestCheckedIn = guestRows.filter((row, index) => checkedInIds.includes(getRegistrationKey(row, index)) || row.checkedIn).length;
    const guestMembers = guestRows.reduce((sum, row) => sum + getCheckinCounts(row).total, 0);
    const guestAmount = guestRows.reduce((sum, row) => sum + getMoneyAmount(row), 0);
    return (
      <>
        <PageHeader root="Reception" area="Guest Check-in" title="Guest registration and check-in" />
        <section className="workflow-hero reception-hero">
          <div>
            <p className="eyebrow">Guest desk</p>
            <h2>Fast intake for walk-ins and invited guests</h2>
            <p>Create a guest registration, assign the event, and check them in from the same screen.</p>
          </div>
          <div className="workflow-action-list">
            <article><strong>{guestRows.length}</strong><span>Guest records</span></article>
            <article><strong>{guestMembers}</strong><span>Total guests</span></article>
            <article><strong>{guestCheckedIn}</strong><span>Checked in</span></article>
          </div>
        </section>
        <section className="admin-dashboard-hero-grid">
          <article><UsersRound size={24} /><span>Guests</span><strong>{guestRows.length}</strong></article>
          <article><CalendarDays size={24} /><span>Members</span><strong>{guestMembers}</strong></article>
          <article><ReceiptText size={24} /><span>Pending</span><strong>{Math.max(0, guestRows.length - guestCheckedIn)}</strong></article>
          <article><HandCoins size={24} /><span>Amount</span><strong>${guestAmount.toLocaleString()}</strong></article>
        </section>
        <form className="admin-create-form" onSubmit={handleGuestRegistrationSubmit}>
          <h2>Register guest</h2>
          <div className="admin-form-grid">
            <label>Name <input name="name" required /></label>
            <label>Email <input name="email" type="email" required /></label>
            <label>Phone number <input name="phone" /></label>
            <label>Family member <input name="familyMember" /></label>
            <label>Program <select name="program" defaultValue={selectedCheckinEvent.title || ''}>{eventOptions.map((item) => <option key={item.title}>{item.title}</option>)}</select></label>
            <label>Event id <input name="eventId" defaultValue={expectedEventId} /></label>
            <label>Adults <input name="adults" type="number" min="0" defaultValue="1" /></label>
            <label>Kids (6-12) <input name="kids" type="number" min="0" defaultValue="0" /></label>
            <label>Kids (5 and below) <input name="youngKids" type="number" min="0" defaultValue="0" /></label>
            <label>Amount <input name="amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
          </div>
          <button className="button primary" type="submit">Save Guest Registration</button>
        </form>
        <AdminTable
          title="Guest registrations"
          rows={guestRows}
          emptyText="No guest registrations yet."
          columns={[
            { key: 'createdAt', label: 'Registered on' },
            { key: 'parentName', label: 'Guest name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone number' },
            { key: 'program', label: 'Program' },
            { key: 'totalMembers', label: 'Members' },
            { key: 'status', label: 'Status' },
            { key: 'action', label: 'Action', render: (row, index) => {
              const checked = checkedInIds.includes(getRegistrationKey(row, index)) || row.checkedIn;
              return checked ? <span className="confirmed-badge">Checked</span> : <button className="checkin-action-button" type="button" onClick={() => markCheckedIn(row, index)}>Checkin</button>;
            } }
          ]}
        />
      </>
    );
  }

  if (view === 'seats') {
    const inferredSeatRows = registrations
      .filter((row) => row.seats || row.totalMembers)
      .map((row) => ({
        eventId: row.eventId,
        program: row.program,
        seatNumber: row.seatNumber || row.seats || '-',
        assignedTo: row.familyMember || row.studentName || row.parentName || '-',
        email: row.email,
        status: row.checkedIn ? 'Checked in' : row.status || 'Registered'
      }));
    const seatRows = seatRecords.length ? seatRecords.map((seat) => ({
      eventId: seat.event_id || seat.eventId,
      program: registrations.find((row) => row.id === seat.registration_id)?.program || '-',
      seatNumber: seat.seat_number || seat.seatNumber,
      assignedTo: seat.assigned_to || seat.assignedTo || '-',
      email: registrations.find((row) => row.id === seat.registration_id)?.email || '-',
      status: seat.status || 'Available'
    })) : inferredSeatRows;
    const assignedSeats = seatRows.filter((seat) => seat.assignedTo && seat.assignedTo !== '-').length;
    const checkedInSeats = seatRows.filter((seat) => /checked/i.test(seat.status || '')).length;
    const availableSeats = Math.max(0, seatRows.length - assignedSeats);
    const occupancyRate = seatRows.length ? Math.round((assignedSeats / seatRows.length) * 100) : 0;
    const seatPrograms = summarizeBy(seatRows, 'program', 4);
    return (
      <>
        <PageHeader root="Reception" area="Seats" title="Seat management" />
        <section className="workflow-hero seat-hero">
          <div>
            <p className="eyebrow">Seat operations</p>
            <h2>{occupancyRate}% occupied</h2>
            <p>Monitor assigned, available, and checked-in seats for the selected event. Use the map for quick visual scanning.</p>
          </div>
          <div className="seat-occupancy-ring" aria-label={`${occupancyRate}% occupied`}>
            <span style={{ '--seat-progress': `${occupancyRate}%` }} />
            <strong>{occupancyRate}%</strong>
          </div>
        </section>
        <section className="admin-dashboard-hero-grid">
          <article><UsersRound size={24} /><span>Total seats</span><strong>{seatRows.length}</strong></article>
          <article><CalendarDays size={24} /><span>Assigned</span><strong>{assignedSeats}</strong></article>
          <article><ReceiptText size={24} /><span>Available</span><strong>{availableSeats}</strong></article>
          <article><Megaphone size={24} /><span>Checked in</span><strong>{checkedInSeats}</strong></article>
        </section>
        <section className="seat-analytics-grid">
          <article className="seat-map-card">
            <div className="panel-mini-heading">
              <span>Seat map</span>
              <strong>{seatRows.length || 0} seats</strong>
            </div>
            <div className="seat-map">
              {(seatRows.length ? seatRows : Array.from({ length: 24 }, (_, index) => ({ seatNumber: index + 1, status: 'Available', assignedTo: '-' }))).slice(0, 80).map((seat, index) => {
                const occupied = seat.assignedTo && seat.assignedTo !== '-';
                const checked = /checked/i.test(seat.status || '');
                return (
                  <span
                    key={`${seat.seatNumber || index}-${index}`}
                    className={checked ? 'seat-dot is-checked' : occupied ? 'seat-dot is-assigned' : 'seat-dot'}
                    title={`${seat.seatNumber || index + 1}: ${seat.status || 'Available'}`}
                  >
                    {seat.seatNumber || index + 1}
                  </span>
                );
              })}
            </div>
          </article>
          <article className="seat-program-card">
            <div className="panel-mini-heading">
              <span>Program distribution</span>
              <strong>{seatPrograms.length}</strong>
            </div>
            {seatPrograms.length ? seatPrograms.map((program) => (
              <div className="program-progress-row" key={program.label}>
                <strong>{program.label}</strong>
                <div className="progress-track"><span style={{ width: `${Math.min(100, (program.count / Math.max(1, seatRows.length)) * 100)}%` }} /></div>
                <small>{program.count} seat(s)</small>
              </div>
            )) : <p className="profile-helper">No seat assignments yet.</p>}
          </article>
        </section>
        <form className="admin-create-form" onSubmit={handleSeatSubmit}>
          <h2>Add or assign seat</h2>
          <div className="admin-form-grid">
            <label>Event id <input name="eventId" defaultValue={expectedEventId} required /></label>
            <label>Seat number <input name="seatNumber" required /></label>
            <label>Registration <select name="registrationId" defaultValue=""><option value="">Available seat</option>{registrations.map((row) => <option key={row.id || getRegistrationKey(row)} value={row.id || ''}>{row.program} - {row.familyMember || row.studentName || row.parentName}</option>)}</select></label>
            <label>Assigned to <input name="assignedTo" /></label>
          </div>
          <button className="button primary" type="submit">Save Seat</button>
          {seatError && <p className="form-error">{seatError}</p>}
        </form>
        <AdminTable
          title="Seat and registration summary"
          rows={seatRows}
          emptyText="No seat records yet."
          columns={[
            { key: 'eventId', label: 'Event ID' },
            { key: 'program', label: 'Program' },
            { key: 'seatNumber', label: 'Seat' },
            { key: 'assignedTo', label: 'Assigned to' },
            { key: 'email', label: 'Registered by' },
            { key: 'status', label: 'Status' }
          ]}
        />
      </>
    );
  }

  if (view === 'teacher') {
    const classRows = registrations.filter((row) => row.registrationType === 'class' || programs.some((program) => program.title === row.program));
    const confirmedClassRows = statusCount(classRows, (status) => status.includes('confirmed'));
    const paidClassRows = classRows.filter(isPaidRegistration).length;
    const classGroups = summarizeBy(classRows, 'program', 6);
    const totalStudents = classRows.length;
    return (
      <>
        <PageHeader root="Teacher" area="Class Area" title="Teacher class area" />
        <section className="workflow-hero teacher-hero">
          <div>
            <p className="eyebrow">Teacher workspace</p>
            <h2>Class roster and readiness</h2>
            <p>Review enrolled students, confirmation status, payment readiness, and family contact details before class.</p>
          </div>
          <div className="workflow-action-list">
            <article><strong>{totalStudents}</strong><span>Students</span></article>
            <article><strong>{confirmedClassRows}</strong><span>Confirmed</span></article>
            <article><strong>{paidClassRows}</strong><span>Paid</span></article>
          </div>
        </section>
        <section className="class-roster-grid">
          {classGroups.length ? classGroups.map((group) => {
            const confirmed = statusCount(group.rows, (status) => status.includes('confirmed'));
            const paid = group.rows.filter(isPaidRegistration).length;
            return (
              <article key={group.label}>
                <div className="panel-mini-heading">
                  <span>{group.label}</span>
                  <strong>{group.count}</strong>
                </div>
                <div className="roster-meta">
                  <span>{confirmed} confirmed</span>
                  <span>{paid} paid</span>
                </div>
                <div className="progress-track"><span style={{ width: `${Math.min(100, (confirmed / Math.max(1, group.count)) * 100)}%` }} /></div>
              </article>
            );
          }) : <article><strong>No class registrations yet.</strong><p>Student rosters will appear here after members register for classes.</p></article>}
        </section>
        <AdminTable
          title="Class registrations"
          rows={classRows}
          emptyText="No class registrations yet."
          filters={[{ key: 'program', label: 'Class', options: uniqueOptions(registrations, 'program') }]}
          columns={[
            { key: 'program', label: 'Class' },
            { key: 'familyMember', label: 'Student', render: (row) => row.familyMember || row.studentName || '-' },
            { key: 'email', label: 'Registered by' },
            { key: 'phone', label: 'Phone number' },
            { key: 'birthYear', label: 'BirthYear' },
            { key: 'status', label: 'Status' },
            { key: 'paid', label: 'Paid', render: (row) => row.paid ? 'Yes' : 'No' },
            { key: 'details', label: 'Details', render: (row) => <button className="mini-action-link secondary" type="button" onClick={() => setRegistrationDetail(row)}>View details</button> }
          ]}
        />
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  if (view === 'treasurer') {
    const expenseStatus = getExpenseStatus(expenses);
    const submittedAmount = expenses
      .filter((row) => String(row.status || '').toLowerCase().includes('submitted'))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const approvedAmount = expenses
      .filter((row) => String(row.status || '').toLowerCase().includes('approved'))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const paidAmount = expenses
      .filter((row) => String(row.status || '').toLowerCase().includes('paid'))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalExpenseAmount = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expenseCategories = summarizeBy(expenses, 'category', 5);
    return (
      <>
        <PageHeader root="Treasurer" area="Expense Review" title="Treasurer expense workflow" />
        <section className="workflow-hero treasurer-hero">
          <div>
            <p className="eyebrow">Treasurer queue</p>
            <h2>${(submittedAmount + approvedAmount).toLocaleString()} awaiting payment flow</h2>
            <p>Review submitted expenses, approve reimbursements, mark paid items, and watch category-level spend.</p>
          </div>
          <div className="workflow-action-list">
            <article><strong>{expenseStatus.submitted}</strong><span>Submitted</span></article>
            <article><strong>{expenseStatus.approved}</strong><span>Approved</span></article>
            <article><strong>{expenseStatus.paid}</strong><span>Paid</span></article>
          </div>
        </section>
        <section className="admin-dashboard-hero-grid">
          <article><ReceiptText size={24} /><span>Total expenses</span><strong>{expenses.length}</strong></article>
          <article><HandCoins size={24} /><span>Submitted</span><strong>${submittedAmount.toLocaleString()}</strong></article>
          <article><CalendarDays size={24} /><span>Approved</span><strong>${approvedAmount.toLocaleString()}</strong></article>
          <article><UsersRound size={24} /><span>Paid</span><strong>${paidAmount.toLocaleString()}</strong></article>
        </section>
        <section className="finance-insight-grid">
          <article>
            <div className="panel-mini-heading">
              <span>Workflow status</span>
              <strong>${totalExpenseAmount.toLocaleString()}</strong>
            </div>
            {[
              ['Submitted', expenseStatus.submitted],
              ['Approved', expenseStatus.approved],
              ['Paid', expenseStatus.paid],
              ['Rejected', expenseStatus.rejected]
            ].map(([label, count]) => (
              <div className="program-progress-row" key={label}>
                <strong>{label}</strong>
                <div className="progress-track"><span style={{ width: `${Math.min(100, (count / Math.max(1, expenses.length)) * 100)}%` }} /></div>
                <small>{count} item(s)</small>
              </div>
            ))}
          </article>
          <article>
            <div className="panel-mini-heading">
              <span>Category spend</span>
              <strong>{expenseCategories.length}</strong>
            </div>
            {expenseCategories.length ? expenseCategories.map((category) => (
              <div className="program-progress-row" key={category.label}>
                <strong>{category.label}</strong>
                <div className="progress-track"><span style={{ width: `${Math.min(100, (category.amount / Math.max(1, totalExpenseAmount)) * 100)}%` }} /></div>
                <small>${category.amount.toLocaleString()} across {category.count} item(s)</small>
              </div>
            )) : <p className="profile-helper">No expenses submitted yet.</p>}
          </article>
        </section>
        <AdminTable
          title="Expense review"
          rows={expenses}
          emptyText="No expense submissions yet."
          filters={[{ key: 'status', label: 'Status', options: uniqueOptions(expenses, 'status') }]}
          columns={[
            { key: 'createdAt', label: 'Created on' },
            { key: 'title', label: 'Title' },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` },
            { key: 'submittedBy', label: 'Submitted by' },
            { key: 'status', label: 'Status' },
            { key: 'approvedBy', label: 'Reviewed by' },
            { key: 'action', label: 'Action', render: (row) => (
              <div className="admin-row-actions">
                <button className="mini-action-link success" type="button" onClick={() => runExpenseAction(row, 'approve', 'Approved')}>Approve</button>
                <button className="mini-action-link success" type="button" onClick={() => runExpenseAction(row, 'paid', 'Paid')}>Paid</button>
                <button className="mini-action-link danger" type="button" onClick={() => runExpenseAction(row, 'reject', 'Rejected')}>Reject</button>
                <button className="mini-action-link secondary" type="button" onClick={() => runExpenseAction(row, 'reset', 'Submitted')}>Reset</button>
              </div>
            ) }
          ]}
        />
      </>
    );
  }

  if (view === 'user-search') {
    return (
      <>
        <PageHeader area="User" title="Find user by email" />
        <form className="admin-create-form compact-admin-form" onSubmit={handleUserSearch}>
          <div className="admin-form-grid">
            <label>Email <input name="email" type="email" placeholder="member@example.com" required /></label>
          </div>
          <button className="button primary" type="submit">Find User</button>
          {userSearchError && <p className="form-error">{userSearchError}</p>}
        </form>
        {userSearchResult && (
          <AdminTable
            title="User result"
            rows={[userSearchResult]}
            columns={[
              { key: 'createdAt', label: 'Created on' },
              { key: 'email', label: 'Email' },
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Phone number' },
              { key: 'role', label: 'Role' },
              { key: 'registrationCount', label: 'Registrations', render: (row) => row.registrations?.length || 0 },
              { key: 'details', label: 'Details', render: (row) => <button className="mini-action-link secondary" type="button" onClick={() => setRegistrationDetail(row)}>View details</button> }
            ]}
          />
        )}
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  if (view === 'email-outbox') {
    return (
      <>
        <PageHeader area="Email Outbox" title="Queued emails" />
        <AdminTable
          title="Email outbox"
          rows={emailOutbox}
          emptyText="No emails queued yet."
          filters={[{ key: 'status', label: 'Status', options: uniqueOptions(emailOutbox, 'status') }]}
          columns={[
            { key: 'created_at', label: 'Created on', render: (row) => row.created_at || row.createdAt || '-' },
            { key: 'to_email', label: 'To', render: (row) => row.to_email || row.toEmail || '-' },
            { key: 'subject', label: 'Subject' },
            { key: 'template', label: 'Template' },
            { key: 'status', label: 'Status' },
            { key: 'sent_at', label: 'Sent on', render: (row) => row.sent_at || row.sentAt || '-' },
            { key: 'action', label: 'Action', render: (row) => <button className="mini-action-link success" type="button" onClick={() => resendOutboxEmail(row)}>Send</button> }
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

  if (view === 'developer') {
    const localKeys = Object.keys(localStorage || {}).filter((key) => key.startsWith('kb-')).sort();
    const tableCounts = [
      ['Users', users.length],
      ['Registrations', registrations.length],
      ['Classes', programs.length],
      ['Events', allEvents.length],
      ['Donations', donations.length],
      ['Expenses', expenses.length],
      ['Announcements', announcements.length],
      ['Email outbox', emailOutbox.length]
    ];
    return (
      <>
        <PageHeader area="Developer" title="Admin developer tools" />
        <section className="admin-dashboard-hero-grid">
          {tableCounts.slice(0, 4).map(([label, count]) => (
            <article key={label}><ReceiptText size={24} /><span>{label}</span><strong>{count}</strong></article>
          ))}
        </section>
        <section className="admin-page-panel">
          <div className="admin-page-panel-heading"><h2>System diagnostics</h2><span>{tableCounts.reduce((sum, [, count]) => sum + count, 0)}</span></div>
          <div className="detail-popup-grid">
            {tableCounts.map(([label, count]) => <article key={label}><span>{label}</span><strong>{count}</strong></article>)}
            <article><span>API mode</span><strong>{import.meta.env.VITE_API_URL ? 'Configured API URL' : 'Default /api proxy'}</strong></article>
            <article><span>Google login</span><strong>{import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'Configured' : 'Missing client id'}</strong></article>
            <article><span>reCAPTCHA</span><strong>{import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ? 'Configured' : 'Local fallback'}</strong></article>
          </div>
        </section>
        <AdminTable
          title="Local cache keys"
          rows={localKeys.map((key) => ({ key, size: String(localStorage.getItem(key) || '').length }))}
          emptyText="No local Kannada Bharati cache keys found."
          columns={[
            { key: 'key', label: 'Key' },
            { key: 'size', label: 'Stored characters' }
          ]}
        />
      </>
    );
  }

  if (view === 'users') {
    return (
      <>
        <PageHeader area="User" title="Manage users" />
        <AdminTable
          title="Users"
          rows={registeredUsers}
          emptyText="No registered users yet."
          filters={[{ key: 'role', label: 'Roles', options: uniqueOptions(registeredUsers, 'role') }]}
          columns={[
            { key: 'createdAt', label: 'Created on' },
            { key: 'email', label: 'Email' },
            { key: 'firstName', label: 'First name' },
            { key: 'lastName', label: 'Last name' },
            { key: 'phone', label: 'Phone number' },
            { key: 'registrationCount', label: 'Registrations' },
            {
              key: 'defaulter',
              label: 'Defaulter',
              render: (row) => (
                <button
                  className={`mini-action-link ${row.isVolunteeringDefaulter ? 'danger' : 'secondary'}`}
                  type="button"
                  onClick={() => updateUser(row, {
                    isVolunteeringDefaulter: !row.isVolunteeringDefaulter,
                    defaulterNotes: row.isVolunteeringDefaulter ? '' : 'Marked from admin user list'
                  })}
                >
                  {row.isVolunteeringDefaulter ? 'Clear' : 'Mark'}
                </button>
              )
            },
            {
              key: 'role',
              label: 'Role',
              render: (row) => (
                <select
                  className="inline-admin-select"
                  value={row.role || 'member'}
                  onChange={(event) => updateUser(row, { role: event.target.value, roles: [event.target.value] })}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">SuperAdmin</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="teacher">Teacher</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="treasurer">Treasurer</option>
                </select>
              )
            },
            { key: 'emailConfirmed', label: 'Email confirmed', render: (row) => row.emailConfirmed ? 'Yes' : 'No' },
            { key: 'twoFactorEnabled', label: '2FA', render: (row) => row.twoFactorEnabled ? 'On' : 'Off' },
            {
              key: 'enabled',
              label: 'Enabled',
              render: (row) => (
                <button
                  className={`mini-action-link ${row.enabled === false ? 'secondary' : 'success'}`}
                  type="button"
                  onClick={() => updateUser(row, { enabled: row.enabled === false })}
                >
                  {row.enabled === false ? 'Enable' : 'Disable'}
                </button>
              )
            },
            { key: 'details', label: 'Details', render: (row) => <button className="mini-action-link secondary" type="button" onClick={() => setRegistrationDetail(row)}>View details</button> }
          ]}
        />
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  const dashboardRows = [...programs.slice(0, 4), ...allEvents.slice(0, 3)];

  return (
    <>
      <PageHeader area="Dashboard" title="Member dashboard" />
      <section className="admin-dashboard-hero-grid">
        <article><UsersRound size={24} /><span>My registrations</span><strong>{userRegistrations.length}</strong></article>
        <article><CalendarDays size={24} /><span>My classes</span><strong>{userClassRegistrations.length}</strong></article>
        <article><ReceiptText size={24} /><span>My events</span><strong>{userEventRegistrations.length}</strong></article>
        <article><Megaphone size={24} /><span>Announcements</span><strong>{announcements.length}</strong></article>
      </section>
      <section className="admin-page-panel member-dashboard-profile">
        <div className="admin-page-panel-heading"><h2>My information</h2><a className="mini-action-link secondary" href="/admin/profile">Update profile</a></div>
        <div className="detail-popup-grid">
          <article><span>Name</span><strong>{[profile.firstName || user.firstName || user.name, profile.lastName || user.lastName].filter(Boolean).join(' ') || user.email}</strong></article>
          <article><span>Email</span><strong>{user.email}</strong></article>
          <article><span>Phone</span><strong>{profile.phone || user.phone || '-'}</strong></article>
          <article><span>Company</span><strong>{profile.company || '-'}</strong></article>
          <article><span>Spouse</span><strong>{[profile.spouseFirstName, profile.spouseLastName].filter(Boolean).join(' ') || '-'}</strong></article>
          <article><span>Children</span><strong>{profileChildren.length}</strong></article>
        </div>
      </section>
      {isAdmin(user) && (
        <section className="admin-dashboard-hero-grid">
          <article><UsersRound size={24} /><span>All registrations</span><strong>{registrations.length}</strong></article>
        <article><CalendarDays size={24} /><span>Current Events</span><strong>{allEvents.length}</strong></article>
        <article><ReceiptText size={24} /><span>Expenses</span><strong>{expenses.length}</strong></article>
          <article><Megaphone size={24} /><span>Announcements</span><strong>{announcements.length}</strong></article>
        </section>
      )}
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
      <AdminTable
        title="My class registrations"
        rows={userClassRegistrations}
        emptyText="You have not registered for any classes yet."
        columns={[
          { key: 'createdAt', label: 'Registered on' },
          { key: 'program', label: 'Class' },
          { key: 'familyMember', label: 'Member', render: (row) => row.familyMember || row.studentName || '-' },
          { key: 'status', label: 'Status' },
          { key: 'paid', label: 'Paid', render: (row) => row.paid ? 'Yes' : 'No' },
          { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` }
        ]}
      />
      <AdminTable
        title="My event registrations"
        rows={userEventRegistrations}
        emptyText="You have not registered for any events yet."
        columns={[
          { key: 'createdAt', label: 'Registered on' },
          { key: 'program', label: 'Event' },
          { key: 'familyMember', label: 'Member', render: (row) => row.familyMember || row.studentName || '-' },
          { key: 'status', label: 'Status' },
          { key: 'paid', label: 'Paid', render: (row) => row.paid ? 'Yes' : 'No' },
          { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` }
        ]}
      />
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
