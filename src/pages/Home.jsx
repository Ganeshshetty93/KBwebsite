import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, HandHeart, HeartHandshake, Music2, Pause, Play, Sparkles, UsersRound } from 'lucide-react';
import PageHeroCarousel from '../components/EventHeroCarousel.jsx';
import { events, heroStats } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { apiReadAboutContent, apiReadRecords } from '../utils/api.js';
import { defaultAboutContent, normalizeAboutContent } from '../utils/aboutContent.js';
import { readJson, writeJson } from '../utils/storage.js';

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

function parseEventDateValue(value) {
  if (!value) return null;
  const rawValue = String(value).trim();
  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const dayMonthYear = rawValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dayMonthYear) {
    const [, day, month, year] = dayMonthYear;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return null;
}

function eventDateFor(event) {
  const mapped = defaultEventDates[event.title];
  const rawDate = mapped || event.startOn || event.start_on || event.eventDate || event.date || event.month || '';
  const parsed = parseEventDateValue(rawDate);

  if (parsed) return parsed;

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

function hasSponsorContent(sponsor) {
  return Boolean(sponsor?.photo || sponsor?.name || sponsor?.level || sponsor?.note || sponsor?.website);
}

const sponsorShowcaseSlides = [
  {
    id: 'showcase-education',
    name: 'Education Partners',
    level: 'Paata Shaale',
    note: 'Supporting Kannada learning, classroom resources, and student programs.',
    shortLabel: 'EDU',
    accent: '#e5a51b',
    softAccent: '#fff0bd'
  },
  {
    id: 'showcase-culture',
    name: 'Cultural Partners',
    level: 'Arts and Events',
    note: 'Helping bring music, dance, theatre, and Karnataka traditions to the community.',
    shortLabel: 'ART',
    accent: '#c41230',
    softAccent: '#ffd9df'
  },
  {
    id: 'showcase-community',
    name: 'Community Partners',
    level: 'Local Support',
    note: 'Working alongside volunteers and families to strengthen Kannada Bharati programs.',
    shortLabel: 'COMM',
    accent: '#08736b',
    softAccent: '#cdeee8'
  },
  {
    id: 'showcase-business',
    name: 'Local Business Partners',
    level: 'Community Sponsor',
    note: 'Local organizations helping community celebrations and family programs thrive.',
    shortLabel: 'LOCAL',
    accent: '#365aa8',
    softAccent: '#dce6ff'
  },
  {
    id: 'showcase-future',
    name: 'Become a Sponsor',
    level: 'Partner With Us',
    note: 'Support language, arts, education, and cultural experiences across Washington.',
    shortLabel: 'JOIN',
    accent: '#7447a8',
    softAccent: '#eadcff'
  }
];

function SponsorCarousel({ sponsors }) {
  const [activeSponsor, setActiveSponsor] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const realSponsors = sponsors.filter(hasSponsorContent);
  const supplementalSlides = sponsorShowcaseSlides.filter((slide) => !realSponsors.some((sponsor) => sponsor.id === slide.id));
  const visibleSponsors = [...realSponsors, ...supplementalSlides].slice(0, Math.max(8, realSponsors.length));
  const sponsorHasDetails = (sponsor) => Boolean(sponsor.name || sponsor.level || sponsor.note || sponsor.website);

  const moveCarousel = (direction) => {
    setActiveIndex((current) => (current + direction + visibleSponsors.length) % visibleSponsors.length);
  };

  useEffect(() => {
    if (isPaused || isInteracting || visibleSponsors.length < 2) return undefined;
    const timer = window.setInterval(() => moveCarousel(1), 4200);
    return () => window.clearInterval(timer);
  }, [isPaused, isInteracting, visibleSponsors.length]);

  useEffect(() => {
    if (activeIndex < visibleSponsors.length) return;
    setActiveIndex(0);
  }, [activeIndex, visibleSponsors.length]);

  if (!visibleSponsors.length) return null;

  const offsetFromActive = (index) => {
    let offset = index - activeIndex;
    const halfway = visibleSponsors.length / 2;
    if (offset > halfway) offset -= visibleSponsors.length;
    if (offset < -halfway) offset += visibleSponsors.length;
    return offset;
  };

  const handleSponsorClick = (sponsor, index) => {
    if (index !== activeIndex) {
      setActiveIndex(index);
      return;
    }
    if (sponsorHasDetails(sponsor)) setActiveSponsor(sponsor);
  };

  return (
    <>
      <div
        className="home-sponsor-carousel"
        aria-label="Kannada Bharati sponsors"
        onMouseEnter={() => setIsInteracting(true)}
        onMouseLeave={() => setIsInteracting(false)}
        onFocus={() => setIsInteracting(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') moveCarousel(-1);
          if (event.key === 'ArrowRight') moveCarousel(1);
        }}
      >
        <div className="home-sponsor-stage">
          {visibleSponsors.map((sponsor, index) => {
            const hasDetails = sponsorHasDetails(sponsor);
            const offset = offsetFromActive(index);
            const distance = Math.abs(offset);
            return (
              <button
                className={`home-sponsor-card${index === activeIndex ? ' is-active' : ''}${hasDetails ? ' has-details' : ' image-only'}${distance > 4 ? ' is-hidden' : ''}`}
                type="button"
                key={sponsor.id || `${sponsor.name || 'sponsor'}-${index}`}
                onClick={() => handleSponsorClick(sponsor, index)}
                aria-label={index === activeIndex && hasDetails ? `View sponsor details for ${sponsor.name || sponsor.level || 'sponsor'}` : `Show ${sponsor.name || sponsor.level || 'sponsor'}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                style={{
                  '--cover-offset': offset,
                  '--cover-distance': distance,
                  '--sponsor-accent': sponsor.accent || '#e5a51b',
                  '--sponsor-soft-accent': sponsor.softAccent || '#fff3ce',
                  zIndex: visibleSponsors.length - distance
                }}
              >
                <span className="home-sponsor-logo">
                  {sponsor.photo
                    ? <img src={sponsor.photo} alt={sponsor.name || 'Sponsor logo'} />
                    : <span className="home-sponsor-placeholder-mark" aria-hidden="true">{sponsor.shortLabel || <Sparkles size={42} />}</span>}
                </span>
                <span className="home-sponsor-caption">
                  <strong>{sponsor.name || sponsor.level || 'Community sponsor'}</strong>
                  {sponsor.level && sponsor.name && <small>{sponsor.level}</small>}
                </span>
                {index === activeIndex && hasDetails && <span className="home-sponsor-detail-cue">View details</span>}
              </button>
            );
          })}
        </div>
        {visibleSponsors.length > 1 && (
          <div className="home-sponsor-controls" aria-label="Sponsor carousel controls">
            <button type="button" onClick={() => moveCarousel(-1)} aria-label="Previous sponsor"><ChevronLeft size={20} /></button>
            <div className="home-sponsor-dots" role="tablist" aria-label="Choose a sponsor">
              {visibleSponsors.map((sponsor, index) => (
                <button
                  className={index === activeIndex ? 'is-active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={index === activeIndex}
                  aria-label={`Show ${sponsor.name || sponsor.level || `sponsor ${index + 1}`}`}
                  key={sponsor.id || `dot-${index}`}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
            <button type="button" onClick={() => setIsPaused((current) => !current)} aria-label={isPaused ? 'Play sponsor carousel' : 'Pause sponsor carousel'}>
              {isPaused ? <Play size={17} /> : <Pause size={17} />}
            </button>
            <button type="button" onClick={() => moveCarousel(1)} aria-label="Next sponsor"><ChevronRight size={20} /></button>
          </div>
        )}
      </div>
      {activeSponsor && (
        <div className="sponsor-detail-modal" role="dialog" aria-modal="true" aria-label="Sponsor details" onClick={() => setActiveSponsor(null)}>
          <article className="sponsor-detail-card" onClick={(event) => event.stopPropagation()}>
            <button className="sponsor-detail-close" type="button" onClick={() => setActiveSponsor(null)} aria-label="Close sponsor details">x</button>
            <div className="sponsor-detail-image">
              {activeSponsor.photo ? <img src={activeSponsor.photo} alt={activeSponsor.name || 'Sponsor logo'} /> : <Sparkles size={54} />}
            </div>
            <div className="sponsor-detail-copy">
              {activeSponsor.level && <span>{activeSponsor.level}</span>}
              <h3>{activeSponsor.name || 'Kannada Bharati sponsor'}</h3>
              {activeSponsor.note && <p>{activeSponsor.note}</p>}
              {activeSponsor.website && (
                <a href={activeSponsor.website} target="_blank" rel="noreferrer">Visit sponsor</a>
              )}
            </div>
          </article>
        </div>
      )}
    </>
  );
}

export default function Home() {
  const { t } = useLanguage();
  const translatedStats = [
    [t('volunteerLed'), t('communityPowered')],
    ['2026-27', t('classesOpen')],
    [t('seattleArea'), t('kannadigaFamilies')]
  ];
  const [dbEvents, setDbEvents] = useState([]);
  const [aboutContent, setAboutContent] = useState(() => normalizeAboutContent(readJson('kb-about-content', defaultAboutContent)));

  useEffect(() => {
    let ignore = false;
    Promise.allSettled([
      apiReadRecords('kb-admin-events'),
      apiReadAboutContent()
    ]).then(([eventsResult, aboutResult]) => {
      if (ignore) return;
      if (eventsResult.status === 'fulfilled') setDbEvents(eventsResult.value);
      else setDbEvents([]);
      if (aboutResult.status === 'fulfilled') {
        const normalized = normalizeAboutContent(aboutResult.value);
        setAboutContent(normalized);
        writeJson('kb-about-content', normalized);
      }
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
  const today = new Date();
  const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonth = {
    key: `${currentMonthDate.getFullYear()}-${currentMonthDate.getMonth()}`,
    ...calendarMonthFor(currentMonthDate),
    events: calendarEvents
      .filter((event) => event.date.getFullYear() === currentMonthDate.getFullYear() && event.date.getMonth() === currentMonthDate.getMonth())
      .sort((a, b) => a.date - b.date)
  };
  const visibleSponsors = aboutContent.sponsors.filter(hasSponsorContent);
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
      <PageHeroCarousel
        pageKey="home"
        eyebrow={t('homeEyebrow')}
        title={t('homeTitle')}
        text={t('homeText')}
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
            <article className="calendar-card current-month-calendar" key={currentMonth.key}>
              <div className="calendar-card-heading">
                <span>{currentMonth.label}</span>
                <strong>{currentMonth.events.length} event{currentMonth.events.length === 1 ? '' : 's'}</strong>
              </div>
              <div className="calendar-weekdays" aria-hidden="true">
                {weekdayNames.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="calendar-days">
                {currentMonth.days.map((day, index) => {
                  const dayEvents = day ? currentMonth.events.filter((event) => event.day === day) : [];
                  return (
                    <span
                      className={dayEvents.length ? 'calendar-day has-event' : 'calendar-day'}
                      key={`${currentMonth.key}-${day || `blank-${index}`}`}
                      title={dayEvents.map((event) => event.title).join(', ')}
                    >
                      {day || ''}
                    </span>
                  );
                })}
              </div>
              <div className="calendar-events">
                {currentMonth.events.length ? currentMonth.events.map((event) => (
                  <div key={`${event.title}-${event.calendarLabel}`}>
                    <time>{event.calendarLabel}</time>
                    <h3>{event.title}</h3>
                    <p>{event.body}</p>
                    {event.location && <p className="event-location">{event.location}</p>}
                  </div>
                )) : (
                  <div className="calendar-empty-month">
                    <time>{currentMonth.label}</time>
                    <h3>No events scheduled this month</h3>
                    <p>See the full calendar for upcoming classes, celebrations, and community programs.</p>
                  </div>
                )}
              </div>
              <Link className="calendar-see-more" to="/calendar">See more on calendar</Link>
            </article>
        </div>
      </section>

      {visibleSponsors.length > 0 && (
        <section className="section home-sponsors-section" aria-labelledby="home-sponsors-title">
          <div className="home-sponsors-heading">
            <p className="eyebrow">Sponsors</p>
            <h2 id="home-sponsors-title">Our community supporters</h2>
            <p>Recognizing the partners and families who help Kannada Bharati keep language, culture, and community programs moving.</p>
            <span><HeartHandshake size={18} /> Sponsor showcase</span>
          </div>
          <SponsorCarousel sponsors={visibleSponsors} />
        </section>
      )}
    </>
  );
}
