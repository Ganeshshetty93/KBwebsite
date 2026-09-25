import { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import { events } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { apiReadRecords } from '../utils/api.js';

function getEventImage(event) {
  if (event.photo) return event.photo;

  const title = (event.title || '').toLowerCase();
  if (title.includes('rajyotsava')) return '/assets/hero/events-hero.png';
  if (title.includes('showcase')) return '/assets/feature/events-feature.png';
  if (title.includes('class')) return '/assets/classes/kannada-language-class.png';
  if (title.includes('music')) return '/assets/culture-feature/music-traditions-feature.png';
  if (title.includes('dance')) return '/assets/culture-feature/classical-dance-feature.png';
  return '/assets/feature/events-feature.png';
}

export default function Events() {
  const { t } = useLanguage();
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
  const [featuredEvent, ...upcomingEvents] = allEvents;
  const uploadedPastPhotos = allEvents.filter((event) => event.photo).map((event) => ({
    title: event.title,
    date: event.month,
    image: event.photo
  }));
  const pastCelebrations = [
    ...uploadedPastPhotos,
    { title: 'Kannada Rajyotsava Memories', date: 'Past celebration', initial: 'ರ' },
    { title: 'Student Showcase Highlights', date: 'Past celebration', initial: 'ಶ' },
    { title: 'Community Food Festival', date: 'Past celebration', initial: 'ಊ' },
    { title: 'Music and Dance Night', date: 'Past celebration', initial: 'ಸ' }
  ];
  const [showPastPhotos, setShowPastPhotos] = useState(false);

  return (
    <>
      <PageHero
        eyebrow={t('eventsTitle')}
        title={t('eventsHeroTitle')}
        text={t('eventsHeroText')}
        className="events-hero"
      />
      <section className="section events-page">
        <div className="section-toolbar events-toolbar">
          <div>
            <p className="eyebrow">{t('eventsTitle')}</p>
            <h2>{t('calendarTitle')}</h2>
            <p className="events-intro">Celebrate culture, learning, and community through Kannada Bharati gatherings across the Seattle area.</p>
          </div>
        </div>

        {featuredEvent && (
          <article className="featured-event">
            <div className="featured-event-media">
              <img src={getEventImage(featuredEvent)} alt={featuredEvent.title} />
            </div>
            <div className="featured-event-copy">
              <span className="date-badge">{featuredEvent.month}</span>
              <h2>{featuredEvent.title}</h2>
              <p>{featuredEvent.body}</p>
              {featuredEvent.location && <p className="event-location">{featuredEvent.location}</p>}
            </div>
          </article>
        )}

        <div className="events-grid">
          {upcomingEvents.map((event) => (
            <article className="event-card" key={`${event.title}-${event.month}`}>
              <img className="event-card-photo" src={getEventImage(event)} alt={event.title} />
              <div className="event-card-body">
                <span className="date-badge">{event.month}</span>
                <h3>{event.title}</h3>
                <p>{event.body}</p>
                {event.location && <p className="event-location">{event.location}</p>}
              </div>
            </article>
          ))}
        </div>

        <section className="past-events-panel">
          <div className="past-events-heading">
            <div>
              <p className="eyebrow">Memories</p>
              <h2>Old celebrated events photos</h2>
              <p>Browse highlights from earlier Kannada Bharati celebrations and showcases.</p>
            </div>
            <button className="button secondary-dark gallery-toggle" type="button" onClick={() => setShowPastPhotos((value) => !value)}>
              <Images size={18} /> {showPastPhotos ? 'Hide Photos' : 'View Photos'}
            </button>
          </div>
          {showPastPhotos && (
            <div className="past-gallery">
              {pastCelebrations.map((item) => (
                <article className="past-photo-card" key={`${item.title}-${item.date}`}>
                  {item.image ? (
                    <img src={item.image} alt={item.title} />
                  ) : (
                    <div className="past-photo-fallback">
                      <span>{item.initial}</span>
                    </div>
                  )}
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.date}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </>
  );
}
