import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BookOpen, HandHeart, Music2, UsersRound } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import { events, heroStats } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { readJson } from '../utils/storage.js';
import { apiReadRecords } from '../utils/api.js';

const cultureImages = [
  {
    title: 'Mysuru Palace',
    text: 'Royal heritage and Dasara lights',
    image: '/assets/culture-clean/mysuru-palace-clean.png'
  },
  {
    title: 'Hampi',
    text: 'Stone temples and Vijayanagara history',
    image: '/assets/culture-clean/hampi-clean.png'
  },
  {
    title: 'Yakshagana',
    text: 'Color, theatre, rhythm and stories',
    image: '/assets/culture-clean/yakshagana-clean.png'
  },
  {
    title: 'Classical Dance',
    text: 'Movement, devotion and expression',
    image: '/assets/culture-clean/dance-clean.png'
  },
  {
    title: 'Music Traditions',
    text: 'Carnatic and Hindustani learning',
    image: '/assets/culture-clean/music-clean.png'
  },
  {
    title: 'Cuisine',
    text: 'Festival meals and family flavors',
    image: '/assets/culture-clean/food-clean.png'
  }
];

export default function Home() {
  const { t } = useLanguage();
  const translatedStats = [
    [t('volunteerLed'), t('communityPowered')],
    ['2026-27', t('classesOpen')],
    [t('seattleArea'), t('kannadigaFamilies')]
  ];
  const [adminEvents, setAdminEvents] = useState(() => readJson('kb-admin-events', []));

  useEffect(() => {
    let ignore = false;
    apiReadRecords('kb-admin-events')
      .then((records) => {
        if (!ignore) setAdminEvents(records);
      })
      .catch(() => {
        if (!ignore) setAdminEvents(readJson('kb-admin-events', []));
      });
    return () => {
      ignore = true;
    };
  }, []);

  const allEvents = [...events, ...adminEvents];
  const featureCards = [
    {
      icon: BookOpen,
      title: t('paataTitle'),
      text: t('paataCardText'),
      link: '/kannada-shaale',
      label: t('viewProgram'),
      image: '/assets/classes/kannada-language.png'
    },
    {
      icon: Music2,
      title: t('culturalClasses'),
      text: t('culturalText'),
      link: '/classes',
      label: t('viewClasses'),
      image: '/assets/classes/bharatanatya-dance.png'
    },
    {
      icon: UsersRound,
      title: t('eventsTitle'),
      text: t('eventsText'),
      link: '/events',
      label: t('viewEvents'),
      image: '/assets/hero/events-hero.png'
    },
    {
      icon: HandHeart,
      title: t('serviceTitle'),
      text: t('serviceText'),
      link: '/volunteer',
      label: t('joinIn'),
      image: '/assets/hero/volunteer-hero.png'
    }
  ];
  const eventImages = [
    '/assets/classes/kannada-language.png',
    '/assets/culture/yakshagana.png',
    '/assets/classes/carnatic-music.png'
  ];

  return (
    <>
      <PageHero
        eyebrow={t('homeEyebrow')}
        title={t('homeTitle')}
        text={t('homeText')}
        image
        actions={[
          { label: t('exploreClasses'), href: '/classes' },
          { label: t('memberLogin'), href: '/login', variant: 'secondary' }
        ]}
      />

      <section className="stat-strip">
        {translatedStats.map(([number, label]) => (
          <div key={label}>
            <strong>{number}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="culture-scroll-section" aria-label="Karnataka culture images">
        <div className="culture-scroll-heading">
          <p className="eyebrow">Karnataka Culture</p>
        </div>
        <div className="culture-scroll" aria-label="Scrollable Karnataka culture images">
          {cultureImages.map((item) => (
            <article className="culture-card" key={item.title}>
              <img src={item.image} alt={item.title} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section feature-grid">
        {featureCards.map(({ icon: Icon, title, text, link, label, image }) => (
          <article key={title}>
            <div className="feature-card-media">
              <img src={image} alt="" />
            </div>
            <div className="feature-card-copy">
              <Icon />
              <h2>{title}</h2>
              <p>{text}</p>
              <Link to={link}>{label}</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="section two-column home-calendar-section">
        <div>
          <p className="eyebrow">{t('upcoming')}</p>
          <h2>{t('calendarTitle')}</h2>
          <p>{t('calendarText')}</p>
        </div>
        <div className="timeline">
          {allEvents.map((event, index) => (
            <article key={event.title}>
              <img
                className="event-photo"
                src={event.photo || eventImages[index % eventImages.length]}
                alt=""
              />
              <div className="timeline-copy">
                <time>{event.month}</time>
                <h3>{event.title}</h3>
                <p>{event.body}</p>
                {event.location && <p className="event-location">{event.location}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
