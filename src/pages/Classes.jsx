import { useEffect, useMemo, useState } from 'react';
import PageHero from '../components/PageHero.jsx';
import ClassCard from '../components/ClassCard.jsx';
import { culturalClasses, paataShaaleLevels } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
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
  const [dbClasses, setDbClasses] = useState([]);
  const { t } = useLanguage();

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
  }, []);

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
        </div>
        <div className="class-grid">
          {visible.map((item) => <ClassCard key={item.title} item={item} />)}
        </div>
      </section>
    </>
  );
}
