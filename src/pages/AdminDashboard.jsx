import { Navigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  HandCoins,
  Megaphone,
  Plus,
  ReceiptText,
  ShieldCheck,
  UserCog,
  Users,
  X
} from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import { culturalClasses, events, paataShaaleLevels } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { appendRecord, getCurrentUser, isAdmin, readJson } from '../utils/storage.js';
import { apiAdminDashboard } from '../utils/api.js';
import { cleanText, firstError, validateAmount, validateRequired } from '../utils/validation.js';

const fallbackPrograms = [
  ...paataShaaleLevels.map((item) => ({ ...item, category: 'Language', date: 'Sep 13, 2026 - Jun 20, 2027' })),
  ...culturalClasses
];

const accessGroups = [
  {
    title: 'Account',
    icon: UserCog,
    items: ['Profile', 'Password', 'External logins']
  },
  {
    title: 'Member',
    icon: Users,
    items: ['Dashboard', 'Registrations', 'Student view']
  },
  {
    title: 'Reception',
    icon: ClipboardCheck,
    items: ['CheckInNew']
  },
  {
    title: 'Volunteer',
    icon: HandCoins,
    items: ['Expense', 'Volunteer requests']
  },
  {
    title: 'Admin',
    icon: ShieldCheck,
    items: ['User', 'Event', 'Announcement', 'Registration', 'Student View']
  }
];

function uniqueOptions(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort();
}

function DataTable({ id, title, rows, columns, emptyText, action, filters = [] }) {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !normalizedQuery || Object.values(row)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesFilters = filters.every((filter) => {
        const selected = activeFilters[filter.key] || 'All';
        return selected === 'All' || String(row[filter.key] || '') === selected;
      });

      return matchesSearch && matchesFilters;
    });
  }, [activeFilters, filters, query, rows]);

  return (
    <section className="admin-panel" id={id}>
      <div className="admin-panel-heading">
        <h2>{title}</h2>
        <div className="admin-panel-actions">
          {action}
          <span>{visibleRows.length}</span>
        </div>
      </div>
      <div className="admin-table-filters">
        <label>
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} />
        </label>
        {filters.map((filter) => (
          <label key={filter.key}>
            {filter.label}
            <select
              value={activeFilters[filter.key] || 'All'}
              onChange={(event) => setActiveFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
            >
              <option>All</option>
              {filter.options.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="fine-print">{emptyText}</p>
      ) : visibleRows.length === 0 ? (
        <p className="fine-print">No records match the selected filters.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={`${row.email || row.title || row.createdAt || index}-${index}`}>
                  {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] || '-'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminDashboard() {
  const user = getCurrentUser();
  const { t } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalType, setModalType] = useState(null);
  const [dashboard, setDashboard] = useState(() => ({
    registrations: readJson('kb-registration-submissions', []),
    logins: readJson('kb-login-submissions', []),
    donations: readJson('kb-donation-submissions', []),
    volunteers: readJson('kb-volunteer-submissions', []),
    contacts: readJson('kb-contact-submissions', []),
    expenses: readJson('kb-expense-submissions', []),
    classes: [],
    events: [],
    fundraisers: readJson('kb-admin-fundraisers', [])
  }));
  const [dataSource, setDataSource] = useState('local demo');
  const [expenseError, setExpenseError] = useState('');
  const [expenseSaved, setExpenseSaved] = useState(false);

  useEffect(() => {
    if (!isAdmin(user)) return undefined;
    let ignore = false;
    apiAdminDashboard()
      .then((records) => {
        if (!ignore) {
          setDashboard({
            ...records,
            expenses: readJson('kb-expense-submissions', []),
            fundraisers: records.fundraisers?.length ? records.fundraisers : readJson('kb-admin-fundraisers', [])
          });
          setDataSource('Supabase');
        }
      })
      .catch(() => {
        if (!ignore) {
          setDashboard({
            registrations: readJson('kb-registration-submissions', []),
            logins: readJson('kb-login-submissions', []),
            donations: readJson('kb-donation-submissions', []),
            volunteers: readJson('kb-volunteer-submissions', []),
            contacts: readJson('kb-contact-submissions', []),
            expenses: readJson('kb-expense-submissions', []),
            classes: [],
            events: [],
            fundraisers: readJson('kb-admin-fundraisers', [])
          });
          setDataSource('local demo');
        }
      });
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  if (!isAdmin(user)) {
    return <Navigate to="/login" replace />;
  }

  const { registrations, logins, donations, volunteers, contacts } = dashboard;
  const expenses = dashboard.expenses || [];
  const programs = dashboard.classes.length ? dashboard.classes : fallbackPrograms;
  const allEvents = dashboard.events.length ? dashboard.events : events;
  const fundraisers = dashboard.fundraisers || [];

  const totalDonated = donations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const registrationProgramOptions = uniqueOptions(registrations, 'program');
  const donationCauseOptions = uniqueOptions(donations, 'cause');
  const donationPaymentOptions = uniqueOptions(donations, 'paymentStatus');
  const fundraiserCategoryOptions = uniqueOptions(fundraisers, 'category');
  const fundraiserStatusOptions = uniqueOptions(fundraisers, 'status');
  const classCategoryOptions = uniqueOptions(programs, 'category');
  const eventMonthOptions = uniqueOptions(allEvents, 'month');
  const volunteerInterestOptions = uniqueOptions(volunteers, 'interest');
  const contactTopicOptions = uniqueOptions(contacts, 'topic');
  const loginRoleOptions = uniqueOptions(logins, 'role');
  const expenseCategoryOptions = uniqueOptions(expenses, 'category');
  const expenseStatusOptions = uniqueOptions(expenses, 'status');
  const accessChecks = [
    { label: 'Users', value: registrations.length, icon: Users, target: 'registrations-panel' },
    { label: 'Events', value: allEvents.length, icon: CalendarDays, target: 'events-panel' },
    { label: 'Announcements', value: contacts.length, icon: Megaphone, target: 'contacts-panel' },
    { label: 'Student View', value: programs.length, icon: GraduationCap, target: 'classes-panel' },
    { label: 'Volunteer Expense', value: expenses.length, icon: HandCoins, target: 'expenses-panel' }
  ];

  function handleExpenseSubmit(event) {
    event.preventDefault();
    setExpenseError('');
    setExpenseSaved(false);
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const validationError = firstError([
      validateRequired(payload.title, 'Expense title'),
      validateRequired(payload.category, 'Category'),
      validateAmount(payload.amount, 'Amount', { min: 1 }),
      validateRequired(payload.expenseDate, 'Expense date'),
      validateRequired(payload.description, 'Description')
    ]);

    if (validationError) {
      setExpenseError(validationError);
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
    setDashboard((current) => ({
      ...current,
      expenses: [...(current.expenses || []), record]
    }));
    form.reset();
    setExpenseSaved(true);
  }

  return (
    <>
      <PageHero
        eyebrow={t('adminOnly')}
        title={t('dashboardTitle')}
        text={t('dashboardText')}
        className="admin-hero"
      />
      <section className="section manage-console">
        <aside className="manage-sidebar" aria-label="Management sections">
          {accessGroups.map((group) => {
            const Icon = group.icon;
            return (
              <article key={group.title}>
                <h3><Icon size={18} /> {group.title}</h3>
                <ul>
                  {group.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            );
          })}
        </aside>
        <div className="manage-content">
          <div className="manage-profile-card">
            <p className="eyebrow">Access check</p>
            <h2>Manage account and admin functionality</h2>
            <div className="profile-info-grid">
              <span>User name</span>
              <strong>{user.email}</strong>
              <span>Role</span>
              <strong>{user.role || 'admin'}</strong>
              <span>Access</span>
              <strong>Admin dashboard enabled</strong>
            </div>
          </div>
          <div className="access-check-grid">
            {accessChecks.map((item) => {
              const Icon = item.icon;
              return (
                <a className="access-check-card" href={`#${item.target}`} key={item.label}>
                  <Icon size={22} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>Accessible</small>
                </a>
              );
            })}
          </div>
        </div>
      </section>
      <section className="section member-dashboard-showcase">
        <div className="dashboard-current-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="eyebrow">Current programs</p>
              <h2>Member dashboard</h2>
            </div>
            <span>{programs.length + allEvents.length} active items</span>
          </div>
          <div className="current-program-grid">
            {programs.slice(0, 3).map((program) => (
              <article className="current-program-card" key={`program-${program.title}`}>
                <strong>{program.title}</strong>
                <p>{program.focus || program.location || 'Kannada Bharati class registration is open.'}</p>
                <ul>
                  <li>{program.date || 'Date to be announced'}</li>
                  <li>{program.time || 'Time to be announced'}</li>
                  <li>{program.fee || 'Donation/fee varies'}</li>
                </ul>
                <a href={`/register?program=${encodeURIComponent(program.title)}`}>Register</a>
              </article>
            ))}
            {allEvents.slice(0, 2).map((event) => (
              <article className="current-program-card event" key={`event-${event.title}`}>
                <strong>{event.title}</strong>
                <p>{event.body || 'Kannada Bharati community event.'}</p>
                <ul>
                  <li>{event.month}</li>
                  <li>{event.location || 'Location to be announced'}</li>
                </ul>
                <a href="/events">View event</a>
              </article>
            ))}
          </div>
          <div className="history-card-grid">
            <article>
              <h3>Your Event Registrations History</h3>
              <p>{registrations.some((item) => /event/i.test(item.program || '')) ? 'Event registrations available in records.' : 'Not registered yet!'}</p>
            </article>
            <article>
              <h3>Your Class Registrations History</h3>
              <p>{registrations.length ? `${registrations.length} registration record${registrations.length === 1 ? '' : 's'} found.` : 'Not registered yet!'}</p>
            </article>
          </div>
        </div>
        <form className="expense-panel" onSubmit={handleExpenseSubmit}>
          <div className="dashboard-panel-heading">
            <div>
              <p className="eyebrow">Volunteer</p>
              <h2><ReceiptText size={24} /> Expense submission</h2>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              Expense title
              <input name="title" required placeholder="Snacks for event volunteers" />
            </label>
            <label>
              Category
              <select name="category" required defaultValue="">
                <option value="" disabled>Choose category</option>
                <option>Event supplies</option>
                <option>Food</option>
                <option>Venue</option>
                <option>Printing</option>
                <option>Travel</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Amount
              <input name="amount" type="number" min="1" step="0.01" required placeholder="75.00" />
            </label>
            <label>
              Expense date
              <input name="expenseDate" type="date" required />
            </label>
          </div>
          <label>
            Description
            <textarea name="description" required minLength="10" maxLength="320" placeholder="What was purchased and which event/program was it for?" />
          </label>
          <button className="button primary" type="submit">Submit Expense</button>
          {expenseError && <p className="form-error">{expenseError}</p>}
          {expenseSaved && <p className="success">Expense submitted for admin review.</p>}
        </form>
      </section>
      <section className="section dashboard-grid">
        <article className="metric-card">
          <span>Data source</span>
          <strong>{dataSource}</strong>
        </article>
        <article className="metric-card">
          <span>{t('registrationDashboard')}</span>
          <strong>{registrations.length}</strong>
        </article>
        <article className="metric-card">
          <span>{t('donationDashboard')}</span>
          <strong>${totalDonated}</strong>
        </article>
        <article className="metric-card">
          <span>{t('classDashboard')}</span>
          <strong>{programs.length}</strong>
        </article>
        <article className="metric-card">
          <span>{t('eventDashboard')}</span>
          <strong>{allEvents.length}</strong>
        </article>
        <article className="metric-card">
          <span>Fund raising</span>
          <strong>{fundraisers.length}</strong>
        </article>
      </section>
      <section className="section admin-stack">
        <DataTable
          title={t('registrationDashboard')}
          id="registrations-panel"
          rows={registrations}
          emptyText={t('noRecords')}
          filters={[
            { key: 'program', label: 'Program', options: registrationProgramOptions }
          ]}
          columns={[
            { key: 'parentName', label: 'Name' },
            { key: 'studentName', label: 'Student' },
            { key: 'email', label: 'Email' },
            { key: 'program', label: 'Program' },
            { key: 'createdAt', label: 'Date', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }
          ]}
        />
        <DataTable
          title={t('donationDashboard')}
          id="donations-panel"
          rows={donations}
          emptyText={t('noRecords')}
          filters={[
            { key: 'cause', label: 'Cause', options: donationCauseOptions },
            { key: 'paymentStatus', label: 'Payment', options: donationPaymentOptions }
          ]}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'cause', label: 'Cause' },
            { key: 'paymentStatus', label: 'Payment' },
            { key: 'amount', label: 'Amount', render: (row) => `$${row.amount || 0}` },
            { key: 'createdAt', label: 'Date', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }
          ]}
        />
        <DataTable
          title="Fund raising"
          id="fundraising-panel"
          rows={fundraisers}
          emptyText="No fundraising causes yet."
          filters={[
            { key: 'category', label: 'Type', options: fundraiserCategoryOptions },
            { key: 'status', label: 'Status', options: fundraiserStatusOptions }
          ]}
          action={
            <button className="admin-plus-button" type="button" aria-label="Add fundraising cause" onClick={() => setModalType('fundraiser')}>
              <Plus size={18} />
            </button>
          }
          columns={[
            { key: 'title', label: 'Cause' },
            { key: 'category', label: 'Type' },
            { key: 'beneficiary', label: 'Beneficiary' },
            { key: 'goal', label: 'Goal', render: (row) => `$${Number(row.goal || 0).toLocaleString()}` },
            { key: 'raised', label: 'Raised', render: (row) => `$${Number(row.raised || 0).toLocaleString()}` },
            { key: 'deadline', label: 'Deadline', render: (row) => row.deadline ? new Date(`${row.deadline}T00:00:00`).toLocaleDateString() : '-' },
            { key: 'status', label: 'Status' },
            { key: 'photo', label: 'Photo', render: (row) => row.photo ? <img className="table-thumb" src={row.photo} alt={row.title} /> : '-' }
          ]}
        />
        <DataTable
          title={t('classDashboard')}
          id="classes-panel"
          rows={programs}
          emptyText={t('noRecords')}
          filters={[
            { key: 'category', label: 'Type', options: classCategoryOptions }
          ]}
          action={
            <button className="admin-plus-button" type="button" aria-label="Add class" onClick={() => setModalType('class')}>
              <Plus size={18} />
            </button>
          }
          columns={[
            { key: 'title', label: 'Class' },
            { key: 'category', label: 'Type' },
            { key: 'time', label: 'Time' },
            { key: 'fee', label: 'Fee' },
            { key: 'photo', label: 'Photo', render: (row) => row.photo ? <img className="table-thumb" src={row.photo} alt={row.title} /> : '-' }
          ]}
        />
        <DataTable
          title={t('eventDashboard')}
          id="events-panel"
          rows={allEvents}
          emptyText={t('noRecords')}
          filters={[
            { key: 'month', label: 'When', options: eventMonthOptions }
          ]}
          action={
            <button className="admin-plus-button" type="button" aria-label="Add event" onClick={() => setModalType('event')}>
              <Plus size={18} />
            </button>
          }
          columns={[
            { key: 'month', label: 'When' },
            { key: 'title', label: 'Event' },
            { key: 'body', label: 'Details' },
            { key: 'photo', label: 'Photo', render: (row) => row.photo ? <img className="table-thumb" src={row.photo} alt={row.title} /> : '-' }
          ]}
        />
        <DataTable
          title="Volunteers"
          id="volunteers-panel"
          rows={volunteers}
          emptyText={t('noRecords')}
          filters={[
            { key: 'interest', label: 'Interest', options: volunteerInterestOptions }
          ]}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'interest', label: 'Interest' },
            { key: 'message', label: 'Message' }
          ]}
        />
        <DataTable
          title="Expense submissions"
          id="expenses-panel"
          rows={expenses}
          emptyText="No expense submissions yet."
          filters={[
            { key: 'category', label: 'Category', options: expenseCategoryOptions },
            { key: 'status', label: 'Status', options: expenseStatusOptions }
          ]}
          columns={[
            { key: 'title', label: 'Expense' },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` },
            { key: 'expenseDate', label: 'Date', render: (row) => row.expenseDate ? new Date(`${row.expenseDate}T00:00:00`).toLocaleDateString() : '-' },
            { key: 'submittedBy', label: 'Submitted by' },
            { key: 'status', label: 'Status' },
            { key: 'description', label: 'Description' }
          ]}
        />
        <DataTable
          title="Contact messages"
          id="contacts-panel"
          rows={contacts}
          emptyText={t('noRecords')}
          filters={[
            { key: 'topic', label: 'Topic', options: contactTopicOptions }
          ]}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'topic', label: 'Topic' },
            { key: 'message', label: 'Message' }
          ]}
        />
        <DataTable
          title="Login activity"
          id="logins-panel"
          rows={logins}
          emptyText={t('noRecords')}
          filters={[
            { key: 'role', label: 'Role', options: loginRoleOptions }
          ]}
          columns={[
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'createdAt', label: 'Date', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }
          ]}
        />
      </section>
      {modalType && (
        <div className="popup-backdrop" role="presentation">
          <div
            className="popup-panel"
            role="dialog"
            aria-modal="true"
            aria-label={modalType === 'fundraiser' ? 'Add fundraising cause' : modalType === 'class' ? 'Add class' : 'Add event'}
          >
            <button className="popup-close" type="button" aria-label="Close popup" onClick={() => setModalType(null)}>
              <X size={20} />
            </button>
            <AdminCreateForm
              type={modalType}
              onCreated={() => {
                setRefreshKey((key) => key + 1);
                setModalType(null);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
