import PageHero from '../components/PageHero.jsx';
import ClassCard from '../components/ClassCard.jsx';
import { faqs, paataShaaleLevels } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function KannadaShaale() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero
        eyebrow={t('paataTitle')}
        title={t('shaaleTitle')}
        text={t('shaaleText')}
        actions={[{ label: t('registerPaata'), href: '/register?program=Kannada%20Paata%20Shaale' }]}
        className="shaale-hero"
      />
      <section className="section class-grid two-cards">
        {paataShaaleLevels.map((level) => (
          <ClassCard key={level.title} item={{ ...level, category: 'Language', location: 'Virtual Google Classroom', date: 'Sep 13, 2026 - Jun 20, 2027' }} />
        ))}
      </section>
      <section className="section two-column band">
        <div>
          <p className="eyebrow">{t('programDetails')}</p>
          <h2>Built for families balancing weekends, school, and culture.</h2>
          <p>Classes are one hour per week and supported by online homework, assessments, teacher communication, and Kannada Academy material.</p>
        </div>
        <div className="info-stack">
          <article><h3>Class format</h3><p>Virtual Google Classroom with weekly Sunday sessions.</p></article>
          <article><h3>Student support</h3><p>Homework and exams are completed online with teacher guidance.</p></article>
          <article><h3>Credit support</h3><p>Advanced levels may support high-school credit pathways where applicable.</p></article>
        </div>
      </section>
      <section className="section">
        <p className="eyebrow">FAQ</p>
        <h2>Paata Shaale questions</h2>
        <div className="faq-list">
          {faqs.map((item, index) => (
            <details key={item.q} open={index === 1}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
