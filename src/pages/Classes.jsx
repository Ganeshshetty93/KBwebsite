import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import ClassCard from '../components/ClassCard.jsx';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import { culturalClasses, paataShaaleLevels } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getCurrentUser, isAdmin } from '../utils/storage.js';
import { apiReadRecords } from '../utils/api.js';

const filters = ['All', 'Language', 'Music', 'Dance', 'Arts'];
const fallbackClasses = [
  ...paataShaaleLevels.map((item) => ({
    ...item,
    category: 'Language',
    status: 'Online',
    date: 'Sep 13, 2026 - Jun 20, 2027',
    location: 'Virtual Google Classroom'
  })),
  ...culturalClasses
];

export default function Classes() {
  const [filter, setFilter] = useState('All');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddClass, setShowAddClass] = useState(false);
  const [dbClasses, setDbClasses] = useState([]);
  const { t } = useLanguage();
  const user = getCurrentUser();

  useEffect(() => {
    let ignore = false;
    apiReadRecords('kb-admin-classes')
      .then((records) => {
        if (!ignore) setDbClasses(records);
      })
      .catch(() => {
        if (!ignore) setDbClasses([]);
      });
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const allClasses = useMemo(() => (dbClasses.length ? dbClasses : fallbackClasses), [dbClasses]);

  const visible = filter === 'All' ? allClasses : allClasses.filter((item) => item.category === filter);

  return (
    <>
      <PageHero
        eyebrow={t('classesEyebrow')}
        title={t('classesTitle')}
        text={t('classesText')}
        actions={[{ label: t('registerNow'), href: '/register' }]}
        className="classes-hero"
      />
      <section className="section">
        <div className="section-toolbar">
          <div className="filter-row">
            {filters.map((item) => (
              <button
                key={item}
                className={filter === item ? 'filter is-active' : 'filter'}
                type="button"
                onClick={() => setFilter(item)}
              >
                {item === 'All' ? t('all') : item === 'Language' ? t('language') : item === 'Music' ? t('music') : item === 'Dance' ? t('dance') : t('arts')}
              </button>
            ))}
          </div>
          {isAdmin(user) && (
            <button className="button primary add-section-button" type="button" onClick={() => setShowAddClass(true)}>
              <Plus size={18} /> + Add Class
            </button>
          )}
        </div>
        <div className="class-grid">
          {visible.map((item) => <ClassCard key={item.title} item={item} />)}
        </div>
      </section>
      {showAddClass && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup-panel" role="dialog" aria-modal="true" aria-label="Add class">
            <button className="popup-close" type="button" aria-label="Close add class popup" onClick={() => setShowAddClass(false)}>
              <X size={20} />
            </button>
            <AdminCreateForm
              type="class"
              onCreated={() => {
                setRefreshKey((key) => key + 1);
                setShowAddClass(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
