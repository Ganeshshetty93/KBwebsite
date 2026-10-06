import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpenCheck, Mail, Phone, UsersRound } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import ClassCard from '../components/ClassCard.jsx';
import { paataShaaleLevels } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { apiReadSiteSetting } from '../utils/api.js';
import { defaultPaataTeachers, normalizePaataTeachers } from '../utils/paataTeachers.js';
import { readJson, writeJson } from '../utils/storage.js';

const paataShaaleFaqs = [
  {
    q: 'What is Kannada Bharati [KB]?',
    a: 'Kannada Bharati is a volunteer-led non-profit and a Washington Kannada Association (WAKA) serving Kannada families across the state. It promotes the cultural heritage and traditions of Karnataka through classes such as Janapada Nritya, Carnatic Music, Hindustani Music, Bharatanatyam, arts, and crafts during the school year.'
  },
  {
    q: 'What is Kannada Academy?',
    a: 'Kannada Academy is a non-profit organization dedicated to popularizing Kannada as a spoken language. It works to make Kannada a contemporary language whose everyday usage becomes customary and widespread.'
  },
  {
    q: 'What is Kannada Bharati Paata Shaale?',
    a: 'Kannada Bharati Paata Shaale teaches Kannada reading, writing, and speaking. Kannada Bharati has years of experience teaching Karnataka arts, dance, drama, and music, and Paata Shaale extends that mission to Kannada language learning for Washington Kannadiga families.'
  },
  {
    q: 'Why is Kannada Bharati introducing Paata Shaale?',
    a: 'Kannada Bharati wants to provide a lighter, convenient Kannada learning option for families through 60-minute weekly online classes. The goal is to help more Kannada families teach Kannada to their children.'
  },
  {
    q: 'What are the advantages of joining Paata Shaale?',
    a: 'Classes are online, meet Sundays from 10 AM to 11 AM Pacific Time, use Kannada Academy material, support Kannada learning up to 8th grade, help with high-school credit pathways, and target a 1:5 teacher-to-student ratio. Textbooks and supplies are expected to be $50.'
  },
  {
    q: 'How many grades are there in Paata Shaale?',
    a: 'Kannada Bharati Paata Shaale follows Kannada Academy material and offers classes up to 8th grade.'
  },
  {
    q: 'How does Kannada Paata Shaale work?',
    a: 'Trained teachers use Kannada Academy textbook content for the yearly curriculum. Weekly lessons, homework, and exams are conducted online from September through June.'
  },
  {
    q: 'Who teaches Kannada Paata Shaale?',
    a: 'Teachers are trained by Kannada Academy and teach Kannada in an easy and fun way using structured curriculum and standard textbooks.'
  },
  {
    q: 'How much do we need to pay per year?',
    a: 'Donations are welcome, but the intent is to keep the class cost to $50 toward textbooks and supplies. Promoting Kannada language learning is the primary aim.'
  },
  {
    q: 'Who are the contacts for Kannada Bharati Paata Shaale?',
    a: 'Kannada Bharati has dedicated leaders for Paata Shaale. Please email kannada@kannadabharati.org.'
  },
  {
    q: 'When and how can I register?',
    a: 'Please register through the Classes page. After registration, the KBPS admin team reviews prerequisites and approves eligible registrations before payment is completed.'
  },
  {
    q: 'When do Paata Shaale classes start?',
    a: 'Past batches started on October 9, 2021 for 2021-2022, September 11, 2022 for 2022-2023, and September 17, 2023 for 2023-2024. Current class dates are shown on the class cards.'
  },
  {
    q: 'My child is 10 years old. Which grade should I enroll in?',
    a: 'Please register first. The Paata Shaale team will reach out with placement information. You can also email kannada@kannadabharati.org.'
  },
  {
    q: 'Where and how do we collect textbooks?',
    a: 'Kannada Bharati coordinates textbook handover after a child is registered and approved for a batch.'
  },
  {
    q: 'Will there be exams?',
    a: 'Yes. There are two exams in a year. There are 12 Kanthe chapters or sections, with an exam after every 6 Kanthe: a midterm test and a final test.'
  },
  {
    q: 'Can classes be conducted on weekdays?',
    a: 'Weekend classes are preferred because many teachers work during weekdays.'
  },
  {
    q: 'What facilities are needed for online classes?',
    a: 'Classes are conducted through Google Online Classroom. Each child receives a unique email ID to log in to Google Classroom. Weekly classes, homework, and exams are conducted online through Google learning tools.'
  },
  {
    q: 'If my child turns 6 in September, can I register for Level 1?',
    a: 'Kannada Bharati suggests that children should be at least 6 years old because Level 1 includes writing work.'
  },
  {
    q: 'Can I register my child directly into Level 2 or Level 3?',
    a: 'To enroll in Level 2, the child must have completed Level 1. To enroll in Level 3, the child must have completed Levels 1 and 2 through Kannada Academy. Otherwise, students start from Level 1.'
  },
  {
    q: 'Does Kannada Bharati help with high-school credits?',
    a: 'Kannada Bharati assesses Kannada reading, writing, and speaking fluency and helps create small groups to prepare for Kannada tests.'
  }
];

export default function KannadaShaale() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const shouldOpenRegistration = searchParams.get('register') === '1';
  const [registerSignals, setRegisterSignals] = useState([0, 0]);
  const [teachers, setTeachers] = useState(() => normalizePaataTeachers(readJson('kb-paata-teachers', defaultPaataTeachers)));

  const paataClasses = paataShaaleLevels.map((level) => ({
    ...level,
    category: 'Language',
    location: 'Virtual Google Classroom',
    date: 'Sep 13, 2026 - Jun 20, 2027'
  }));

  function openRegistration(index = 0) {
    setRegisterSignals((current) => current.map((value, signalIndex) => (signalIndex === index ? value + 1 : value)));
    window.setTimeout(() => {
      document.getElementById('paata-registration-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  useEffect(() => {
    if (shouldOpenRegistration) {
      openRegistration(0);
    }
  }, [shouldOpenRegistration]);

  useEffect(() => {
    let ignore = false;
    apiReadSiteSetting('paata-teachers')
      .then((rows) => {
        if (ignore) return;
        const normalized = normalizePaataTeachers(rows);
        setTeachers(normalized);
        writeJson('kb-paata-teachers', normalized);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <PageHero
        eyebrow={t('paataTitle')}
        title={t('shaaleTitle')}
        text={t('shaaleText')}
        actions={[{ label: t('registerPaata'), href: '/register?program=Kannada%20Paata%20Shaale' }]}
        className="shaale-hero"
      />
      <section className="section paata-registration-callout">
        <div>
          <p className="eyebrow">Registrations open</p>
          <h2>Kannada Bharati Paata Shaale registrations are open</h2>
          <p>Choose the student from your family profile, submit the class registration, then wait for admin approval before completing payment.</p>
        </div>
        <div className="paata-registration-actions" aria-label="Paata Shaale registration actions">
          <button className="button compact" type="button" onClick={() => openRegistration(0)}>Register Level 1</button>
          <button className="button secondary-dark" type="button" onClick={() => openRegistration(1)}>Register Levels 2-6</button>
        </div>
      </section>
      <section className="section class-grid two-cards" id="paata-registration-options">
        {paataClasses.map((level, index) => (
          <ClassCard key={level.title} item={level} registerSignal={registerSignals[index] || 0} />
        ))}
      </section>
      <section className="section paata-teacher-section" aria-labelledby="paata-teacher-title">
        <div className="paata-teacher-heading">
          <p className="eyebrow">Teachers</p>
          <h2 id="paata-teacher-title">Meet the Paata Shaale teachers</h2>
          <p>Our trained volunteer teachers make Kannada approachable with structured lessons, speaking practice, homework guidance, and personal attention.</p>
          <div className="paata-teacher-stats">
            <article><UsersRound size={19} /><strong>{teachers.length}</strong><span>Teachers</span></article>
            <article><BookOpenCheck size={19} /><strong>1:5</strong><span>Target ratio</span></article>
          </div>
        </div>
        <div className="paata-teacher-carousel" aria-label="Auto-scrolling Paata Shaale teacher cards">
          <div className="paata-teacher-grid">
            {[...teachers, ...teachers].map((teacher, index) => (
              <article className="paata-teacher-card" key={`${teacher.id}-${index}`}>
                <div className="paata-teacher-photo">
                  {teacher.photo ? <img src={teacher.photo} alt={teacher.name} /> : <UsersRound size={36} />}
                </div>
                <div className="paata-teacher-copy">
                  <span>{teacher.level || 'Paata Shaale'}</span>
                  <h3>{teacher.name}</h3>
                  <strong>{teacher.role || 'Teacher'}</strong>
                  {teacher.bio && <p>{teacher.bio}</p>}
                  <div className="paata-teacher-contact">
                    {teacher.email && <a href={`mailto:${teacher.email}`}><Mail size={15} /> {teacher.email}</a>}
                    {teacher.phone && <a href={`tel:${teacher.phone}`}><Phone size={15} /> {teacher.phone}</a>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
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
        <h2>Frequently Asked Questions about Kannada Bharati Paata Shaale</h2>
        <div className="faq-list">
          {paataShaaleFaqs.map((item, index) => (
            <details key={item.q} open={index === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        <p className="paata-closing-line">ಎಲ್ಲಾದರು ಇರು ಎಂತಾದರು ಇರು ಎಂದೆಂದಿಗೂ ನೀ ಕನ್ನಡವಾಗಿರು</p>
        <p className="profile-helper">Being away from our Motherland, what keeps us rooted is our culture.</p>
      </section>
    </>
  );
}
