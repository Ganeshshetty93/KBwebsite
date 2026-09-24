import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BookOpen, HandHeart, Music2, UsersRound } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import { events, heroStats } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { apiReadRecords } from '../utils/api.js';

const cultureImages = [
  {
    title: 'Mysuru Palace',
    text: 'Royal heritage and Dasara lights',
    image: '/assets/culture-feature/mysuru-palace-feature.png'
  },
  {
    title: 'Hampi',
    text: 'Stone temples and Vijayanagara history',
    image: '/assets/culture-feature/hampi-feature.png'
  },
  {
    title: 'Yakshagana',
    text: 'Color, theatre, rhythm and stories',
    image: '/assets/culture-feature/yakshagana-feature.png'
  },
  {
    title: 'Classical Dance',
    text: 'Movement, devotion and expression',
    image: '/assets/culture-feature/classical-dance-feature.png'
  },
  {
    title: 'Music Traditions',
    text: 'Carnatic and Hindustani learning',
    image: '/assets/culture-feature/music-traditions-feature.png'
  },
  {
    title: 'Cuisine',
    text: 'Festival meals and family flavors',
    image: '/assets/culture-feature/cuisine-feature.png'
  }
];

const jnanapeetaWinners = [
  {
    name: 'Kuvempu',
    year: '1967',
    image: '/assets/jnanapeeta/kuvempu.jpg'
  },
  {
    name: 'D. R. Bendre',
    year: '1973',
    image: '/assets/jnanapeeta/dr-bendre.jpg'
  },
  {
    name: 'K. Shivaram Karanth',
    year: '1977',
    image: '/assets/jnanapeeta/shivaram-karanth.jpg'
  },
  {
    name: 'Masti Venkatesha Iyengar',
    year: '1983',
    image: '/assets/jnanapeeta/masti-venkatesha-iyengar.png'
  },
  {
    name: 'V. K. Gokak',
    year: '1990',
    image: '/assets/jnanapeeta/vk-gokak.png'
  },
  {
    name: 'U. R. Ananthamurthy',
    year: '1994',
    image: '/assets/jnanapeeta/ur-ananthamurthy.jpg'
  },
  {
    name: 'Girish Karnad',
    year: '1998',
    image: '/assets/jnanapeeta/girish-karnad.jpg'
  },
  {
    name: 'Chandrashekhara Kambara',
    year: '2010',
    image: '/assets/jnanapeeta/chandrashekhara-kambara.jpg'
  }
];

const defaultEventDates = {
  'Class year begins': 'Sep 13, 2026',
  'Kannada Rajyotsava': 'Nov 1, 2026',
  'Student showcase': 'Apr 18, 2027'
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function eventDateFor(event) {
  const mapped = defaultEventDates[event.title];
  const rawDate = mapped || event.month || '';
  const parsed = new Date(rawDate);

  if (!Number.isNaN(parsed.getTime())) return parsed;

  const season = rawDate.match(/^(Fall|Spring)\s+(\d{4})$/i);
  if (season?.[1].toLowerCase() === 'fall') return new Date(Number(season[2]), 10, 1);
  if (season?.[1].toLowerCase() === 'spring') return new Date(Number(season[2]), 3, 18);

  return new Date(2026, 8, 13);
}

function calendarMonthFor(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: firstDay }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(day);
  }

  return {
    label: `${monthNames[month]} ${year}`,
    month,
    year,
    days
  };
}

export default function Home() {
  const { t } = useLanguage();
  const translatedStats = [
    [t('volunteerLed'), t('communityPowered')],
    ['2026-27', t('classesOpen')],
    [t('seattleArea'), t('kannadigaFamilies')]
  ];
  const [dbEvents, setDbEvents] = useState([]);

  useEffect(() => {
    let ignore = false;
    apiReadRecords('kb-admin-events')
      .then((records) => {
        if (!ignore) setDbEvents(records);
      })
      .catch(() => {
        if (!ignore) setDbEvents([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const allEvents = dbEvents.length ? dbEvents : events;
  const calendarEvents = allEvents.map((event) => {
    const date = eventDateFor(event);
    return {
      ...event,
      date,
      day: date.getDate(),
      calendarLabel: `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    };
  });
  const calendarMonths = calendarEvents
    .reduce((months, event) => {
      const key = `${event.date.getFullYear()}-${event.date.getMonth()}`;
      const existing = months.find((month) => month.key === key);

      if (existing) {
        existing.events.push(event);
        return months;
      }

      months.push({
        key,
        sortDate: new Date(event.date.getFullYear(), event.date.getMonth(), 1),
        ...calendarMonthFor(event.date),
        events: [event]
      });
      return months;
    }, [])
    .sort((a, b) => a.sortDate - b.sortDate);
  const featureCards = [
    {
      icon: BookOpen,
      title: t('paataTitle'),
      text: t('paataCardText'),
      link: '/kannada-shaale',
      label: t('viewProgram'),
      image: '/assets/classes/kannada-language-class.png'
    },
    {
      icon: Music2,
      title: t('culturalClasses'),
      text: t('culturalText'),
      link: '/classes',
      label: t('viewClasses'),
      image: '/assets/culture-feature/classical-dance-feature.png'
    },
    {
      icon: UsersRound,
      title: t('eventsTitle'),
      text: t('eventsText'),
      link: '/events',
      label: t('viewEvents'),
      image: '/assets/feature/events-feature.png'
    },
    {
      icon: HandHeart,
      title: t('serviceTitle'),
      text: t('serviceText'),
      link: '/volunteer',
      label: t('joinIn'),
      image: '/assets/feature/service-feature.png'
    }
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

      <section className="kannada-quote-section" aria-label="Kannada cultural quote">
        <p>ಎಲ್ಲಾದರು ಇರು ಎಂತಾದರು ಇರು ಎಂದೆಂದಿಗೂ ನೀ ಕನ್ನಡವಾಗಿರು</p>
      </section>

      <section className="culture-scroll-section" aria-label="Karnataka culture images">
        <div className="culture-scroll-heading">
          <p className="eyebrow">Karnataka Culture</p>
        </div>
        <div className="culture-scroll" aria-label="Scrollable Karnataka culture images">
          <div className="culture-scroll-track">
            {[...cultureImages, ...cultureImages].map((item, index) => (
              <article
                className="culture-card"
                key={`${item.title}-${index}`}
                aria-hidden={index >= cultureImages.length}
              >
                <img src={item.image} alt={index < cultureImages.length ? item.title : ''} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="laureate-scroll-section" aria-label="Kannada Jnanapeeta award winners">
        <div className="laureate-scroll-heading">
          <p className="eyebrow">Jnanapeeta Prashasti</p>
          <h2>Kannada literary laureates</h2>
        </div>
        <div className="laureate-scroll" aria-label="Auto-scrolling Kannada Jnanapeeta winners">
          <div className="laureate-scroll-track">
            {[...jnanapeetaWinners, ...jnanapeetaWinners].map((winner, index) => (
              <article
                className="laureate-card"
                key={`${winner.name}-${index}`}
                aria-hidden={index >= jnanapeetaWinners.length}
              >
                <img src={winner.image} alt={index < jnanapeetaWinners.length ? winner.name : ''} />
                <div>
                  <span>{winner.year}</span>
                  <h3>{winner.name}</h3>
                  <p>Jnanapeeta Award winner</p>
                </div>
              </article>
            ))}
          </div>
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
        <div className="calendar-board" aria-label="Community event calendar">
          {calendarMonths.map((month) => (
            <article className="calendar-card" key={month.key}>
              <div className="calendar-card-heading">
                <span>{month.label}</span>
                <strong>{month.events.length} event{month.events.length > 1 ? 's' : ''}</strong>
              </div>
              <div className="calendar-weekdays" aria-hidden="true">
                {weekdayNames.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="calendar-days">
                {month.days.map((day, index) => {
                  const dayEvents = day ? month.events.filter((event) => event.day === day) : [];
                  return (
                    <span
                      className={dayEvents.length ? 'calendar-day has-event' : 'calendar-day'}
                      key={`${month.key}-${day || `blank-${index}`}`}
                      title={dayEvents.map((event) => event.title).join(', ')}
                    >
                      {day || ''}
                    </span>
                  );
                })}
              </div>
              <div className="calendar-events">
                {month.events.map((event) => (
                  <div key={`${event.title}-${event.calendarLabel}`}>
                    <time>{event.calendarLabel}</time>
                    <h3>{event.title}</h3>
                    <p>{event.body}</p>
                    {event.location && <p className="event-location">{event.location}</p>}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
