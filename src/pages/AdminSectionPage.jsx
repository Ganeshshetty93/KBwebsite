import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { BookOpen, CalendarDays, Eye, HandCoins, Megaphone, Plus, ReceiptText, UsersRound, X } from 'lucide-react';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { culturalClasses, events, paataShaaleLevels } from '../data/siteData.js';
import { appendRecord, canAccessAdminPath, defaultAdminPath, getCurrentUser, hasAnyRole, isAdmin, readJson, setCurrentUser, writeJson } from '../utils/storage.js';
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
  apiSaveAttendance,
  apiSaveSiteSetting,
  apiSendOutboxEmail,
  apiSendTestEmail,
  apiUploadFile,
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
const assignableRoles = ['member', 'admin', 'superadmin', 'receptionist', 'teacher', 'volunteer', 'treasurer'];
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
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(1);
  const visibleRows = useMemo(() => rows.filter((row) => {
    const text = Object.values(row).join(' ').toLowerCase();
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesFilters = filters.every((filter) => {
      const selected = activeFilters[filter.key] || 'All';
      return selected === 'All' || String(row[filter.key] || '') === selected;
    });
    return matchesQuery && matchesFilters;
  }), [activeFilters, filters, query, rows]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedRows = visibleRows.slice(pageStart, pageStart + pageSize);
  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'table';
  const renderValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return tr(value);
    return value;
  };

  useEffect(() => {
    setPage(1);
  }, [activeFilters, query, rows]);

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
        <h2>{tr(title)}</h2>
        <div>
          {action}
          <span>{visibleRows.length}</span>
        </div>
      </div>
      <div className="admin-page-filters">
        {filters.map((filter) => (
          <label key={filter.key}>
            {tr(filter.label)}
            <select value={activeFilters[filter.key] || 'All'} onChange={(event) => setActiveFilters((current) => ({ ...current, [filter.key]: event.target.value }))}>
              <option value="All">{tr('All')}</option>
              {filter.options.map((option) => <option key={option} value={option}>{tr(option)}</option>)}
            </select>
          </label>
        ))}
        <label>
          {tr('Search')}
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr('Search')} />
        </label>
      </div>
      <div className="admin-table-actions">
        <button type="button" onClick={handleCopy}>{tr('Copy')}</button>
        <button type="button" onClick={() => downloadFile(`${filename}.csv`, makeCsv(visibleRows, columns), 'text/csv;charset=utf-8')}>CSV</button>
        <button type="button" onClick={() => downloadFile(`${filename}.xls`, makeHtmlTable(title, visibleRows, columns), 'application/vnd.ms-excel;charset=utf-8')}>Excel</button>
        <button type="button" onClick={() => openPrintableTable(title, visibleRows, columns)}>PDF</button>
        <button type="button" onClick={() => openPrintableTable(title, visibleRows, columns)}>{tr('Print')}</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column.key}>{tr(column.label)}</th>)}</tr>
          </thead>
          <tbody>
            {pagedRows.length ? pagedRows.map((row, index) => (
              <tr key={`${row.id || row.email || row.title || row.text || pageStart + index}-${pageStart + index}`}>
                {columns.map((column) => <td key={column.key}>{column.render ? column.render(row, pageStart + index) : renderValue(row[column.key])}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={columns.length}>{tr(emptyText)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {visibleRows.length > pageSize && (
        <div className="admin-pagination" aria-label={`${title} pagination`}>
          <span>
            {tr('Showing')} {pageStart + 1}-{Math.min(pageStart + pageSize, visibleRows.length)} {tr('of')} {visibleRows.length}
          </span>
          <div>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>{tr('Previous')}</button>
            <strong>{currentPage} / {totalPages}</strong>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>{tr('Next')}</button>
          </div>
        </div>
      )}
    </section>
  );
}

function PageHeader({ root = 'Admin', area, title, action }) {
  const { tr } = useLanguage();
  return (
    <div className="admin-page-header">
      <div>
        <p><span>{tr(root)}</span> / {tr(area)}</p>
        <h1>{tr(title)}</h1>
      </div>
      {action}
    </div>
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
      <section className="workflow-hero attendance-hero">
        <div>
          <p className="eyebrow">{tr('Teacher workspace')}</p>
          <h2>{tr('Take class attendance')}</h2>
          <p>{tr('Select a class and date, mark each student, add notes when needed, and save the roster for reception/admin visibility.')}</p>
          <div className="attendance-hero-meta">
            <span><BookOpen size={16} /> {tr(selectedClass || 'No class selected')}</span>
            <span><CalendarDays size={16} /> {attendanceDate}</span>
          </div>
        </div>
        <div className="workflow-action-list">
          <article><strong>{classRows.length}</strong><span>{tr('Students')}</span></article>
          <article><strong>{presentCount}</strong><span>{tr('Present or late')}</span></article>
          <article><strong>{attendanceRate}%</strong><span>{tr('Attendance')}</span></article>
        </div>
      </section>
      <section className="attendance-command-center admin-page-panel">
        <div className="attendance-command-heading">
          <div>
            <span>{tr('Attendance register')}</span>
            <strong>{tr(selectedClass || 'Select class')}</strong>
          </div>
          <div className="attendance-quick-actions">
            <button type="button" onClick={() => markAll('Present')} disabled={!classRows.length}>{tr('Mark all present')}</button>
            <button type="button" onClick={() => markAll('Absent')} disabled={!classRows.length}>{tr('Mark all absent')}</button>
          </div>
        </div>
        <div className="attendance-class-strip">
          {classOptions.slice(0, 6).map((item) => (
            <button
              key={item.title}
              className={item.title === selectedClass ? 'is-active' : ''}
              type="button"
              onClick={() => setSelectedClass(item.title)}
            >
              <strong>{tr(item.title)}</strong>
              <span>{item.registeredCount} {tr('students')}</span>
            </button>
          ))}
        </div>
        <div className="attendance-toolbar">
          <label>
            {tr('Class')}
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              {classOptions.map((item) => <option key={item.title} value={item.title}>{tr(item.title)} ({item.registeredCount})</option>)}
            </select>
          </label>
          <label>
            {tr('Date')}
            <DatePicker value={attendanceDate} onChange={setAttendanceDate} placeholder={tr('Choose date')} />
          </label>
          <button className="button primary" type="button" onClick={handleSave} disabled={!classRows.length || saving}>
            {saving ? tr('Saving...') : tr(savedForSelection.length ? 'Update attendance' : 'Save attendance')}
          </button>
        </div>
        <div className="attendance-status-summary">
          <span>{tr('Registered in selected class')}: <strong>{selectedClassMeta.registeredCount || 0}</strong></span>
          <span>{tr('Present/Late')}: <strong>{presentCount}</strong></span>
          <span>{tr('Absent')}: <strong>{absentCount}</strong></span>
          <span>{tr('Saved records')}: <strong>{savedForSelection.length}</strong></span>
        </div>
      </section>
      {notice && <p className="animated-form-message">{tr(notice)}</p>}
      <section className="attendance-roster">
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
      <section className="attendance-history-grid">
        <article>
          <div className="panel-mini-heading">
            <span>{tr('Recent sessions')}</span>
            <strong>{recentSessionRows.length}</strong>
          </div>
          {recentSessionRows.length ? recentSessionRows.map((session) => (
            <div className="attendance-history-row" key={`${session.className}-${session.attendanceDate}`}>
              <div>
                <strong>{tr(session.className)}</strong>
                <span>{session.attendanceDate}</span>
              </div>
              <span>{session.present}/{session.total} {tr('present')}</span>
            </div>
          )) : <p>{tr('Saved attendance sessions will appear here.')}</p>}
        </article>
        <article>
          <div className="panel-mini-heading">
            <span>{tr('Class coverage')}</span>
            <strong>{classOptions.filter((item) => item.registeredCount).length}</strong>
          </div>
          {classOptions.slice(0, 5).map((item) => (
            <div className="attendance-history-row" key={item.title}>
              <div>
                <strong>{tr(item.title)}</strong>
                <span>{item.registeredCount ? tr('Ready for attendance') : tr('No registrations yet')}</span>
              </div>
              <span>{item.registeredCount}</span>
            </div>
          ))}
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

function EnabledToggle({ enabled, onChange, onLabel = 'Yes', offLabel = 'No', label = 'Enabled' }) {
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
      <span>{tr('View receipt')}</span>
      <small>{row.receiptName || formatFileSize(row.receiptSize)}</small>
    </a>
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
            <h2>{profile.firstName || row.parentName || row.email}</h2>
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

function UserRoleEditor({ row, onChange }) {
  const roles = Array.isArray(row.roles) && row.roles.length ? row.roles : [row.role || 'member'];
  function toggleRole(role) {
    let next = roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
    if (!next.length) next = ['member'];
    onChange(next);
  }
  return (
    <div className="role-chip-editor">
      {assignableRoles.map((role) => (
        <label key={role} className={roles.includes(role) ? 'is-selected' : ''}>
          <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
          <span>{role}</span>
        </label>
      ))}
    </div>
  );
}

function AdminEditModal({ kind, row, eventTypes = [], recurrences = [], onClose, onSave }) {
  const [error, setError] = useState('');
  const title = kind === 'event' ? 'Edit event' : kind === 'announcement' ? 'Edit announcement' : 'Edit registration';

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
    } else {
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
          <h2>{title}</h2>
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
          <button className="button primary" type="submit">Save changes</button>
          {error && <p className="form-error">{error}</p>}
        </form>
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
          const canSeeAllRegistrations = isAdmin(effectiveUser) || hasAnyRole(effectiveUser, ['receptionist', 'teacher']);
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
  const [editRecord, setEditRecord] = useState(null);
  const [checkedInIds, setCheckedInIds] = useState(() => readJson('kb-checkin-records', []));
  const [eventTypes, setEventTypes] = useState(() => readJson('kb-event-types', defaultEventTypes));
  const [recurrences, setRecurrences] = useState(() => readJson('kb-recurrence-options', defaultRecurrences));
  const [volunteerGoogleForm, setVolunteerGoogleForm] = useState(() => readJson('kb-volunteer-google-form', defaultVolunteerGoogleForm));
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [emailOutboxNotice, setEmailOutboxNotice] = useState('');
  const [emailOutboxError, setEmailOutboxError] = useState('');
  const [userSearchResult, setUserSearchResult] = useState(null);
  const [userSearchError, setUserSearchError] = useState('');
  const [seatError, setSeatError] = useState('');
  const [seatRecords, setSeatRecords] = useState([]);
  const [seatEventTitle, setSeatEventTitle] = useState('');
  const [selectedSeatNumber, setSelectedSeatNumber] = useState('');
  const [selectedSeatRegistrationId, setSelectedSeatRegistrationId] = useState('');
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
  const attendanceRecords = dashboard.attendance || [];
  const profile = readJson(memberProfileKey(user?.email), {});
  const profileChildren = readJson(memberChildrenKey(user?.email), []);
  const eventOptions = [...new Map([
    ...allEvents.map((item) => [item.title, item]),
    ...programs.map((item) => [item.title, item]),
    ...registrations.filter((item) => item.program).map((item) => [item.program, { title: item.program }])
  ].filter(([title]) => title).map(([title, item], index) => [title, { ...item, title, eventId: item.eventId || makeEventId(title, index) }])).values()];
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

  useEffect(() => {
    if (view !== 'seats') return;
    if (!seatEventTitle && firstSeatEventTitle) {
      setSeatEventTitle(firstSeatEventTitle);
      return;
    }
    apiReadSeats(selectedSeatEventId)
      .then((records) => setSeatRecords(records.seats || []))
      .catch(() => setSeatRecords([]));
  }, [firstSeatEventTitle, seatEventTitle, selectedSeatEventId, view]);

  useEffect(() => {
    if (view !== 'seats') return;
    setSelectedSeatNumber('');
    setSelectedSeatRegistrationId('');
    setSeatError('');
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

  async function saveEditedRecord(kind, row, patch) {
    const idMatches = (item) => (item.id && row.id && item.id === row.id) || item.createdAt === row.createdAt || item.title === row.title || item.text === row.text;
    const storageKeyByKind = {
      event: 'kb-admin-events',
      announcement: 'kb-announcement-submissions',
      registration: 'kb-registration-submissions'
    };
    const dashboardKeyByKind = {
      event: 'events',
      announcement: 'announcements',
      registration: 'registrations'
    };
    const currentRows = kind === 'event' ? allEvents : kind === 'announcement' ? announcements : registrations;
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
    const eventId = cleanText(payload.eventId || selectedSeatEventId);
    const seatNumber = cleanText(payload.seatNumber || selectedSeatNumber);
    if (!eventId || !seatNumber) {
      setSeatError('Event id and seat number are required.');
      return;
    }
    const registrationId = payload.registrationId || selectedSeatRegistrationId || '';
    const selectedRegistration = registrations.find((row) => row.id === registrationId);

    try {
      await apiCreateSeat({
        eventId,
        seatNumber,
        registrationId: registrationId || null,
        assignedTo: payload.assignedTo || selectedRegistration?.familyMember || selectedRegistration?.studentName || selectedRegistration?.parentName || null
      });
      const records = await apiReadSeats(eventId);
      setSeatRecords(records.seats || []);
      setSelectedSeatRegistrationId('');
      refresh();
    } catch (error) {
      setSeatError(error.message || 'Could not save seat.');
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
      const result = await apiReceptionCheckin({
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
    const myReceiptCount = myExpenseRows.filter((row) => row.receiptUrl).length;
    return (
      <>
        <PageHeader area="Volunteer / Expense" title="Expense Submission" />
        <section className="workflow-hero volunteer-hero">
          <div>
            <p className="eyebrow">Volunteer expense area</p>
            <h2>Submit receipts and track reimbursement status</h2>
            <p>This page mirrors the old Volunteer expense area: volunteers submit expenses here and treasurers review them separately.</p>
          </div>
          <div className="workflow-action-list">
            <article><strong>{myExpenseRows.length}</strong><span>My expenses</span></article>
            <article><strong>{myReceiptCount}</strong><span>Receipts</span></article>
            <article><strong>{statusCount(myExpenseRows, (status) => status.includes('approved'))}</strong><span>Approved</span></article>
            <article><strong>{statusCount(myExpenseRows, (status) => status.includes('paid'))}</strong><span>{tr('Paid')}</span></article>
          </div>
        </section>
        <form className="expense-workspace-form" onSubmit={handleExpenseSubmit}>
          <div className="expense-form-heading">
            <div>
              <span>Reimbursement request</span>
              <h2>Kannada Bharati Expense Submission</h2>
              <p>Attach a receipt and include enough detail for treasurer approval. PDF, JPG, and PNG files up to 8 MB are supported.</p>
            </div>
            <div className="expense-form-status">
              <strong>{myExpenseRows.filter((row) => String(row.status || '').toLowerCase().includes('submitted')).length}</strong>
              <span>Waiting review</span>
            </div>
          </div>
          <div className="expense-entry-layout">
            <section className="expense-primary-card">
              <div className="admin-form-grid expense-form-grid">
                <label>Expense title<input name="title" required placeholder="Snacks for Kannada class" /></label>
                <label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose category</option><option>Event supplies</option><option>Food</option><option>Venue</option><option>Printing</option><option>Travel</option><option>Other</option></select></label>
                <label>Amount<input name="amount" type="number" min="1" step="0.01" required placeholder="0.00" /></label>
                <label className="advanced-date-field">
                  Expense date
                  <DatePicker
                    name="expenseDate"
                    required
                    placeholder="Choose expense date"
                    quickOptions={[
                      { label: 'Yesterday', offsetDays: -1 },
                      { label: 'Last week', offsetDays: -7 }
                    ]}
                  />
                </label>
                <label>Vendor / paid to<input name="vendor" placeholder="Costco, venue, printer..." /></label>
                <label>Payment method<select name="paymentMethod" defaultValue="Personal card"><option>Personal card</option><option>Cash</option><option>Check</option><option>PayPal</option><option>Bank transfer</option><option>Other</option></select></label>
                <label className="expense-wide-field">Reimburse to<input name="reimbursementTo" defaultValue={user.email} placeholder="Name or email" /></label>
              </div>
              <label className="expense-description">Description<textarea name="description" required minLength="10" maxLength="320" placeholder="Describe what was purchased, which class/event it supports, and any notes for treasurer review." /></label>
            </section>
            <aside className="expense-upload-card">
              <div className="expense-upload-icon"><ReceiptText size={32} /></div>
              <h3>Receipt upload</h3>
              <p>Upload the original receipt or invoice. Treasurer can open it directly from the review table.</p>
              <label className="expense-file-drop">
                <input name="receipt" type="file" accept="application/pdf,image/png,image/jpeg" />
                <strong>Choose receipt file</strong>
                <span>PDF, JPG, PNG up to 8 MB</span>
              </label>
              <div className="expense-review-hints">
                <span>Include vendor name</span>
                <span>Match amount to receipt</span>
                <span>Use clear payment notes</span>
              </div>
            </aside>
          </div>
          <div className="expense-submit-bar">
            <div>
              <strong>Ready for review?</strong>
              <span>Submitted expenses go to Treasurer / Expense Review.</span>
            </div>
            <button className="button primary" type="submit" disabled={expenseSubmitting}>{expenseSubmitting ? 'Submitting...' : 'Submit expense'}</button>
          </div>
          {expenseError && <p className="form-error">{expenseError}</p>}
          {expenseSaved && <p className="success">Expense submitted for admin review.</p>}
        </form>
        <AdminTable
          title="My expense submissions"
          rows={myExpenseRows}
          filters={[
            { key: 'category', label: 'Category', options: uniqueOptions(expenses, 'category') },
            { key: 'status', label: 'Status', options: uniqueOptions(expenses, 'status') }
          ]}
          columns={[
            { key: 'title', label: 'Expense' },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` },
            { key: 'expenseDate', label: 'Date' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'receipt', label: 'Receipt', render: (row) => <ReceiptLink row={row} /> },
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
            { key: 'edit', label: 'Edit', render: (row) => <button className="mini-action-link secondary" type="button" onClick={() => setEditRecord({ kind: 'event', row })}>Edit</button> }
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
                <EnabledToggle enabled={isEnabledValue(row.enabled)} onChange={() => toggleAnnouncement(row)} />
              )
            },
            { key: 'edit', label: 'Edit', render: (row) => <button className="mini-action-link secondary" type="button" onClick={() => setEditRecord({ kind: 'announcement', row })}>Edit</button> }
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
    const checkedInCount = checkinRows.filter((row, index) => checkedInIds.includes(getRegistrationKey(row, index)) || isCheckedInRegistration(row)).length;
    const pendingCheckinCount = Math.max(0, checkinRows.length - checkedInCount);
    const paidCheckinCount = checkinRows.filter(isPaidRegistration).length;
    const submittedCheckinCount = statusCount(checkinRows, (status) => status.includes('submitted'));
    const topCheckinPrograms = summarizeBy(checkinRows, 'program', 3);
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
            return (
              <div className="admin-row-actions compact-actions">
                {(row.status || 'Submitted') !== 'Confirmed' ? (
                  <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'confirm', { status: 'Confirmed' })}>{tr('Confirm')}</button>
                ) : (
                  <button className="mini-action-link secondary" type="button" onClick={() => runRegistrationAction(row, 'reset', { status: 'Submitted' })}>{tr('Reset')}</button>
                )}
                <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'emailstatus', { emailStatus: 'Sent' })}>{tr('Email')}</button>
                {!isPaidRegistration(row) && <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'paid', { paid: true, paymentReceived: true, status: 'Confirmed', emailStatus: 'Payment sent' })}>{tr('Paid')}</button>}
                <EnabledToggle enabled={row.enabled !== false} onLabel="Enabled" offLabel="Disabled" onChange={(enabled) => toggleRegistrationEnabled(row, enabled)} />
              </div>
            );
          }
          return checked ? (
            <span className="confirmed-badge">{row.checkedInAt ? new Date(row.checkedInAt).toLocaleString() : 'Checked'}</span>
          ) : (
            <div className="admin-row-actions compact-actions">
              <button className="checkin-action-button" type="button" onClick={() => markCheckedIn(row, index)}>CheckIn</button>
              <button className="mini-action-link success" type="button" onClick={() => runRegistrationAction(row, 'emailstatus', { emailStatus: 'Sent' })}>{tr('Email')}</button>
            </div>
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
          <div className="checkin-summary-table" aria-label="Registration summary" style={{ gridTemplateColumns: `repeat(${Math.max(1, checkinAnalytics.length)}, minmax(112px, 1fr))` }}>
            {checkinAnalytics.map((item) => <span key={`head-${item.key}`}>{item.key}</span>)}
            {checkinAnalytics.map((item) => <strong key={`total-${item.key}`}>{item.value}</strong>)}
            {checkinAnalytics.map((item) => <strong key={`checked-${item.key}`} className="checked-analytics-value">{item.checkedValue}</strong>)}
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
          columns={checkinColumns}
        />
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  if (['registrations', 'registration-classes', 'registration-payments'].includes(view)) {
    const withRegistrationCategory = (row) => {
      const meta = getProgramMeta(row, programs, allEvents);
      return {
        ...row,
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
        render: (row) => (
          <div className="admin-row-actions">
            {(row.status || 'Submitted') !== 'Confirmed' ? (
              <button className="mini-action-link success" type="button" title="Confirm this registration and send confirmation email" onClick={() => runRegistrationAction(row, 'confirm', { status: 'Confirmed' })}>{tr('Confirm')}</button>
            ) : (
              <button className="mini-action-link secondary" type="button" title="Reset registration back to submitted" onClick={() => runRegistrationAction(row, 'reset', { status: 'Submitted' })}>{tr('Reset')}</button>
            )}
            <button className="mini-action-link success" type="button" title="Send or resend registration email status" onClick={() => runRegistrationAction(row, 'emailstatus', { emailStatus: 'Sent' })}>{tr('Email')}</button>
            {!isPaidRegistration(row) && (
              <button className="mini-action-link success" type="button" title="Mark payment received and save payment reference" onClick={() => runRegistrationAction(row, 'paid', { paid: true, paymentReceived: true, status: 'Confirmed', emailStatus: 'Payment sent' })}>{tr('Paid')}</button>
            )}
            <button className="mini-action-link secondary" type="button" onClick={() => setEditRecord({ kind: 'registration', row })}>Edit</button>
          </div>
        )
      }
    ];
    const eventRegistrationColumns = [
      { key: 'slNo', label: 'Sl no.', render: (_row, index) => index + 1 },
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
        render: (row) => (
          <div className="admin-row-actions compact-actions">
            {(row.status || 'Submitted') !== 'Confirmed' ? (
              <button className="mini-action-link success" type="button" title="Confirm this registration and send confirmation email" onClick={() => runRegistrationAction(row, 'confirm', { status: 'Confirmed' })}>{tr('Confirm')}</button>
            ) : (
              <button className="mini-action-link secondary" type="button" title="Reset registration back to submitted" onClick={() => runRegistrationAction(row, 'reset', { status: 'Submitted' })}>{tr('Reset')}</button>
            )}
            <button className="mini-action-link success" type="button" title="Send or resend registration email status" onClick={() => runRegistrationAction(row, 'emailstatus', { emailStatus: 'Sent' })}>{tr('Email')}</button>
            {!isPaidRegistration(row) && (
              <button className="mini-action-link success" type="button" title="Mark payment received and save payment reference" onClick={() => runRegistrationAction(row, 'paid', { paid: true, paymentReceived: true, status: 'Confirmed', emailStatus: 'Payment sent' })}>{tr('Paid')}</button>
            )}
            <button className="mini-action-link secondary" type="button" onClick={() => setEditRecord({ kind: 'registration', row })}>Edit</button>
          </div>
        )
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
      { key: 'details', label: 'Details', render: (row) => <DetailsIconButton onClick={() => setRegistrationDetail(row)} /> }
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
    const seatCapacity = Math.max(0, Number(selectedSeatEvent.capacity || selectedSeatEvent.totalSeats || selectedSeatEvent.seats || 0));
    const eventRegistrationRows = registrations.filter((row) => (
      row.eventId === selectedSeatEventId
      || row.program === selectedSeatEvent.title
      || (!row.eventId && row.program === selectedSeatEvent.title)
    ));
    const seatRecordMap = new Map(seatRecords.map((seat) => [String(seat.seat_number || seat.seatNumber), seat]));
    const generatedSeats = Array.from({ length: seatCapacity || Math.max(24, seatRecords.length) }, (_, index) => {
      const seatNumber = String(index + 1);
      const saved = seatRecordMap.get(seatNumber);
      const registration = saved ? registrations.find((row) => row.id === saved.registration_id || row.id === saved.registrationId) : null;
      return {
        id: saved?.id || '',
        eventId: selectedSeatEventId,
        program: selectedSeatEvent.title || '-',
        seatNumber,
        assignedTo: saved?.assigned_to || saved?.assignedTo || registration?.familyMember || registration?.studentName || registration?.parentName || '-',
        email: registration?.email || '-',
        registrationId: saved?.registration_id || saved?.registrationId || '',
        status: saved?.status || 'Available'
      };
    });
    const extraSavedSeats = seatRecords
      .filter((seat) => Number(seat.seat_number || seat.seatNumber) > generatedSeats.length)
      .map((seat) => {
        const registration = registrations.find((row) => row.id === seat.registration_id || row.id === seat.registrationId);
        return {
          id: seat.id || '',
          eventId: seat.event_id || seat.eventId || selectedSeatEventId,
          program: selectedSeatEvent.title || registration?.program || '-',
          seatNumber: seat.seat_number || seat.seatNumber,
          assignedTo: seat.assigned_to || seat.assignedTo || registration?.familyMember || registration?.studentName || registration?.parentName || '-',
          email: registration?.email || '-',
          registrationId: seat.registration_id || seat.registrationId || '',
          status: seat.status || 'Available'
        };
      });
    const seatRows = [...generatedSeats, ...extraSavedSeats];
    const assignedSeats = seatRows.filter((seat) => seat.assignedTo && seat.assignedTo !== '-').length;
    const checkedInSeats = seatRows.filter((seat) => /checked/i.test(seat.status || '')).length;
    const availableSeats = Math.max(0, seatRows.length - assignedSeats);
    const occupancyRate = seatRows.length ? Math.round((assignedSeats / seatRows.length) * 100) : 0;
    const seatPrograms = summarizeBy(seatRows, 'program', 4);
    const selectedSeat = seatRows.find((seat) => seat.seatNumber === selectedSeatNumber) || seatRows.find((seat) => seat.status === 'Available') || seatRows[0] || {};
    return (
      <>
        <PageHeader root="Reception" area="Seats" title="Seat management" />
        <section className="workflow-hero seat-hero">
          <div>
            <p className="eyebrow">Seat operations</p>
            <h2>{selectedSeatEvent.title || 'Choose an event'}</h2>
            <p>Choose an event first. Seats are generated from the event capacity, then you can click a seat and assign it to a registered attendee.</p>
          </div>
          <div className="seat-occupancy-ring" aria-label={`${occupancyRate}% occupied`}>
            <span style={{ '--seat-progress': `${occupancyRate}%` }} />
            <strong>{occupancyRate}%</strong>
          </div>
        </section>
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
            <small>{selectedSeatEventId}</small>
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
              {(seatRows.length ? seatRows : Array.from({ length: 24 }, (_, index) => ({ seatNumber: index + 1, status: 'Available', assignedTo: '-' }))).slice(0, 80).map((seat, index) => {
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
                    }}
                  >
                    {seat.seatNumber || index + 1}
                  </button>
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
        <form className="seat-assignment-panel" onSubmit={handleSeatSubmit}>
          <div>
            <span>Step 2</span>
            <h2>Assign selected seat</h2>
            <p>Click a seat in the map, choose a registered attendee, then save the assignment.</p>
          </div>
          <input name="eventId" type="hidden" value={selectedSeatEventId} readOnly />
          <div className="admin-form-grid">
            <label>Seat number
              <select name="seatNumber" value={selectedSeatNumber || selectedSeat.seatNumber || ''} onChange={(event) => setSelectedSeatNumber(event.target.value)} required>
                <option value="" disabled>Select seat</option>
                {seatRows.map((seat) => <option key={seat.seatNumber} value={seat.seatNumber}>Seat {seat.seatNumber} - {seat.assignedTo && seat.assignedTo !== '-' ? seat.assignedTo : 'Available'}</option>)}
              </select>
            </label>
            <label>Assign to registered attendee
              <select name="registrationId" value={selectedSeatRegistrationId} onChange={(event) => setSelectedSeatRegistrationId(event.target.value)}>
                <option value="">Keep available</option>
                {eventRegistrationRows.map((row, index) => <option key={row.id || getRegistrationKey(row, index)} value={row.id || ''}>{row.familyMember || row.studentName || row.parentName || row.email} - {row.email}</option>)}
              </select>
            </label>
            <label>Assigned name override
              <input name="assignedTo" placeholder="Optional manual name" />
            </label>
          </div>
          <button className="button primary" type="submit">Save assignment</button>
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
    const classRows = registrations.filter((row) => row.registrationType === 'class' || programs.some((program) => program.title === row.program));
    const teacherRows = registeredUsers.filter((row) => String(row.role || '').toLowerCase() === 'teacher' || (row.roles || []).includes?.('teacher'));
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
            <article><strong>{paidClassRows}</strong><span>{tr('Paid')}</span></article>
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
          title="Teacher directory"
          rows={teacherRows}
          emptyText="No teacher accounts found."
          columns={[
            { key: 'firstName', label: 'First name' },
            { key: 'lastName', label: 'Last name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone number' },
            { key: 'registrationCount', label: 'Registrations' }
          ]}
        />
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
            { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toFixed(2)}` },
            { key: 'paid', label: 'Paid', render: (row) => isPaidRegistration(row) ? 'Yes' : 'No' },
            { key: 'paymentReference', label: 'Payment Ref', render: (row) => getPaymentDetails(row)?.reference || '-' },
            { key: 'details', label: 'Details', render: (row) => <DetailsIconButton onClick={() => setRegistrationDetail(row)} /> }
          ]}
        />
        {registrationDetail && <RegistrationDetailModal row={registrationDetail} onClose={() => setRegistrationDetail(null)} />}
      </>
    );
  }

  if (view === 'teacher-attendance') {
    return (
      <TeacherAttendanceView
        programs={programs}
        registrations={registrations}
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
    const expenseReceiptCount = expenses.filter((row) => row.receiptUrl).length;
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
            <article><strong>{expenseReceiptCount}</strong><span>Receipts</span></article>
            <article><strong>{expenseStatus.approved}</strong><span>Approved</span></article>
            <article><strong>{expenseStatus.paid}</strong><span>{tr('Paid')}</span></article>
          </div>
        </section>
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
            { key: 'approvedBy', label: 'Reviewed by' },
            { key: 'action', label: 'Action', render: (row) => (
              <div className="admin-row-actions">
                <button className="mini-action-link success" type="button" onClick={() => runExpenseAction(row, 'approve', 'Approved')}>Approve</button>
                <button className="mini-action-link success" type="button" onClick={() => runExpenseAction(row, 'paid', 'Paid')}>{tr('Paid')}</button>
                <button className="mini-action-link danger" type="button" onClick={() => runExpenseAction(row, 'reject', 'Rejected')}>Reject</button>
                <button className="mini-action-link secondary" type="button" onClick={() => runExpenseAction(row, 'reset', 'Submitted')}>{tr('Reset')}</button>
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
              { key: 'details', label: 'Details', render: (row) => <DetailsIconButton onClick={() => setRegistrationDetail(row)} /> }
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
    const totalDiagnostics = tableCounts.reduce((sum, [, count]) => sum + count, 0);
    const systemStatuses = [
      ['API mode', import.meta.env.VITE_API_URL ? 'Configured API URL' : 'Default /api proxy', Boolean(import.meta.env.VITE_API_URL)],
      ['Google login', import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'Configured' : 'Missing client id', Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)],
      ['reCAPTCHA', import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ? 'Configured' : 'Local fallback', Boolean(import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY)]
    ];
    return (
      <>
        <PageHeader area="Developer" title="Admin developer tools" />
        <section className="developer-hero-panel">
          <div>
            <p className="eyebrow">System overview</p>
            <h2>{totalDiagnostics} records tracked across core modules</h2>
            <p>Use this page to verify data volume, integration readiness, email templates, and local browser cache during admin testing.</p>
          </div>
          <div className="developer-hero-stats">
            <article><strong>{tableCounts.length}</strong><span>Data groups</span></article>
            <article><strong>{templatePreviews.length}</strong><span>Email templates</span></article>
            <article><strong>{localKeys.length}</strong><span>Local keys</span></article>
          </div>
        </section>
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
          <article><span>{tr('Email')}</span><strong>{user.email}</strong></article>
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
              <button className="mini-action-link secondary" type="button" onClick={() => setDetailRecord(row)}>{tr('Details')}</button>
            </div>
          ) },
          { key: 'register', label: 'Register', render: (row) => <a className="mini-action-link" href={`/admin/register-member?program=${encodeURIComponent(row.title)}`}>{tr('Register')}</a> }
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

