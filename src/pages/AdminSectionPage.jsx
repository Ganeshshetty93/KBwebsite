import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { BookOpen, Building2, CalendarDays, CheckCircle, ChevronRight, Clock3, CloudUpload, Copy, CreditCard, Download, Edit3, ExternalLink, Eye, FileSpreadsheet, FileText, GraduationCap, HandCoins, ImagePlus, ListChecks, Mail, MapPin, Megaphone, MoreHorizontal, Phone, Plus, Printer, ReceiptText, RefreshCw, Save, Search, Send, Trash2, UserRound, UserPlus, UsersRound, X } from 'lucide-react';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import ContentSettingsNav, { contentSettingsTitles } from '../components/ContentSettingsNav.jsx';
import DatePicker from '../components/DatePicker.jsx';
import ModalTitle from '../components/ModalTitle.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { culturalClasses, events, paataShaaleLevels } from '../data/siteData.js';
import { adminPageCatalog, appendAdminRecordAsync, appendRecord, builtInAssignableRoles, canAccessAdminPath, defaultAdminPath, getAllowedFieldKeysForPath, getAssignableRoles, getCurrentUser, hasAnyRole, isAdmin, normalizeRoleId, readJson, setCurrentUser, writeJson } from '../utils/storage.js';
import { defaultAboutContent, normalizeAboutContent } from '../utils/aboutContent.js';
import { defaultPaataTeachers, normalizePaataTeachers } from '../utils/paataTeachers.js';
import {
  apiAdminDashboard,
  apiAppendRecord,
  apiCreateSeat,
  apiDeleteSubmission,
  apiExpenseAction,
  apiFindUserByEmail,
  apiLookupUserPhone,
  apiReadAboutContent,
  apiWelcomeDeskCheckIn,
  apiReadSeats,
  apiReadSiteSetting,
  apiRegistrationAction,
  apiSaveAttendance,
  apiSaveAboutContent,
  apiSaveSiteSetting,
  apiSendBulkEmail,
  apiSendOutboxEmail,
  apiSendTestEmail,
  apiUploadFile,
  apiUpdateSeat,
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

const sampleFindUsers = [
  {
    id: 'sample-member',
    createdAt: '2026-01-14',
    email: 'member@example.com',
    name: 'Ganesh Shetty',
    phone: '(408) 555-0123',
    role: 'Member',
    children: [
      { id: 'sample-child-1', name: 'Arjun Shetty', phone: '(408) 555-0198', classLevel: 'Class 2' },
      { id: 'sample-child-2', name: 'Sneha Shetty', phone: '(408) 555-0156', classLevel: 'Class 5' }
    ],
    registrations: [
      { id: 'sample-registration-1', registeredOn: '2026-03-15', registrationType: 'Event', program: 'Ugadi Celebration', status: 'Confirmed' },
      { id: 'sample-registration-2', registeredOn: '2026-04-05', registrationType: 'Class', program: 'Kannada Koota', status: 'Confirmed' }
    ]
  },
  {
    id: 'sample-teacher',
    createdAt: '2026-02-02',
    email: 'priya@example.com',
    name: 'Priya Kulkarni',
    phone: '(408) 555-0456',
    role: 'Teacher',
    children: [],
    registrations: [{ id: 'sample-registration-3' }, { id: 'sample-registration-4' }, { id: 'sample-registration-5' }]
  },
  {
    id: 'sample-volunteer',
    createdAt: '2026-01-28',
    email: 'rohan@example.com',
    name: 'Rohan Kulkarni',
    phone: '(510) 555-0789',
    role: 'Volunteer',
    children: [],
    registrations: [{ id: 'sample-registration-6' }]
  }
];

const sampleStudentView = {
  profile: {
    id: 'KB00125',
    name: 'Aarav Sinha',
    birthDate: 'Mar 14, 2010',
    email: 'aarav.sinha@example.com',
    phone: '(408) 555-0136',
    address: '123 Maple Ave\nSan Jose, CA 95129',
    parentName: 'Suresh Sinha',
    parentEmail: 'suresh.sinha@example.com',
    parentPhone: '(408) 555-0179'
  },
  family: [
    { name: 'Aarav Sinha', level: 'Level 2', initials: 'AS', tone: 'blue' },
    { name: 'Priya Sinha', level: 'Level 3', initials: 'PK', tone: 'pink' },
    { name: 'Sai Sinha', level: 'Level 1', initials: 'SS', tone: 'blue' }
  ],
  classRegistrations: [
    { id: 'sample-class-1', studentName: 'Aarav Sinha', program: 'Level 2', term: 'Spring 2026', programDates: 'Jan 10, 2026 – May 16, 2026', amount: 280, status: 'Confirmed', registrationType: 'class' },
    { id: 'sample-class-2', studentName: 'Aarav Sinha', program: 'Conversational Kannada', term: 'Spring 2026', programDates: 'Jan 10, 2026 – May 16, 2026', amount: 280, status: 'Confirmed', registrationType: 'class' },
    { id: 'sample-class-3', studentName: 'Aarav Sinha', program: 'Cultural Arts (Dance)', term: 'Spring 2026', programDates: 'Feb 07, 2026 – May 16, 2026', amount: 120, status: 'Pending', registrationType: 'class' }
  ],
  eventRegistrations: [
    { id: 'sample-event-1', studentName: 'Aarav Sinha', program: 'Ugadi Celebration', date: 'Mar 15, 2026', location: 'Community Center', amount: 30, status: 'Confirmed', registrationType: 'event' },
    { id: 'sample-event-2', studentName: 'Aarav Sinha', program: 'Summer Camp 2026', date: 'Jun 08, 2026 – Jun 12, 2026', location: 'KB School', amount: 250, status: 'Confirmed', registrationType: 'event' },
    { id: 'sample-event-3', studentName: 'Aarav Sinha', program: 'Sahitya Vaachana', date: 'May 10, 2026', location: 'Community Center', amount: 10, status: 'Confirmed', registrationType: 'event' }
  ],
  availablePrograms: [
    { id: 'sample-program-1', title: 'Level 3', type: 'Kannada Class', level: 'Level 3', schedule: 'Jan 10, 2026 – May 16, 2026', fee: 280 },
    { id: 'sample-program-2', title: 'Advanced Reading', type: 'Kannada Class', level: 'Level 3+', schedule: 'Jan 10, 2026 – May 16, 2026', fee: 280 },
    { id: 'sample-program-3', title: 'Folk Arts Workshop', type: 'Special Program', level: 'All Levels', schedule: 'Feb 07, 2026 – Apr 11, 2026', fee: 120 }
  ]
};

const eventTypeDescriptions = {
  Classroom: 'Kannada class registration and classroom programs',
  Festival: 'Cultural celebration with performances and activities',
  Workshop: 'Learning sessions and hands-on activities',
  Competition: 'Contests and talent showcases',
  Seminar: 'Community learning sessions and presentations',
  Cultural: 'Cultural programs, performances and celebrations'
};

const recurrenceDescriptions = {
  OneTime: 'Occurs once on a specific date',
  Daily: 'Repeats every day',
  Weekly: 'Repeats every week on selected day(s)',
  Monthly: 'Repeats every month on selected day(s)',
  Yearly: 'Repeats every year on selected date'
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function validateReceiptFile(file) {
  if (!file || file.size === 0) return '';
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) return 'Receipt must be a PDF, JPG, or PNG file.';
  if (file.size > 8 * 1024 * 1024) return 'Receipt file must be 8 MB or smaller.';
  return '';
}

function formatFileSize(size = 0) {
  const bytes = Number(size || 0);
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateShort(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function getInitials(value = '') {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'KB';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function normalizeRoleDefinitions(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((role) => ({
    id: normalizeRoleId(role.id || role.name),
    name: cleanText(role.name || role.id),
    description: cleanText(role.description),
    pages: Array.isArray(role.pages) ? role.pages.filter(Boolean) : [],
    fields: role.fields && typeof role.fields === 'object' ? role.fields : {}
  })).filter((role) => role.id && role.name);
}

function normalizeTeacherAllotments(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id || `allotment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    classTitle: cleanText(row.classTitle || row.class_title || row.program),
    teacherEmail: cleanText(row.teacherEmail || row.teacher_email).toLowerCase(),
    teacherName: cleanText(row.teacherName || row.teacher_name),
    notes: cleanText(row.notes),
    enabled: row.enabled !== false
  })).filter((row) => row.classTitle && row.teacherEmail);
}

function cloneEventPayload(row = {}) {
  const suffix = new Date().getFullYear() + 1;
  const nextUrlKey = `${row.urlKey || row.url_key || row.title || 'event'}-${suffix}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return {
    ...row,
    id: undefined,
    createdAt: undefined,
    created_at: undefined,
    eventId: row.eventId ? `${row.eventId}-copy` : '',
    urlKey: nextUrlKey,
    title: `${row.title || 'Event'} Copy`,
    startOn: '',
    endOn: '',
    month: '',
    enabled: false
  };
}

function cloneClassPayload(row = {}) {
  return {
    ...row,
    id: undefined,
    createdAt: undefined,
    created_at: undefined,
    title: `${row.title || 'Class'} Copy`,
    date: '',
    time: '',
    status: 'Draft'
  };
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

function AdminTable({ title, rows, columns, filters = [], emptyText = 'No records yet.', action, pageSize = 10 }) {
  const { tr } = useLanguage();
  const location = useLocation();
  const allowedFieldKeys = getAllowedFieldKeysForPath(getCurrentUser(), location.pathname);
  const visibleColumns = useMemo(() => {
    const permittedColumns = !allowedFieldKeys ? columns : columns.filter((column) => {
      const allowed = allowedFieldKeys.map((field) => String(field).toLowerCase());
      return (
        allowed.includes(String(column.key || '').toLowerCase())
        || allowed.includes(String(column.label || '').toLowerCase())
      );
    });
    return permittedColumns.slice().sort((left, right) => {
      const leftIsAction = ['action', 'actions'].includes(String(left.key || '').toLowerCase());
      const rightIsAction = ['action', 'actions'].includes(String(right.key || '').toLowerCase());
      return Number(leftIsAction) - Number(rightIsAction);
    });
  }, [allowedFieldKeys, columns]);
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [exportOpen, setExportOpen] = useState(false);
  const visibleRows = useMemo(() => rows.filter((row) => {
    const text = Object.values(row).join(' ').toLowerCase();
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesFilters = filters.every((filter) => {
      const selected = activeFilters[filter.key] || 'All';
      return selected === 'All' || String(row[filter.key] || '') === selected;
    });
    return matchesQuery && matchesFilters;
  }), [activeFilters, filters, query, rows]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pagedRows = visibleRows.slice(pageStart, pageStart + rowsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((number) => number === 1 || number === totalPages || Math.abs(number - currentPage) <= 1);
  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'table';
  const renderValue = (value, column = {}) => {
    if (value === null || value === undefined || value === '') return '-';
    const normalizedKey = String(column.key || '').toLowerCase();
    const isStatusField = normalizedKey.endsWith('status') || ['payment', 'paid', 'enabled', 'email_status'].includes(normalizedKey);
    if (isStatusField && ['string', 'number', 'boolean'].includes(typeof value)) {
      const label = tr(String(value));
      const normalizedValue = String(value).toLowerCase();
      const tone = /failed|rejected|deleted|disabled|inactive|not paid|^no$|error/.test(normalizedValue)
        ? 'danger'
        : /pending|queued|waiting|review|not checked|submitted/.test(normalizedValue)
          ? 'warning'
          : /paid|confirmed|active|enabled|approved|sent|healthy|available|connected|checked|^yes$/.test(normalizedValue)
            ? 'success'
            : 'info';
      return (
        <span className={`admin-status-pill is-${tone}`}>
          {tone === 'success' && <CheckCircle size={16} />}
          {tone === 'warning' && <Clock3 size={16} />}
          {tone === 'danger' && <X size={16} />}
          {tone === 'info' && <i />}
          {label}
        </span>
      );
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return tr(value);
    return value;
  };

  useEffect(() => {
    setPage(1);
  }, [activeFilters, query, rows]);

  async function handleCopy() {
    const text = makeCsv(visibleRows, visibleColumns);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      downloadFile(`${filename}.txt`, text, 'text/plain;charset=utf-8');
    }
  }

  const exportActions = [
    { label: 'Copy to clipboard', icon: <Copy size={16} />, onClick: handleCopy },
    { label: 'CSV', icon: <FileText size={16} />, onClick: () => downloadFile(`${filename}.csv`, makeCsv(visibleRows, visibleColumns), 'text/csv;charset=utf-8') },
    { label: 'Excel', icon: <FileSpreadsheet size={16} />, onClick: () => downloadFile(`${filename}.xls`, makeHtmlTable(title, visibleRows, visibleColumns), 'application/vnd.ms-excel;charset=utf-8') },
    { label: 'PDF', icon: <ReceiptText size={16} />, onClick: () => openPrintableTable(title, visibleRows, visibleColumns) },
    { label: 'Print', icon: <Printer size={16} />, onClick: () => openPrintableTable(title, visibleRows, visibleColumns) }
  ];

  return (
    <section className="admin-page-panel">
      <div className="admin-page-panel-heading">
        <h2>{tr(title)}</h2>
        <div>
          {action}
          <span>{visibleRows.length}</span>
        </div>
      </div>
      <div className="admin-table-toolbar">
        <label className="admin-table-search-control">
          <span>{tr('Search')}</span>
          <div><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr('Search records...')} /></div>
        </label>
        {filters.map((filter) => (
          <label className="admin-table-filter-control" key={filter.key}>
            <span>{tr(filter.label)}</span>
            <select value={activeFilters[filter.key] || 'All'} onChange={(event) => setActiveFilters((current) => ({ ...current, [filter.key]: event.target.value }))}>
              <option value="All">{filter.key === 'status' ? tr('All statuses') : tr('All')}</option>
              {filter.options.map((option) => <option key={option} value={option}>{tr(option)}</option>)}
            </select>
          </label>
        ))}
        <div className="admin-table-export-menu">
          <button className="admin-table-export-trigger" type="button" onClick={() => setExportOpen((value) => !value)} aria-expanded={exportOpen}>
            <Download size={21} /> {tr('Export')} <ChevronRight size={18} />
          </button>
          {exportOpen && (
            <div className="admin-table-export-dropdown">
              {exportActions.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setExportOpen(false);
                  }}
                >
                  <span className={`export-icon-tone export-icon-tone-${index + 1}`}>{item.icon}</span>
                  {tr(item.label)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="admin-table-filter-note">
        {tr('Filters apply to the current table.')}
      </div>
      <div className="table-scroll admin-data-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>{visibleColumns.map((column) => <th key={column.key} data-column={column.key}>{tr(column.label)}</th>)}</tr>
          </thead>
          <tbody>
            {pagedRows.length ? pagedRows.map((row, index) => (
              <tr key={`${row.id || row.email || row.title || row.text || pageStart + index}-${pageStart + index}`}>
                {visibleColumns.map((column) => <td key={column.key} data-column={column.key}>{column.render ? column.render(row, pageStart + index) : renderValue(row[column.key], column)}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={visibleColumns.length || 1}>{tr(visibleColumns.length ? emptyText : 'No fields are enabled for this role.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {visibleRows.length > rowsPerPage && (
        <div className="admin-pagination" aria-label={`${title} pagination`}>
          <span>
            {tr('Showing')} {pageStart + 1}-{Math.min(pageStart + rowsPerPage, visibleRows.length)} {tr('of')} {visibleRows.length}
          </span>
          <label>
            {tr('Rows per page')}
            <select value={rowsPerPage} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(1); }}>
              {[10, 25, 50].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div>
            <button type="button" aria-label={tr('Previous')} onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>‹</button>
            {pageNumbers.map((number, index) => (
              <span key={number}>
                {index > 0 && number - pageNumbers[index - 1] > 1 ? <i>…</i> : null}
                <button className={number === currentPage ? 'is-active' : ''} type="button" onClick={() => setPage(number)}>{number}</button>
              </span>
            ))}
            <button type="button" aria-label={tr('Next')} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>›</button>
          </div>
        </div>
      )}
    </section>
  );
}

function PageHeader({ root = 'Admin', area, title, action }) {
  const { tr } = useLanguage();
  const headerTitle = title || (area === 'Dashboard' ? 'Dashboard' : area);
  const isContentSettings = contentSettingsTitles.has(headerTitle);
  const displayTitle = isContentSettings ? 'Content & Settings' : headerTitle;
  const descriptions = {
    'Content & Settings': 'Manage events, galleries, announcements and site content',
    Dashboard: 'Overview of your Kannada Bharathi community',
    Profile: 'Manage your personal information, family details and account settings',
    'Member registration': 'Register yourself and your family for Kannada Bharathi classes and programs',
    'Expense Submission': 'Submit and track your volunteer related expenses',
    'Manage events': 'Create, edit and manage events for the Kannada Bharathi community',
    'Manage classes': 'Create and manage classes, set schedules, fees and locations',
    'Role and access control': 'Create and manage custom roles with page and field visibility',
    'Teacher allotment': 'Manage class to teacher assignments and access permissions',
    'Manage event dropdowns': 'Manage event types, recurrence options and volunteer registration form.',
    'About page content': 'Manage the content displayed on the public About page',
    'Teacher details': 'Manage paata teachers, class levels and teacher information',
    'Paata teacher details': 'Manage paata teachers, class levels and teacher information',
    'Manage announcements': 'Manage events, galleries, announcements and site content',
    'Manage fundraising causes': "Create and manage fundraising causes to support Kannada Bharathi's programs and community initiatives.",
    'Donation payment details': 'View and manage donation payments for Kannada Bharati',
    'Group email and contact messages': 'Send group emails to your community and manage newsletter subscribers and contact messages.',
    'Volunteer submissions': 'View and manage volunteer interest form submissions.',
    'Event check-in': 'Manage event check-in, search registrations and track attendance',
    'Event registration details': 'View and manage event registrations, payments and attendance',
    'Guest registration and check-in': 'Register event guests, manage family details and check them in on arrival.',
    'Seat management': 'Manage event seating, assign registered attendees and track check-ins',
    'Teacher class area': 'Manage your classes, view student registrations and track readiness.',
    'Treasurer expense workflow': 'Review, approve and track expenses, reimbursements and payments',
    'Find user by email': 'Search for a member and view their profile, children and registrations',
    'Email outbox': 'Track and manage queued, sent and failed emails to members and participants',
    'Student View': "Inspect a student's registrations, classes and event participation",
    'Admin developer tools': 'System diagnostics, email templates and local storage utilities',
    'Manage users': 'View and manage user accounts, roles and access permissions'
  };
  const description = descriptions[displayTitle] || descriptions[headerTitle] || descriptions[title] || (area ? `Manage ${String(area).toLowerCase()} details` : '');
  const titleClass = String(displayTitle || '').length > 27 ? 'has-long-title' : '';
  const descriptionClass = String(description || '').length > 62 ? 'has-long-description' : '';
  return (
    <>
      <div className={`admin-page-header ${titleClass} ${descriptionClass} ${displayTitle ? '' : 'is-breadcrumb-only'} ${isContentSettings ? 'is-content-settings-header' : ''} ${displayTitle === 'Dashboard' ? 'is-dashboard-header' : ''} ${displayTitle === 'Find user by email' ? 'is-find-user-header' : ''}`}>
        <div className="admin-page-header-copy">
          <p><span>{tr(root)}</span> / {tr(area)}</p>
          {displayTitle ? <h1>{tr(displayTitle)}</h1> : null}
          {description ? <small>{tr(description)}</small> : null}
        </div>
        {action}
      </div>
      {isContentSettings ? <ContentSettingsNav /> : null}
    </>
  );
}

function TeacherAttendanceView({ programs, registrations, attendanceRecords, currentUser, onSave }) {
  const { tr } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const classOptions = useMemo(() => {
    const classRegistrations = registrations.filter((row) => isClassRegistration(row, programs, []));
    const classes = [
      ...programs.map((item) => ({ key: item.id || item.title, title: item.title })),
      ...classRegistrations.map((row) => ({ key: row.program, title: row.program }))
    ].filter((item) => item.title);
    return [...new Map(classes.map((item) => [item.title, item])).values()]
      .map((item) => ({
        ...item,
        registeredCount: classRegistrations.filter((row) => row.program === item.title).length
      }))
      .sort((a, b) => b.registeredCount - a.registeredCount || a.title.localeCompare(b.title));
  }, [programs, registrations]);
  const [selectedClass, setSelectedClass] = useState(() => classOptions[0]?.title || '');
  const [classSearch, setClassSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [coverageSearch, setCoverageSearch] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedClass && classOptions[0]?.title) setSelectedClass(classOptions[0].title);
  }, [classOptions, selectedClass]);

  const allClassRows = useMemo(() => registrations.filter((row) => isClassRegistration(row, programs, [])), [programs, registrations]);
  const classRows = useMemo(() => registrations
    .filter((row) => isClassRegistration(row, programs, []))
    .filter((row) => !selectedClass || row.program === selectedClass)
    .sort((a, b) => String(a.familyMember || a.studentName || a.parentName || '').localeCompare(String(b.familyMember || b.studentName || b.parentName || ''))),
  [programs, registrations, selectedClass]);
  const filteredClassOptions = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    if (!query) return classOptions;
    return classOptions.filter((item) => [item.title, item.key]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [classOptions, classSearch]);
  const filteredCoverageOptions = useMemo(() => {
    const query = coverageSearch.trim().toLowerCase();
    if (!query) return classOptions;
    return classOptions.filter((item) => [item.title, item.key]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [classOptions, coverageSearch]);
  const visibleClassRows = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return classRows;
    return classRows.filter((row) => [
      row.familyMember,
      row.studentName,
      row.parentName,
      row.email,
      row.phone
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [classRows, studentSearch]);
  const selectedClassMeta = classOptions.find((item) => item.title === selectedClass) || {};

  const savedForSelection = useMemo(() => attendanceRecords.filter((row) => (
    row.className === selectedClass && row.attendanceDate === attendanceDate
  )), [attendanceDate, attendanceRecords, selectedClass]);
  const recentSessions = useMemo(() => attendanceRecords
    .filter((row) => !selectedClass || row.className === selectedClass)
    .reduce((sessions, row) => {
      const key = `${row.className}-${row.attendanceDate}`;
      sessions[key] ||= { className: row.className, attendanceDate: row.attendanceDate, total: 0, present: 0, absent: 0 };
      sessions[key].total += 1;
      if (['Present', 'Late'].includes(row.status)) sessions[key].present += 1;
      if (row.status === 'Absent') sessions[key].absent += 1;
      return sessions;
    }, {}), [attendanceRecords, selectedClass]);
  const recentSessionRows = Object.values(recentSessions)
    .sort((a, b) => String(b.attendanceDate).localeCompare(String(a.attendanceDate)))
    .slice(0, 4);

  useEffect(() => {
    const nextDraft = {};
    classRows.forEach((row, index) => {
      const key = getRegistrationKey(row, index);
      const saved = savedForSelection.find((item) => item.registrationKey === key || (item.registrationId && item.registrationId === row.id));
      nextDraft[key] = {
        status: saved?.status || 'Present',
        notes: saved?.notes || ''
      };
    });
    setDraft(nextDraft);
    setNotice('');
  }, [classRows, savedForSelection]);

  const counts = classRows.reduce((total, row, index) => {
    const status = draft[getRegistrationKey(row, index)]?.status || 'Present';
    total[status] = (total[status] || 0) + 1;
    return total;
  }, {});
  const presentCount = (counts.Present || 0) + (counts.Late || 0);
  const absentCount = counts.Absent || 0;
  const attendanceRate = classRows.length ? Math.round((presentCount / classRows.length) * 100) : 0;

  function markAll(status) {
    const nextDraft = {};
    classRows.forEach((row, index) => {
      const key = getRegistrationKey(row, index);
      nextDraft[key] = { ...(draft[key] || {}), status };
    });
    setDraft((current) => ({ ...current, ...nextDraft }));
  }

  function clearNotes() {
    setDraft((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, notes: '' }])));
  }

  async function handleSave() {
    setSaving(true);
    setNotice('');
    const records = classRows.map((row, index) => {
      const registrationKey = getRegistrationKey(row, index);
      return {
        classKey: selectedClass,
        className: selectedClass,
        attendanceDate,
        registrationId: row.id || null,
        registrationKey,
        studentName: row.familyMember || row.studentName || row.parentName || row.email || 'Student',
        familyMember: row.familyMember || row.studentName || '',
        email: row.email || '',
        status: draft[registrationKey]?.status || 'Present',
        notes: draft[registrationKey]?.notes || '',
        takenBy: currentUser?.email || ''
      };
    });

    try {
      await onSave(records);
      setNotice('Attendance saved successfully.');
    } catch (error) {
      setNotice(error.message || 'Attendance saved locally. Please check the API connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader root="Teacher" area="Attendance" title="Student attendance" />
      <section className="teacher-attendance-workspace">
        <aside className="teacher-attendance-class-panel">
          <div className="teacher-attendance-panel-heading">
            <span><UsersRound size={20} /></span>
            <div>
              <h2>{tr('Classes')}</h2>
              <p>{tr('Select a class to view and mark attendance.')}</p>
            </div>
          </div>
          <label className="teacher-attendance-search">
            <Search size={16} />
            <input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder={tr('Search classes...')} />
          </label>
          <div className="teacher-attendance-class-list">
            {filteredClassOptions.length ? filteredClassOptions.map((item) => (
              <button
                key={item.title}
                className={item.title === selectedClass ? 'is-active' : ''}
                type="button"
                onClick={() => setSelectedClass(item.title)}
              >
                <span>
                  <strong>{tr(item.title)}</strong>
                  <small>{item.registeredCount} {item.registeredCount === 1 ? tr('student') : tr('students')}</small>
                  {item.key && <em>ID {item.key}</em>}
                </span>
                <ChevronRight size={18} />
              </button>
            )) : <p className="teacher-attendance-empty-text">{tr('No classes found.')}</p>}
          </div>
        </aside>
        <section className="teacher-attendance-main-panel">
          <div className="teacher-attendance-title-row">
            <div className="teacher-attendance-title">
              <span><CalendarDays size={20} /></span>
              <div>
                <h2>{tr(selectedClass || 'Select class')}</h2>
                <p>{selectedClassMeta.key ? `Class ID: ${selectedClassMeta.key}` : tr('Choose a class to manage attendance')}</p>
              </div>
            </div>
            <div className="teacher-attendance-date">
              <label>{tr('Date')}<DatePicker value={attendanceDate} onChange={setAttendanceDate} placeholder={tr('Choose date')} /></label>
              <button className="button secondary" type="button" onClick={() => setAttendanceDate(today)}>{tr('Today')}</button>
            </div>
          </div>
          <div className="teacher-attendance-stats">
            <article><span>{tr('Registered in selected class')}:</span><strong>{selectedClassMeta.registeredCount || 0}</strong></article>
            <article><span>{tr('Present/Late')}:</span><strong>{presentCount}</strong></article>
            <article><span>{tr('Absent')}:</span><strong>{absentCount}</strong></article>
            <article><span>{tr('Saved records')}:</span><strong>{savedForSelection.length}</strong></article>
          </div>
          <div className="teacher-attendance-tools">
            <label className="teacher-attendance-search">
              <Search size={16} />
              <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder={tr('Search student by name or email...')} />
            </label>
            <div className="attendance-quick-actions">
              <button type="button" onClick={() => markAll('Present')} disabled={!classRows.length}>{tr('Mark all present')}</button>
              <button type="button" onClick={() => markAll('Absent')} disabled={!classRows.length}>{tr('Mark all absent')}</button>
              <button className="teacher-attendance-more" type="button" onClick={clearNotes} disabled={!classRows.length} title={tr('Clear notes')} aria-label={tr('Clear notes')}>
                <MoreHorizontal size={19} />
              </button>
              <span>{tr('More')}</span>
            </div>
          </div>
          <div className="teacher-attendance-table-shell">
            <table className="teacher-attendance-table">
              <thead>
                <tr>
                  <th>{tr('Student')}</th>
                  <th>{tr('Attendance')}</th>
                  <th>{tr('Notes')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleClassRows.length ? visibleClassRows.map((row, index) => {
                  const originalIndex = classRows.indexOf(row);
                  const key = getRegistrationKey(row, originalIndex >= 0 ? originalIndex : index);
                  const value = draft[key] || { status: 'Present', notes: '' };
                  const student = row.familyMember || row.studentName || row.parentName || row.email || 'Student';
                  return (
                    <tr key={key}>
                      <td>
                        <div className="teacher-attendance-student">
                          <span>{student.charAt(0).toUpperCase() || 'S'}</span>
                          <div>
                            <strong>{student}</strong>
                            <small>{row.email || tr('Sample student')}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="attendance-status-picker" role="group" aria-label={`${student} attendance`}>
                          {['Present', 'Absent', 'Late', 'Excused'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              className={value.status === status ? 'is-active' : ''}
                              onClick={() => setDraft((current) => ({ ...current, [key]: { ...(current[key] || {}), status } }))}
                            >
                              {status === 'Present' && <CheckCircle size={15} />}
                              {status === 'Absent' && <span className="attendance-radio-dot" />}
                              {status === 'Late' && <Clock3 size={15} />}
                              {status === 'Excused' && <X size={15} />}
                              {tr(status)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          value={value.notes}
                          onChange={(event) => setDraft((current) => ({ ...current, [key]: { ...(current[key] || {}), notes: event.target.value } }))}
                          placeholder={tr('Add a note...')}
                        />
                        <button type="button" onClick={() => setDraft((current) => ({ ...current, [key]: { ...(current[key] || {}), notes: '' } }))}>
                          {tr('Clear notes')}
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={3}>
                      <div className="attendance-empty-state">
                        <div><UsersRound size={34} /></div>
                        <strong>{tr('No students found for this class.')}</strong>
                        <p>{allClassRows.length
                          ? tr('Choose another class above. Classes with enrolled students are shown first.')
                          : tr('Class registrations will appear here after members register.')}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {notice && <p className="teacher-attendance-inline-notice"><CheckCircle size={16} /> {tr(notice)}</p>}
          {!notice && <p className="teacher-attendance-inline-notice"><Clock3 size={16} /> {savedForSelection.length ? tr('Attendance has saved records for this date.') : tr('Attendance is not saved yet.')}</p>}
          <div className="teacher-attendance-save-row">
            <span>{classRows.length} {classRows.length === 1 ? tr('student marked') : tr('students marked')}</span>
            <button className="button primary" type="button" onClick={handleSave} disabled={!classRows.length || saving}>
              <Save size={16} /> {saving ? tr('Saving...') : tr('Save attendance')}
            </button>
          </div>
        </section>
      </section>
      {notice && <p className="animated-form-message">{tr(notice)}</p>}
      <div className="attendance-mobile-save">
        <div>
          <strong>{presentCount}/{classRows.length}</strong>
          <span>{tr('present or late')}</span>
        </div>
        <button className="button primary" type="button" onClick={handleSave} disabled={!classRows.length || saving}>
          {saving ? tr('Saving...') : tr(savedForSelection.length ? 'Update' : 'Save')}
        </button>
      </div>
      <section className="attendance-roster is-legacy-hidden">
        {classRows.length ? classRows.map((row, index) => {
          const key = getRegistrationKey(row, index);
          const value = draft[key] || { status: 'Present', notes: '' };
          const student = row.familyMember || row.studentName || row.parentName || row.email || 'Student';
          return (
            <article key={key} className={`attendance-row is-${String(value.status).toLowerCase()}`}>
              <div>
                <strong>{student}</strong>
                <span>{row.email || '-'}{row.phone ? ` · ${row.phone}` : ''}</span>
              </div>
              <div className="attendance-status-picker" role="group" aria-label={`${student} attendance`}>
                {['Present', 'Absent', 'Late', 'Excused'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={value.status === status ? 'is-active' : ''}
                    onClick={() => setDraft((current) => ({ ...current, [key]: { ...(current[key] || {}), status } }))}
                  >
                    {tr(status)}
                  </button>
                ))}
              </div>
              <input
                value={value.notes}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: { ...(current[key] || {}), notes: event.target.value } }))}
                placeholder={tr('Notes')}
              />
            </article>
          );
        }) : (
          <article className="attendance-empty-state">
            <div><UsersRound size={34} /></div>
            <strong>{tr('No students found for this class.')}</strong>
            <p>{allClassRows.length
              ? tr('Choose another class above. Classes with enrolled students are shown first.')
              : tr('Class registrations will appear here after members register.')}</p>
          </article>
        )}
      </section>
      <section className="teacher-attendance-lower-grid">
        <article className="teacher-attendance-lower-card teacher-recent-session-card">
          <div className="teacher-attendance-lower-heading">
            <div>
              <span className="teacher-class-section-icon teacher-class-section-icon--gold"><CalendarDays size={20} /></span>
              <h2>{tr('Recent sessions')}</h2>
            </div>
            <strong>{recentSessionRows.length}</strong>
          </div>
          {recentSessionRows.length ? recentSessionRows.slice(0, 1).map((session) => {
            const date = new Date(`${session.attendanceDate}T00:00:00`);
            const month = Number.isNaN(date.getTime()) ? String(session.attendanceDate).slice(5, 7) : date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const day = Number.isNaN(date.getTime()) ? String(session.attendanceDate).slice(-2) : String(date.getDate()).padStart(2, '0');
            return (
              <div className="teacher-recent-session" key={`${session.className}-${session.attendanceDate}`}>
                <div className="teacher-recent-date">
                  <span>{month}</span>
                  <strong>{day}</strong>
                </div>
                <div className="teacher-recent-copy">
                  <h3>{tr(session.className)}</h3>
                  <p>{session.attendanceDate}</p>
                </div>
                <div className="teacher-recent-counts">
                  <strong>{session.present} / {session.total} {tr('present')}</strong>
                  <span>{Math.max(0, session.total - session.present)} {tr('not present')}</span>
                </div>
              </div>
            );
          }) : (
            <div className="teacher-recent-empty">
              <Clock3 size={28} />
              <strong>{tr('No recent sessions yet')}</strong>
              <p>{tr('Saved attendance sessions will appear here.')}</p>
            </div>
          )}
          <button className="teacher-outline-button" type="button" disabled={!recentSessionRows.length}>
            <ReceiptText size={17} /> {tr('View session outline')} <ChevronRight size={18} />
          </button>
        </article>
        <article className="teacher-attendance-lower-card teacher-class-coverage-card">
          <div className="teacher-attendance-lower-heading">
            <div>
              <span className="teacher-class-section-icon teacher-class-section-icon--gold"><UsersRound size={20} /></span>
              <h2>{tr('Class coverage')}</h2>
            </div>
            <strong>{classOptions.length} {tr('classes')}</strong>
          </div>
          <label className="teacher-attendance-search teacher-coverage-search">
            <Search size={16} />
            <input value={coverageSearch} onChange={(event) => setCoverageSearch(event.target.value)} placeholder={tr('Search classes...')} />
          </label>
          <div className="teacher-coverage-list">
            {filteredCoverageOptions.slice(0, 5).map((item, index) => (
              <div className="teacher-coverage-row" key={item.title}>
                <span className={`teacher-coverage-icon teacher-coverage-icon-${(index % 4) + 1}`}>
                  {index % 4 === 0 ? <GraduationCap size={18} /> : index % 4 === 1 ? <CreditCard size={18} /> : index % 4 === 2 ? <UsersRound size={18} /> : <BookOpen size={18} />}
                </span>
                <div>
                  <strong>{tr(item.title)}</strong>
                  {item.key && <small>ID {item.key}</small>}
                </div>
                <em><CheckCircle size={15} /> {item.registeredCount ? tr('Ready') : tr('Waiting')}</em>
                <b><UsersRound size={15} /> {item.registeredCount} {item.registeredCount === 1 ? tr('student') : tr('students')}</b>
                <button type="button" onClick={() => setSelectedClass(item.title)}>
                  {tr('Take attendance')} <ChevronRight size={18} />
                </button>
              </div>
            ))}
            {!filteredCoverageOptions.length && <p className="teacher-attendance-empty-text">{tr('No classes found.')}</p>}
          </div>
          <div className="teacher-coverage-footer">
            <span>{tr('Showing')} {Math.min(5, filteredCoverageOptions.length)} {tr('of')} {filteredCoverageOptions.length} {tr('classes')}</span>
            <button type="button" onClick={() => setCoverageSearch('')}>{tr('View all classes')} <ChevronRight size={16} /></button>
          </div>
        </article>
      </section>
    </>
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

function isClassroomEvent(item = {}) {
  const value = String(item.eventType || item.type || item.category || item.registrationType || '').toLowerCase();
  return value.includes('classroom') || value.includes('class') || value.includes('language');
}

function getEventMeta(row = {}, allEvents = []) {
  return allEvents.find((item) => item.title === row.program || item.eventId === row.eventId || item.id === row.eventId) || {};
}

function getClassMeta(row = {}, programs = []) {
  return programs.find((item) => item.title === row.program || item.eventId === row.eventId || item.id === row.eventId) || {};
}

function getProgramMeta(row = {}, programs = [], allEvents = []) {
  const eventMeta = getEventMeta(row, allEvents);
  if (eventMeta.title || eventMeta.eventId || eventMeta.id) return eventMeta;
  return getClassMeta(row, programs);
}

function isClassRegistration(row = {}, programs = [], allEvents = []) {
  const eventMeta = getEventMeta(row, allEvents);
  if (eventMeta.title || eventMeta.eventId || eventMeta.id) return isClassroomEvent(eventMeta);

  const classMeta = getClassMeta(row, programs);
  if (classMeta.title || classMeta.eventId || classMeta.id) return true;

  return row.registrationType === 'class'
    || /classroom|class|paata|shaale/i.test(`${row.registrationType || ''} ${row.program || ''}`);
}

function isCheckedInRegistration(row = {}) {
  return row.checkedIn === true
    || row.checked_in === true
    || Boolean(row.checkedInAt || row.checked_in_at);
}

function getDynamicCheckinColumns(event = {}, rows = []) {
  const rsvp = Array.isArray(event.rsvp) ? event.rsvp : [];
  if (rsvp.length) {
    return rsvp.map((item) => {
      const label = typeof item === 'string' ? item : item?.name || item?.label || item?.title;
      const key = typeof item === 'string' ? label : item?.key || item?.id || item?.value || label;
      return label ? { key, label, source: 'rsvp', aliases: [key, label, item?.name, item?.label, item?.title, item?.value].filter(Boolean) } : null;
    }).filter(Boolean);
  }

  const menuItems = Array.isArray(event.priceMenu)
    ? event.priceMenu
    : event.priceMenu?.items || event.priceMenu?.options || [];
  if (menuItems.length) {
    return menuItems.map((item) => {
      const label = item?.name || item?.label || item?.title;
      const key = item?.key || item?.id || item?.value || label;
      return label ? { key, label, source: 'priceMenu', aliases: [key, label, item?.name, item?.label, item?.title, item?.value].filter(Boolean) } : null;
    }).filter(Boolean);
  }

  const rowLabels = new Set();
  rows.forEach((row) => {
    if (Array.isArray(row.rsvp)) {
      row.rsvp.forEach((entry) => {
        if (entry && typeof entry === 'object') Object.keys(entry).forEach((key) => rowLabels.add(key));
      });
    } else if (row.rsvp && typeof row.rsvp === 'object') {
      Object.keys(row.rsvp).forEach((key) => rowLabels.add(key));
    }
  });
  return [...rowLabels].map((label) => ({ key: label, label, source: 'rsvp' }));
}

function getRegistrationDynamicColumns(rows = [], allEvents = []) {
  const columns = new Map();
  rows.forEach((row) => {
    const event = getEventMeta(row, allEvents);
    getDynamicCheckinColumns(event, [row]).forEach((column) => {
      const label = column.label || column.key;
      if (!label) return;
      const existing = columns.get(label);
      columns.set(label, {
        ...column,
        key: existing?.key || column.key || label,
        label,
        aliases: [...new Set([...(existing?.aliases || []), ...(column.aliases || []), column.key, label].filter(Boolean))]
      });
    });
  });
  return [...columns.values()];
}

function getDynamicCheckinValue(row = {}, column = {}) {
  const aliases = [...new Set([column.key, column.label, ...(column.aliases || [])].filter(Boolean).map(String))];
  if (!aliases.length) return 0;

  if (Array.isArray(row.rsvp)) {
    for (const entry of row.rsvp) {
      if (!entry || typeof entry !== 'object') continue;
      const key = aliases.find((alias) => Object.prototype.hasOwnProperty.call(entry, alias));
      if (key) return Number(entry[key] || 0);
    }
  } else if (row.rsvp && typeof row.rsvp === 'object') {
    const key = aliases.find((alias) => Object.prototype.hasOwnProperty.call(row.rsvp, alias));
    if (key) return Number(row.rsvp[key] || 0);
  } else if (row.rsvp && aliases.some((alias) => String(row.rsvp).toLowerCase() === alias.toLowerCase())) {
    return getCheckinCounts(row).total || 1;
  }

  const priceItems = Array.isArray(row.priceMenu)
    ? row.priceMenu
    : row.priceMenu?.items || row.priceMenu?.options || [];
  const priceMatch = priceItems.find((item) => aliases.includes(String(item?.key || item?.id || item?.value || item?.name || item?.label || item?.title)));
  if (priceMatch) return Number(priceMatch.quantity || priceMatch.count || priceMatch.qty || priceMatch.value || 0);

  if (row.priceSelection && aliases.some((alias) => String(row.priceSelection).toLowerCase() === alias.toLowerCase())) {
    return getCheckinCounts(row).total || 1;
  }

  const key = aliases.find((alias) => row[alias] !== undefined);
  if (key) return Number(row[key] || 0);
  return 0;
}

function getCheckinAnalytics(rows = [], dynamicColumns = [], checkedInIds = []) {
  const checked = rows.filter((row, index) => checkedInIds.includes(getRegistrationKey(row, index)) || isCheckedInRegistration(row));
  const totalMembers = rows.reduce((sum, row) => sum + getCheckinCounts(row).total, 0);
  const checkedMembers = checked.reduce((sum, row) => sum + getCheckinCounts(row).total, 0);
  const totals = [
    { key: 'Registrations', value: rows.length, checkedValue: checked.length },
    { key: 'Amount', value: `$${rows.reduce((sum, row) => sum + getMoneyAmount(row), 0).toLocaleString()}`, checkedValue: `$${checked.reduce((sum, row) => sum + getMoneyAmount(row), 0).toLocaleString()}` }
  ];

  dynamicColumns.forEach((column) => {
    totals.push({
      key: column.label,
      value: rows.reduce((sum, row) => sum + getDynamicCheckinValue(row, column), 0),
      checkedValue: checked.reduce((sum, row) => sum + getDynamicCheckinValue(row, column), 0)
    });
  });

  totals.push({ key: 'Total Members', value: totalMembers, checkedValue: checkedMembers });
  return totals;
}

function statusCount(rows = [], matcher) {
  return rows.filter((row) => matcher(String(row.status || '').toLowerCase(), row)).length;
}

function isPaidRegistration(row = {}) {
  return row.paid === true || row.paymentReceived === true || row.paymentReceived === 'true' || String(row.paid || '').toLowerCase() === 'paid';
}

function EnabledToggle({ enabled, onChange, onLabel = 'Enabled', offLabel = 'Disabled', label = 'Enabled' }) {
  const { tr } = useLanguage();
  const isOn = Boolean(enabled);
  return (
    <button
      className={isOn ? 'toggle-switch is-on' : 'toggle-switch'}
      type="button"
      role="switch"
      aria-label={tr(label)}
      aria-checked={isOn}
      onClick={() => onChange(!isOn)}
    >
      <span />
      <strong>{tr(isOn ? onLabel : offLabel)}</strong>
    </button>
  );
}

function DetailsIconButton({ onClick, label = 'View details' }) {
  const { tr } = useLanguage();
  return (
    <button className="icon-action-button" type="button" aria-label={tr(label)} title={tr(label)} onClick={onClick}>
      <Eye size={17} />
      <span>{tr(label)}</span>
    </button>
  );
}

function ReceiptLink({ row }) {
  const { tr } = useLanguage();
  if (!row.receiptUrl) return <span className="muted-cell">{tr('No receipt')}</span>;
  return (
    <a className="receipt-link" href={row.receiptUrl} target="_blank" rel="noreferrer" title={row.receiptName || 'Open receipt'}>
      <ReceiptText size={16} />
      <span>{tr('View')}</span>
      <small>{row.receiptName || formatFileSize(row.receiptSize)}</small>
    </a>
  );
}

function TableActionMenu({ primary, items = [] }) {
  const { tr } = useLanguage();
  const visibleItems = items.filter(Boolean);
  return (
    <div className="table-action-cluster">
      {primary}
      {visibleItems.length ? (
        <details className="table-more-menu">
          <summary aria-label={tr('More actions')} title={tr('More actions')}>
            <MoreHorizontal size={18} />
          </summary>
          <div className="table-more-menu-list">
            {visibleItems.map((item) => (
              <button
                key={item.label}
                className={item.danger ? 'is-danger' : ''}
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  item.onClick();
                }}
              >
                {item.icon}
                <span>{tr(item.label)}</span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function getPaymentDetails(row = {}) {
  const nested = row.paymentDetails || row.priceMenu?.paymentDetails || row.price_menu?.paymentDetails || null;
  if (nested) return nested;
  if (!row.paypalOrderId && !row.paypalCaptureId && !row.paymentStatus) return null;
  return {
    method: 'PayPal',
    status: row.paymentStatus || (row.paymentReceived || row.paid ? 'Paid' : 'Pending'),
    reference: row.paypalCaptureId || row.paypalOrderId || '',
    orderId: row.paypalOrderId || '',
    captureId: row.paypalCaptureId || '',
    invoiceId: row.invoiceId || row.id || '',
    amount: row.amount || 0,
    updatedAt: row.paymentCompletedAt || row.paymentCancelledAt || row.createdAt || ''
  };
}

function mergeLocalPaymentDetails(row = {}, details = {}) {
  const priceMenu = row.priceMenu && typeof row.priceMenu === 'object' && !Array.isArray(row.priceMenu)
    ? row.priceMenu
    : { items: Array.isArray(row.priceMenu) ? row.priceMenu : [] };
  return {
    ...row,
    paymentDetails: details,
    priceMenu: {
      ...priceMenu,
      paymentDetails: details
    }
  };
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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
            <ModalTitle matchText="Event details">{item.title}</ModalTitle>
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
  const paymentDetails = getPaymentDetails(row);
  const counts = getCheckinCounts(row);
  const profileRows = [
    ['Registered name', row.parentName || row.name || '-'],
    ['Email', row.email || '-'],
    ['Phone', profile.phone || row.phone || '-'],
    ['Program', row.program || '-'],
    ['Registration type', row.registrationType || '-'],
    ['Event type', row.eventCategory || row.eventType || row.type || '-'],
    ['Event ID', row.eventId || '-'],
    ['Status', row.status || 'Submitted'],
    ['Email status', row.emailStatus || '-'],
    ['Amount', `$${Number(row.amount || 0).toFixed(2)}`],
    ['Payment', isPaidRegistration(row) ? 'Paid' : 'Pending'],
    ['Payment method', paymentDetails?.method || (isPaidRegistration(row) ? 'PayPal / Manual' : '-')],
    ['Payment reference', paymentDetails?.reference || '-'],
    ['Payment marked by', paymentDetails?.markedBy || '-'],
    ['Payment marked on', paymentDetails?.updatedAt || '-'],
    ['Payment notes', paymentDetails?.notes || '-'],
    ['RSVP', row.rsvp || '-'],
    ['Price selection', row.priceSelection || '-'],
    ['Adults', counts.adults],
    ['Kids', counts.kids],
    ['Young kids', counts.youngKids],
    ['Total members', counts.total],
    ['Checked in', row.checkedInAt || row.checked_in_at || (row.checkedIn ? 'Yes' : '-')],
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
            <ModalTitle matchText="Registration profile">{profile.firstName || row.parentName || row.email}</ModalTitle>
            <p>{profile.description || 'Member profile and registration details are shown below.'}</p>
          </div>
        </div>
        <div className="detail-popup-grid">
          {profileRows.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{formatDetailValue(value)}</strong>
            </article>
          ))}
        </div>
        <section className="payment-summary-band">
          <article>
            <span>Class / Event</span>
            <strong>{row.program || '-'}</strong>
          </article>
          <article>
            <span>Amount</span>
            <strong>${Number(row.amount || 0).toFixed(2)}</strong>
          </article>
          <article>
            <span>Payment</span>
            <strong>{isPaidRegistration(row) ? 'Paid' : 'Pending'}</strong>
          </article>
          <article>
            <span>Reference</span>
            <strong>{paymentDetails?.reference || '-'}</strong>
          </article>
        </section>
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
                <thead><tr><th>Program</th><th>Member</th><th>Status</th><th>Amount</th><th>Paid</th><th>Payment ref</th><th>Registered on</th></tr></thead>
                <tbody>
                  {registrations.map((registration) => (
                    <tr key={registration.id || `${registration.program}-${registration.createdAt}`}>
                      <td>{registration.program || '-'}</td>
                      <td>{registration.familyMember || registration.studentName || '-'}</td>
                      <td>{registration.status || 'Submitted'}</td>
                      <td>${Number(registration.amount || 0).toFixed(2)}</td>
                      <td>{isPaidRegistration(registration) ? 'Yes' : 'No'}</td>
                      <td>{getPaymentDetails(registration)?.reference || '-'}</td>
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

function roleDisplayName(role) {
  const value = String(role || '').trim();
  const normalized = value.toLowerCase();
  if (normalized === 'welcomedesk' || normalized === 'receptionist') return 'Welcome Desk';
  if (normalized === 'superadmin') return 'Super Admin';
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}

function UserRoleEditor({ row, onChange }) {
  const [open, setOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0, width: 300 });
  const controlRef = useRef(null);
  const closeTimerRef = useRef(null);
  const roles = Array.isArray(row.roles) && row.roles.length ? row.roles : [row.role || 'member'];
  const assignableRoles = [...new Set([...getAssignableRoles(), ...roles])];

  function placePicker() {
    const bounds = controlRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const gutter = 12;
    const gap = 7;
    const estimatedHeight = 220;
    const width = Math.min(300, window.innerWidth - gutter * 2);
    const left = Math.max(gutter, Math.min(bounds.left, window.innerWidth - width - gutter));
    const fitsBelow = bounds.bottom + gap + estimatedHeight <= window.innerHeight - gutter;
    const top = fitsBelow
      ? bounds.bottom + gap
      : Math.max(gutter, bounds.top - estimatedHeight - gap);
    setPickerPosition({ top, left, width });
  }

  useEffect(() => {
    if (!open) return undefined;
    placePicker();
    window.addEventListener('resize', placePicker);
    window.addEventListener('scroll', placePicker, true);
    return () => {
      window.removeEventListener('resize', placePicker);
      window.removeEventListener('scroll', placePicker, true);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  function keepPickerOpen() {
    window.clearTimeout(closeTimerRef.current);
  }

  function schedulePickerClose() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  }

  function toggleRole(role) {
    let next = roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
    if (!next.length) next = ['member'];
    onChange(next);
  }
  const picker = (
    <div
      className={`user-role-picker${open ? ' is-open' : ''}`}
      style={pickerPosition}
      onMouseEnter={keepPickerOpen}
      onMouseLeave={schedulePickerClose}
    >
      <div className="user-role-picker-heading">
        <span>Select roles</span>
        <button type="button" aria-label="Close role selector" onClick={() => setOpen(false)}><X size={15} /></button>
      </div>
      <div className="role-chip-editor">
        {assignableRoles.map((role) => (
          <label key={role} className={roles.includes(role) ? 'is-selected' : ''} title={roleDisplayName(role)}>
            <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
            <span>{roleDisplayName(role)}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={controlRef}
        className={`user-role-control${open ? ' is-open' : ''}`}
        onMouseEnter={() => {
          keepPickerOpen();
          placePicker();
          setOpen(true);
        }}
        onMouseLeave={schedulePickerClose}
      >
      <div className="user-role-summary">
        <div className="user-role-badges" aria-label={`Assigned roles: ${roles.map(roleDisplayName).join(', ')}`}>
          {roles.slice(0, 2).map((role) => <span key={role}>{roleDisplayName(role)}</span>)}
          {roles.length > 2 && <strong>+{roles.length - 2}</strong>}
        </div>
        <button
          className="user-role-edit"
          type="button"
          aria-label={`Edit roles for ${row.email || row.name || 'user'}`}
          aria-expanded={open}
          title="Select roles"
          onClick={() => {
            placePicker();
            setOpen(true);
          }}
        >
          <Edit3 size={15} />
        </button>
      </div>
      </div>
      {createPortal(picker, document.body)}
    </>
  );
}

function getRolePageIcon(page = {}) {
  const text = `${page.label || ''} ${page.path || ''}`.toLowerCase();
  if (/dashboard|report|developer/.test(text)) return ListChecks;
  if (/check|registration|attendance|seat/.test(text)) return CheckCircle;
  if (/user|profile|member|guest|student/.test(text)) return UserRound;
  if (/event|calendar|announcement|gallery/.test(text)) return CalendarDays;
  if (/class|teacher|paata/.test(text)) return GraduationCap;
  if (/donation|fund|expense|treasurer|payment/.test(text)) return HandCoins;
  if (/message|email|contact/.test(text)) return Mail;
  if (/role|access|setting|content/.test(text)) return ListChecks;
  return Building2;
}

function getRolePageDescription(page = {}) {
  const text = `${page.label || ''} ${page.path || ''}`.toLowerCase();
  if (/seat/.test(text)) return 'Manage event seating, assign guests to seats and track check-in status.';
  if (/check/.test(text)) return 'Check in attendees and review arrival details.';
  if (/event/.test(text)) return 'Create, update and monitor community events.';
  if (/class|teacher/.test(text)) return 'Manage classes, teachers, students and attendance.';
  if (/donation|fund|expense|treasurer|payment/.test(text)) return 'Review payment, donation and expense records.';
  if (/message|email/.test(text)) return 'Send messages and review email communication.';
  if (/role|access/.test(text)) return 'Control page permissions and visible table fields.';
  return 'Allow access to this admin page and configure visible fields.';
}

function formatRoleFieldLabel(field = '') {
  return String(field)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getRoleFieldDescription(field = '') {
  const label = formatRoleFieldLabel(field).toLowerCase();
  if (/action|actions/.test(label)) return 'Row level actions such as view, edit, approve or assign.';
  if (/id|key|ref|reference/.test(label)) return 'Identifier used to connect related records.';
  if (/status|enabled|paid|payment/.test(label)) return 'Status shown for review and follow-up.';
  if (/email|phone|name|profile/.test(label)) return 'Member or attendee contact information.';
  if (/date|created|start|end|sent|attendance/.test(label)) return 'Date or time information shown in the table.';
  if (/amount|fee|goal|raised|price/.test(label)) return 'Financial value for the selected record.';
  return `${formatRoleFieldLabel(field)} field`;
}

function RoleAccessManager({ roles, onSave, notice, error }) {
  const [editingId, setEditingId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState(adminPageCatalog[0]?.path || '/admin');
  const [pageQuery, setPageQuery] = useState('');
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState({ name: '', description: '', pages: [], fields: {} });
  const editing = roles.find((role) => role.id === editingId);
  const selectedPageMeta = adminPageCatalog.find((page) => page.path === selectedPage) || adminPageCatalog[0];
  const selectedFields = draft.fields?.[selectedPage] || [];
  const allSelectedPageFields = selectedPageMeta?.fields || [];
  const filteredPages = adminPageCatalog.filter((page) => {
    const text = `${page.label} ${page.path}`.toLowerCase();
    return !pageQuery.trim() || text.includes(pageQuery.trim().toLowerCase());
  });
  const SelectedPageIcon = getRolePageIcon(selectedPageMeta);

  function resetDraft() {
    setEditingId('');
    setSelectedPage(adminPageCatalog[0]?.path || '/admin');
    setPageQuery('');
    setFormError('');
    setDraft({ name: '', description: '', pages: [], fields: {} });
  }

  function openAddModal() {
    resetDraft();
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetDraft();
  }

  function editRole(role) {
    setEditingId(role.id);
    setDraft({
      name: role.name,
      description: role.description || '',
      pages: role.pages || [],
      fields: role.fields || {}
    });
    setSelectedPage(role.pages?.[0] || adminPageCatalog[0]?.path || '/admin');
    setModalOpen(true);
  }

  function togglePage(path) {
    const page = adminPageCatalog.find((item) => item.path === path);
    setDraft((current) => ({
      ...current,
      pages: current.pages.includes(path) ? current.pages.filter((item) => item !== path) : [...current.pages, path],
      fields: current.pages.includes(path)
        ? Object.fromEntries(Object.entries(current.fields || {}).filter(([fieldPath]) => fieldPath !== path))
        : { ...(current.fields || {}), [path]: page?.fields || [] }
    }));
    setSelectedPage(path);
  }

  function toggleField(path, field) {
    setDraft((current) => {
      const currentFields = current.fields?.[path] || [];
      const nextFields = currentFields.includes(field)
        ? currentFields.filter((item) => item !== field)
        : [...currentFields, field];
      return {
        ...current,
        pages: current.pages.includes(path) ? current.pages : [...current.pages, path],
        fields: { ...(current.fields || {}), [path]: nextFields }
      };
    });
  }

  function setAllFields(path, fields) {
    setDraft((current) => ({
      ...current,
      pages: current.pages.includes(path) ? current.pages : [...current.pages, path],
      fields: { ...(current.fields || {}), [path]: fields }
    }));
  }

  function saveRole(event) {
    event.preventDefault();
    const id = normalizeRoleId(editingId || draft.name);
    setFormError('');
    if (!id || !cleanText(draft.name)) {
      setFormError('Role name is required.');
      return;
    }
    if (builtInAssignableRoles.map(normalizeRoleId).includes(id) || id === 'receptionist') {
      setFormError('Built-in roles cannot be overwritten. Use a custom role name.');
      return;
    }
    if (!draft.pages.length) {
      setFormError('Select at least one page for this role.');
      return;
    }
    const fields = draft.pages.reduce((acc, path) => {
      acc[path] = (draft.fields?.[path] || []).filter(Boolean);
      return acc;
    }, {});
    const nextRole = {
      id,
      name: cleanText(draft.name),
      description: cleanText(draft.description),
      pages: draft.pages,
      fields
    };
    const nextRoles = editing
      ? roles.map((role) => (role.id === editingId ? nextRole : role))
      : [...roles.filter((role) => role.id !== id), nextRole];
    onSave(nextRoles);
    closeModal();
  }

  function removeRole(roleId) {
    onSave(roles.filter((role) => role.id !== roleId));
    if (editingId === roleId) resetDraft();
  }

  return (
    <>
      {notice && <p className="success admin-floating-message">{notice}</p>}
      {error && <p className="form-error admin-floating-message">{error}</p>}
      <AdminTable
        title="Saved roles"
        rows={roles}
        emptyText="No custom roles yet."
        action={<button className="button primary" type="button" onClick={openAddModal}><Plus size={16} /> Add role</button>}
        columns={[
          { key: 'name', label: 'Role' },
          { key: 'id', label: 'Role key' },
          { key: 'description', label: 'Description' },
          { key: 'pages', label: 'Pages', render: (role) => `${(role.pages || []).length} page(s)` },
          { key: 'fields', label: 'Fields', render: (role) => Object.values(role.fields || {}).reduce((total, fields) => total + fields.length, 0) },
          { key: 'actions', label: 'Actions', render: (role) => (
            <TableActionMenu
              primary={<button className="mini-action-link secondary" type="button" onClick={() => editRole(role)}><Edit3 size={15} /> Edit</button>}
              items={[
                { label: 'Edit', icon: <Edit3 size={15} />, onClick: () => editRole(role) },
                { label: 'Delete', icon: <Trash2 size={15} />, danger: true, onClick: () => removeRole(role.id) }
              ]}
            />
          ) }
        ]}
      />
      {modalOpen && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup-panel role-access-modal" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit role' : 'Add role'}>
            <button className="popup-close" type="button" aria-label="Close popup" onClick={closeModal}>
              <X size={20} />
            </button>
            <form className="admin-create-form role-access-form" onSubmit={saveRole}>
              <div className="role-modal-heading">
                <div>
                  <ModalTitle>{editing ? 'Edit role' : 'Add role'}</ModalTitle>
                  <p className="admin-form-note">{editing ? 'Update page access and field permissions' : 'Create a new role with page access and field permissions'}</p>
                </div>
              </div>
              {formError && <p className="form-error">{formError}</p>}
              <div className="role-modal-basics">
                <label>Role name <b aria-hidden="true">*</b><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Event coordinator" required /></label>
                <label>Description <b aria-hidden="true">*</b><input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Can manage selected event pages" required /></label>
              </div>
              <div className="role-permission-builder">
                <aside className="role-page-side">
                  <div className="role-builder-title">
                    <h3>1. Select pages</h3>
                    <p>Choose which pages this role can access. Select one or more pages.</p>
                  </div>
                  <label className="role-page-search" aria-label="Search pages">
                    <input value={pageQuery} onChange={(event) => setPageQuery(event.target.value)} placeholder="Search pages..." />
                    <Search size={18} />
                  </label>
                  <div className="role-page-list" role="list">
                    {filteredPages.map((page) => {
                      const PageIcon = getRolePageIcon(page);
                      const isSelected = draft.pages.includes(page.path);
                      return (
                        <button
                          key={page.path}
                          className={`${selectedPage === page.path ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`}
                          type="button"
                          onClick={() => setSelectedPage(page.path)}
                        >
                          <span className="role-check" aria-hidden="true">{isSelected ? <CheckCircle size={16} /> : null}</span>
                          <PageIcon size={18} />
                          <span><strong>{page.label}</strong><small>{page.path}</small></span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            aria-label={`Allow ${page.label}`}
                            onChange={() => togglePage(page.path)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </button>
                      );
                    })}
                    {!filteredPages.length && <p className="muted-cell">No matching pages.</p>}
                  </div>
                </aside>
                <section className="role-field-side">
                  <div className="role-builder-title">
                    <h3>2. Configure field access</h3>
                    <p>These fields control which table columns this role can see.</p>
                  </div>
                  <div className="role-selected-page-card">
                    <span><SelectedPageIcon size={28} /></span>
                    <div>
                      <h4>{selectedPageMeta?.label || 'Selected page'}</h4>
                      <p>{selectedPageMeta?.path}</p>
                      <small>{getRolePageDescription(selectedPageMeta)}</small>
                    </div>
                  </div>
                  <div className="role-field-actions">
                    <strong><CheckCircle size={17} /> {selectedFields.length} of {allSelectedPageFields.length} fields selected</strong>
                    <button className="mini-action-link secondary" type="button" onClick={() => setAllFields(selectedPage, allSelectedPageFields)}><CheckCircle size={15} /> Select all</button>
                    <button className="mini-action-link secondary" type="button" onClick={() => setAllFields(selectedPage, [])}>Clear fields</button>
                  </div>
                  <div className="role-field-grid">
                    {allSelectedPageFields.map((field) => (
                      <label key={field} className={selectedFields.includes(field) ? 'is-selected' : ''}>
                        <input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(selectedPage, field)} />
                        <span className="role-check" aria-hidden="true">{selectedFields.includes(field) ? <CheckCircle size={16} /> : null}</span>
                        <span>
                          <strong>{formatRoleFieldLabel(field)}</strong>
                          <small>{getRoleFieldDescription(field)}</small>
                        </span>
                        <code>{field}</code>
                        <em>String</em>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
              <div className="paata-teacher-form-actions">
                <button className="button ghost" type="button" onClick={closeModal}>Cancel</button>
                <button className="button primary" type="submit"><Plus size={18} /> {editing ? 'Update role' : 'Add role'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function TeacherAllotmentManager({ allotments, classes, teachers, onSave, notice, error }) {
  const [editingId, setEditingId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState({ classTitle: '', teacherEmail: '', teacherName: '', notes: '', enabled: true });
  const classOptions = classes.filter((item) => item.title);
  const teacherOptions = teachers.filter((item) => item.email);

  function resetDraft() {
    setEditingId('');
    setDraft({ classTitle: classOptions[0]?.title || '', teacherEmail: '', teacherName: '', notes: '', enabled: true });
  }

  function openAddModal() {
    resetDraft();
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetDraft();
  }

  function updateTeacher(email) {
    const teacher = teacherOptions.find((item) => String(item.email).toLowerCase() === String(email).toLowerCase());
    setDraft((current) => ({ ...current, teacherEmail: email, teacherName: teacher ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.name || email : current.teacherName }));
  }

  function saveAllotment(event) {
    event.preventDefault();
    if (!draft.classTitle || !draft.teacherEmail) return;
    const row = {
      ...draft,
      id: editingId || `allotment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      teacherEmail: cleanText(draft.teacherEmail).toLowerCase(),
      teacherName: cleanText(draft.teacherName),
      classTitle: cleanText(draft.classTitle),
      notes: cleanText(draft.notes),
      enabled: Boolean(draft.enabled)
    };
    const nextRows = editingId
      ? allotments.map((item) => (item.id === editingId ? row : item))
      : [...allotments.filter((item) => !(item.classTitle === row.classTitle && item.teacherEmail === row.teacherEmail)), row];
    onSave(nextRows);
    closeModal();
  }

  function editAllotment(row) {
    setEditingId(row.id);
    setDraft({ ...row });
    setModalOpen(true);
  }

  return (
    <>
      {notice && <p className="success admin-floating-message">{notice}</p>}
      {error && <p className="form-error admin-floating-message">{error}</p>}
      <AdminTable
        title="Teacher allotments"
        rows={allotments}
        emptyText="No teacher allotments yet."
        action={<button className="button primary" type="button" onClick={openAddModal}><Plus size={16} /> Add allotment</button>}
        columns={[
          { key: 'classTitle', label: 'Class' },
          { key: 'teacherName', label: 'Teacher' },
          { key: 'teacherEmail', label: 'Teacher email' },
          { key: 'notes', label: 'Notes' },
          { key: 'enabled', label: 'Enabled', render: (row) => row.enabled !== false ? 'Yes' : 'No' },
          { key: 'actions', label: 'Actions', render: (row) => (
            <TableActionMenu
              primary={<button className="mini-action-link secondary" type="button" onClick={() => editAllotment(row)}><Edit3 size={15} /> Edit</button>}
              items={[
                { label: 'Edit', icon: <Edit3 size={15} />, onClick: () => editAllotment(row) },
                { label: 'Delete', icon: <Trash2 size={15} />, danger: true, onClick: () => onSave(allotments.filter((item) => item.id !== row.id)) }
              ]}
            />
          ) }
        ]}
      />
      {modalOpen && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup-panel teacher-allotment-modal" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit allotment' : 'Add allotment'}>
            <button className="popup-close" type="button" aria-label="Close popup" onClick={closeModal}>
              <X size={20} />
            </button>
            <form className="admin-create-form" onSubmit={saveAllotment}>
              <ModalTitle>{editingId ? 'Edit allotment' : 'Add allotment'}</ModalTitle>
              <p className="admin-form-note">Assign one teacher to one class. The teacher attendance and class area will use these assignments.</p>
              <div className="admin-form-grid">
                <label>Class<select value={draft.classTitle} onChange={(event) => setDraft((current) => ({ ...current, classTitle: event.target.value }))} required><option value="">Choose class</option>{classOptions.map((item) => <option key={item.id || item.title} value={item.title}>{item.title}</option>)}</select></label>
                <label>Teacher<select value={draft.teacherEmail} onChange={(event) => updateTeacher(event.target.value)} required><option value="">Choose teacher</option>{teacherOptions.map((item) => <option key={item.email} value={item.email}>{`${item.firstName || item.name || item.email} ${item.lastName || ''}`.trim()} · {item.email}</option>)}</select></label>
                <label>Teacher display name<input value={draft.teacherName} onChange={(event) => setDraft((current) => ({ ...current, teacherName: event.target.value }))} /></label>
                <label className="admin-checkbox"><input type="checkbox" checked={draft.enabled !== false} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} /> Active assignment</label>
              </div>
              <label>Notes<textarea rows={4} value={draft.notes || ''} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Primary teacher, substitute, batch note..." /></label>
              <div className="paata-teacher-form-actions">
                <button className="button primary" type="submit"><Save size={16} /> {editingId ? 'Update allotment' : 'Add allotment'}</button>
                <button className="button ghost" type="button" onClick={closeModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function AdminEditModal({ kind, row, eventTypes = [], recurrences = [], onClose, onSave }) {
  const [error, setError] = useState('');
  const titleByKind = {
    event: 'Edit event',
    class: 'Edit class',
    announcement: 'Edit announcement',
    registration: 'Edit registration',
    fundraiser: 'Edit fundraising cause',
    donation: 'Edit donation',
    contact: 'Edit contact message',
    volunteer: 'Edit volunteer submission',
    expense: 'Edit expense'
  };
  const title = titleByKind[kind] || 'Edit record';

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    let patch = {};

    if (kind === 'event') {
      if (!cleanText(data.title)) {
        setError('Event title is required.');
        return;
      }
      patch = {
        eventId: cleanText(data.eventId),
        urlKey: cleanText(data.urlKey),
        title: cleanText(data.title),
        eventType: data.eventType,
        body: cleanText(data.body),
        location: cleanText(data.location),
        startOn: data.startOn,
        endOn: data.endOn,
        recurrence: data.recurrence,
        capacity: Number(data.capacity || 0),
        price: Number(data.price || 0),
        minAge: data.minAge ? Number(data.minAge) : null,
        maxAge: data.maxAge ? Number(data.maxAge) : null,
        enabled: Boolean(data.enabled),
        isOpenForRegistration: Boolean(data.isOpenForRegistration),
        isPaymentRequired: Boolean(data.isPaymentRequired),
        isAgeRestricted: Boolean(data.isAgeRestricted),
        displaySeatNumbers: Boolean(data.displaySeatNumbers),
        isAutoApproved: Boolean(data.isAutoApproved),
        enableDefaulterFine: Boolean(data.enableDefaulterFine),
        enableCheckIn: Boolean(data.enableCheckIn),
        freeForVolunteers: Boolean(data.freeForVolunteers),
        enableVolunteerDiscount: Boolean(data.enableVolunteerDiscount),
        volunteerDiscountPercentage: Number(data.volunteerDiscountPercentage || 0),
        defaulterFineAmount: Number(data.defaulterFineAmount || 0),
        photo: data.removePhoto ? '' : cleanText(data.photo),
        teachers: cleanText(data.teachers).split(',').map((item) => item.trim()).filter(Boolean),
        registrationInfo: {
          heading: cleanText(data.registrationHeading) || 'Registration',
          instructions: cleanText(data.registrationInstructions),
          confirmationMessage: cleanText(data.registrationConfirmation),
          paymentMessage: cleanText(data.paymentMessage)
        }
      };
    } else if (kind === 'class') {
      if (!cleanText(data.title)) {
        setError('Class title is required.');
        return;
      }
      patch = {
        title: cleanText(data.title),
        category: cleanText(data.category),
        status: cleanText(data.status),
        date: cleanText(data.date),
        time: cleanText(data.time),
        age: cleanText(data.age),
        fee: cleanText(data.fee),
        location: cleanText(data.location),
        focus: cleanText(data.focus),
        photo: data.removePhoto ? '' : cleanText(data.photo)
      };
    } else if (kind === 'announcement') {
      if (!cleanText(data.text)) {
        setError('Announcement text is required.');
        return;
      }
      patch = {
        text: cleanText(data.text),
        ctaText: cleanText(data.ctaText),
        ctaUrl: cleanText(data.ctaUrl),
        startOn: data.startOn,
        endOn: data.endOn,
        enabled: Boolean(data.enabled)
      };
    } else if (kind === 'registration') {
      if (!cleanText(data.email) || !cleanText(data.program)) {
        setError('Email and program are required.');
        return;
      }
      patch = {
        parentName: cleanText(data.parentName),
        studentName: cleanText(data.studentName),
        familyMember: cleanText(data.familyMember),
        email: cleanText(data.email).toLowerCase(),
        phone: cleanText(data.phone),
        program: cleanText(data.program),
        registrationType: data.registrationType,
        status: data.status,
        amount: Number(data.amount || 0),
        paid: Boolean(data.paid),
        paymentReceived: Boolean(data.paymentReceived),
        enabled: Boolean(data.enabled),
        birthYear: cleanText(data.birthYear),
        totalMembers: Number(data.totalMembers || 1),
        rsvp: cleanText(data.rsvp),
        priceSelection: cleanText(data.priceSelection),
        emailStatus: cleanText(data.emailStatus)
      };
    } else if (kind === 'fundraiser') {
      if (!cleanText(data.title)) {
        setError('Cause title is required.');
        return;
      }
      patch = {
        title: cleanText(data.title),
        category: cleanText(data.category),
        beneficiary: cleanText(data.beneficiary),
        purpose: cleanText(data.purpose),
        goal: Number(data.goal || 0),
        raised: Number(data.raised || 0),
        deadline: data.deadline,
        status: cleanText(data.status) || 'Active',
        photo: cleanText(data.photo)
      };
    } else if (kind === 'donation') {
      if (!cleanText(data.email)) {
        setError('Donor email is required.');
        return;
      }
      patch = {
        name: cleanText(data.name),
        email: cleanText(data.email).toLowerCase(),
        cause: cleanText(data.cause),
        causeId: cleanText(data.causeId),
        amount: Number(data.amount || 0),
        paymentStatus: cleanText(data.paymentStatus) || 'Submitted',
        paymentReference: cleanText(data.paymentReference)
      };
    } else if (kind === 'contact') {
      if (!cleanText(data.email) || !cleanText(data.message)) {
        setError('Email and message are required.');
        return;
      }
      patch = {
        name: cleanText(data.name),
        email: cleanText(data.email).toLowerCase(),
        topic: cleanText(data.topic),
        message: cleanText(data.message)
      };
    } else if (kind === 'volunteer') {
      if (!cleanText(data.email)) {
        setError('Volunteer email is required.');
        return;
      }
      patch = {
        name: cleanText(data.name),
        email: cleanText(data.email).toLowerCase(),
        interest: cleanText(data.interest),
        message: cleanText(data.message)
      };
    } else if (kind === 'expense') {
      if (!cleanText(data.title)) {
        setError('Expense title is required.');
        return;
      }
      patch = {
        title: cleanText(data.title),
        category: cleanText(data.category),
        amount: Number(data.amount || 0),
        expenseDate: data.expenseDate,
        vendor: cleanText(data.vendor),
        paymentMethod: cleanText(data.paymentMethod),
        reimbursementTo: cleanText(data.reimbursementTo),
        description: cleanText(data.description),
        receiptUrl: cleanText(data.receiptUrl),
        status: cleanText(data.status) || 'Submitted',
        submittedBy: cleanText(data.submittedBy)
      };
    }

    onSave(patch);
  }

  return (
    <div className="popup-backdrop" role="presentation">
      <div className="popup-panel edit-record-popup" role="dialog" aria-modal="true" aria-label={title}>
        <button className="popup-close" type="button" aria-label="Close popup" onClick={onClose}>
          <X size={20} />
        </button>
        <form className="admin-create-form" onSubmit={handleSubmit}>
          <ModalTitle>{title}</ModalTitle>
          <p className="admin-form-note">Update the existing record and save changes back to the admin table.</p>
          {kind === 'event' && (
            <>
              <div className="admin-form-grid">
                <label>Event title<input name="title" defaultValue={row.title || ''} required /></label>
                <label>URL key<input name="urlKey" defaultValue={row.urlKey || ''} /></label>
                <label>Event ID<input name="eventId" defaultValue={row.eventId || ''} /></label>
                <label>Event type<select name="eventType" defaultValue={row.eventType || eventTypes[0] || 'Workshop'}>{eventTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Start on<DatePicker name="startOn" mode="datetime" defaultValue={String(row.startOn || '').slice(0, 16)} placeholder="Choose start date and time" /></label>
                <label>End on<DatePicker name="endOn" mode="datetime" defaultValue={String(row.endOn || '').slice(0, 16)} placeholder="Choose end date and time" /></label>
                <label>Recurrence<select name="recurrence" defaultValue={row.recurrence || recurrences[0] || 'OneTime'}>{recurrences.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Location<input name="location" defaultValue={row.location || ''} /></label>
                <label>Capacity<input name="capacity" type="number" min="0" defaultValue={row.capacity || 0} /></label>
                <label>Base price<input name="price" type="number" min="0" step="0.01" defaultValue={row.price || 0} /></label>
                <label>Image URL<input name="photo" defaultValue={row.photo || ''} placeholder="https://..." /></label>
                <label>Min age<input name="minAge" type="number" min="0" max="100" defaultValue={row.minAge || ''} /></label>
                <label>Max age<input name="maxAge" type="number" min="0" max="100" defaultValue={row.maxAge || ''} /></label>
                <label>Teachers<input name="teachers" defaultValue={(row.teachers || []).join ? row.teachers.join(', ') : row.teachers || ''} /></label>
                <label>Volunteer discount %<input name="volunteerDiscountPercentage" type="number" min="0" max="100" defaultValue={row.volunteerDiscountPercentage || 0} /></label>
                <label>Defaulter fine<input name="defaulterFineAmount" type="number" min="0" step="0.01" defaultValue={row.defaulterFineAmount || 0} /></label>
              </div>
              <div className="admin-checkbox-grid">
                <label className="admin-checkbox"><input name="enabled" type="checkbox" defaultChecked={row.enabled !== false} /> Enabled</label>
                <label className="admin-checkbox"><input name="isOpenForRegistration" type="checkbox" defaultChecked={Boolean(row.isOpenForRegistration)} /> Open for registration</label>
                <label className="admin-checkbox"><input name="isPaymentRequired" type="checkbox" defaultChecked={Boolean(row.isPaymentRequired)} /> Payment required</label>
                <label className="admin-checkbox"><input name="isAgeRestricted" type="checkbox" defaultChecked={Boolean(row.isAgeRestricted)} /> Age restricted</label>
                <label className="admin-checkbox"><input name="isAutoApproved" type="checkbox" defaultChecked={Boolean(row.isAutoApproved)} /> Auto approved</label>
                <label className="admin-checkbox"><input name="displaySeatNumbers" type="checkbox" defaultChecked={Boolean(row.displaySeatNumbers)} /> Display seats</label>
                <label className="admin-checkbox"><input name="enableDefaulterFine" type="checkbox" defaultChecked={Boolean(row.enableDefaulterFine)} /> Defaulter fine</label>
                <label className="admin-checkbox"><input name="removePhoto" type="checkbox" /> Remove image</label>
                <label className="admin-checkbox"><input name="enableCheckIn" type="checkbox" defaultChecked={Boolean(row.enableCheckIn)} /> Enable check-in</label>
                <label className="admin-checkbox"><input name="freeForVolunteers" type="checkbox" defaultChecked={Boolean(row.freeForVolunteers)} /> Free for volunteers</label>
                <label className="admin-checkbox"><input name="enableVolunteerDiscount" type="checkbox" defaultChecked={Boolean(row.enableVolunteerDiscount)} /> Volunteer discount</label>
              </div>
              <label>Description<textarea name="body" defaultValue={row.body || ''} /></label>
              <div className="admin-form-grid">
                <label>Registration heading<input name="registrationHeading" defaultValue={row.registrationInfo?.heading || 'Registration'} /></label>
                <label>Registration instructions<textarea name="registrationInstructions" defaultValue={row.registrationInfo?.instructions || ''} /></label>
                <label>Confirmation message<textarea name="registrationConfirmation" defaultValue={row.registrationInfo?.confirmationMessage || ''} /></label>
                <label>Payment message<textarea name="paymentMessage" defaultValue={row.registrationInfo?.paymentMessage || ''} /></label>
              </div>
            </>
          )}
          {kind === 'class' && (
            <>
              <div className="admin-form-grid">
                <label>Class title<input name="title" defaultValue={row.title || ''} required /></label>
                <label>Category<input name="category" defaultValue={row.category || ''} /></label>
                <label>Status<input name="status" defaultValue={row.status || ''} placeholder="New students / Draft / Waitlist" /></label>
                <label>Date range<input name="date" defaultValue={row.date || ''} placeholder="Sep 13, 2027 - Jun 20, 2028" /></label>
                <label>Time<input name="time" defaultValue={row.time || ''} placeholder="Sundays, 10:00 AM - 11:00 AM" /></label>
                <label>Age group<input name="age" defaultValue={row.age || ''} /></label>
                <label>Fee<input name="fee" defaultValue={row.fee || ''} /></label>
                <label>Location<input name="location" defaultValue={row.location || ''} /></label>
                <label>Image URL<input name="photo" defaultValue={row.photo || ''} placeholder="https://..." /></label>
              </div>
              <label>Focus<textarea name="focus" defaultValue={row.focus || ''} /></label>
              <label className="admin-checkbox"><input name="removePhoto" type="checkbox" /> Remove image</label>
            </>
          )}
          {kind === 'announcement' && (
            <>
              <label>Announcement text<input name="text" defaultValue={row.text || ''} required /></label>
              <label>CTA text<input name="ctaText" defaultValue={row.ctaText || ''} /></label>
              <label>CTA URL<input name="ctaUrl" defaultValue={row.ctaUrl || ''} /></label>
              <div className="admin-form-grid">
                <label>Start on<DatePicker name="startOn" defaultValue={String(row.startOn || '').slice(0, 10)} placeholder="Choose start date" /></label>
                <label>End on<DatePicker name="endOn" defaultValue={String(row.endOn || '').slice(0, 10)} placeholder="Choose end date" /></label>
              </div>
              <label className="admin-checkbox"><input name="enabled" type="checkbox" defaultChecked={isEnabledValue(row.enabled)} /> Enabled</label>
            </>
          )}
          {kind === 'registration' && (
            <>
              <div className="admin-form-grid">
                <label>Parent name<input name="parentName" defaultValue={row.parentName || ''} /></label>
                <label>Registered name<input name="studentName" defaultValue={row.studentName || ''} /></label>
                <label>Family member<input name="familyMember" defaultValue={row.familyMember || row.studentName || ''} /></label>
                <label>Email<input name="email" type="email" defaultValue={row.email || ''} required /></label>
                <label>Phone<input name="phone" defaultValue={row.phone || ''} /></label>
                <label>Program<input name="program" defaultValue={row.program || ''} required /></label>
                <label>Type<select name="registrationType" defaultValue={row.registrationType || 'event'}><option>class</option><option>event</option><option>guest</option></select></label>
                <label>Status<select name="status" defaultValue={row.status || 'Submitted'}><option>Submitted</option><option>Confirmed</option><option>Deleted</option><option>Waitlist</option></select></label>
                <label>Amount<input name="amount" type="number" min="0" step="0.01" defaultValue={row.amount || 0} /></label>
                <label>Birth year<input name="birthYear" defaultValue={row.birthYear || ''} /></label>
                <label>Total members<input name="totalMembers" type="number" min="1" defaultValue={row.totalMembers || row.seats || 1} /></label>
                <label>Email status<input name="emailStatus" defaultValue={row.emailStatus || ''} /></label>
                <label>RSVP<input name="rsvp" defaultValue={typeof row.rsvp === 'string' ? row.rsvp : JSON.stringify(row.rsvp || '')} /></label>
                <label>Price selection<input name="priceSelection" defaultValue={row.priceSelection || ''} /></label>
              </div>
              <div className="admin-checkbox-grid">
                <label className="admin-checkbox"><input name="paid" type="checkbox" defaultChecked={isPaidRegistration(row)} /> Paid</label>
                <label className="admin-checkbox"><input name="paymentReceived" type="checkbox" defaultChecked={Boolean(row.paymentReceived || row.paid)} /> Payment received</label>
                <label className="admin-checkbox"><input name="enabled" type="checkbox" defaultChecked={row.enabled !== false} /> Enabled</label>
              </div>
            </>
          )}
          {kind === 'fundraiser' && (
            <>
              <div className="admin-form-grid">
                <label>Cause title<input name="title" defaultValue={row.title || ''} required /></label>
                <label>Category<input name="category" defaultValue={row.category || ''} /></label>
                <label>Beneficiary<input name="beneficiary" defaultValue={row.beneficiary || ''} /></label>
                <label>Status<select name="status" defaultValue={row.status || 'Active'}><option>Active</option><option>Paused</option><option>Completed</option></select></label>
                <label>Raised<input name="raised" type="number" min="0" step="0.01" defaultValue={row.raised || 0} /></label>
                <label>Goal<input name="goal" type="number" min="0" step="0.01" defaultValue={row.goal || 0} /></label>
                <label>Needed by<DatePicker name="deadline" defaultValue={String(row.deadline || '').slice(0, 10)} placeholder="Choose deadline" /></label>
                <label>Image URL<input name="photo" defaultValue={row.photo || ''} /></label>
              </div>
              <label>Details<textarea name="purpose" defaultValue={row.purpose || ''} rows={4} /></label>
            </>
          )}
          {kind === 'donation' && (
            <div className="admin-form-grid">
              <label>Name<input name="name" defaultValue={row.name || ''} /></label>
              <label>Email<input name="email" type="email" defaultValue={row.email || ''} required /></label>
              <label>Donation cause<input name="cause" defaultValue={row.cause || ''} /></label>
              <label>Cause ID<input name="causeId" defaultValue={row.causeId || ''} /></label>
              <label>Amount<input name="amount" type="number" min="0" step="0.01" defaultValue={row.amount || 0} /></label>
              <label>Payment status<input name="paymentStatus" defaultValue={row.paymentStatus || ''} /></label>
              <label>Payment reference<input name="paymentReference" defaultValue={row.paymentReference || ''} /></label>
            </div>
          )}
          {kind === 'contact' && (
            <>
              <div className="admin-form-grid">
                <label>Name<input name="name" defaultValue={row.name || ''} /></label>
                <label>Email<input name="email" type="email" defaultValue={row.email || ''} required /></label>
                <label>Topic<input name="topic" defaultValue={row.topic || ''} /></label>
              </div>
              <label>Message<textarea name="message" defaultValue={row.message || ''} rows={5} required /></label>
            </>
          )}
          {kind === 'volunteer' && (
            <>
              <div className="admin-form-grid">
                <label>Name<input name="name" defaultValue={row.name || ''} /></label>
                <label>Email<input name="email" type="email" defaultValue={row.email || ''} required /></label>
                <label>Volunteer interest<input name="interest" defaultValue={row.interest || ''} /></label>
              </div>
              <label>Message<textarea name="message" defaultValue={row.message || ''} rows={5} /></label>
            </>
          )}
          {kind === 'expense' && (
            <>
              <div className="admin-form-grid">
                <label>Title<input name="title" defaultValue={row.title || ''} required /></label>
                <label>Category<input name="category" defaultValue={row.category || ''} /></label>
                <label>Amount<input name="amount" type="number" min="0" step="0.01" defaultValue={row.amount || 0} /></label>
                <label>Expense date<DatePicker name="expenseDate" defaultValue={String(row.expenseDate || row.expense_date || '').slice(0, 10)} placeholder="Choose expense date" /></label>
                <label>Vendor<input name="vendor" defaultValue={row.vendor || ''} /></label>
                <label>Payment method<input name="paymentMethod" defaultValue={row.paymentMethod || ''} /></label>
                <label>Reimburse to<input name="reimbursementTo" defaultValue={row.reimbursementTo || ''} /></label>
                <label>Submitted by<input name="submittedBy" defaultValue={row.submittedBy || ''} /></label>
                <label>Status<select name="status" defaultValue={row.status || 'Submitted'}><option>Submitted</option><option>Approved</option><option>Paid</option><option>Rejected</option></select></label>
                <label>Receipt URL<input name="receiptUrl" defaultValue={row.receiptUrl || ''} /></label>
              </div>
              <label>Description<textarea name="description" defaultValue={row.description || ''} rows={4} /></label>
            </>
          )}
          <button className="button primary" type="submit">Save changes</button>
          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}

function makeAboutRow(section) {
  const id = `${section}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (section === 'currentCommittee') {
    return { id, name: '', role: '', email: '', phone: '', bio: '', photo: '' };
  }
  if (section === 'sponsors') {
    return { id, name: '', level: '', website: '', note: '', photo: '' };
  }
  return { id, term: '', title: '', members: '', photo: '' };
}

function AboutContentEditor({ content, setContent, onSave, saving, notice, error }) {
  const { tr } = useLanguage();
  const [editor, setEditor] = useState(null);
  const [draftError, setDraftError] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const sections = [
    {
      key: 'currentCommittee',
      title: 'Current Committee',
      description: 'Add committee members with role, contact details, short bio, and profile photo.',
      addLabel: 'Add member',
      fields: [
        ['name', 'Name', 'text'],
        ['role', 'Role / title', 'text'],
        ['email', 'Email', 'email'],
        ['phone', 'Phone', 'tel'],
        ['bio', 'Short bio', 'textarea']
      ]
    },
    {
      key: 'sponsors',
      title: 'Our Sponsors',
      description: 'Add sponsor logos, sponsor level, website, and recognition text.',
      addLabel: 'Add sponsor',
      fields: [
        ['name', 'Sponsor name', 'text'],
        ['level', 'Level', 'text'],
        ['website', 'Website', 'url'],
        ['note', 'Recognition note', 'textarea']
      ]
    },
    {
      key: 'pastCommittees',
      title: 'Past Committees',
      description: 'Add previous committee terms, group photos, and member details.',
      addLabel: 'Add past committee',
      fields: [
        ['term', 'Term / year', 'text'],
        ['title', 'Committee title', 'text'],
        ['members', 'Members / notes', 'textarea']
      ]
    }
  ];

  const activeSection = editor ? sections.find((section) => section.key === editor.sectionKey) : null;

  function getRowTitle(sectionKey, row) {
    if (sectionKey === 'pastCommittees') return row.title || row.term || 'Past committee';
    if (sectionKey === 'sponsors') return row.name || row.level || 'Sponsor logo';
    return row.name || 'Untitled';
  }

  function getRowMeta(sectionKey, row) {
    if (sectionKey === 'currentCommittee') return [row.role, row.email, row.phone].filter(Boolean).join(' · ') || 'Committee member';
    if (sectionKey === 'sponsors') return [row.level, row.website].filter(Boolean).join(' · ') || 'Sponsor';
    return row.term || 'Past committee';
  }

  function getRowNote(sectionKey, row) {
    if (sectionKey === 'currentCommittee') return row.bio;
    if (sectionKey === 'sponsors') return row.note;
    return row.members;
  }

  function openAdd(sectionKey) {
    setDraftError('');
    setEditor({ mode: 'add', sectionKey, draft: makeAboutRow(sectionKey) });
  }

  function openEdit(sectionKey, row) {
    setDraftError('');
    setEditor({ mode: 'edit', sectionKey, rowId: row.id, draft: { ...makeAboutRow(sectionKey), ...row } });
  }

  function updateDraft(field, value) {
    setDraftError('');
    setEditor((current) => ({ ...current, draft: { ...current.draft, [field]: value } }));
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (!editor) return;
    const sectionKey = editor.sectionKey;
    const draft = { ...editor.draft };
    if (sectionKey === 'currentCommittee' && !cleanText(draft.name)) {
      setDraftError('Name is required.');
      return;
    }
    if (sectionKey === 'sponsors' && !cleanText(draft.name) && !cleanText(draft.level) && !cleanText(draft.website) && !cleanText(draft.note) && !cleanText(draft.photo)) {
      setDraftError('Add a sponsor name, details, or upload a sponsor image.');
      return;
    }
    if (sectionKey === 'pastCommittees' && !cleanText(draft.term) && !cleanText(draft.title)) {
      setDraftError('Term or committee title is required.');
      return;
    }
    const cleaned = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, key === 'id' ? value : cleanText(value)]));
    const nextContent = {
      ...content,
      [sectionKey]: editor.mode === 'edit'
        ? content[sectionKey].map((row) => (row.id === editor.rowId ? cleaned : row))
        : [...content[sectionKey], cleaned]
    };
    setDraftSaving(true);
    const saved = await onSave(nextContent);
    setDraftSaving(false);
    if (saved) setEditor(null);
  }

  async function removeRow(sectionKey, rowId) {
    const confirmed = window.confirm('Remove this item from the About page?');
    if (!confirmed) return;
    const nextContent = {
      ...content,
      [sectionKey]: content[sectionKey].filter((row) => row.id !== rowId)
    };
    await onSave(nextContent);
  }

  async function uploadDraftPhoto(file) {
    if (!file || file.size === 0) return;
    const imageError = validateImageFile(file);
    if (imageError) {
      setDraftError(imageError);
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    let photo = dataUrl;
    try {
      const uploaded = await apiUploadFile({
        dataUrl,
        fileName: file.name,
        container: 'assets',
        directory: 'about'
      });
      photo = uploaded.url || dataUrl;
    } catch {
      photo = dataUrl;
    }
    updateDraft('photo', photo);
  }

  return (
    <>
      <section className="about-admin-hero">
        <div>
          <p className="eyebrow">{tr('About Us')}</p>
          <h2>{tr('Manage public About page')}</h2>
          <p>{tr('Upload committee photos, sponsor logos, and past committee details. The public About page updates after saving.')}</p>
        </div>
        <button className="button" type="button" onClick={() => onSave()} disabled={saving}>
          <Save size={17} /> {saving ? tr('Saving...') : tr('Save About Page')}
        </button>
      </section>
      {error && <p className="form-error admin-floating-message">{error}</p>}
      {notice && <p className="success admin-floating-message">{notice}</p>}
      <div className="about-admin-grid">
        {sections.map((section) => (
          <section className="admin-page-panel about-admin-section" key={section.key}>
            <div className="admin-page-panel-heading">
              <div>
                <h2>{tr(section.title)}</h2>
                <p>{tr(section.description)}</p>
              </div>
              <div className="about-admin-heading-actions">
                <span>{content[section.key].length}</span>
                <button className="mini-action-link secondary" type="button" onClick={() => openAdd(section.key)}>
                  <Plus size={14} /> {tr(section.addLabel)}
                </button>
              </div>
            </div>
            <div className="about-admin-directory-table">
              {content[section.key].map((row) => (
                <article className="about-admin-directory-row" key={row.id}>
                  <div className="about-admin-directory-photo">
                    {row.photo ? <img src={row.photo} alt={getRowTitle(section.key, row)} /> : <ImagePlus size={24} />}
                  </div>
                  <div className="about-admin-directory-main">
                    <strong>{getRowTitle(section.key, row)}</strong>
                    <span>{getRowMeta(section.key, row)}</span>
                    {getRowNote(section.key, row) && <p>{getRowNote(section.key, row)}</p>}
                  </div>
                  <div className="about-admin-directory-actions">
                    <button className="icon-button table-icon-button" type="button" data-label={tr('Edit')} onClick={() => openEdit(section.key, row)} title={tr('Edit')} aria-label={tr('Edit')}>
                      <Edit3 size={15} />
                    </button>
                    <button className="icon-button table-icon-button danger" type="button" data-label={tr('Remove')} onClick={() => removeRow(section.key, row.id)} title={tr('Remove')} aria-label={tr('Remove')}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {content[section.key].length === 0 && (
              <button className="button secondary about-add-button" type="button" onClick={() => openAdd(section.key)}>
                <Plus size={16} /> {tr(section.addLabel)}
              </button>
            )}
          </section>
        ))}
      </div>
      {editor && activeSection && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup-panel about-admin-modal" role="dialog" aria-modal="true" aria-label={editor.mode === 'edit' ? `Edit ${activeSection.title}` : activeSection.addLabel}>
            <button className="popup-close" type="button" aria-label="Close popup" onClick={() => setEditor(null)}>
              <X size={20} />
            </button>
            <form className="about-admin-modal-form" onSubmit={saveDraft}>
              <div className="paata-admin-section-title">
                <span>{editor.mode === 'edit' ? <Edit3 size={18} /> : <Plus size={18} />}</span>
                <div>
                  <h2>{editor.mode === 'edit' ? tr(`Edit ${activeSection.title}`) : tr(activeSection.addLabel)}</h2>
                  <p>{tr(activeSection.description)}</p>
                </div>
              </div>
              <div className="about-admin-modal-layout">
                <div className="about-admin-photo-editor">
                  <div className="about-admin-photo-preview">
                    {editor.draft.photo ? <img src={editor.draft.photo} alt={getRowTitle(editor.sectionKey, editor.draft)} /> : <ImagePlus size={34} />}
                  </div>
                  <label>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadDraftPhoto(event.target.files?.[0])} />
                    <ImagePlus size={15} /> {tr('Upload photo')}
                  </label>
                </div>
                <div className="about-admin-fields about-admin-modal-fields">
                  {activeSection.fields.map(([field, label, type]) => (
                    <label key={field} className={type === 'textarea' || field === 'website' ? 'is-wide' : ''}>
                      <span>{tr(label)}</span>
                      {type === 'textarea' ? (
                        <textarea value={editor.draft[field] || ''} onChange={(event) => updateDraft(field, event.target.value)} rows={4} />
                      ) : (
                        <input type={type} value={editor.draft[field] || ''} onChange={(event) => updateDraft(field, event.target.value)} />
                      )}
                    </label>
                  ))}
                </div>
              </div>
              <div className="paata-teacher-form-actions">
                <button className="button secondary-dark" type="button" onClick={() => setEditor(null)} disabled={draftSaving}>
                  <X size={16} /> {tr('Cancel')}
                </button>
                <button className="button primary" type="submit" disabled={draftSaving || saving}>
                  <Save size={16} /> {draftSaving ? tr('Saving...') : editor.mode === 'edit' ? tr('Update') : tr('Add')}
                </button>
              </div>
              {draftError && <p className="form-error">{draftError}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function makePaataTeacher() {
  return {
    id: `paata-teacher-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    role: '',
    level: '',
    email: '',
    phone: '',
    bio: '',
    photo: ''
  };
}

function PaataTeacherEditor({ teachers, setTeachers, onSave, saving, notice, error }) {
  const { tr } = useLanguage();
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState(() => makePaataTeacher());
  const [draftError, setDraftError] = useState('');

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDraftError('');
  }

  function resetDraft() {
    setEditingId('');
    setDraft(makePaataTeacher());
    setDraftError('');
  }

  function saveDraft(event) {
    event.preventDefault();
    const cleaned = normalizePaataTeachers([{ ...draft, id: editingId || draft.id || makePaataTeacher().id }])[0];
    if (!cleaned?.name) {
      setDraftError('Teacher name is required.');
      return;
    }
    if (cleaned.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) {
      setDraftError('Enter a valid teacher email.');
      return;
    }

    setTeachers((current) => {
      if (editingId) {
        return current.map((teacher) => (teacher.id === editingId ? { ...cleaned, id: editingId } : teacher));
      }
      return [...current, { ...cleaned, id: cleaned.id || makePaataTeacher().id }];
    });
    resetDraft();
  }

  function editTeacher(teacher) {
    setEditingId(teacher.id);
    setDraft({ ...makePaataTeacher(), ...teacher });
    setDraftError('');
  }

  function removeTeacher(id) {
    setTeachers((current) => current.filter((teacher) => teacher.id !== id));
    if (editingId === id) resetDraft();
  }

  async function uploadTeacherPhoto(file) {
    if (!file || file.size === 0) return;
    const imageError = validateImageFile(file);
    if (imageError) {
      setDraftError(imageError);
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    let photo = dataUrl;
    try {
      const uploaded = await apiUploadFile({
        dataUrl,
        fileName: file.name,
        container: 'assets',
        directory: 'paata-teachers'
      });
      photo = uploaded.url || dataUrl;
    } catch {
      photo = dataUrl;
    }
    updateDraft('photo', photo);
  }

  return (
    <>
      {error && <p className="form-error admin-floating-message">{error}</p>}
      {notice && <p className="success admin-floating-message">{notice}</p>}
      <div className="paata-admin-workspace">
        <section className="admin-page-panel paata-teacher-form-panel">
          <div className="paata-admin-section-title">
            <span><UserPlus size={18} /></span>
            <div>
              <h2>{editingId ? tr('Edit teacher') : tr('Add new teacher')}</h2>
            </div>
          </div>
          {draftError && <p className="form-error">{draftError}</p>}
          <form className="paata-teacher-admin-form" onSubmit={saveDraft}>
            <div className="paata-teacher-photo-editor">
              <label className="paata-teacher-upload-box">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadTeacherPhoto(event.target.files?.[0])} />
                {draft.photo ? (
                  <img src={draft.photo} alt={draft.name || 'Teacher'} />
                ) : (
                  <>
                    <ImagePlus size={34} />
                    <span>{tr('Click to upload photo')}</span>
                    <small>{tr('PNG, JPG or JPEG (Max 5MB)')}</small>
                  </>
                )}
              </label>
            </div>
            <div className="paata-teacher-form-grid">
              <label><span>{tr('Teacher name')}</span><input value={draft.name || ''} onChange={(event) => updateDraft('name', event.target.value)} placeholder="Teacher name" /></label>
              <label><span>{tr('Role / title')}</span><input value={draft.role || ''} onChange={(event) => updateDraft('role', event.target.value)} placeholder="Lead teacher" /></label>
              <label><span>{tr('Class level')}</span><input value={draft.level || ''} onChange={(event) => updateDraft('level', event.target.value)} placeholder="Level 1" /></label>
              <label><span>{tr('Email')}</span><input type="email" value={draft.email || ''} onChange={(event) => updateDraft('email', event.target.value)} placeholder="teacher@example.com" /></label>
              <label><span>{tr('Phone')}</span><input type="tel" value={draft.phone || ''} onChange={(event) => updateDraft('phone', event.target.value)} placeholder="Phone number" /></label>
              <label className="paata-teacher-bio-field"><span>{tr('Short bio')}</span><textarea rows={4} value={draft.bio || ''} onChange={(event) => updateDraft('bio', event.target.value)} placeholder="Short teacher profile for public page" /></label>
            </div>
            <div className="paata-teacher-form-actions">
              <button className="button" type="submit">
                {editingId ? <Save size={16} /> : <Plus size={16} />} {editingId ? tr('Update teacher') : tr('Add teacher')}
              </button>
              <button className="button secondary" type="button" onClick={resetDraft}>
                <X size={16} /> {tr('Clear')}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-page-panel paata-teacher-list-panel">
          <div className="admin-page-panel-heading">
            <div>
              <h2>{tr('Saved teachers')} <span>({teachers.length})</span></h2>
            </div>
            <button className="button paata-save-list-button" type="button" onClick={onSave} disabled={saving}>
              <Save size={17} /> {saving ? tr('Saving...') : tr('Save Teachers')}
            </button>
          </div>
          <div className="paata-admin-teacher-list">
            {teachers.map((teacher) => (
              <article className={editingId === teacher.id ? 'paata-admin-teacher-row is-editing' : 'paata-admin-teacher-row'} key={teacher.id}>
                <div className="paata-admin-teacher-avatar">
                  {teacher.photo ? <img src={teacher.photo} alt={teacher.name || 'Teacher'} /> : <GraduationCap size={26} />}
                </div>
                <div className="paata-admin-teacher-summary">
                  <strong>{teacher.name || tr('Unnamed teacher')}</strong>
                  <div className="paata-admin-teacher-badges">
                    <span>{teacher.role || tr('Teacher')}</span>
                    <span>{teacher.level || tr('Level not set')}</span>
                  </div>
                  <div>
                    {teacher.email && <small><Mail size={13} /> {teacher.email}</small>}
                    {teacher.phone && <small><Phone size={13} /> {teacher.phone}</small>}
                  </div>
                  {teacher.bio && <p>{teacher.bio}</p>}
                </div>
                <div className="paata-admin-teacher-actions">
                  <button className="icon-button" type="button" onClick={() => editTeacher(teacher)} title={tr('Edit teacher')} aria-label={tr('Edit teacher')}>
                    <Edit3 size={16} />
                  </button>
                  <button className="icon-button danger" type="button" onClick={() => removeTeacher(teacher.id)} title={tr('Delete teacher')} aria-label={tr('Delete teacher')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {teachers.length === 0 && (
              <div className="empty-state compact-empty-state">
                <GraduationCap size={28} />
                <strong>{tr('No teachers added yet')}</strong>
                <p>{tr('Use the form to add teacher details and photos.')}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
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
    newsletterSubscribers: [],
    expenses: readJson('kb-expense-submissions', []),
    announcements: initialAnnouncements.rows,
    classes: [],
    events: [],
    fundraisers: readJson('kb-admin-fundraisers', []),
    attendance: readJson('kb-attendance-records', []),
    emailOutbox: []
  }));
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    apiAdminDashboard()
      .then((records) => {
        if (!ignore) {
          const currentUser = getCurrentUser();
          const currentEmail = String(currentUser?.email || '').toLowerCase();
          const refreshedCurrentUser = (records.users || []).find((row) => String(row.email || '').toLowerCase() === currentEmail);
          const effectiveUser = refreshedCurrentUser ? { ...currentUser, ...refreshedCurrentUser } : currentUser;
          if (refreshedCurrentUser && JSON.stringify(refreshedCurrentUser.roles || []) !== JSON.stringify(currentUser?.roles || [])) {
            setCurrentUser(effectiveUser);
          }
          const canSeeAllRegistrations = isAdmin(effectiveUser) || hasAnyRole(effectiveUser, ['welcomeDesk', 'welcomedesk', 'receptionist', 'teacher']);
          const canSeeAllExpenses = isAdmin(effectiveUser) || hasAnyRole(effectiveUser, ['treasurer']);
          const canSeeOwnExpenses = canSeeAllExpenses || hasAnyRole(effectiveUser, ['volunteer']);
          const localRegistrations = readJson('kb-registration-submissions', []).filter((row) => (
            canSeeAllRegistrations || String(row.email || '').toLowerCase() === currentEmail
          ));
          const localExpenses = readJson('kb-expense-submissions', []).filter((row) => (
            canSeeAllExpenses || (canSeeOwnExpenses && String(row.submittedBy || row.submitted_by || '').toLowerCase() === currentEmail)
          ));
          const localAnnouncements = withAnnouncementKeys(readJson('kb-announcement-submissions', seedAnnouncements));
          if (localAnnouncements.changed) writeJson('kb-announcement-submissions', localAnnouncements.rows);
          const dashboardAnnouncements = records.announcements?.length
            ? records.announcements
            : localAnnouncements.rows;
          setDashboard((current) => ({
            ...current,
            ...records,
            registrations: records.registrations?.length ? records.registrations : localRegistrations,
            expenses: records.expenses?.length ? records.expenses : localExpenses,
            announcements: dashboardAnnouncements,
            fundraisers: records.fundraisers?.length ? records.fundraisers : readJson('kb-admin-fundraisers', []),
            attendance: records.attendance?.length ? records.attendance : readJson('kb-attendance-records', [])
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
  const location = useLocation();
  const { tr } = useLanguage();
  const user = getCurrentUser();
  const { dashboard, setDashboard, refresh } = useAdminData();
  const [modalType, setModalType] = useState(null);
  const [expenseError, setExpenseError] = useState('');
  const [expenseSaved, setExpenseSaved] = useState(false);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseQuery, setExpenseQuery] = useState('');
  const [expenseReceiptName, setExpenseReceiptName] = useState('');
  const [announcementError, setAnnouncementError] = useState('');
  const [announcementSaved, setAnnouncementSaved] = useState(false);
  const [siteMessage, setSiteMessage] = useState(() => readJson('kb-site-message', { enabled: false, title: '', message: '', ctaText: '', ctaUrl: '' }));
  const [siteMessageError, setSiteMessageError] = useState('');
  const [siteMessageSaved, setSiteMessageSaved] = useState(false);
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
  const [editRecord, setEditRecord] = useState(null);
  const [guestRegistrationOpen, setGuestRegistrationOpen] = useState(false);
  const [checkedInIds, setCheckedInIds] = useState(() => readJson('kb-checkin-records', []));
  const [eventTypes, setEventTypes] = useState(() => readJson('kb-event-types', defaultEventTypes));
  const [recurrences, setRecurrences] = useState(() => readJson('kb-recurrence-options', defaultRecurrences));
  const [volunteerGoogleForm, setVolunteerGoogleForm] = useState(() => readJson('kb-volunteer-google-form', defaultVolunteerGoogleForm));
  const [aboutContent, setAboutContent] = useState(() => normalizeAboutContent(readJson('kb-about-content', defaultAboutContent)));
  const [aboutSaving, setAboutSaving] = useState(false);
  const [aboutNotice, setAboutNotice] = useState('');
  const [aboutError, setAboutError] = useState('');
  const [paataTeachers, setPaataTeachers] = useState(() => normalizePaataTeachers(readJson('kb-paata-teachers', defaultPaataTeachers)));
  const [paataTeachersSaving, setPaataTeachersSaving] = useState(false);
  const [paataTeachersNotice, setPaataTeachersNotice] = useState('');
  const [paataTeachersError, setPaataTeachersError] = useState('');
  const [roleDefinitions, setRoleDefinitions] = useState(() => readJson('kb-role-definitions', []));
  const [roleAccessNotice, setRoleAccessNotice] = useState('');
  const [roleAccessError, setRoleAccessError] = useState('');
  const [teacherAllotments, setTeacherAllotments] = useState(() => readJson('kb-teacher-allotments', []));
  const [teacherAllotmentNotice, setTeacherAllotmentNotice] = useState('');
  const [teacherAllotmentError, setTeacherAllotmentError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [emailOutboxNotice, setEmailOutboxNotice] = useState('');
  const [emailOutboxError, setEmailOutboxError] = useState('');
  const [bulkEmail, setBulkEmail] = useState({ audience: 'all-users', target: '', sending: false, notice: '', error: '' });
  const [userSearchResult, setUserSearchResult] = useState(null);
  const [userSearchError, setUserSearchError] = useState('');
  const [seatError, setSeatError] = useState('');
  const [seatNotice, setSeatNotice] = useState('');
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatLoaded, setSeatLoaded] = useState(false);
  const [seatSaving, setSeatSaving] = useState(false);
  const [seatActionId, setSeatActionId] = useState('');
  const [seatRecords, setSeatRecords] = useState([]);
  const [seatApiRegistrations, setSeatApiRegistrations] = useState([]);
  const [seatEventTitle, setSeatEventTitle] = useState('');
  const [selectedSeatNumber, setSelectedSeatNumber] = useState('');
  const [selectedSeatRegistrationId, setSelectedSeatRegistrationId] = useState('');
  const [selectedSeatAssignedName, setSelectedSeatAssignedName] = useState('');
  const [studentViewTab, setStudentViewTab] = useState('registrations');
  const [studentViewSelectedName, setStudentViewSelectedName] = useState('');
  const [dashboardEventSearch, setDashboardEventSearch] = useState('');
  const [teacherDirectoryQuery, setTeacherDirectoryQuery] = useState('');
  const registrations = dashboard.registrations || [];
  const users = dashboard.users || [];
  const donations = dashboard.donations || [];
  const volunteers = dashboard.volunteers || [];
  const contacts = (dashboard.contacts || []).filter((row) => row.topic !== 'Newsletter');
  const newsletterSubscribers = dashboard.newsletterSubscribers || [];
  const expenses = dashboard.expenses || [];
  const programs = dashboard.classes?.length ? dashboard.classes : fallbackPrograms;
  const allEvents = dashboard.events?.length ? dashboard.events : events;
  const announcements = dashboard.announcements || [];
  const fundraisers = dashboard.fundraisers || [];
  const emailOutbox = dashboard.emailOutbox || [];
  const attendanceRecords = dashboard.attendance || [];
  const profile = readJson(memberProfileKey(user?.email), {});
  const profileChildren = readJson(memberChildrenKey(user?.email), []);
  const eventOptionMap = new Map();
  const addEventOption = (title, item = {}, preferExisting = false) => {
    if (!title) return;
    const current = eventOptionMap.get(title) || {};
    if (preferExisting && current.title) return;
    eventOptionMap.set(title, {
      ...current,
      ...item,
      title,
      eventId: item.eventId || item.id || current.eventId || current.id || makeEventId(title),
      capacity: Number(item.capacity ?? current.capacity ?? item.totalSeats ?? current.totalSeats ?? item.seats ?? current.seats ?? 0)
    });
  };
  allEvents.forEach((item) => addEventOption(item.title, item));
  programs.forEach((item) => addEventOption(item.title, item, true));
  registrations
    .filter((item) => item.program)
    .forEach((item) => addEventOption(item.program, { title: item.program, eventId: item.eventId }, true));
  const eventOptions = [...eventOptionMap.values()];
  const selectedCheckinEvent = eventOptions.find((item) => item.title === checkinProgram) || eventOptions[0] || {};
  const expectedEventId = selectedCheckinEvent.eventId || '';
  const firstSeatEventTitle = eventOptions[0]?.title || '';
  const selectedSeatEvent = eventOptions.find((item) => item.title === seatEventTitle) || eventOptions[0] || {};
  const selectedSeatEventId = selectedSeatEvent.eventId || selectedSeatEvent.id || makeEventId(selectedSeatEvent.title || 'Event');
  const selectedCheckinTitle = selectedCheckinEvent.title || '';
  const selectedCheckinIsClassroom = isClassroomEvent(selectedCheckinEvent) || programs.some((item) => item.title === selectedCheckinTitle);
  const checkinRows = checkinApplied
    ? registrations.filter((item) => {
        const matchesEvent = item.program === selectedCheckinTitle || (expectedEventId && item.eventId === expectedEventId);
        if (!matchesEvent) return false;
        if (selectedCheckinIsClassroom) return true;
        const status = String(item.status || '').toLowerCase();
        return item.enabled !== false && status !== 'deleted' && (status.includes('confirmed') || isPaidRegistration(item) || isCheckedInRegistration(item));
      })
    : registrations;
  const dynamicCheckinColumns = getDynamicCheckinColumns(selectedCheckinEvent, checkinRows);
  const checkinAnalytics = getCheckinAnalytics(checkinRows, dynamicCheckinColumns, checkedInIds);
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
  const currentUserEmail = String(user?.email || '').toLowerCase();
  const userRegistrations = registrations.filter((item) => String(item.email || '').toLowerCase() === currentUserEmail);
  const userClassRegistrations = userRegistrations.filter((item) => (
    item.registrationType === 'class'
    || programs.some((program) => program.title === item.program)
    || /class|paata|shaale|guitar|dance|music|kannada/i.test(item.program || '')
  ));
  const userEventRegistrations = userRegistrations.filter((item) => !userClassRegistrations.includes(item));
  const memberOptions = [
    `${profile.firstName || user?.firstName || user?.name || user?.email || ''} ${profile.lastName || ''}`.trim(),
    ...profileChildren.map((child) => `${child.firstName || child.childFirstName} ${child.lastName || child.childLastName || ''}`.trim()).filter(Boolean)
  ].filter(Boolean);
  const volunteerGoogleFormSaved = normalizeVolunteerGoogleForm(volunteerGoogleForm);
  const volunteerGoogleFormReady = Boolean(volunteerGoogleFormSaved.enabled && volunteerGoogleFormSaved.url);
  const volunteerGoogleFormStatus = volunteerGoogleFormReady
    ? 'Enabled'
    : volunteerGoogleFormSaved.enabled
      ? 'Needs URL'
      : 'Disabled';
  const bulkEventOptions = uniqueOptions(registrations.filter((row) => row.registrationType !== 'class'), 'program');
  const bulkClassOptions = uniqueOptions(registrations.filter((row) => (
    row.registrationType === 'class'
    || programs.some((program) => program.title === row.program)
    || /class|paata|shaale|guitar|dance|music|kannada/i.test(row.program || '')
  )), 'program');
  const bulkRecipientCount = (() => {
    if (bulkEmail.audience === 'all-users') {
      return new Set(registeredUsers.map((row) => String(row.email || '').toLowerCase()).filter(Boolean)).size;
    }
    if (bulkEmail.audience === 'newsletter') {
      return new Set(newsletterSubscribers
        .filter((row) => String(row.status || 'Active').toLowerCase() === 'active')
        .map((row) => String(row.email || '').toLowerCase())
        .filter(Boolean)).size;
    }
    const rows = registrations.filter((row) => {
      const enabled = row.enabled !== false;
      const notDeleted = String(row.status || '').toLowerCase() !== 'deleted';
      const typeMatches = bulkEmail.audience === 'class'
        ? (row.registrationType === 'class' || programs.some((program) => program.title === row.program) || /class|paata|shaale|guitar|dance|music|kannada/i.test(row.program || ''))
        : row.registrationType !== 'class';
      return enabled && notDeleted && typeMatches && row.program === bulkEmail.target;
    });
    return new Set(rows.map((row) => String(row.email || '').toLowerCase()).filter(Boolean)).size;
  })();
  const assignedClassTitles = teacherAllotments
    .filter((row) => row.enabled !== false && String(row.teacherEmail || '').toLowerCase() === currentUserEmail)
    .map((row) => row.classTitle);
  const shouldLimitToAssignedClasses = !isAdmin(user) && hasAnyRole(user, ['teacher']) && assignedClassTitles.length > 0;
  const visibleTeacherPrograms = shouldLimitToAssignedClasses
    ? programs.filter((program) => assignedClassTitles.includes(program.title))
    : programs;
  const visibleTeacherRegistrations = shouldLimitToAssignedClasses
    ? registrations.filter((row) => assignedClassTitles.includes(row.program))
    : registrations;

  useEffect(() => {
    if (view !== 'seats') return;
    if (!seatEventTitle && firstSeatEventTitle) {
      setSeatEventTitle(firstSeatEventTitle);
      return;
    }
    if (!selectedSeatEventId) return;
    let ignore = false;
    setSeatLoading(true);
    setSeatLoaded(false);
    setSeatError('');
    setSeatNotice('');
    apiReadSeats(selectedSeatEventId)
      .then((records) => {
        if (ignore) return;
        setSeatRecords(records.seats || []);
        setSeatApiRegistrations(records.registrations || []);
        setSeatLoaded(true);
      })
      .catch((error) => {
        if (ignore) return;
        setSeatRecords([]);
        setSeatApiRegistrations([]);
        setSeatError(error.message || 'Could not load seats. Check your login and API connection.');
      })
      .finally(() => {
        if (!ignore) setSeatLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [firstSeatEventTitle, seatEventTitle, selectedSeatEventId, view]);

  useEffect(() => {
    if (view !== 'seats') return;
    setSelectedSeatNumber('');
    setSelectedSeatRegistrationId('');
    setSelectedSeatAssignedName('');
    setSeatError('');
    setSeatNotice('');
  }, [seatEventTitle, view]);

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

  useEffect(() => {
    if (view !== 'about') return;
    let ignore = false;
    apiReadAboutContent()
      .then((setting) => {
        if (ignore) return;
        const normalized = normalizeAboutContent(setting);
        setAboutContent(normalized);
        writeJson('kb-about-content', normalized);
        window.dispatchEvent(new Event('kb-data-change'));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'paata-teachers') return;
    let ignore = false;
    apiReadSiteSetting('paata-teachers')
      .then((rows) => {
        if (ignore) return;
        const normalized = normalizePaataTeachers(rows);
        setPaataTeachers(normalized);
        writeJson('kb-paata-teachers', normalized);
        window.dispatchEvent(new Event('kb-data-change'));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'role-access') return;
    let ignore = false;
    apiReadSiteSetting('role-definitions')
      .then((rows) => {
        if (ignore) return;
        const normalized = normalizeRoleDefinitions(rows);
        setRoleDefinitions(normalized);
        writeJson('kb-role-definitions', normalized);
        window.dispatchEvent(new Event('kb-data-change'));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'teacher-allotments') return;
    let ignore = false;
    apiReadSiteSetting('teacher-allotments')
      .then((rows) => {
        if (ignore) return;
        const normalized = normalizeTeacherAllotments(rows);
        setTeacherAllotments(normalized);
        writeJson('kb-teacher-allotments', normalized);
        window.dispatchEvent(new Event('kb-data-change'));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [view]);

  useEffect(() => {
    if (!['teacher', 'teacher-attendance'].includes(view)) return;
    let ignore = false;
    apiReadSiteSetting('teacher-allotments')
      .then((rows) => {
        if (ignore) return;
        const normalized = normalizeTeacherAllotments(rows);
        setTeacherAllotments(normalized);
        writeJson('kb-teacher-allotments', normalized);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'announcements') return;
    let ignore = false;
    apiReadSiteSetting('site-message')
      .then((setting) => {
        if (ignore) return;
        const nextMessage = setting || { enabled: false, title: '', message: '', ctaText: '', ctaUrl: '' };
        setSiteMessage(nextMessage);
        writeJson('kb-site-message', nextMessage);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [view]);

  if (!canAccessAdminPath(user, location.pathname)) {
    return <Navigate to={defaultAdminPath(user)} replace />;
  }

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
    let actionPayload = {};
    let nextFallbackPatch = fallbackPatch;
    if (action === 'paid') {
      const reference = window.prompt('Enter PayPal transaction/reference id for this payment:', getPaymentDetails(row)?.reference || '');
      if (reference === null) return;
      const notes = window.prompt('Payment notes (class/event, payer name, PayPal email, or receipt notes):', getPaymentDetails(row)?.notes || `${row.program || 'Registration'} - ${row.familyMember || row.studentName || row.parentName || ''}`);
      if (notes === null) return;
      const details = {
        method: 'PayPal',
        reference: cleanText(reference),
        notes: cleanText(notes),
        amount: getMoneyAmount(row),
        program: row.program || '',
        registrationType: row.registrationType || '',
        markedBy: user.email,
        updatedAt: new Date().toISOString()
      };
      actionPayload = { paymentDetails: details };
      nextFallbackPatch = mergeLocalPaymentDetails({ ...fallbackPatch, ...row }, details);
      nextFallbackPatch = { ...nextFallbackPatch, ...fallbackPatch };
    }

    const nextRow = { ...row, ...nextFallbackPatch };
    const nextRegistrations = registrations.map((item) => (sameRegistration(item, row) ? nextRow : item));
    updateLocalRegistrations(nextRegistrations);

    if (!row.id) return;
    try {
      const saved = await apiRegistrationAction(row.id, action, actionPayload);
      updateLocalRegistrations(nextRegistrations.map((item) => (sameRegistration(item, nextRow) ? saved : item)));
    } catch {
      try {
        const saved = await apiUpdateSubmission('registration', row.id, nextFallbackPatch);
        updateLocalRegistrations(nextRegistrations.map((item) => (sameRegistration(item, nextRow) ? saved : item)));
      } catch {
        // Keep local admin action result when API is unavailable.
      }
    }
  }

  function toggleRegistrationEnabled(row, enabled) {
    const currentStatus = String(row.status || '').toLowerCase();
    const nextStatus = enabled
      ? (currentStatus === 'deleted' ? 'Submitted' : row.status || 'Submitted')
      : 'Deleted';
    runRegistrationAction(row, enabled ? 'enable' : 'delete', { enabled, status: nextStatus });
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

  async function updateEvent(row, patch) {
    const nextEvents = allEvents.map((item) => (
      (item.id && row.id && item.id === row.id) || item.title === row.title
        ? { ...item, ...patch }
        : item
    ));
    writeJson('kb-admin-events', nextEvents);
    setDashboard((current) => ({ ...current, events: nextEvents }));
    window.dispatchEvent(new Event('kb-data-change'));

    if (!row.id) return;
    try {
      const saved = await apiUpdateSubmission('event', row.id, patch);
      const savedEvents = nextEvents.map((item) => (item.id === row.id ? saved : item));
      writeJson('kb-admin-events', savedEvents);
      setDashboard((current) => ({ ...current, events: savedEvents }));
      window.dispatchEvent(new Event('kb-data-change'));
    } catch {
      // Keep local event toggle state when the API is unavailable.
    }
  }

  async function cloneAdminRecord(kind, row) {
    const key = kind === 'class' ? 'kb-admin-classes' : 'kb-admin-events';
    const dashboardKey = kind === 'class' ? 'classes' : 'events';
    const payload = kind === 'class' ? cloneClassPayload(row) : cloneEventPayload(row);
    const localRecord = { ...payload, localId: `${kind}-clone-${Date.now()}`, createdAt: new Date().toISOString() };
    const localRows = [localRecord, ...(dashboard[dashboardKey] || [])];
    writeJson(key, localRows);
    setDashboard((current) => ({ ...current, [dashboardKey]: localRows }));
    window.dispatchEvent(new Event('kb-data-change'));

    try {
      const saved = await appendAdminRecordAsync(key, payload);
      const savedRows = [saved, ...localRows.filter((item) => item.localId !== localRecord.localId)];
      writeJson(key, savedRows);
      setDashboard((current) => ({ ...current, [dashboardKey]: savedRows }));
      setEditRecord({ kind, row: saved });
      window.dispatchEvent(new Event('kb-data-change'));
    } catch {
      setEditRecord({ kind, row: localRecord });
    }
  }

  async function saveRoleDefinitions(nextRoles) {
    const normalized = normalizeRoleDefinitions(nextRoles);
    setRoleDefinitions(normalized);
    writeJson('kb-role-definitions', normalized);
    setRoleAccessNotice('Role access saved.');
    setRoleAccessError('');
    window.dispatchEvent(new Event('kb-data-change'));
    try {
      const saved = await apiSaveSiteSetting('role-definitions', normalized);
      const savedNormalized = normalizeRoleDefinitions(saved);
      setRoleDefinitions(savedNormalized);
      writeJson('kb-role-definitions', savedNormalized);
      window.dispatchEvent(new Event('kb-data-change'));
    } catch (error) {
      setRoleAccessError(error.message || 'Role access saved locally, but database save failed.');
    }
  }

  async function saveTeacherAllotments(nextRows) {
    const normalized = normalizeTeacherAllotments(nextRows);
    setTeacherAllotments(normalized);
    writeJson('kb-teacher-allotments', normalized);
    setTeacherAllotmentNotice('Teacher allotments saved.');
    setTeacherAllotmentError('');
    window.dispatchEvent(new Event('kb-data-change'));
    try {
      const saved = await apiSaveSiteSetting('teacher-allotments', normalized);
      const savedNormalized = normalizeTeacherAllotments(saved);
      setTeacherAllotments(savedNormalized);
      writeJson('kb-teacher-allotments', savedNormalized);
      window.dispatchEvent(new Event('kb-data-change'));
    } catch (error) {
      setTeacherAllotmentError(error.message || 'Teacher allotments saved locally, but database save failed.');
    }
  }

  async function saveEditedRecord(kind, row, patch) {
    const idMatches = (item) => (
      (item.id && row.id && item.id === row.id)
      || (item.createdAt && row.createdAt && item.createdAt === row.createdAt)
      || (item.created_at && row.created_at && item.created_at === row.created_at)
      || (item.title && row.title && item.title === row.title)
      || (item.text && row.text && item.text === row.text)
      || (item.email && row.email && item.email === row.email && item.message === row.message)
    );
    const storageKeyByKind = {
      event: 'kb-admin-events',
      class: 'kb-admin-classes',
      announcement: 'kb-announcement-submissions',
      registration: 'kb-registration-submissions',
      fundraiser: 'kb-admin-fundraisers',
      donation: 'kb-donation-submissions',
      volunteer: 'kb-volunteer-submissions',
      contact: 'kb-contact-submissions',
      expense: 'kb-expense-submissions'
    };
    const dashboardKeyByKind = {
      event: 'events',
      class: 'classes',
      announcement: 'announcements',
      registration: 'registrations',
      fundraiser: 'fundraisers',
      donation: 'donations',
      volunteer: 'volunteers',
      contact: 'contacts',
      expense: 'expenses'
    };
    const currentRowsByKind = {
      event: allEvents,
      class: programs,
      announcement: announcements,
      registration: registrations,
      fundraiser: fundraisers,
      donation: donations,
      volunteer: volunteers,
      contact: contacts,
      expense: expenses
    };
    const currentRows = currentRowsByKind[kind] || [];
    const optimisticRow = { ...row, ...patch };
    const nextRows = currentRows.map((item) => (idMatches(item) ? optimisticRow : item));
    writeJson(storageKeyByKind[kind], nextRows);
    setDashboard((current) => ({ ...current, [dashboardKeyByKind[kind]]: nextRows }));
    window.dispatchEvent(new Event('kb-data-change'));

    if (!row.id) {
      setEditRecord(null);
      return;
    }

    try {
      const saved = await apiUpdateSubmission(kind, row.id, patch);
      const savedRows = nextRows.map((item) => (idMatches(item) ? saved : item));
      writeJson(storageKeyByKind[kind], savedRows);
      setDashboard((current) => ({ ...current, [dashboardKeyByKind[kind]]: savedRows }));
      window.dispatchEvent(new Event('kb-data-change'));
    } catch {
      // Keep optimistic edit for local/demo mode.
    } finally {
      setEditRecord(null);
    }
  }

  async function deleteAdminRecord(kind, row) {
    const confirmed = window.confirm(`Delete this ${kind} record?`);
    if (!confirmed) return;
    const idMatches = (item) => (
      (item.id && row.id && item.id === row.id)
      || (item.createdAt && row.createdAt && item.createdAt === row.createdAt)
      || (item.created_at && row.created_at && item.created_at === row.created_at)
      || (item.title && row.title && item.title === row.title)
      || (item.text && row.text && item.text === row.text)
      || (item.email && row.email && item.email === row.email && item.message === row.message)
    );
    const storageKeyByKind = {
      event: 'kb-admin-events',
      class: 'kb-admin-classes',
      announcement: 'kb-announcement-submissions',
      registration: 'kb-registration-submissions',
      fundraiser: 'kb-admin-fundraisers',
      donation: 'kb-donation-submissions',
      volunteer: 'kb-volunteer-submissions',
      contact: 'kb-contact-submissions',
      expense: 'kb-expense-submissions'
    };
    const dashboardKeyByKind = {
      event: 'events',
      class: 'classes',
      announcement: 'announcements',
      registration: 'registrations',
      fundraiser: 'fundraisers',
      donation: 'donations',
      volunteer: 'volunteers',
      contact: 'contacts',
      expense: 'expenses'
    };
    const currentRowsByKind = {
      event: allEvents,
      class: programs,
      announcement: announcements,
      registration: registrations,
      fundraiser: fundraisers,
      donation: donations,
      volunteer: volunteers,
      contact: contacts,
      expense: expenses
    };
    const currentRows = currentRowsByKind[kind] || [];
    const nextRows = currentRows.filter((item) => !idMatches(item));
    writeJson(storageKeyByKind[kind], nextRows);
    setDashboard((current) => ({ ...current, [dashboardKeyByKind[kind]]: nextRows }));
    window.dispatchEvent(new Event('kb-data-change'));

    if (!row.id) return;
    try {
      await apiDeleteSubmission(kind, row.id);
    } catch {
      // Keep optimistic delete for local/demo mode when the API is unavailable.
    }
  }

  function AdminRecordActions({ kind, row, canEdit = true, canDelete = true }) {
    const canClone = kind === 'event' || kind === 'class';
    return (
      <TableActionMenu
        primary={canEdit ? (
          <button className="mini-action-link secondary" type="button" onClick={() => setEditRecord({ kind, row })}>
            <Edit3 size={15} /> {tr('Edit')}
          </button>
        ) : null}
        items={[
          canClone && { label: 'Clone', icon: <Copy size={15} />, onClick: () => cloneAdminRecord(kind, row) },
          canEdit && { label: 'Edit', icon: <Edit3 size={15} />, onClick: () => setEditRecord({ kind, row }) },
          canDelete && { label: 'Delete', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteAdminRecord(kind, row) }
        ]}
      />
    );
  }

  function RegistrationActionMenu({ row, checkinAction = null, checkedLabel = '' }) {
    const confirmed = (row.status || 'Submitted') === 'Confirmed';
    const paid = isPaidRegistration(row);
    const primary = checkinAction || (!confirmed
      ? <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'confirm', { status: 'Confirmed' })}>{tr('Confirm')}</button>
      : !paid
        ? <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'paid', { paid: true, paymentReceived: true, status: 'Confirmed', emailStatus: 'Payment sent' })}>{tr('Mark paid')}</button>
        : <span className="confirmed-badge">{checkedLabel || tr('Confirmed')}</span>);
    return (
      <TableActionMenu
        primary={primary}
        items={[
          { label: 'View details', icon: <Eye size={15} />, onClick: () => setRegistrationDetail(row) },
          { label: 'Edit', icon: <Edit3 size={15} />, onClick: () => setEditRecord({ kind: 'registration', row }) },
          !confirmed && { label: 'Confirm', icon: <CheckCircle size={15} />, onClick: () => runRegistrationAction(row, 'confirm', { status: 'Confirmed' }) },
          !paid && { label: 'Mark paid', icon: <CheckCircle size={15} />, onClick: () => runRegistrationAction(row, 'paid', { paid: true, paymentReceived: true, status: 'Confirmed', emailStatus: 'Payment sent' }) },
          { label: 'Email', icon: <Mail size={15} />, onClick: () => runRegistrationAction(row, 'emailstatus', { emailStatus: 'Sent' }) },
          { label: 'Reset status', icon: <RefreshCw size={15} />, onClick: () => runRegistrationAction(row, 'reset', { status: 'Submitted' }) },
          { label: 'Delete', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteAdminRecord('registration', row) }
        ]}
      />
    );
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
    const adults = Number(payload.adults || 1);
    const kids = Number(payload.kids || 0);
    const youngKids = Number(payload.youngKids || 0);
    const totalMembers = Math.max(1, adults + kids + youngKids);
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
      adults,
      kids,
      youngKids,
      totalMembers,
      seats: totalMembers,
      amount: Number(payload.amount || 0)
    });
    setDashboard((current) => ({ ...current, registrations: [...(current.registrations || []), record] }));
    event.currentTarget.reset();
    setGuestRegistrationOpen(false);
  }

  async function handleSeatSubmit(event) {
    event.preventDefault();
    setSeatError('');
    setSeatNotice('');
    if (!seatLoaded) {
      setSeatError('Seats are not loaded. Resolve the API or login error before saving.');
      return;
    }
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const eventId = cleanText(payload.eventId || selectedSeatEventId);
    const seatNumber = cleanText(payload.seatNumber || selectedSeatNumber);
    if (!eventId || !seatNumber) {
      setSeatError('Event id and seat number are required.');
      return;
    }
    const registrationId = payload.registrationId || selectedSeatRegistrationId || '';
    const selectedRegistration = [...seatApiRegistrations, ...registrations].find((row) => row.id === registrationId);
    const assignedTo = cleanText(payload.assignedTo)
      || selectedRegistration?.familyMember
      || selectedRegistration?.studentName
      || selectedRegistration?.parentName
      || null;
    const currentSeat = seatRecords.find((seat) => String(seat.seat_number || seat.seatNumber) === seatNumber);
    const status = assignedTo || registrationId
      ? (/checked/i.test(currentSeat?.status || '') ? 'Checked In' : 'Assigned')
      : 'Available';

    setSeatSaving(true);
    try {
      await apiCreateSeat({
        eventId,
        seatNumber,
        registrationId: registrationId || null,
        assignedTo,
        status
      });
      const records = await apiReadSeats(eventId);
      setSeatRecords(records.seats || []);
      setSeatApiRegistrations(records.registrations || []);
      setSelectedSeatRegistrationId('');
      setSelectedSeatAssignedName('');
      setSeatNotice(status === 'Available' ? `Seat ${seatNumber} is now available.` : `Seat ${seatNumber} assignment saved.`);
      refresh();
    } catch (error) {
      setSeatError(error.message || 'Could not save seat.');
    } finally {
      setSeatSaving(false);
    }
  }

  async function handleSeatCheckIn(seat, checkedIn) {
    setSeatError('');
    setSeatNotice('');
    if (!seat?.id) {
      setSeatError('Save this seat assignment before changing its check-in status.');
      return;
    }
    const actionKey = String(seat.id);
    setSeatActionId(actionKey);
    try {
      await apiUpdateSeat(seat.id, { status: checkedIn ? 'Checked In' : 'Assigned' });
      const records = await apiReadSeats(selectedSeatEventId);
      setSeatRecords(records.seats || []);
      setSeatApiRegistrations(records.registrations || []);
      setSeatNotice(`Seat ${seat.seatNumber} marked ${checkedIn ? 'checked in' : 'assigned'}.`);
    } catch (error) {
      setSeatError(error.message || 'Could not update the seat check-in status.');
    } finally {
      setSeatActionId('');
    }
  }

  async function resendOutboxEmail(row) {
    if (!row.id) return;
    setEmailOutboxNotice('');
    setEmailOutboxError('');
    try {
      await apiSendOutboxEmail(row.id);
      setEmailOutboxNotice('Email sent successfully.');
      refresh();
    } catch (error) {
      setEmailOutboxError(error.message || 'Could not send email. Check SMTP settings.');
    }
  }

  async function sendTestEmail() {
    setEmailOutboxNotice('');
    setEmailOutboxError('');
    try {
      await apiSendTestEmail(user?.email);
      setEmailOutboxNotice(`Test email sent to ${user?.email || 'the admin email'}.`);
      refresh();
    } catch (error) {
      setEmailOutboxError(error.message || 'Could not send test email. Check SMTP settings.');
    }
  }

  async function handleBulkEmailSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const audience = cleanText(payload.audience);
    const target = cleanText(payload.target);
    const ctaLabel = cleanText(payload.ctaLabel);
    const ctaUrl = cleanText(payload.ctaUrl);
    const validationError = firstError([
      validateRequired(audience, 'Audience'),
      ['event', 'class'].includes(audience) ? validateRequired(target, 'Target') : '',
      validateRequired(payload.subject, 'Subject'),
      cleanText(payload.subject).length < 4 ? 'Subject must be at least 4 characters.' : '',
      validateRequired(payload.body, 'Message'),
      cleanText(payload.body).length < 10 ? 'Message must be at least 10 characters.' : '',
      ctaLabel && !ctaUrl ? 'Action button URL is required when a label is entered.' : '',
      ctaUrl && !ctaLabel ? 'Action button label is required when a URL is entered.' : '',
      ctaUrl ? validateUrl(ctaUrl, 'Action button URL') : ''
    ]);

    if (validationError) {
      setBulkEmail((current) => ({ ...current, notice: '', error: validationError }));
      return;
    }

    setBulkEmail((current) => ({ ...current, sending: true, notice: '', error: '' }));
    try {
      const result = await apiSendBulkEmail({
        audience,
        target,
        subject: cleanText(payload.subject),
        contextLabel: cleanText(payload.contextLabel),
        intro: cleanText(payload.intro),
        body: cleanText(payload.body),
        eventDate: cleanText(payload.eventDate),
        eventTime: cleanText(payload.eventTime),
        eventVenue: cleanText(payload.eventVenue),
        highlights: cleanText(payload.highlights),
        agenda: cleanText(payload.agenda),
        registrationTitle: cleanText(payload.registrationTitle),
        registrationFee: cleanText(payload.registrationFee),
        registrationNote: cleanText(payload.registrationNote),
        communityNote: cleanText(payload.communityNote),
        sponsorAcknowledgement: cleanText(payload.sponsorAcknowledgement),
        footer: cleanText(payload.footer),
        ctaLabel,
        ctaUrl
      });
      form.reset();
      setBulkEmail({ audience: 'all-users', target: '', sending: false, notice: `Message prepared for ${result.count} recipient(s). Sent: ${result.sent}. Queued/stored: ${result.queued}.`, error: '' });
      refresh();
    } catch (error) {
      setBulkEmail((current) => ({ ...current, sending: false, notice: '', error: error.message || 'Could not send group email.' }));
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
    if (!row.id) {
      const next = checkedInIds.includes(key) ? checkedInIds : [...checkedInIds, key];
      writeJson('kb-checkin-records', next);
      setCheckedInIds(next);
      updateRegistration(row, { checkedIn: true, checkedInAt: new Date().toISOString() });
      return;
    }

    setCheckinError('');
    try {
      const result = await apiWelcomeDeskCheckIn({
        registrationId: row.id,
        registrationKey: key,
        eventId: row.eventId || expectedEventId
      });
      const checkedAt = result.registration?.checkedInAt || new Date().toISOString();
      const next = checkedInIds.includes(key) ? checkedInIds : [...checkedInIds, key];
      writeJson('kb-checkin-records', next);
      setCheckedInIds(next);
      const nextRow = result.registration || { ...row, checkedIn: true, checkedInAt: checkedAt };
      updateLocalRegistrations(registrations.map((item) => (sameRegistration(item, row) ? nextRow : item)));
    } catch (error) {
      setCheckinError(error.message || 'Already checked in.');
    }
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    setExpenseError('');
    setExpenseSaved(false);
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const receiptFile = form.elements.receipt?.files?.[0];
    const error = firstError([
      validateRequired(payload.title, 'Expense title'),
      validateRequired(payload.category, 'Category'),
      validateAmount(payload.amount, 'Amount', { min: 1 }),
      validateRequired(payload.expenseDate, 'Expense date'),
      validateRequired(payload.description, 'Description'),
      validateReceiptFile(receiptFile)
    ]);
    if (error) {
      setExpenseError(error);
      return;
    }

    setExpenseSubmitting(true);
    let receipt = {};
    try {
      if (receiptFile && receiptFile.size > 0) {
        const dataUrl = await readFileAsDataUrl(receiptFile);
        try {
          const uploaded = await apiUploadFile({
            dataUrl,
            fileName: receiptFile.name,
            container: 'users',
            directory: `expenses/${user.email}`
          });
          receipt = {
            receiptUrl: uploaded.url || dataUrl,
            receiptName: receiptFile.name,
            receiptType: receiptFile.type,
            receiptSize: receiptFile.size
          };
        } catch {
          receipt = {
            receiptUrl: dataUrl,
            receiptName: receiptFile.name,
            receiptType: receiptFile.type,
            receiptSize: receiptFile.size
          };
        }
      }

      const expensePayload = {
        title: cleanText(payload.title),
        category: cleanText(payload.category),
        amount: Number(payload.amount),
        expenseDate: payload.expenseDate,
        description: cleanText(payload.description),
        vendor: cleanText(payload.vendor),
        paymentMethod: payload.paymentMethod,
        reimbursementTo: cleanText(payload.reimbursementTo) || user.email,
        ...receipt,
        status: 'Submitted',
        submittedBy: user.email
      };

      let record;
      try {
        record = await apiAppendRecord('kb-expense-submissions', expensePayload);
      } catch {
        record = appendRecord('kb-expense-submissions', expensePayload);
      }
      record ||= appendRecord('kb-expense-submissions', expensePayload);
      setDashboard((current) => ({ ...current, expenses: [record, ...(current.expenses || [])] }));
      form.reset();
      setExpenseReceiptName('');
      setExpenseSaved(true);
    } catch (submitError) {
      setExpenseError(submitError.message || 'Could not submit expense. Please try again.');
    } finally {
      setExpenseSubmitting(false);
    }
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

  async function handleSiteMessageSubmit(event) {
    event.preventDefault();
    setSiteMessageError('');
    setSiteMessageSaved(false);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const enabled = Boolean(payload.enabled);
    const nextMessage = {
      enabled,
      title: cleanText(payload.title),
      message: cleanText(payload.message),
      ctaText: cleanText(payload.ctaText),
      ctaUrl: cleanText(payload.ctaUrl),
      updatedAt: new Date().toISOString()
    };
    const error = firstError([
      enabled ? validateRequired(nextMessage.title, 'Popup title') : '',
      enabled ? validateRequired(nextMessage.message, 'Popup message') : '',
      nextMessage.title.length > 90 ? 'Popup title must be 90 characters or fewer.' : '',
      nextMessage.message.length > 700 ? 'Popup message must be 700 characters or fewer.' : '',
      nextMessage.ctaText.length > 40 ? 'Button text must be 40 characters or fewer.' : '',
      nextMessage.ctaUrl ? validateUrl(nextMessage.ctaUrl, 'Popup button URL') : ''
    ]);

    if (error) {
      setSiteMessageError(error);
      return;
    }

    writeJson('kb-site-message', nextMessage);
    setSiteMessage(nextMessage);
    try {
      const saved = await apiSaveSiteSetting('site-message', nextMessage);
      const finalMessage = saved || nextMessage;
      writeJson('kb-site-message', finalMessage);
      setSiteMessage(finalMessage);
      setSiteMessageSaved(true);
      window.dispatchEvent(new Event('kb-data-change'));
    } catch (saveError) {
      setSiteMessageError(saveError.message || 'Could not save popup message.');
    }
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
    setSettingsSaved(true);
    window.dispatchEvent(new Event('kb-data-change'));
  }

  function addSettingPrompt(key, values, setter, label, placeholder) {
    setSettingsError('');
    setSettingsSaved(false);
    const value = cleanText(window.prompt(`Add ${label.toLowerCase()}`, placeholder || ''));
    if (!value) return;
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setSettingsError(`${label} already exists.`);
      return;
    }
    saveEventSettings(key, setter, [...values, value].sort());
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

  function editSetting(key, values, setter, value, label) {
    setSettingsError('');
    setSettingsSaved(false);
    const nextValue = cleanText(window.prompt(`Edit ${label.toLowerCase()}`, value));
    if (!nextValue || nextValue === value) return;
    if (values.some((item) => item !== value && item.toLowerCase() === nextValue.toLowerCase())) {
      setSettingsError(`${label} already exists.`);
      return;
    }
    saveEventSettings(key, setter, values.map((item) => (item === value ? nextValue : item)).sort());
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

  async function handleAboutContentSave(contentOverride = aboutContent) {
    setAboutError('');
    setAboutNotice('');
    const normalized = normalizeAboutContent(contentOverride);
    const cleaned = {
      currentCommittee: normalized.currentCommittee.filter((row) => row.name || row.role || row.email || row.phone || row.bio || row.photo),
      sponsors: normalized.sponsors.filter((row) => row.name || row.level || row.website || row.note || row.photo),
      pastCommittees: normalized.pastCommittees.filter((row) => row.term || row.title || row.members || row.photo)
    };
    const validationError = firstError([
      cleaned.currentCommittee.some((row) => !row.name) ? 'Each current committee row needs a name.' : '',
      cleaned.pastCommittees.some((row) => !row.term && !row.title) ? 'Each past committee row needs a term or title.' : ''
    ]);

    if (validationError) {
      setAboutError(validationError);
      return false;
    }

    setAboutSaving(true);
    try {
      const saved = await apiSaveAboutContent(cleaned);
      const nextContent = normalizeAboutContent(saved || cleaned);
      writeJson('kb-about-content', nextContent);
      setAboutContent(nextContent);
      setAboutNotice('About page content saved.');
      window.dispatchEvent(new Event('kb-data-change'));
      return true;
    } catch (error) {
      setAboutError(error.message || 'Could not save About page content.');
      return false;
    } finally {
      setAboutSaving(false);
    }
  }

  async function handlePaataTeachersSave() {
    setPaataTeachersError('');
    setPaataTeachersNotice('');
    const cleaned = normalizePaataTeachers(paataTeachers)
      .filter((teacher) => teacher.name || teacher.role || teacher.level || teacher.email || teacher.phone || teacher.bio || teacher.photo);
    const validationError = firstError([
      cleaned.length === 0 ? 'Add at least one teacher.' : '',
      cleaned.some((teacher) => !teacher.name) ? 'Each teacher row needs a teacher name.' : '',
      cleaned.some((teacher) => teacher.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email)) ? 'Enter a valid teacher email.' : ''
    ]);

    if (validationError) {
      setPaataTeachersError(validationError);
      return;
    }

    setPaataTeachersSaving(true);
    writeJson('kb-paata-teachers', cleaned);
    setPaataTeachers(cleaned);
    try {
      const saved = await apiSaveSiteSetting('paata-teachers', cleaned);
      const normalized = normalizePaataTeachers(saved || cleaned);
      writeJson('kb-paata-teachers', normalized);
      setPaataTeachers(normalized);
      setPaataTeachersNotice('Paata Shaale teacher details saved.');
      window.dispatchEvent(new Event('kb-data-change'));
    } catch (error) {
      setPaataTeachersError(error.message || 'Could not save teacher details.');
    } finally {
      setPaataTeachersSaving(false);
    }
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
            <label>Date of birth <DatePicker name="birthDate" defaultValue={profile.birthDate || ''} required placeholder="Choose date of birth" /></label>
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
            <label>Date of birth <DatePicker name="spouseBirthDate" defaultValue={profile.spouseBirthDate || ''} placeholder="Choose date of birth" /></label>
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
            <button className="button primary" type="submit">{tr('Register')}</button>
            {registrationError && <p className="form-error">{registrationError}</p>}
            {registrationSaved && <p className="success">Registration submitted for {selectedProgram.title}.</p>}
          </form>
        </section>
      </>
    );
  }

  if (view === 'expense') {
    const myExpenseRows = expenses.filter((row) => !row.submittedBy || String(row.submittedBy || '').toLowerCase() === String(user?.email || '').toLowerCase());
    const pendingExpenseCount = statusCount(myExpenseRows, (status) => status.includes('submitted') || status.includes('pending') || status.includes('review'));
    const approvedExpenseCount = statusCount(myExpenseRows, (status) => status.includes('approved') || status.includes('paid'));
    const filteredExpenseRows = myExpenseRows.filter((row) => {
      const query = expenseQuery.trim().toLowerCase();
      if (!query) return true;
      return [row.title, row.category, row.vendor, row.submittedBy, row.status]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
    const renderExpenseStatus = (status = 'Submitted') => {
      const normalized = String(status).toLowerCase();
      const tone = normalized.includes('paid') || normalized.includes('approved')
        ? 'success'
        : normalized.includes('rejected')
          ? 'danger'
          : normalized.includes('submitted')
            ? 'info'
            : 'warning';
      return (
        <span className={`admin-status-pill is-${tone}`}>
          {tone === 'success' ? <CheckCircle size={16} /> : tone === 'danger' ? <X size={16} /> : tone === 'warning' ? <Clock3 size={16} /> : <i />}
          {status}
        </span>
      );
    };
    return (
      <>
        <PageHeader area="Volunteer / Expense" title="Expense Submission" />
        <section className="expense-reference-metrics" aria-label="Expense submission summary">
          <article>
            <span className="expense-reference-metric-icon is-blue"><ReceiptText size={28} /></span>
            <div><small>My Submissions</small><strong>{myExpenseRows.length}</strong></div>
          </article>
          <article>
            <span className="expense-reference-metric-icon is-gold"><Clock3 size={30} /></span>
            <div><small>Pending</small><strong>{pendingExpenseCount}</strong></div>
          </article>
          <article>
            <span className="expense-reference-metric-icon is-green"><CheckCircle size={30} /></span>
            <div><small>Approved / Paid</small><strong>{approvedExpenseCount}</strong></div>
          </article>
        </section>
        <form className="expense-reference-form" onSubmit={handleExpenseSubmit}>
          <header className="expense-reference-form-title"><ReceiptText size={27} /><h2>Submit a new expense</h2></header>
          <div className="expense-reference-fields">
            <label>Expense title <sup>*</sup><input name="title" required placeholder="Volunteer Meeting Snacks" /></label>
            <label>Category <sup>*</sup><select name="category" required defaultValue=""><option value="" disabled>Choose category</option><option>Snacks &amp; Beverages</option><option>Event supplies</option><option>Food</option><option>Venue</option><option>Printing</option><option>Travel</option><option>Materials</option><option>Other</option></select></label>
            <label>Amount <sup>*</sup><span className="expense-reference-money"><b>$</b><input name="amount" type="number" min="1" step="0.01" required placeholder="85.00" /></span></label>
            <div className="expense-reference-date"><span>Expense date <sup>*</sup></span><DatePicker name="expenseDate" required placeholder="Choose expense date" quickOptions={[{ label: 'Yesterday', offsetDays: -1 }, { label: 'Last week', offsetDays: -7 }]} /></div>
            <label>Vendor / paid to <sup>*</sup><input name="vendor" placeholder="Fresh Foods Market" /></label>
            <label className="expense-reference-payment">Payment method <sup>*</sup><select name="paymentMethod" defaultValue="Personal card"><option value="Personal card">Personal Card (Reimbursement)</option><option>Cash</option><option>Check</option><option>PayPal</option><option>Bank transfer</option><option>Other</option></select></label>
            <label className="expense-reference-reimburse">Reimburse to <sup>*</sup><input name="reimbursementTo" defaultValue={user?.email || ''} placeholder="volunteer@example.com" /></label>
            <label className="expense-reference-description">Description <sup>*</sup><textarea name="description" required minLength="10" maxLength="320" placeholder="Purchased snacks and drinks for volunteer orientation meeting." /></label>
            <div className="expense-reference-upload-field">
              <span>Receipt upload <sup>*</sup></span>
              <label
                className="expense-reference-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  const input = event.currentTarget.querySelector('input[type="file"]');
                  if (!file || !input) return;
                  const transfer = new DataTransfer();
                  transfer.items.add(file);
                  input.files = transfer.files;
                  setExpenseReceiptName(file.name);
                }}
              >
                <input name="receipt" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setExpenseReceiptName(event.target.files?.[0]?.name || '')} />
                <CloudUpload size={48} />
                <strong>{expenseReceiptName || 'Drag and drop a receipt here'}</strong>
                <span>{expenseReceiptName ? 'Click to choose a different file' : <>or <b>click to browse</b></>}</span>
                <small>PDF, JPG or PNG (up to 8 MB)</small>
              </label>
            </div>
            <button className="button primary expense-reference-submit" type="submit" disabled={expenseSubmitting}><Send size={22} />{expenseSubmitting ? 'Submitting...' : 'Submit expense'}</button>
          </div>
          {expenseError && <p className="form-error">{expenseError}</p>}
          {expenseSaved && <p className="success">Expense submitted for admin review.</p>}
        </form>
        <section className="expense-reference-list">
          <header>
            <div><ListChecks size={25} /><h2>My expense submissions</h2></div>
            <label><Search size={18} /><input value={expenseQuery} onChange={(event) => setExpenseQuery(event.target.value)} placeholder="Search expenses by title, vendor or category..." aria-label="Search expense submissions" /></label>
          </header>
          <div className="table-scroll">
            <table className="expense-reference-table">
              <thead><tr><th>Expense</th><th>Category</th><th>Amount</th><th>Date</th><th>Vendor</th><th>Receipt</th><th>Submitted by</th><th>Status</th></tr></thead>
              <tbody>
                {filteredExpenseRows.length ? filteredExpenseRows.map((row, index) => (
                  <tr key={row.id || `${row.title}-${index}`}>
                    <td>{row.title || '-'}</td><td>{row.category || '-'}</td><td>${Number(row.amount || 0).toFixed(2)}</td><td>{formatDateShort(row.expenseDate)}</td><td>{row.vendor || '-'}</td><td><ReceiptLink row={row} /></td><td>{row.submittedBy || user?.email || '-'}</td><td>{renderExpenseStatus(row.status)}</td>
                  </tr>
                )) : <tr><td colSpan={8}>No expense submissions match your search.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
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
            {
              key: 'enabled',
              label: 'Enabled',
              render: (row) => (
                <EnabledToggle
                  enabled={row.enabled !== false}
                  onLabel="Enabled"
                  offLabel="Disabled"
                  onChange={(enabled) => updateEvent(row, { enabled })}
                />
              )
            },
            { key: 'actions', label: 'Actions', render: (row) => <AdminRecordActions kind="event" row={row} /> }
          ]}
        />
        {modalType === 'event' && <CreateModal type="event" onClose={() => setModalType(null)} onCreated={() => { refresh(); setModalType(null); }} />}
        {editRecord?.kind === 'event' && (
          <AdminEditModal
            kind="event"
            row={editRecord.row}
            eventTypes={eventTypes}
            recurrences={recurrences}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('event', editRecord.row, patch)}
          />
        )}
      </>
    );
  }

  if (view === 'classes') {
    return (
      <>
        <PageHeader area="Classes" title="Manage classes" action={<button className="button primary" type="button" onClick={() => setModalType('class')}>Create</button>} />
        <AdminTable
          title="Classes"
          rows={programs}
          emptyText="No classes created yet."
          columns={[
            { key: 'title', label: 'Class' },
            { key: 'category', label: 'Category' },
            { key: 'status', label: 'Status' },
            { key: 'date', label: 'Date' },
            { key: 'time', label: 'Time' },
            { key: 'age', label: 'Age' },
            { key: 'fee', label: 'Fee' },
            { key: 'location', label: 'Location' },
            { key: 'focus', label: 'Focus' },
            { key: 'actions', label: 'Actions', render: (row) => <AdminRecordActions kind="class" row={row} /> }
          ]}
        />
        {modalType === 'class' && <CreateModal type="class" onClose={() => setModalType(null)} onCreated={() => { refresh(); setModalType(null); }} />}
        {editRecord?.kind === 'class' && (
          <AdminEditModal
            kind="class"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('class', editRecord.row, patch)}
          />
        )}
      </>
    );
  }

  if (view === 'role-access') {
    return (
      <>
        <PageHeader area="Security" title="Role and access control" />
        <RoleAccessManager
          roles={roleDefinitions}
          onSave={saveRoleDefinitions}
          notice={roleAccessNotice}
          error={roleAccessError}
        />
      </>
    );
  }

  if (view === 'teacher-allotments') {
    const teacherRows = registeredUsers.filter((row) => String(row.role || '').toLowerCase() === 'teacher' || (row.roles || []).includes?.('teacher'));
    return (
      <>
        <PageHeader area="Teacher" title="Teacher allotment" />
        <TeacherAllotmentManager
          allotments={teacherAllotments}
          classes={programs}
          teachers={teacherRows}
          onSave={saveTeacherAllotments}
          notice={teacherAllotmentNotice}
          error={teacherAllotmentError}
        />
      </>
    );
  }

  if (view === 'event-settings') {
    return (
      <>
        <PageHeader area="Event Settings" title="Manage event dropdowns" />
        {settingsError && <p className="form-error admin-floating-message">{settingsError}</p>}
        {settingsSaved && <p className="success admin-floating-message">Settings saved.</p>}
        <div className="event-settings-reference">
          <section className="admin-page-panel event-setting-panel">
            <div className="event-setting-panel-heading">
              <span className="event-setting-heading-icon"><CalendarDays size={26} /></span>
              <div>
                <h2>Event types</h2>
                <p>Manage event types used for class registration and event creation.</p>
              </div>
              <button className="button primary event-setting-add" type="button" onClick={() => addSettingPrompt('kb-event-types', eventTypes, setEventTypes, 'Event type', 'Competition')}>
                <Plus size={21} /> Add event type
              </button>
            </div>
            <table className="event-setting-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Event type</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eventTypes.map((item, index) => (
                  <tr key={item}>
                    <td>{index + 1}</td>
                    <td>{item}</td>
                    <td>{eventTypeDescriptions[item] || 'Custom event type for registration and event creation'}</td>
                    <td><span className="event-setting-status"><span /> Active</span></td>
                    <td>
                      <div className="event-setting-actions">
                        <button type="button" onClick={() => editSetting('kb-event-types', eventTypes, setEventTypes, item, 'Event type')}><Edit3 size={16} /> Edit</button>
                        <button className="danger" type="button" onClick={() => removeSetting('kb-event-types', eventTypes, setEventTypes, item)}><Trash2 size={16} /> Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="admin-page-panel event-setting-panel">
            <div className="event-setting-panel-heading">
              <span className="event-setting-heading-icon"><RefreshCw size={28} /></span>
              <div>
                <h2>Recurrence options</h2>
                <p>Manage recurrence options for events and classes.</p>
              </div>
              <button className="button primary event-setting-add" type="button" onClick={() => addSettingPrompt('kb-recurrence-options', recurrences, setRecurrences, 'Recurrence', 'BiWeekly')}>
                <Plus size={21} /> Add recurrence
              </button>
            </div>
            <table className="event-setting-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Recurrence</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recurrences.map((item, index) => (
                  <tr key={item}>
                    <td>{index + 1}</td>
                    <td>{item}</td>
                    <td>{recurrenceDescriptions[item] || 'Custom repeat option for event and class schedules'}</td>
                    <td><span className="event-setting-status"><span /> Active</span></td>
                    <td>
                      <div className="event-setting-actions">
                        <button type="button" onClick={() => editSetting('kb-recurrence-options', recurrences, setRecurrences, item, 'Recurrence')}><Edit3 size={16} /> Edit</button>
                        <button className="danger" type="button" onClick={() => removeSetting('kb-recurrence-options', recurrences, setRecurrences, item)}><Trash2 size={16} /> Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="admin-page-panel event-setting-panel google-form-settings-panel is-reference">
            <div className="event-setting-panel-heading google-form-reference-heading">
              <span className="event-setting-heading-icon"><UsersRound size={30} /></span>
              <div>
                <h2>Volunteer Google Form</h2>
                <p>Allow volunteers to register using a Google Form for events.</p>
              </div>
            </div>
            <form className="google-form-settings is-reference" onSubmit={handleVolunteerGoogleFormSubmit}>
              <div className="google-form-reference-fields">
                <label className="google-form-toggle is-reference">
                  <input
                    name="enabled"
                    type="checkbox"
                    checked={Boolean(volunteerGoogleForm.enabled)}
                    onChange={(event) => updateVolunteerGoogleFormDraft({ enabled: event.target.checked })}
                  />
                  <span>
                    <strong>Allow Google Form registration</strong>
                    <small>When enabled, a link to the registration form will be available on event pages.</small>
                  </span>
                </label>
                <label className="google-form-url-field is-reference">
                  Google Form URL <b>*</b>
                  <input
                    name="url"
                    type="url"
                    value={volunteerGoogleForm.url || ''}
                    onChange={(event) => updateVolunteerGoogleFormDraft({ url: event.target.value })}
                    placeholder="https://docs.google.com/forms/d//example"
                  />
                  <small>Enter the public Google Form URL for volunteer registration.</small>
                </label>
                <button className="button primary google-form-reference-save" type="submit"><Save size={18} /> Save settings</button>
              </div>
              <div className="google-form-preview is-reference">
                <strong>Form status preview</strong>
                <div className={volunteerGoogleFormReady ? 'google-form-preview-card is-ready' : 'google-form-preview-card'}>
                  <CheckCircle size={30} />
                  <span>
                    <b>{volunteerGoogleFormReady ? 'Form is active and accessible' : volunteerGoogleFormStatus}</b>
                    <small>{volunteerGoogleFormReady ? 'Volunteers can register using the link below.' : 'Save a valid public Google Form URL to enable this form.'}</small>
                  </span>
                </div>
                {volunteerGoogleFormSaved.url && (
                  <a href={volunteerGoogleFormSaved.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={19} /> Open form
                  </a>
                )}
              </div>
            </form>
          </section>
        </div>
      </>
    );
  }

  if (view === 'about') {
    return (
      <>
        <PageHeader area="About Us" title="About page content" />
        <AboutContentEditor
          content={aboutContent}
          setContent={setAboutContent}
          onSave={handleAboutContentSave}
          saving={aboutSaving}
          notice={aboutNotice}
          error={aboutError}
        />
      </>
    );
  }

  if (view === 'paata-teachers') {
    return (
      <>
        <PageHeader area="Paata Shaale" title="Paata teacher details" />
        <PaataTeacherEditor
          teachers={paataTeachers}
          setTeachers={setPaataTeachers}
          onSave={handlePaataTeachersSave}
          saving={paataTeachersSaving}
          notice={paataTeachersNotice}
          error={paataTeachersError}
        />
      </>
    );
  }

  if (view === 'announcements') {
    return (
      <>
        <PageHeader area="Announcement" title="Manage announcements" action={<button className="button primary" type="button" onClick={() => { setAnnouncementError(''); setAnnouncementSaved(false); setModalType('announcement'); }}>Create</button>} />
        {announcementSaved && <p className="success admin-floating-message">Announcement saved.</p>}
        <section className="admin-page-panel site-message-admin-panel">
          <div className="admin-page-panel-heading">
            <div>
              <h2>Floating user message</h2>
              <p>Show a small animated icon on public pages. Visitors click it to read this message.</p>
            </div>
            <span className={isEnabledValue(siteMessage.enabled) ? 'status-pill is-live' : 'status-pill'}>{isEnabledValue(siteMessage.enabled) ? 'Live' : 'Off'}</span>
          </div>
          <form className="site-message-form" onSubmit={handleSiteMessageSubmit}>
            <label className="google-form-toggle">
              <span>
                <strong>Enable popup message</strong>
                <small>{isEnabledValue(siteMessage.enabled) ? 'Users can see the animated message icon.' : 'Message icon is hidden from users.'}</small>
              </span>
              <input
                name="enabled"
                type="checkbox"
                checked={Boolean(siteMessage.enabled)}
                onChange={(event) => setSiteMessage((current) => ({ ...current, enabled: event.target.checked }))}
              />
            </label>
            <div className="admin-form-grid">
              <label>Popup title<input name="title" maxLength="90" value={siteMessage.title || ''} onChange={(event) => setSiteMessage((current) => ({ ...current, title: event.target.value }))} placeholder="Important Kannada Bharati update" /></label>
              <label>Button text<input name="ctaText" maxLength="40" value={siteMessage.ctaText || ''} onChange={(event) => setSiteMessage((current) => ({ ...current, ctaText: event.target.value }))} placeholder="View details" /></label>
              <label className="span-two">Button URL<input name="ctaUrl" value={siteMessage.ctaUrl || ''} onChange={(event) => setSiteMessage((current) => ({ ...current, ctaUrl: event.target.value }))} placeholder="/events or https://..." /></label>
              <label className="span-two">Message<textarea name="message" maxLength="700" rows={4} value={siteMessage.message || ''} onChange={(event) => setSiteMessage((current) => ({ ...current, message: event.target.value }))} placeholder="Type the message users should read after clicking the floating icon." /></label>
            </div>
            <div className="site-message-admin-footer">
              <div className="site-message-admin-preview">
                <strong>{siteMessage.title || 'Popup title preview'}</strong>
                <span>{siteMessage.message || 'Message preview appears here while you type.'}</span>
              </div>
              <button className="button primary" type="submit">Save Popup Message</button>
            </div>
            {siteMessageError && <p className="form-error">{siteMessageError}</p>}
            {siteMessageSaved && <p className="success">Popup message saved.</p>}
          </form>
        </section>
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
                <EnabledToggle enabled={isEnabledValue(row.enabled)} onChange={() => toggleAnnouncement(row)} />
              )
            },
            { key: 'actions', label: 'Actions', render: (row) => <AdminRecordActions kind="announcement" row={row} /> }
          ]}
        />
        {modalType === 'announcement' && (
          <div className="popup-backdrop" role="presentation">
            <div className="popup-panel" role="dialog" aria-modal="true" aria-label="Create announcement">
              <button className="popup-close" type="button" aria-label="Close popup" onClick={() => setModalType(null)}>
                <X size={20} />
              </button>
              <form className="admin-create-form" onSubmit={handleAnnouncementSubmit}>
                <ModalTitle>Create announcement</ModalTitle>
                <p className="admin-form-note">Add a short message with a clear action link and valid display dates.</p>
                <label>Announcement text<input name="text" required minLength="5" maxLength="160" /></label>
                <label>CTA text<input name="ctaText" required maxLength="40" placeholder="Register today" /></label>
                <label>CTA URL<input name="ctaUrl" required placeholder="/register or https://example.com" /></label>
                <div className="admin-form-grid">
                  <label>Start on<DatePicker name="startOn" required placeholder="Choose start date" /></label>
                  <label>End on<DatePicker name="endOn" required placeholder="Choose end date" /></label>
                </div>
                <label className="admin-checkbox"><input name="enabled" type="checkbox" defaultChecked /> Enabled</label>
                <button className="button primary" type="submit">Save</button>
                {announcementError && <p className="form-error">{announcementError}</p>}
              </form>
            </div>
          </div>
        )}
        {editRecord?.kind === 'announcement' && (
          <AdminEditModal
            kind="announcement"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('announcement', editRecord.row, patch)}
          />
        )}
      </>
    );
  }

  if (view === 'fundraising') {
    return (
      <>
        <PageHeader area="Fund Raising" title="Manage fundraising causes" action={<button className="button primary" type="button" onClick={() => setModalType('fundraiser')}>Create</button>} />
        <section className="admin-dashboard-hero-grid checkin-metric-grid">
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
            { key: 'status', label: 'Status' },
            { key: 'actions', label: 'Actions', render: (row) => <AdminRecordActions kind="fundraiser" row={row} /> }
          ]}
        />
        {modalType === 'fundraiser' && <CreateModal type="fundraiser" onClose={() => setModalType(null)} onCreated={() => { refresh(); setModalType(null); }} />}
        {editRecord?.kind === 'fundraiser' && (
          <AdminEditModal
            kind="fundraiser"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('fundraiser', editRecord.row, patch)}
          />
        )}
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
            { key: 'causeId', label: 'Cause ID' },
            { key: 'actions', label: 'Actions', render: (row) => <AdminRecordActions kind="donation" row={row} /> }
          ]}
        />
        {editRecord?.kind === 'donation' && (
          <AdminEditModal
            kind="donation"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('donation', editRecord.row, patch)}
          />
        )}
      </>
    );
  }

  if (view === 'messages') {
    const targetOptions = bulkEmail.audience === 'class' ? bulkClassOptions : bulkEventOptions;
    return (
      <>
        <PageHeader area="Messages" title="Group email and contact messages" />
        <form className="admin-page-panel bulk-email-composer" onSubmit={handleBulkEmailSubmit}>
          <div className="admin-page-panel-heading">
            <h2>Send group email</h2>
            <span>{bulkRecipientCount} recipient(s)</span>
          </div>
          <div className="bulk-email-grid">
            <label>
              Audience
              <select
                name="audience"
                value={bulkEmail.audience}
                onChange={(event) => setBulkEmail((current) => ({ ...current, audience: event.target.value, target: '', notice: '', error: '' }))}
              >
                <option value="all-users">All users</option>
                <option value="newsletter">Newsletter subscribers</option>
                <option value="event">Specific event registrations</option>
                <option value="class">Specific class registrations</option>
              </select>
            </label>
            {['event', 'class'].includes(bulkEmail.audience) && (
              <label>
                {bulkEmail.audience === 'class' ? 'Class' : 'Event'}
                <select
                  name="target"
                  value={bulkEmail.target}
                  onChange={(event) => setBulkEmail((current) => ({ ...current, target: event.target.value, notice: '', error: '' }))}
                  required
                >
                  <option value="" disabled>Choose {bulkEmail.audience === 'class' ? 'class' : 'event'}</option>
                  {targetOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            )}
            {!['event', 'class'].includes(bulkEmail.audience) && <input type="hidden" name="target" value="" />}
            <label className="bulk-email-wide">
              Subject
              <input name="subject" minLength="4" maxLength="140" required placeholder="Kannada Bharati update" />
            </label>
            <label className="bulk-email-wide">
              Header subtitle
              <input name="contextLabel" maxLength="180" placeholder="Kannada's Pride - Festival of Lights - Togetherness" />
            </label>
            <label className="bulk-email-wide">
              Greeting / intro
              <input name="intro" maxLength="160" placeholder="Hello Kannada Bharati family," />
            </label>
            <label className="bulk-email-wide">
              Message
              <textarea name="body" minLength="10" maxLength="4000" required placeholder="Type the message that should be sent to the selected group." />
            </label>
            <div className="bulk-email-section-title bulk-email-wide">
              <strong>Event information</strong>
              <span>Displayed together in a highlighted event-details panel.</span>
            </div>
            <label>
              Event date
              <input name="eventDate" maxLength="120" placeholder="Sunday, November 1, 2026" />
            </label>
            <label>
              Event time
              <input name="eventTime" maxLength="120" placeholder="2:00 PM - 7:00 PM" />
            </label>
            <label className="bulk-email-wide">
              Venue
              <input name="eventVenue" maxLength="240" placeholder="Venue name and full address" />
            </label>
            <label className="bulk-email-wide">
              What awaits you
              <textarea className="bulk-email-compact-textarea" name="highlights" maxLength="2500" placeholder={'Add one highlight per line\nLive dance and music\nFood and refreshments\nActivities for children'} />
            </label>
            <label className="bulk-email-wide">
              Event agenda
              <textarea className="bulk-email-compact-textarea" name="agenda" maxLength="2500" placeholder={'Add one agenda item per line using Time | Activity\n2:00 PM | Deepavali Art Workshop\n3:00 PM | Indoor games\n6:00 PM | Dinner'} />
            </label>
            <div className="bulk-email-section-title bulk-email-wide">
              <strong>Registration</strong>
              <span>Optional fee, note, and call-to-action shown in a registration panel.</span>
            </div>
            <label>
              Registration heading
              <input name="registrationTitle" maxLength="120" placeholder="Register today" />
            </label>
            <label>
              Registration fee
              <input name="registrationFee" maxLength="120" placeholder="Entry is free for everyone" />
            </label>
            <label className="bulk-email-wide">
              Registration note
              <input name="registrationNote" maxLength="240" placeholder="Registration closes October 25" />
            </label>
            <label className="bulk-email-wide">
              Footer note
              <input name="footer" maxLength="220" placeholder="Optional closing note" />
            </label>
            <label>
              Action button label
              <input name="ctaLabel" maxLength="60" placeholder="View details and register" />
            </label>
            <label>
              Action button URL
              <input name="ctaUrl" maxLength="500" placeholder="/classes or https://..." />
            </label>
            <label className="bulk-email-wide">
              Community note
              <input name="communityNote" maxLength="300" placeholder="Come, celebrate, connect and create memories with our community." />
            </label>
            <label className="bulk-email-wide">
              Sponsor acknowledgement
              <textarea className="bulk-email-compact-textarea" name="sponsorAcknowledgement" maxLength="1200" placeholder="Thank you to our annual sponsors for supporting Kannada Bharati programs." />
            </label>
          </div>
          <div className="bulk-email-actions">
            <span>Emails are sent through SMTP when configured; otherwise they are stored in the Email Outbox.</span>
            <button className="button primary" type="submit" disabled={bulkEmail.sending || bulkRecipientCount === 0}>
              {bulkEmail.sending ? 'Sending...' : 'Send group email'}
            </button>
          </div>
          {bulkEmail.notice && <p className="success">{bulkEmail.notice}</p>}
          {bulkEmail.error && <p className="form-error">{bulkEmail.error}</p>}
        </form>
        <AdminTable
          title="Newsletter subscribers"
          rows={newsletterSubscribers}
          emptyText="No newsletter subscribers yet."
          filters={[{ key: 'status', label: 'Status', options: uniqueOptions(newsletterSubscribers, 'status') }]}
          columns={[
            { key: 'subscribedAt', label: 'Subscribed on' },
            { key: 'email', label: 'Email' },
            { key: 'status', label: 'Status' },
            { key: 'source', label: 'Source' }
          ]}
        />
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
            { key: 'message', label: 'Message' },
            { key: 'actions', label: 'Actions', render: (row) => <AdminRecordActions kind="contact" row={row} /> }
          ]}
        />
        {editRecord?.kind === 'contact' && (
          <AdminEditModal
            kind="contact"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('contact', editRecord.row, patch)}
          />
        )}
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
            { key: 'message', label: 'Message' },
            { key: 'actions', label: 'Actions', render: (row) => <AdminRecordActions kind="volunteer" row={row} /> }
          ]}
        />
        {editRecord?.kind === 'volunteer' && (
          <AdminEditModal
            kind="volunteer"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('volunteer', editRecord.row, patch)}
          />
        )}
      </>
    );
  }

  if (view === 'checkin') {
    const checkinAmountTotal = checkinRows.reduce((sum, row) => sum + getMoneyAmount(row), 0);
    const submittedCheckinCount = statusCount(checkinRows, (status) => status.includes('submitted'));
    const topCheckinPrograms = summarizeBy(checkinRows, 'program', 3);
    const checkedCheckinRows = checkinRows.filter((row, index) => checkedInIds.includes(getRegistrationKey(row, index)) || isCheckedInRegistration(row));
    const checkedCheckinAmount = checkedCheckinRows.reduce((sum, row) => sum + getMoneyAmount(row), 0);
    const checkedCheckinMembers = checkedCheckinRows.reduce((sum, row) => sum + getCheckinCounts(row).total, 0);
    const checkinMemberTotal = checkinRows.reduce((sum, row) => sum + getCheckinCounts(row).total, 0);
    const checkedDynamicTotals = dynamicCheckinColumns.map((column) => checkedCheckinRows.reduce((sum, row) => sum + Number(getDynamicCheckinValue(row, column) || 0), 0));
    const checkinColumns = [
      { key: 'serial', label: 'Sl no.', render: (_row, index) => index + 1 },
      {
        key: 'action',
        label: 'Action',
        render: (row, index) => {
          const checked = checkedInIds.includes(getRegistrationKey(row, index)) || isCheckedInRegistration(row);
          if (selectedCheckinIsClassroom) {
            if (row.enabled === false || String(row.status || '').toLowerCase() === 'deleted') {
              return <EnabledToggle enabled={false} onLabel="Enabled" offLabel="Disabled" onChange={(enabled) => toggleRegistrationEnabled(row, enabled)} />;
            }
            return <RegistrationActionMenu row={row} />;
          }
          return (
            <RegistrationActionMenu
              row={row}
              checkedLabel={row.checkedInAt ? new Date(row.checkedInAt).toLocaleString() : 'Checked'}
              checkinAction={checked ? <span className="confirmed-badge">{row.checkedInAt ? new Date(row.checkedInAt).toLocaleString() : 'Checked'}</span> : <button className="checkin-action-button" type="button" onClick={() => markCheckedIn(row, index)}>Check In</button>}
            />
          );
        }
      },
      { key: 'parentName', label: 'Registered Name' },
      { key: 'email', label: 'Registered by' },
      { key: 'seats', label: 'Seats', render: (row) => getCheckinCounts(row).total },
      ...dynamicCheckinColumns.map((column) => ({
        key: `dynamic-${column.key}`,
        label: column.label,
        render: (row) => getDynamicCheckinValue(row, column) || ''
      })),
      ...(!selectedCheckinIsClassroom ? [{ key: 'total', label: 'Total', render: (row) => getCheckinCounts(row).total }] : []),
      { key: 'amount', label: 'Amount', render: (row) => `$${getMoneyAmount(row).toLocaleString()}` },
      { key: 'createdAt', label: 'Registered on' },
      { key: 'eventId', label: 'Event ID', render: (row, index) => row.eventId || makeEventId(row.program, index) },
      { key: 'phone', label: 'Phone Number' },
      { key: 'details', label: 'Details', render: (row) => <DetailsIconButton onClick={() => setRegistrationDetail(row)} /> }
    ];
    return (
      <>
        <PageHeader root="Welcome Desk" area="Check-in" title="Event check-in" />
        <section className="admin-dashboard-hero-grid checkin-metric-grid">
          <article><UsersRound size={24} /><span>Total registrations</span><strong>{checkinRows.length}</strong><ChevronRight size={18} /></article>
          <article><CalendarDays size={24} /><span>Submitted</span><strong>{submittedCheckinCount}</strong><ChevronRight size={18} /></article>
          <article><ReceiptText size={24} /><span>Total members</span><strong>{checkinMemberTotal}</strong><ChevronRight size={18} /></article>
          <article><HandCoins size={24} /><span>Amount</span><strong>${checkinAmountTotal.toLocaleString()}</strong><ChevronRight size={18} /></article>
        </section>
        <section className="checkin-overview-grid">
          <article className="checkin-card checkin-find-card">
            <div className="checkin-card-heading">
              <span><Search size={20} /></span>
              <div>
                <h2>Find registrations</h2>
                <p>Search for an event or a member to view registration details.</p>
              </div>
            </div>
            <form className="checkin-find-form" onSubmit={handleCheckinSubmit}>
              <label>Event
                <select value={selectedCheckinEvent.title || ''} onChange={(event) => { setCheckinProgram(event.target.value); setCheckinApplied(false); setCheckinError(''); setCheckinEventId(''); }} required>
                  {eventOptions.map((item) => <option key={item.title} value={item.title}>{item.title}</option>)}
                </select>
              </label>
              <label>
                Event ID (optional)
                <input value={checkinEventId} onChange={(event) => setCheckinEventId(event.target.value)} placeholder="Event id optional" />
              </label>
              <button className="button primary" type="submit">Apply</button>
            </form>
            <form className="checkin-phone-form" onSubmit={handlePhoneLookup}>
              <label>Phone lookup
                <input name="email" type="email" placeholder="member@example.com" />
              </label>
              <button className="button secondary-dark" type="submit">Find phone</button>
              {phoneLookup.phone && <strong>{phoneLookup.email}: {phoneLookup.phone}</strong>}
              {phoneLookup.error && <span className="form-error inline-error">{phoneLookup.error}</span>}
            </form>
          </article>
          <article className="checkin-card checkin-summary-card">
            <div className="checkin-card-heading">
              <span><ListChecks size={20} /></span>
              <div>
                <h2>Event summary</h2>
                <p>Key registration and attendance numbers for this event.</p>
              </div>
            </div>
            <div className="checkin-summary-matrix" style={{ gridTemplateColumns: `minmax(130px, 1.1fr) repeat(${Math.max(1, dynamicCheckinColumns.length + 3)}, minmax(86px, 1fr))` }}>
              <span />
              <strong>Registrations</strong>
              <strong>Amount</strong>
              {dynamicCheckinColumns.map((column) => <strong key={`summary-head-${column.key}`}>{column.label}</strong>)}
              <strong>Total members</strong>
              <b>All registrations</b>
              <span>{checkinRows.length}</span>
              <span>${checkinAmountTotal.toLocaleString()}</span>
              {checkinAnalytics.map((item) => <span key={`summary-all-${item.key}`}>{item.value}</span>)}
              <span>{checkinMemberTotal}</span>
              <b>Checked in</b>
              <span>{checkedCheckinRows.length}</span>
              <span>${checkedCheckinAmount.toLocaleString()}</span>
              {checkedDynamicTotals.map((value, index) => <span key={`summary-checked-${dynamicCheckinColumns[index]?.key || index}`}>{value}</span>)}
              <span>{checkedCheckinMembers}</span>
            </div>
          </article>
        </section>
        <section className="checkin-program-overview">
          <div className="checkin-card-heading">
            <span><Building2 size={20} /></span>
            <div>
              <h2>Program overview</h2>
              <p>View and manage registrations by program.</p>
            </div>
          </div>
          <div className="checkin-program-grid">
            {(topCheckinPrograms.length ? topCheckinPrograms : [{ label: selectedCheckinEvent.title || 'Selected event', count: checkinRows.length, amount: checkinAmountTotal }]).map((program, index) => (
              <article key={program.label}>
                <span>{index % 3 === 0 ? <UsersRound size={22} /> : index % 3 === 1 ? <CalendarDays size={22} /> : <HandCoins size={22} />}</span>
                <div>
                  <strong>{program.label}</strong>
                  <button type="button" onClick={() => setCheckinProgram(program.label)}>View registrations <ChevronRight size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
        {checkinError && <p className="form-error">{checkinError}</p>}
        <AdminTable
          title="Event check-in details"
          rows={checkinRows}
          filters={[{ key: 'program', label: 'Events', options: uniqueOptions(checkinRows, 'program') }]}
          columns={checkinColumns}
        />
        {editRecord?.kind === 'registration' && (
          <AdminEditModal
            kind="registration"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('registration', editRecord.row, patch)}
          />
        )}
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  if (['registrations', 'registration-classes', 'registration-payments'].includes(view)) {
    const withRegistrationCategory = (row) => {
      const meta = getProgramMeta(row, programs, allEvents);
      return {
        ...row,
        program: row.program || meta.title || '-',
        eventId: row.eventId || meta.eventId || meta.id || '',
        eventCategory: meta.eventType || meta.category || row.registrationType || '-'
      };
    };
    const classRegistrationRows = registrations.filter((row) => isClassRegistration(row, programs, allEvents)).map(withRegistrationCategory);
    const eventRegistrationRows = registrations.filter((row) => !isClassRegistration(row, programs, allEvents)).map(withRegistrationCategory);
    const paymentRows = registrations
      .filter((row) => Number(row.amount || 0) > 0 || isPaidRegistration(row))
      .map((row) => ({ ...withRegistrationCategory(row), paymentReference: getPaymentDetails(row)?.reference || '' }));
    const visibleRows = view === 'registration-classes'
      ? classRegistrationRows
      : view === 'registration-payments'
        ? paymentRows
        : eventRegistrationRows;
    const eventDetailDynamicColumns = getRegistrationDynamicColumns(eventRegistrationRows, allEvents);
    const eventRegistrationSummary = getCheckinAnalytics(eventRegistrationRows, eventDetailDynamicColumns, []);
    const tableTitle = view === 'registration-classes'
      ? 'Class details'
      : view === 'registration-payments'
        ? 'Payment details'
        : 'Event details';
    const tableEmptyText = view === 'registration-classes'
      ? 'No class registrations yet.'
      : view === 'registration-payments'
        ? 'No class or event payment records yet.'
        : 'No event registrations yet.';
    const eventTypeFilterOptions = eventTypes.filter((item) => String(item).toLowerCase() !== 'classroom');
    const registrationColumns = [
      { key: 'slNo', label: 'Sl no.', render: (_row, index) => index + 1 },
      { key: 'program', label: 'Class', render: (row) => row.program || '-' },
      { key: 'status', label: 'Status', render: (row) => row.status || 'Submitted' },
      { key: 'paid', label: 'Paid', render: (row) => isPaidRegistration(row) ? 'Paid' : 'Pending' },
      { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toFixed(2)}` },
      { key: 'eventCategory', label: 'Type', render: (row) => row.eventCategory || row.registrationType || '-' },
      { key: 'paymentReference', label: 'Payment Ref', render: (row) => getPaymentDetails(row)?.reference || '-' },
      { key: 'createdAt', label: 'Registered on' },
      {
        key: 'studentName',
        label: 'Registered Name',
        render: (row) => (
          <div className="registered-user-cell">
            <strong>{row.studentName && row.studentName !== '-' ? row.studentName : row.parentName || '-'}</strong>
            <DetailsIconButton onClick={() => setRegistrationDetail(row)} />
          </div>
        )
      },
      { key: 'email', label: 'Registered by' },
      { key: 'familyMember', label: 'Family Member', render: (row) => row.familyMember || row.studentName || '-' },
      { key: 'birthYear', label: 'BirthYear', render: (row) => row.birthYear || '-' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'enabled', label: 'Enabled', render: (row) => <EnabledToggle enabled={row.enabled !== false} onLabel="Enabled" offLabel="Disabled" onChange={(enabled) => toggleRegistrationEnabled(row, enabled)} /> },
      {
        key: 'action',
        label: 'Action',
        render: (row) => <RegistrationActionMenu row={row} />
      }
    ];
    const eventRegistrationColumns = [
      { key: 'slNo', label: 'Sl no.', render: (_row, index) => index + 1 },
      { key: 'program', label: 'Event', render: (row) => row.program || '-' },
      { key: 'eventId', label: 'Event ID', render: (row) => row.eventId || '-' },
      { key: 'eventCategory', label: 'Type', render: (row) => row.eventCategory || row.registrationType || '-' },
      { key: 'status', label: 'Status', render: (row) => row.status || 'Submitted' },
      { key: 'paid', label: 'Paid', render: (row) => isPaidRegistration(row) ? 'Paid' : 'Pending' },
      { key: 'createdAt', label: 'Registered on' },
      {
        key: 'studentName',
        label: 'Registered Name',
        render: (row) => (
          <div className="registered-user-cell">
            <strong>{row.studentName && row.studentName !== '-' ? row.studentName : row.parentName || row.familyMember || '-'}</strong>
            <DetailsIconButton onClick={() => setRegistrationDetail(row)} />
          </div>
        )
      },
      { key: 'email', label: 'Registered by' },
      { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toFixed(2)}` },
      { key: 'paymentReceived', label: 'PaymentReceived', render: (row) => isPaidRegistration(row) ? `$${Number(row.amount || 0).toFixed(2)}` : '-' },
      { key: 'phone', label: 'Phone Number', render: (row) => row.phone || row.profile?.phone || '-' },
      ...eventDetailDynamicColumns.map((column) => ({
        key: `dynamic-${column.key}`,
        label: column.label,
        render: (row) => getDynamicCheckinValue(row, column) || '0'
      })),
      { key: 'totalMembers', label: 'Total', render: (row) => getCheckinCounts(row).total },
      { key: 'enabled', label: 'Enabled', render: (row) => <EnabledToggle enabled={row.enabled !== false} onLabel="Enabled" offLabel="Disabled" onChange={(enabled) => toggleRegistrationEnabled(row, enabled)} /> },
      {
        key: 'action',
        label: 'Action',
        render: (row) => <RegistrationActionMenu row={row} />
      }
    ];
    const paymentColumns = [
      { key: 'createdAt', label: 'Registered on' },
      { key: 'program', label: 'Class / Event' },
      { key: 'eventCategory', label: 'Type', render: (row) => row.eventCategory || row.registrationType || '-' },
      { key: 'familyMember', label: 'Member', render: (row) => row.familyMember || row.studentName || '-' },
      { key: 'email', label: 'Paid by / Registered by' },
      { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toFixed(2)}` },
      { key: 'paid', label: 'Payment', render: (row) => isPaidRegistration(row) ? 'Paid' : 'Pending' },
      { key: 'paymentReference', label: 'Payment Ref' },
      { key: 'paymentNotes', label: 'Notes', render: (row) => getPaymentDetails(row)?.notes || '-' },
      { key: 'details', label: 'Details', render: (row) => <DetailsIconButton onClick={() => setRegistrationDetail(row)} /> },
      { key: 'actions', label: 'Actions', render: (row) => <RegistrationActionMenu row={row} /> }
    ];
    return (
      <>
        <PageHeader area="Event Registration" title="Event registration details" />
        {view === 'registrations' && (
          <section className="registration-summary-grid event-registration-summary" aria-label="Event registration totals">
            {eventRegistrationSummary.map((item) => (
              <article key={item.key}>
                <span>{tr(item.key)}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </section>
        )}
        <AdminTable
          title={tableTitle}
          rows={visibleRows}
          emptyText={tableEmptyText}
          filters={view === 'registration-payments'
            ? [
                { key: 'program', label: 'Class / Event', options: uniqueOptions(visibleRows, 'program') },
                { key: 'eventCategory', label: 'Type', options: uniqueOptions(visibleRows, 'eventCategory') }
              ]
            : view === 'registrations'
              ? [
                  { key: 'eventCategory', label: 'Type', options: eventTypeFilterOptions },
                  { key: 'program', label: 'Event', options: uniqueOptions(visibleRows, 'program') }
                ]
            : [
                { key: 'program', label: 'Class', options: uniqueOptions(visibleRows, 'program') }
              ]}
          columns={view === 'registration-payments' ? paymentColumns : view === 'registrations' ? eventRegistrationColumns : registrationColumns}
        />
        {editRecord?.kind === 'registration' && (
          <AdminEditModal
            kind="registration"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('registration', editRecord.row, patch)}
          />
        )}
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
        <PageHeader root="Welcome Desk" area="Guest Check-in" title="Guest registration and check-in" />
        <section className="admin-dashboard-hero-grid">
          <article><UsersRound size={24} /><span>Guests</span><strong>{guestRows.length}</strong></article>
          <article><CalendarDays size={24} /><span>Members</span><strong>{guestMembers}</strong></article>
          <article><ReceiptText size={24} /><span>Pending</span><strong>{Math.max(0, guestRows.length - guestCheckedIn)}</strong></article>
          <article><HandCoins size={24} /><span>Amount</span><strong>${guestAmount.toLocaleString()}</strong></article>
        </section>
        <section className="admin-panel guest-registration-launch-panel">
          <div>
            <span className="eyebrow">Reception</span>
            <h2>Register guest</h2>
            <p>Add walk-in guests for the selected event, then check them in from the table below.</p>
          </div>
          <button className="button primary" type="button" onClick={() => setGuestRegistrationOpen(true)}>
            <UserPlus size={18} /> Register guest
          </button>
        </section>
        {guestRegistrationOpen && createPortal(
          <div className="popup-backdrop" role="presentation">
            <div className="popup-panel guest-registration-modal" role="dialog" aria-modal="true" aria-label="Register guest">
              <button className="popup-close" type="button" aria-label="Close guest registration" onClick={() => setGuestRegistrationOpen(false)}>
                <X size={20} />
              </button>
              <form className="admin-create-form guest-registration-form" onSubmit={handleGuestRegistrationSubmit}>
                <div className="modal-heading-with-icon">
                  <span><UserPlus size={22} /></span>
                  <div>
                    <p className="eyebrow">Welcome Desk</p>
                    <h2>Register guest</h2>
                  </div>
                </div>
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
            </div>
          </div>,
          document.body
        )}
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
              return (
                <RegistrationActionMenu
                  row={row}
                  checkedLabel="Checked"
                  checkinAction={checked ? <span className="confirmed-badge">Checked</span> : <button className="checkin-action-button" type="button" onClick={() => markCheckedIn(row, index)}>Check In</button>}
                />
              );
            } }
          ]}
        />
        {editRecord?.kind === 'registration' && (
          <AdminEditModal
            kind="registration"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('registration', editRecord.row, patch)}
          />
        )}
      </>
    );
  }

  if (view === 'seats') {
    const seatCapacity = Math.max(0, Number(selectedSeatEvent.capacity || selectedSeatEvent.totalSeats || selectedSeatEvent.seats || 0));
    const registrationPool = [...new Map([...seatApiRegistrations, ...registrations].map((row, index) => [row.id || getRegistrationKey(row, index), row])).values()];
    const eventRegistrationRows = registrationPool.filter((row) => (
      String(row.eventId || '') === String(selectedSeatEventId)
      || row.program === selectedSeatEvent.title
      || (!row.eventId && row.program === selectedSeatEvent.title)
    ));
    const registrationById = new Map(registrationPool.filter((row) => row.id).map((row) => [String(row.id), row]));
    const seatRecordMap = new Map(seatRecords.map((seat) => [String(seat.seat_number || seat.seatNumber), seat]));

    const toSeatRow = (saved, fallbackSeatNumber = '') => {
      const seatNumber = String(saved?.seat_number || saved?.seatNumber || fallbackSeatNumber);
      const registrationId = saved?.registration_id || saved?.registrationId || '';
      const registration = registrationById.get(String(registrationId));
      const assignedTo = saved?.assigned_to || saved?.assignedTo || registration?.familyMember || registration?.studentName || registration?.parentName || '-';
      const hasAssignment = Boolean(registrationId || (assignedTo && assignedTo !== '-'));
      const savedStatus = saved?.status || '';
      const status = hasAssignment && /^available$/i.test(savedStatus)
        ? 'Assigned'
        : savedStatus || (hasAssignment ? 'Assigned' : 'Available');
      return {
        id: saved?.id || '',
        eventId: saved?.event_id || saved?.eventId || selectedSeatEventId,
        program: selectedSeatEvent.title || registration?.program || '-',
        seatNumber,
        assignedTo,
        email: registration?.email || '-',
        registrationId,
        status
      };
    };

    const generatedSeats = Array.from({ length: seatCapacity }, (_, index) => {
      const seatNumber = String(index + 1);
      return toSeatRow(seatRecordMap.get(seatNumber), seatNumber);
    });
    const generatedSeatNumbers = new Set(generatedSeats.map((seat) => seat.seatNumber));
    const extraSavedSeats = seatRecords
      .filter((seat) => !generatedSeatNumbers.has(String(seat.seat_number || seat.seatNumber)))
      .map((seat) => toSeatRow(seat));
    const seatRows = [...generatedSeats, ...extraSavedSeats]
      .filter((seat) => seat.seatNumber)
      .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true, sensitivity: 'base' }));
    const assignedSeats = seatRows.filter((seat) => !/^available$/i.test(seat.status) || (seat.assignedTo && seat.assignedTo !== '-')).length;
    const checkedInSeats = seatRows.filter((seat) => /checked/i.test(seat.status || '')).length;
    const availableSeats = seatRows.filter((seat) => /^available$/i.test(seat.status) && (!seat.assignedTo || seat.assignedTo === '-')).length;
    const seatPrograms = summarizeBy(seatRows, 'program', 4);
    const selectedSeat = seatRows.find((seat) => seat.seatNumber === selectedSeatNumber) || seatRows.find((seat) => seat.status === 'Available') || seatRows[0] || {};
    return (
      <>
        <PageHeader root="Welcome Desk" area="Seats" title="Seat management" />
        {seatLoading && <p className="admin-inline-message">Loading seat data...</p>}
        {seatNotice && <p className="admin-inline-message">{seatNotice}</p>}
        {seatError && <p className="admin-inline-message error">{seatError}</p>}
        <section className="seat-control-panel admin-page-panel">
          <div>
            <span>Step 1</span>
            <label>Choose event
              <select value={seatEventTitle} onChange={(event) => setSeatEventTitle(event.target.value)}>
                {eventOptions.map((item) => (
                  <option key={item.title} value={item.title}>{item.title}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span>Event capacity</span>
            <strong>{seatCapacity || 'Not set'}</strong>
            <small>Event ID: {selectedSeatEventId}</small>
            {!seatCapacity && <small>Set capacity in Event Management before creating new seats.</small>}
          </div>
          <div>
            <span>Registered attendees</span>
            <strong>{eventRegistrationRows.length}</strong>
            <small>{eventRegistrationRows.length ? 'Ready to assign' : 'No registrations found for this event'}</small>
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
              {seatRows.map((seat, index) => {
                const occupied = seat.assignedTo && seat.assignedTo !== '-';
                const checked = /checked/i.test(seat.status || '');
                return (
                  <button
                    key={`${seat.seatNumber || index}-${index}`}
                    type="button"
                    className={seat.seatNumber === selectedSeatNumber ? 'seat-dot is-selected' : checked ? 'seat-dot is-checked' : occupied ? 'seat-dot is-assigned' : 'seat-dot'}
                    title={`${seat.seatNumber || index + 1}: ${seat.assignedTo && seat.assignedTo !== '-' ? seat.assignedTo : 'Available'}`}
                    onClick={() => {
                      setSelectedSeatNumber(String(seat.seatNumber || index + 1));
                      setSelectedSeatRegistrationId(seat.registrationId || '');
                      setSelectedSeatAssignedName(seat.registrationId ? '' : (occupied ? seat.assignedTo : ''));
                    }}
                  >
                    {seat.seatNumber || index + 1}
                  </button>
                );
              })}
              {!seatLoading && seatLoaded && !seatRows.length && (
                <div className="seat-map-empty">No seats configured. Set this event's capacity in Event Management first.</div>
              )}
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
        <form className="seat-assignment-panel" onSubmit={handleSeatSubmit}>
          <div>
            <span>Step 2</span>
            <h2>Assign selected seat</h2>
            <p>Click a seat in the map, choose a registered attendee, then save the assignment.</p>
          </div>
          <input name="eventId" type="hidden" value={selectedSeatEventId} readOnly />
          <div className="admin-form-grid">
            <label>Seat number
              <select name="seatNumber" value={selectedSeatNumber || selectedSeat.seatNumber || ''} onChange={(event) => {
                const nextNumber = event.target.value;
                const nextSeat = seatRows.find((seat) => seat.seatNumber === nextNumber);
                setSelectedSeatNumber(nextNumber);
                setSelectedSeatRegistrationId(nextSeat?.registrationId || '');
                setSelectedSeatAssignedName(nextSeat?.registrationId ? '' : (nextSeat?.assignedTo !== '-' ? nextSeat?.assignedTo || '' : ''));
              }} required disabled={!seatLoaded || !seatRows.length}>
                <option value="" disabled>Select seat</option>
                {seatRows.map((seat) => <option key={seat.seatNumber} value={seat.seatNumber}>Seat {seat.seatNumber} - {seat.assignedTo && seat.assignedTo !== '-' ? seat.assignedTo : 'Available'}</option>)}
              </select>
            </label>
            <label>Assign to registered attendee
              <select name="registrationId" value={selectedSeatRegistrationId} onChange={(event) => {
                setSelectedSeatRegistrationId(event.target.value);
                if (event.target.value) setSelectedSeatAssignedName('');
              }} disabled={!seatLoaded || !seatRows.length}>
                <option value="">Keep available</option>
                {eventRegistrationRows.map((row, index) => <option key={row.id || getRegistrationKey(row, index)} value={row.id || ''}>{row.familyMember || row.studentName || row.parentName || row.email} - {row.email}</option>)}
              </select>
            </label>
            <label>Assigned name override
              <input name="assignedTo" value={selectedSeatAssignedName} onChange={(event) => setSelectedSeatAssignedName(event.target.value)} placeholder="Optional manual name" disabled={!seatLoaded || !seatRows.length} />
            </label>
          </div>
          <div className="seat-assignment-actions">
            <button className="button primary" type="submit" disabled={!seatLoaded || !seatRows.length || seatSaving}>{seatSaving ? 'Saving...' : 'Save assignment'}</button>
            {selectedSeat.id && selectedSeat.assignedTo && selectedSeat.assignedTo !== '-' && (
              <button className="button secondary" type="button" disabled={seatActionId === String(selectedSeat.id)} onClick={() => handleSeatCheckIn(selectedSeat, !/checked/i.test(selectedSeat.status || ''))}>
                <CheckCircle size={17} />
                {seatActionId === String(selectedSeat.id) ? 'Updating...' : /checked/i.test(selectedSeat.status || '') ? 'Undo check-in' : 'Check in'}
              </button>
            )}
          </div>
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
            { key: 'status', label: 'Status' },
            { key: 'actions', label: 'Actions', render: (seat) => seat.id && seat.assignedTo && seat.assignedTo !== '-' ? (
              <TableActionMenu
                primary={(
                  <button className="mini-action-link secondary" type="button" disabled={seatActionId === String(seat.id)} onClick={() => handleSeatCheckIn(seat, !/checked/i.test(seat.status || ''))}>
                    <CheckCircle size={15} />
                    {/checked/i.test(seat.status || '') ? 'Undo' : 'Check in'}
                  </button>
                )}
                items={[
                  { label: /checked/i.test(seat.status || '') ? 'Reset status' : 'Check in', icon: <CheckCircle size={15} />, onClick: () => handleSeatCheckIn(seat, !/checked/i.test(seat.status || '')) }
                ]}
              />
            ) : '-' }
          ]}
        />
      </>
    );
  }

  async function handleAttendanceSave(records) {
    const mergeRows = (incomingRows) => {
      const incomingKeys = new Set(incomingRows.map((row) => `${row.className}|${row.attendanceDate}|${row.registrationKey}`));
      const remaining = attendanceRecords.filter((row) => !incomingKeys.has(`${row.className}|${row.attendanceDate}|${row.registrationKey}`));
      const nextRows = [...remaining, ...incomingRows];
      writeJson('kb-attendance-records', nextRows);
      setDashboard((current) => ({ ...current, attendance: nextRows }));
      return nextRows;
    };

    try {
      const savedRows = await apiSaveAttendance(records);
      mergeRows(savedRows.length ? savedRows : records);
    } catch (error) {
      mergeRows(records.map((row) => ({
        ...row,
        id: row.id || `${row.className}-${row.attendanceDate}-${row.registrationKey}`,
        updatedAt: new Date().toISOString()
      })));
      throw error;
    }
  }

  if (view === 'teacher') {
    const classRows = visibleTeacherRegistrations.filter((row) => row.registrationType === 'class' || visibleTeacherPrograms.some((program) => program.title === row.program));
    const teacherRows = registeredUsers.filter((row) => String(row.role || '').toLowerCase() === 'teacher' || (row.roles || []).includes?.('teacher'));
    const classGroups = summarizeBy(classRows, 'program', 6);
    const visibleTeacherRows = teacherRows.filter((row) => {
      const query = teacherDirectoryQuery.trim().toLowerCase();
      if (!query) return true;
      return [row.firstName, row.lastName, row.name, row.email, row.phone]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
    return (
      <>
        <PageHeader root="Teacher" area="Class Area" title="Teacher class area" />
        <section className="teacher-class-dashboard-card">
          <div className="teacher-class-section-heading">
            <span className="teacher-class-section-icon teacher-class-section-icon--gold"><ListChecks size={20} /></span>
            <div>
              <h2>Class overview</h2>
              <p>View registrations, confirmations and payment status for each class.</p>
            </div>
          </div>
          <div className="teacher-class-table-shell">
            <table className="teacher-class-table teacher-class-overview-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Registrations</th>
                  <th>Confirmed</th>
                  <th>Paid</th>
                  <th>Payment progress</th>
                </tr>
              </thead>
              <tbody>
                {classGroups.length ? classGroups.map((group) => {
                  const confirmed = statusCount(group.rows, (status) => status.includes('confirmed'));
                  const paid = group.rows.filter(isPaidRegistration).length;
                  const progress = Math.round((paid / Math.max(1, group.count)) * 100);
                  const program = visibleTeacherPrograms.find((item) => item.title === group.label);
                  return (
                    <tr key={group.label}>
                      <td>
                        <strong>{group.label || 'Unassigned class'}</strong>
                        {program?.eventId && <small>{program.eventId}</small>}
                      </td>
                      <td>{group.count}</td>
                      <td>{confirmed}</td>
                      <td>{paid}</td>
                      <td>
                        <div className="teacher-payment-progress">
                          <span><i style={{ width: `${progress}%` }} /></span>
                          <b>{progress}%</b>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="teacher-class-empty">No class registrations yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="teacher-class-dashboard-card teacher-directory-card">
          <div className="teacher-directory-toolbar">
            <div className="teacher-class-section-heading">
              <span className="teacher-class-section-icon teacher-class-section-icon--blue"><UsersRound size={20} /></span>
              <div>
                <h2>Teacher directory <em>{teacherRows.length} teachers</em></h2>
                <p>Search and view teacher details, including their class registrations.</p>
              </div>
            </div>
            <div className="teacher-directory-actions">
              <label className="teacher-directory-search">
                <Search size={16} />
                <input
                  value={teacherDirectoryQuery}
                  onChange={(event) => setTeacherDirectoryQuery(event.target.value)}
                  placeholder="Search teachers by name or email"
                />
              </label>
              <button className="button secondary" type="button">Export</button>
            </div>
          </div>
          <div className="teacher-class-table-shell">
            <table className="teacher-class-table teacher-directory-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Registrations</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTeacherRows.length ? visibleTeacherRows.map((row) => {
                  const name = `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.name || row.email || 'Teacher';
                  const initial = name.trim().charAt(0).toUpperCase() || 'T';
                  return (
                    <tr key={row.id || row.email || name}>
                      <td>
                        <div className="teacher-directory-name">
                          <span>{initial}</span>
                          <strong>{name}</strong>
                        </div>
                      </td>
                      <td>{row.email || '-'}</td>
                      <td>{row.phone || '-'}</td>
                      <td>{Number(row.registrationCount || row.registrations?.length || 0)}</td>
                      <td>
                        <div className="teacher-directory-row-actions">
                          <button className="button secondary" type="button" onClick={() => setDetailRecord(row)}>
                            <Eye size={15} /> View details
                          </button>
                          <button className="icon-button" type="button" title="More actions" aria-label="More actions">
                            <MoreHorizontal size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="teacher-class-empty">No teacher accounts found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="teacher-directory-note">Sample teacher details shown.</p>
        </section>
        <AdminTable
          title="Class registrations"
          rows={classRows}
          emptyText="No class registrations yet."
          filters={[{ key: 'program', label: 'Class', options: uniqueOptions(classRows, 'program') }]}
          columns={[
            { key: 'program', label: 'Class' },
            { key: 'familyMember', label: 'Student', render: (row) => row.familyMember || row.studentName || '-' },
            { key: 'email', label: 'Registered by' },
            { key: 'phone', label: 'Phone number' },
            { key: 'birthYear', label: 'BirthYear' },
            { key: 'status', label: 'Status' },
            { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toFixed(2)}` },
            { key: 'paid', label: 'Paid', render: (row) => isPaidRegistration(row) ? 'Yes' : 'No' },
            { key: 'paymentReference', label: 'Payment Ref', render: (row) => getPaymentDetails(row)?.reference || '-' },
            { key: 'details', label: 'Details', render: (row) => <DetailsIconButton onClick={() => setRegistrationDetail(row)} /> },
            { key: 'actions', label: 'Actions', render: (row) => <RegistrationActionMenu row={row} /> }
          ]}
        />
        {editRecord?.kind === 'registration' && (
          <AdminEditModal
            kind="registration"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('registration', editRecord.row, patch)}
          />
        )}
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  if (view === 'teacher-attendance') {
    return (
      <TeacherAttendanceView
        programs={visibleTeacherPrograms}
        registrations={visibleTeacherRegistrations}
        attendanceRecords={attendanceRecords}
        currentUser={user}
        onSave={handleAttendanceSave}
      />
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
        <section className="admin-dashboard-hero-grid">
          <article><ReceiptText size={24} /><span>Total expenses</span><strong>{expenses.length}</strong></article>
          <article><HandCoins size={24} /><span>Submitted</span><strong>${submittedAmount.toLocaleString()}</strong></article>
          <article><CalendarDays size={24} /><span>Approved</span><strong>${approvedAmount.toLocaleString()}</strong></article>
          <article><UsersRound size={24} /><span>{tr('Paid')}</span><strong>${paidAmount.toLocaleString()}</strong></article>
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
            { key: 'vendor', label: 'Vendor' },
            { key: 'paymentMethod', label: 'Payment method' },
            { key: 'receipt', label: 'Receipt', render: (row) => <ReceiptLink row={row} /> },
            { key: 'submittedBy', label: 'Submitted by' },
            { key: 'reimbursementTo', label: 'Reimburse to' },
            { key: 'status', label: 'Status' },
            { key: 'action', label: 'Action', render: (row) => (
              <TableActionMenu
                primary={String(row.status || '').toLowerCase().includes('approved')
                  ? <button className="mini-action-link success" type="button" onClick={() => runExpenseAction(row, 'paid', 'Paid')}>{tr('Mark paid')}</button>
                  : <button className="mini-action-link success" type="button" onClick={() => runExpenseAction(row, 'approve', 'Approved')}>Approve</button>}
                items={[
                  { label: 'View details', icon: <Eye size={15} />, onClick: () => setEditRecord({ kind: 'expense', row }) },
                  { label: 'Edit', icon: <Edit3 size={15} />, onClick: () => setEditRecord({ kind: 'expense', row }) },
                  !String(row.status || '').toLowerCase().includes('paid') && { label: 'Mark paid', icon: <CheckCircle size={15} />, onClick: () => runExpenseAction(row, 'paid', 'Paid') },
                  { label: 'Reject', icon: <X size={15} />, danger: true, onClick: () => runExpenseAction(row, 'reject', 'Rejected') },
                  { label: 'Reset status', icon: <RefreshCw size={15} />, onClick: () => runExpenseAction(row, 'reset', 'Submitted') },
                  { label: 'Delete', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteAdminRecord('expense', row) }
                ]}
              />
            ) }
          ]}
        />
        {editRecord?.kind === 'expense' && (
          <AdminEditModal
            kind="expense"
            row={editRecord.row}
            onClose={() => setEditRecord(null)}
            onSave={(patch) => saveEditedRecord('expense', editRecord.row, patch)}
          />
        )}
      </>
    );
  }

  if (view === 'user-search') {
    const foundUser = userSearchResult;
    const matchingUsers = foundUser ? [foundUser] : (userSearchError ? [] : sampleFindUsers);
    const selectedUser = foundUser || (!userSearchError ? sampleFindUsers[0] : null);
    const foundProfile = selectedUser?.profile || {};
    const foundName = cleanText(selectedUser?.name || `${foundProfile.firstName || selectedUser?.firstName || ''} ${foundProfile.lastName || selectedUser?.lastName || ''}`) || selectedUser?.email || 'Member';
    const foundEmail = selectedUser?.email || foundProfile.email || '-';
    const foundPhone = selectedUser?.phone || foundProfile.phone || '-';
    const foundRole = selectedUser?.role || selectedUser?.roles?.[0] || foundProfile.role || 'Member';
    const foundCreatedAt = selectedUser?.createdAt || selectedUser?.created_at || foundProfile.createdAt || foundProfile.created_at;
    const foundRegistrations = Array.isArray(selectedUser?.registrations) ? selectedUser.registrations : [];
    const foundChildren = Array.isArray(selectedUser?.children) ? selectedUser.children : [];

    return (
      <>
        <PageHeader
          area="User"
          title="Find user by email"
          action={<span className="find-user-sample-badge">Sample data</span>}
        />
        <form className="find-user-search-card" onSubmit={handleUserSearch}>
          <label>
            <span>Email address <b>*</b></span>
            <div className="find-user-input-wrap">
              <Mail size={18} />
              <input name="email" type="email" placeholder="member@example.com" defaultValue="member@example.com" required />
            </div>
          </label>
          <button className="button primary" type="submit"><Search size={22} /> Search</button>
          {userSearchError && <p className="form-error">{userSearchError}</p>}
        </form>
        <section className="find-user-results-panel">
          <h2>Matching users <span>({matchingUsers.length})</span></h2>
          <div className="find-user-table-wrap">
            <table className="find-user-table">
              <thead>
                <tr>
                  <th />
                  <th>Created on</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Phone number</th>
                  <th>Role</th>
                  <th>Registrations</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {matchingUsers.length ? matchingUsers.map((row, rowIndex) => {
                  const profile = row.profile || {};
                  const name = cleanText(row.name || `${profile.firstName || row.firstName || ''} ${profile.lastName || row.lastName || ''}`) || row.email || 'Member';
                  const email = row.email || profile.email || '-';
                  const phone = row.phone || profile.phone || '-';
                  const role = row.role || row.roles?.[0] || profile.role || 'Member';
                  const createdAt = row.createdAt || row.created_at || profile.createdAt || profile.created_at;
                  const registrationCount = Array.isArray(row.registrations) ? row.registrations.length : 0;
                  return (
                    <tr key={row.id || email} className={rowIndex === 0 ? 'is-selected' : undefined}>
                      <td><span className="find-user-avatar sm">{getInitials(name)}</span></td>
                      <td>{formatDateShort(createdAt)}</td>
                      <td>{email}</td>
                      <td>{name}</td>
                      <td>{phone}</td>
                      <td><span className={`find-user-role ${String(role).toLowerCase()}`}>{role}</span></td>
                      <td><button className="find-user-count-link" type="button">{registrationCount}</button></td>
                      <td>
                        <button className="find-user-details-button" type="button" onClick={() => document.getElementById('find-user-detail-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                          View details <ChevronRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="find-user-empty">Search by email to view matching users.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedUser && (
            <article className="find-user-detail-card" id="find-user-detail-card">
              <header className="find-user-detail-header">
                <span className="find-user-avatar lg">{getInitials(foundName)}</span>
                <div>
                  <h3>{foundName} <span className={`find-user-role ${String(foundRole).toLowerCase()}`}>{foundRole}</span></h3>
                  <p>
                    <span><Mail size={17} /> {foundEmail}</span>
                    <span><Phone size={17} /> {foundPhone}</span>
                  </p>
                </div>
                <aside>
                  <small>Created on</small>
                  <span><CalendarDays size={17} /> {formatDateShort(foundCreatedAt)}</span>
                </aside>
              </header>

              <div className="find-user-detail-grid">
                <section className="find-user-info-box">
                  <h4><UserRound size={22} /> Profile</h4>
                  <dl>
                    <dt>Name</dt><dd>{foundName}</dd>
                    <dt>Email</dt><dd>{foundEmail}</dd>
                    <dt>Phone number</dt><dd>{foundPhone}</dd>
                    <dt>Role</dt><dd><span className={`find-user-role ${String(foundRole).toLowerCase()}`}>{foundRole}</span></dd>
                    <dt>Created on</dt><dd>{formatDateShort(foundCreatedAt)}</dd>
                  </dl>
                </section>

                <section className="find-user-info-box">
                  <h4><UsersRound size={22} /> Children <span>({foundChildren.length})</span></h4>
                  <div className="find-user-children-list">
                    {foundChildren.length ? foundChildren.map((child, index) => {
                      const childName = cleanText(child.name || `${child.firstName || ''} ${child.lastName || ''}`) || `Child ${index + 1}`;
                      return (
                        <div key={child.id || childName}>
                          <span className="find-user-avatar md">{getInitials(childName)}</span>
                          <strong>{childName}<small>{child.phone || child.email || '-'}</small></strong>
                          <em>{child.classLevel || child.level || child.class || 'Active'}</em>
                        </div>
                      );
                    }) : <p className="find-user-empty-note">No children found for this user.</p>}
                  </div>
                </section>

                <section className="find-user-info-box">
                  <h4><CalendarDays size={22} /> Registrations <span>({foundRegistrations.length})</span></h4>
                  <table className="find-user-mini-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Event / Class</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foundRegistrations.length ? foundRegistrations.slice(0, 3).map((registration, index) => (
                        <tr key={registration.id || `${registration.program}-${index}`}>
                          <td>{formatDateShort(registration.registeredOn || registration.createdAt || registration.created_at || registration.date)}</td>
                          <td>{registration.registrationType || registration.type || (registration.eventId ? 'Event' : 'Class')}</td>
                          <td>{registration.program || registration.event || registration.className || '-'}</td>
                          <td><span className="find-user-confirmed">{registration.status || 'Confirmed'}</span></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4}>No registrations found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </div>
            </article>
          )}
        </section>
      </>
    );
  }

  if (view === 'email-outbox') {
    return (
      <>
        <PageHeader
          area="Email Outbox"
          title="Queued emails"
          action={<button className="button primary" type="button" onClick={sendTestEmail}>Send test email</button>}
        />
        {(emailOutboxNotice || emailOutboxError) && (
          <div className={`admin-inline-message ${emailOutboxError ? 'error' : 'success'}`}>
            {emailOutboxError || emailOutboxNotice}
          </div>
        )}
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
            { key: 'action', label: 'Action', render: (row) => (
              <TableActionMenu
                primary={<button className="mini-action-link success" type="button" onClick={() => resendOutboxEmail(row)}>Send</button>}
                items={[
                  { label: 'Send', icon: <Send size={15} />, onClick: () => resendOutboxEmail(row) }
                ]}
              />
            ) }
          ]}
        />
      </>
    );
  }

  if (view === 'student-view') {
    const studentNameFor = (row) => cleanText(row.familyMember || row.studentName || row.registeredName || row.parentName || row.name || row.email);
    const actualStudentNames = [...new Set(registrations.map(studentNameFor).filter(Boolean))];
    const requestedStudent = cleanText(searchParams.get('student'));
    const availableStudentNames = actualStudentNames.length ? actualStudentNames : sampleStudentView.family.map((member) => member.name);
    const selectedStudentName = availableStudentNames.includes(studentViewSelectedName)
      ? studentViewSelectedName
      : availableStudentNames.includes(requestedStudent)
        ? requestedStudent
        : availableStudentNames[0] || sampleStudentView.profile.name;
    const selectedRows = registrations.filter((row) => studentNameFor(row) === selectedStudentName);
    const hasLiveStudent = selectedRows.length > 0;
    const liveProfileRow = selectedRows[0] || {};
    const liveClassRows = selectedRows.filter((row) => isClassRegistration(row, programs, allEvents));
    const liveEventRows = selectedRows.filter((row) => !isClassRegistration(row, programs, allEvents));
    const profileData = hasLiveStudent ? {
      id: liveProfileRow.studentId || liveProfileRow.student_id || liveProfileRow.eventId || `KB${String(actualStudentNames.indexOf(selectedStudentName) + 1).padStart(5, '0')}`,
      name: selectedStudentName,
      birthDate: liveProfileRow.birthDate || liveProfileRow.birth_date || (liveProfileRow.birthYear ? `Birth year ${liveProfileRow.birthYear}` : '-'),
      email: liveProfileRow.studentEmail || liveProfileRow.email || '-',
      phone: liveProfileRow.studentPhone || liveProfileRow.phone || '-',
      address: liveProfileRow.address || profile.address || '-',
      parentName: liveProfileRow.parentName || liveProfileRow.registeredBy || '-',
      parentEmail: liveProfileRow.email || '-',
      parentPhone: liveProfileRow.phone || '-'
    } : { ...sampleStudentView.profile, name: selectedStudentName };
    const familyMembers = actualStudentNames.length ? actualStudentNames.slice(0, 5).map((name, index) => {
      const row = registrations.find((registration) => studentNameFor(registration) === name) || {};
      const matchingProgram = programs.find((program) => program.title === row.program);
      return {
        name,
        level: matchingProgram?.level || row.level || String(row.program || 'Student').replace(/^Kannada\s*/i, ''),
        initials: getInitials(name),
        tone: index % 2 ? 'pink' : 'blue'
      };
    }) : sampleStudentView.family;
    const normalizeClassRow = (row, index) => {
      const meta = getProgramMeta(row, programs, allEvents);
      return {
        ...row,
        id: row.id || `class-${index}`,
        studentName: studentNameFor(row) || selectedStudentName,
        program: row.program || meta.title || '-',
        term: row.term || meta.term || 'Spring 2026',
        programDates: row.programDates || row.schedule || meta.date || meta.schedule || formatDateShort(row.createdAt),
        amount: getMoneyAmount(row),
        status: row.status || (isPaidRegistration(row) ? 'Confirmed' : 'Pending')
      };
    };
    const normalizeEventRow = (row, index) => {
      const meta = getProgramMeta(row, programs, allEvents);
      return {
        ...row,
        id: row.id || `event-${index}`,
        studentName: studentNameFor(row) || selectedStudentName,
        program: row.program || meta.title || '-',
        date: row.date || meta.startOn || meta.date || formatDateShort(row.createdAt),
        location: row.location || meta.location || '-',
        amount: getMoneyAmount(row),
        status: row.status || (isPaidRegistration(row) ? 'Confirmed' : 'Pending')
      };
    };
    const classRegistrationRows = (hasLiveStudent ? liveClassRows : sampleStudentView.classRegistrations).map(normalizeClassRow);
    const eventRegistrationRows = (hasLiveStudent ? liveEventRows : sampleStudentView.eventRegistrations).map(normalizeEventRow);
    const registeredProgramNames = new Set(selectedRows.map((row) => row.program));
    const liveAvailablePrograms = programs.filter((program) => !registeredProgramNames.has(program.title)).slice(0, 3).map((program, index) => ({
      id: program.id || `available-${index}`,
      title: program.title,
      type: program.category || program.type || 'Kannada Class',
      level: program.level || program.age || 'All Levels',
      schedule: program.schedule || program.date || 'Schedule available',
      fee: Number(program.fee || program.amount || 0)
    }));
    const availablePrograms = liveAvailablePrograms.length ? liveAvailablePrograms : sampleStudentView.availablePrograms;
    const showClassRegistrations = studentViewTab !== 'events';
    const showEventRegistrations = studentViewTab !== 'classes';
    const renderStatus = (status) => {
      const isConfirmed = /confirmed|paid|active/i.test(status || '');
      return (
        <span className={`student-view-status ${isConfirmed ? 'is-confirmed' : 'is-pending'}`}>
          {isConfirmed ? <CheckCircle size={17} /> : <Clock3 size={17} />}
          <span>{status || 'Pending'}</span>
        </span>
      );
    };
    return (
      <>
        <PageHeader area="Student view" title="Student View" />
        <section className="student-view-workspace">
          <aside className="student-view-profile-card">
            <div className="student-view-profile-heading">
              <h2>Student Profile</h2>
              <a className="student-view-edit-button" href="/admin/profile"><Edit3 size={17} /> Edit</a>
            </div>
            <div className="student-view-profile-identity">
              <span className="student-view-avatar">{getInitials(profileData.name)}</span>
              <div>
                <h3>{profileData.name}</h3>
                <p>Student ID: {profileData.id}</p>
                <span>Active</span>
              </div>
            </div>
            <dl className="student-view-profile-details">
              <div><dt><CalendarDays size={18} /> Date of Birth</dt><dd>{profileData.birthDate}</dd></div>
              <div><dt><Mail size={18} /> Email</dt><dd>{profileData.email}</dd></div>
              <div><dt><Phone size={18} /> Phone</dt><dd>{profileData.phone}</dd></div>
              <div><dt><MapPin size={18} /> Address</dt><dd>{String(profileData.address).split('\n').map((line) => <span key={line}>{line}</span>)}</dd></div>
              <div><dt><UsersRound size={18} /> Parent / Guardian</dt><dd><span>{profileData.parentName}</span><span>{profileData.parentEmail}</span><span>{profileData.parentPhone}</span></dd></div>
            </dl>
            <div className="student-view-family-card">
              <div className="student-view-family-title"><UsersRound size={23} /><strong>Family Members ({familyMembers.length})</strong><ChevronRight size={19} /></div>
              {familyMembers.map((member) => (
                <button
                  className={member.name === selectedStudentName ? 'is-selected' : ''}
                  type="button"
                  key={member.name}
                  onClick={() => setStudentViewSelectedName(member.name)}
                >
                  <span className={`student-view-family-avatar is-${member.tone}`}>{member.initials}</span>
                  <span><strong>{member.name}</strong><small>Student • {member.level}</small></span>
                  <em>Active</em>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </aside>

          <div className="student-view-main">
            <nav className="student-view-tabs" aria-label="Student record sections">
              <button className={studentViewTab === 'registrations' ? 'is-active' : ''} type="button" onClick={() => setStudentViewTab('registrations')}><ReceiptText size={22} /> Registrations</button>
              <button className={studentViewTab === 'classes' ? 'is-active' : ''} type="button" onClick={() => setStudentViewTab('classes')}><GraduationCap size={23} /> Classes</button>
              <button className={studentViewTab === 'events' ? 'is-active' : ''} type="button" onClick={() => setStudentViewTab('events')}><CalendarDays size={22} /> Events</button>
            </nav>

            {showClassRegistrations && (
              <section className="student-view-data-card">
                <div className="student-view-section-heading"><h2>Class Registrations</h2><button type="button" onClick={() => setStudentViewTab('classes')}>View all</button></div>
                <div className="student-view-table-scroll">
                  <table>
                    <thead><tr><th>Student</th><th>Class</th><th>Term</th><th>Program Dates</th><th>Paid Amount</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {classRegistrationRows.length ? classRegistrationRows.map((row) => (
                        <tr key={row.id}>
                          <td><span className="student-view-table-student"><i>{getInitials(row.studentName)}</i>{row.studentName}</span></td>
                          <td>{row.program}</td><td>{row.term}</td><td>{row.programDates}</td><td>${Number(row.amount || 0).toLocaleString()}</td><td>{renderStatus(row.status)}</td>
                          <td><button className="student-view-more-button" type="button" aria-label={`View ${row.program} registration`} onClick={() => setRegistrationDetail(row)}><MoreHorizontal size={19} /></button></td>
                        </tr>
                      )) : <tr><td colSpan={7}>No class registrations found for this student.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {showEventRegistrations && (
              <section className="student-view-data-card">
                <div className="student-view-section-heading"><h2>Event Registrations</h2><button type="button" onClick={() => setStudentViewTab('events')}>View all</button></div>
                <div className="student-view-table-scroll">
                  <table>
                    <thead><tr><th>Student</th><th>Event</th><th>Date</th><th>Location</th><th>Paid Amount</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {eventRegistrationRows.length ? eventRegistrationRows.map((row) => (
                        <tr key={row.id}>
                          <td><span className="student-view-table-student"><i>{getInitials(row.studentName)}</i>{row.studentName}</span></td>
                          <td>{row.program}</td><td>{row.date}</td><td>{row.location}</td><td>${Number(row.amount || 0).toLocaleString()}</td><td>{renderStatus(row.status)}</td>
                          <td><button className="student-view-more-button" type="button" aria-label={`View ${row.program} registration`} onClick={() => setRegistrationDetail(row)}><MoreHorizontal size={19} /></button></td>
                        </tr>
                      )) : <tr><td colSpan={7}>No event registrations found for this student.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="student-view-data-card student-view-available-card">
              <div className="student-view-section-heading student-view-program-heading">
                <h2>Available Programs for This Student</h2>
                <div><select aria-label="Program type"><option>All Program Types</option><option>Kannada Class</option><option>Special Program</option></select><select aria-label="Term"><option>Spring 2026</option><option>Summer 2026</option></select></div>
              </div>
              <div className="student-view-table-scroll">
                <table>
                  <thead><tr><th>Program</th><th>Type</th><th>Age / Level</th><th>Schedule</th><th>Fee</th><th>Availability</th><th>Action</th></tr></thead>
                  <tbody>{availablePrograms.map((program) => (
                    <tr key={program.id || program.title}><td><strong>{program.title}</strong></td><td>{program.type}</td><td>{program.level}</td><td>{program.schedule}</td><td>${Number(program.fee || 0).toLocaleString()}</td><td><span className="student-view-open"><i /> Open</span></td><td><button className="student-view-register-button" type="button" onClick={() => { window.location.href = `/admin/register-member?program=${encodeURIComponent(program.title)}`; }}>Register</button></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  if (view === 'developer') {
    const localKeys = Object.keys(localStorage || {}).filter((key) => key.startsWith('kb-')).sort();
    const templatePreviews = [
      {
        title: 'Confirm email',
        key: 'confirm-email',
        subject: 'Confirm your Kannada Bharati account',
        body: 'Please confirm your Kannada Bharati account.',
        action: 'Confirm Email'
      },
      {
        title: 'Forgot password',
        key: 'forgot-password',
        subject: 'Reset your Kannada Bharati password',
        body: 'Use the link below to reset your Kannada Bharati password.',
        action: 'Reset Password'
      },
      {
        title: 'Login verification',
        key: 'two-factor-code',
        subject: 'Your Kannada Bharati login code',
        body: 'Secure login and two-factor authentication code with its expiration notice.',
        action: 'Preview Login Code'
      },
      {
        title: 'Registration',
        key: 'registration',
        subject: 'Kannada Bharati registration received',
        body: 'Your registration details are below. Payment instructions appear when an amount is pending.',
        action: 'Pay Registration Fee'
      },
      {
        title: 'Donation',
        key: 'donation',
        subject: 'Kannada Bharati donation confirmation',
        body: 'Thank you for supporting Kannada Bharati.',
        action: 'View Donation'
      },
      {
        title: 'Payment confirmation',
        key: 'payment',
        subject: 'Kannada Bharati payment confirmation',
        body: 'Payment status and registration details are included for the recipient.',
        action: 'View Payment'
      },
      {
        title: 'Admin message',
        key: 'bulk-message',
        subject: 'Classes Registration Now Open',
        body: 'Branded template used for messages composed by administrators.',
        action: 'Preview Message Email'
      }
    ];
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
    const systemStatuses = [
      ['API mode', import.meta.env.VITE_API_URL ? 'Configured API URL' : 'Default /api proxy', Boolean(import.meta.env.VITE_API_URL)],
      ['Google login', import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'Configured' : 'Missing client id', Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)],
      ['reCAPTCHA', import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ? 'Configured' : 'Local fallback', Boolean(import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY)]
    ];
    return (
      <>
        <PageHeader area="Developer" title="Admin developer tools" />
        <section className="admin-page-panel developer-panel">
          <div className="admin-page-panel-heading"><h2>System diagnostics</h2><span>{tableCounts.reduce((sum, [, count]) => sum + count, 0)}</span></div>
          <div className="developer-diagnostic-grid">
            {tableCounts.map(([label, count]) => (
              <article key={label} className="developer-metric-card">
                <span>{label}</span>
                <strong>{count}</strong>
                <small>{count ? 'Data available' : 'No records yet'}</small>
              </article>
            ))}
          </div>
          <div className="developer-status-row">
            {systemStatuses.map(([label, value, configured]) => (
              <article key={label} className={configured ? 'developer-status-card is-ready' : 'developer-status-card'}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </section>
        <section className="admin-page-panel developer-panel">
          <div className="admin-page-panel-heading"><h2>Email template previews</h2><span>{templatePreviews.length}</span></div>
          <div className="template-preview-grid">
            {templatePreviews.map((template) => (
              <article className="email-template-preview" key={template.title}>
                <span>{template.title}</span>
                <h3>{template.subject}</h3>
                <p>{template.body}</p>
                <a className="button compact" href={`/api/developer/email-templates/${template.key}`} target="_blank" rel="noreferrer">{template.action}</a>
                <small>Kannada Bharati</small>
              </article>
            ))}
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
              label: 'Roles',
              render: (row) => (
                <UserRoleEditor row={row} onChange={(roles) => updateUser(row, { role: roles.includes('admin') || roles.includes('superadmin') ? 'admin' : roles[0], roles })} />
              )
            },
            {
              key: 'defaulterHistory',
              label: 'History',
              render: (row) => {
                const history = (dashboard.defaulterHistory || []).filter((item) => String(item.user_email || item.userEmail || '').toLowerCase() === String(row.email || '').toLowerCase());
                return history.length ? `${history.length} record(s)` : '-';
              }
            },
            { key: 'emailConfirmed', label: 'Email confirmed', render: (row) => row.emailConfirmed ? 'Yes' : 'No' },
            { key: 'twoFactorEnabled', label: '2FA', render: (row) => row.twoFactorEnabled ? 'On' : 'Off' },
            {
              key: 'enabled',
              label: 'Enabled',
              render: (row) => (
                <EnabledToggle
                  enabled={row.enabled !== false}
                  onLabel="Enabled"
                  offLabel="Disabled"
                  onChange={(enabled) => updateUser(row, { enabled })}
                />
              )
            },
            { key: 'details', label: 'Details', render: (row) => <DetailsIconButton onClick={() => setRegistrationDetail(row)} /> }
          ]}
        />
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  const dashboardName = [
    profile.firstName || user?.firstName || user?.name,
    profile.lastName || user?.lastName
  ].filter(Boolean).join(' ').trim() || user?.email || 'Member';
  const dashboardInitials = dashboardName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const dashboardSpouseName = [profile.spouseFirstName, profile.spouseLastName].filter(Boolean).join(' ') || '-';
  const dashboardPhone = profile.phone || user?.phone || '-';
  const dashboardEvents = allEvents
    .filter((row) => `${row.title || ''} ${row.location || ''}`.toLowerCase().includes(dashboardEventSearch.trim().toLowerCase()))
    .slice(0, 4);
  const memberMetrics = [
    { label: 'My registrations', value: userRegistrations.length, icon: UserRound, href: '/admin/registration-classes' },
    { label: 'My classes', value: userClassRegistrations.length, icon: CalendarDays, href: '/admin/registration-classes' },
    { label: 'My events', value: userEventRegistrations.length, icon: ReceiptText, href: '/admin/registrations' },
    { label: 'Announcements', value: announcements.length, icon: Megaphone, href: '/admin/announcements' }
  ];
  const communityCards = [
    { label: 'All registrations', value: registrations.length, icon: UsersRound, href: '/admin/registrations' },
    { label: 'Current events', value: allEvents.length, icon: CalendarDays, href: '/admin/events' },
    { label: 'Expenses', value: expenses.length, icon: ReceiptText, href: '/admin/expense' },
    { label: 'Announcements', value: announcements.length, icon: Megaphone, href: '/admin/announcements' }
  ];

  return (
    <div className="member-dashboard-page">
      <nav className="member-dashboard-breadcrumb" aria-label="Breadcrumb"><strong>Admin</strong><span>/</span>Dashboard</nav>

      <section className="member-dashboard-welcome">
        <div className="member-dashboard-welcome-copy">
          <h1>Member dashboard</h1>
          <p>Welcome, {dashboardName}</p>
        </div>
        <span className="member-dashboard-welcome-art" aria-hidden="true" />
      </section>

      <section className="member-dashboard-metrics" aria-label="Member dashboard summary">
        {memberMetrics.map((card) => {
          const Icon = card.icon;
          return (
            <a className="member-dashboard-metric" href={card.href} key={card.label}>
              <span className="member-dashboard-metric-icon"><Icon size={22} /></span>
              <span><small>{card.label}</small><strong>{card.value}</strong></span>
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          );
        })}
      </section>

      <section className="member-dashboard-workspace">
        <article className="member-dashboard-card member-dashboard-information">
          <div className="member-dashboard-card-heading">
            <h2>My information</h2>
            <a className="member-dashboard-edit" href="/admin/profile"><Edit3 size={14} />Update profile</a>
          </div>
          <div className="member-dashboard-identity">
            <span className="member-dashboard-avatar">{dashboardInitials}</span>
            <strong>{dashboardName}</strong>
          </div>
          <div className="member-dashboard-profile-details">
            <div><Mail size={16} /><span>Email</span><strong>{user?.email || '-'}</strong></div>
            <div><Phone size={16} /><span>Phone</span><strong>{dashboardPhone}</strong></div>
            <div><Building2 size={16} /><span>Company</span><strong>{profile.company || '-'}</strong></div>
            <div><UsersRound size={16} /><span>Spouse</span><strong>{dashboardSpouseName}</strong></div>
            <div><UserRound size={16} /><span>Children</span><strong>{profileChildren.length}</strong></div>
          </div>
        </article>

        <div className="member-dashboard-right-column">
          <article className="member-dashboard-card member-dashboard-community-card">
            <div className="member-dashboard-card-heading"><h2>Community overview</h2></div>
            <div className="member-dashboard-community-grid">
              {communityCards.map((card) => {
                const Icon = card.icon;
                return (
                  <a href={card.href} key={card.label}>
                    <span className="member-dashboard-metric-icon"><Icon size={20} /></span>
                    <span><small>{card.label}</small><strong>{card.value}</strong></span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </article>

          <article className="member-dashboard-card member-dashboard-current-events">
            <div className="member-dashboard-card-heading">
              <h2>Current events</h2>
              <span className="member-dashboard-count">{allEvents.length}</span>
            </div>
            <label className="member-dashboard-event-search">
              <Search size={16} />
              <input value={dashboardEventSearch} onChange={(event) => setDashboardEventSearch(event.target.value)} placeholder="Search" />
            </label>
            <div className="member-dashboard-event-list">
              {dashboardEvents.map((event) => (
                <a href={`/admin/register-member?program=${encodeURIComponent(event.title || '')}`} key={event.id || event.title}>
                  <span className="member-dashboard-event-date"><CalendarDays size={17} /></span>
                  <span><strong>{event.title}</strong><small>{event.date || event.startOn || event.month || 'Date to be announced'}{event.location ? ` · ${event.location}` : ''}</small></span>
                  <ChevronRight size={16} />
                </a>
              ))}
              {dashboardEvents.length === 0 && (
                <div className="member-dashboard-events-empty">
                  <CalendarDays size={38} />
                  <span>No matching events</span>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
      {detailRecord && <EventDetailModal item={detailRecord} onClose={() => setDetailRecord(null)} />}
    </div>
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

