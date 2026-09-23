import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import { culturalClasses, events, paataShaaleLevels } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getCurrentUser, isAdmin, readJson } from '../utils/storage.js';
import { apiAdminDashboard } from '../utils/api.js';

function DataTable({ title, rows, columns, emptyText, action }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <h2>{title}</h2>
        <div className="admin-panel-actions">
          {action}
          <span>{rows.length}</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="fine-print">{emptyText}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
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
    classes: readJson('kb-admin-classes', []),
    events: readJson('kb-admin-events', [])
  }));
  const [dataSource, setDataSource] = useState('local demo');

  useEffect(() => {
    if (!isAdmin(user)) return undefined;
    let ignore = false;
    apiAdminDashboard()
      .then((records) => {
        if (!ignore) {
          setDashboard(records);
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
            classes: readJson('kb-admin-classes', []),
            events: readJson('kb-admin-events', [])
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
  const programs = [
    ...paataShaaleLevels.map((item) => ({ ...item, category: 'Language', date: 'Sep 13, 2026 - Jun 20, 2027' })),
    ...culturalClasses,
    ...dashboard.classes
  ];
  const allEvents = [...events, ...dashboard.events];

  const totalDonated = donations.reduce((sum, item) => sum + Number(item.amount || 0), 0);

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
      </section>
      <section className="section admin-stack">
        <DataTable
          title={t('registrationDashboard')}
          rows={registrations}
          emptyText={t('noRecords')}
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
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'amount', label: 'Amount', render: (row) => `$${row.amount || 0}` },
            { key: 'createdAt', label: 'Date', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }
          ]}
        />
        <DataTable
          title={t('classDashboard')}
          rows={programs}
          emptyText={t('noRecords')}
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
          columns={[
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'createdAt', label: 'Date', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }
          ]}
        />
      </section>
      {modalType && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup-panel" role="dialog" aria-modal="true" aria-label={modalType === 'class' ? 'Add class' : 'Add event'}>
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
