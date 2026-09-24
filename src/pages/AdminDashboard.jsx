import { Navigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import { culturalClasses, events, paataShaaleLevels } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getCurrentUser, isAdmin, readJson } from '../utils/storage.js';
import { apiAdminDashboard } from '../utils/api.js';

const fallbackPrograms = [
  ...paataShaaleLevels.map((item) => ({ ...item, category: 'Language', date: 'Sep 13, 2026 - Jun 20, 2027' })),
  ...culturalClasses
];

function uniqueOptions(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort();
}

function DataTable({ title, rows, columns, emptyText, action, filters = [] }) {
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
    <section className="admin-panel">
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
    classes: [],
    events: [],
    fundraisers: readJson('kb-admin-fundraisers', [])
  }));
  const [dataSource, setDataSource] = useState('local demo');

  useEffect(() => {
    if (!isAdmin(user)) return undefined;
    let ignore = false;
    apiAdminDashboard()
      .then((records) => {
        if (!ignore) {
          setDashboard({
            ...records,
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

  return (
    <>
      <PageHero
        eyebrow={t('adminOnly')}
        title={t('dashboardTitle')}
        text={t('dashboardText')}
        className="admin-hero"
      />
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
          title="Contact messages"
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
