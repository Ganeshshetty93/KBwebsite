import { useEffect, useState } from 'react';
import { Images, Plus, X } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import AdminCreateForm from '../components/AdminCreateForm.jsx';
import { events } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getCurrentUser, isAdmin, readJson } from '../utils/storage.js';
import { apiReadRecords } from '../utils/api.js';

export default function Events() {
  const { t } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [adminEvents, setAdminEvents] = useState(() => readJson('kb-admin-events', []));
  const user = getCurrentUser();

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
  }, [refreshKey]);

  const allEvents = [...events, ...adminEvents];
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
          {isAdmin(user) && (
            <button className="button primary add-section-button" type="button" onClick={() => setShowAddEvent(true)}>
              <Plus size={18} /> + Add Event
            </button>
          )}
        </div>

        {featuredEvent && (
          <article className="featured-event">
            <div className="featured-event-media">
              {featuredEvent.photo ? (
                <img src={featuredEvent.photo} alt={featuredEvent.title} />
              ) : (
                <div className="event-art">
                  <span>ಕ</span>
                </div>
              )}
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
              {event.photo ? (
                <img className="event-card-photo" src={event.photo} alt={event.title} />
              ) : (
                <div className="event-card-pattern" aria-hidden="true">
                  <span>{event.title.slice(0, 1)}</span>
                </div>
              )}
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
      {showAddEvent && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup-panel" role="dialog" aria-modal="true" aria-label="Add event">
            <button className="popup-close" type="button" aria-label="Close add event popup" onClick={() => setShowAddEvent(false)}>
              <X size={20} />
            </button>
            <AdminCreateForm
              type="event"
              onCreated={() => {
                setRefreshKey((key) => key + 1);
                setShowAddEvent(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
