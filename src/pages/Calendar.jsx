import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Clock, MapPin } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import { events as fallbackEvents } from '../data/siteData.js';
import { culturalClasses, paataShaaleLevels } from '../data/siteData.js';
import { apiReadRecords } from '../utils/api.js';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayMap = {
  Sundays: 0,
  Mondays: 1,
  Tuesdays: 2,
  Wednesdays: 3,
  Thursdays: 4,
  Fridays: 5,
  Saturdays: 6
};

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseMonthText(value) {
  const text = String(value || '');
  const match = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i);
  if (!match) return null;
  const monthIndex = monthNames.findIndex((month) => month.toLowerCase().startsWith(match[1].toLowerCase().slice(0, 3)));
  return monthIndex >= 0 ? new Date(Number(match[2]), monthIndex, 1) : null;
}

function getEventDate(event) {
  if (event?.startOn) return event.startOn;
  if ((event?.title || '').toLowerCase().includes('class year begins')) return '2026-09-13';
  return parseMonthText(event?.month) || event?.month || '';
}

function getClassRange(item) {
  const parts = String(item.date || '').split(/\s+-\s+/);
  if (parts.length !== 2) return { start: null, end: null };
  return {
    start: parseDate(parts[0]),
    end: parseDate(parts[1])
  };
}

function getClassWeekday(item) {
  const firstPart = String(item.time || '').split(',')[0]?.trim();
  return weekdayMap[firstPart];
}

function formatDate(value) {
  if (!value) return 'Date to be announced';
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function addCalendarItem(map, date, item) {
  if (!date) return;
  const key = dateKey(date);
  const existing = map.get(key) || [];
  map.set(key, [...existing, item]);
}

function buildCalendarItems(events, classes) {
  const itemMap = new Map();
  events.forEach((event) => {
    const date = parseDate(getEventDate(event));
    addCalendarItem(itemMap, date, {
      type: 'event',
      title: event.title,
      body: event.body || event.location || 'Details will be shared soon.',
      date
    });
  });

  classes.forEach((item) => {
    const { start, end } = getClassRange(item);
    const weekday = getClassWeekday(item);
    if (!start || !end || weekday === undefined) {
      addCalendarItem(itemMap, start, {
        type: 'class',
        title: item.title,
        body: item.time || item.location || 'Class schedule',
        date: start
      });
      return;
    }

    const cursor = new Date(start);
    while (cursor.getDay() !== weekday) cursor.setDate(cursor.getDate() + 1);
    while (cursor <= end) {
      addCalendarItem(itemMap, new Date(cursor), {
        type: 'class',
        title: item.title,
        body: item.time || item.location || 'Class schedule',
        date: new Date(cursor)
      });
      cursor.setDate(cursor.getDate() + 7);
    }
  });

  return itemMap;
}

function chooseCalendarYear(events, classes) {
  const dates = [
    ...events.map((event) => parseDate(getEventDate(event))),
    ...classes.map((item) => getClassRange(item).start)
  ].filter(Boolean);
  return dates.length ? Math.min(...dates.map((date) => date.getFullYear())) : 2026;
}

function buildMonthDays(year, month, itemMap) {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const itemsInMonth = [...itemMap.entries()]
    .map(([dateKey, items]) => ({ date: parseDate(dateKey), items }))
    .filter(({ date }) => date && date.getFullYear() === year && date.getMonth() === month)
    .sort((a, b) => a.date - b.date);

  return {
    label: `${monthNames[month].slice(0, 3)} ${year}`,
    items: itemsInMonth,
    days: [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: lastDate }, (_, index) => {
        const day = index + 1;
        const key = dateKey(new Date(year, month, day));
        const items = itemMap.get(key) || [];
        return { day, key, items, hasItem: items.length > 0 };
      })
    ]
  };
}

export default function Calendar() {
  const [dbEvents, setDbEvents] = useState([]);
  const [dbClasses, setDbClasses] = useState([]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      apiReadRecords('kb-admin-events').catch(() => []),
      apiReadRecords('kb-admin-classes').catch(() => [])
    ]).then(([events, classes]) => {
      if (!ignore) {
        setDbEvents(events);
        setDbClasses(classes);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const fallbackClasses = [
    ...paataShaaleLevels.map((item) => ({ ...item, category: 'Language' })),
    ...culturalClasses
  ];
  const events = (dbEvents.length ? dbEvents : fallbackEvents)
    .filter((item) => item.enabled !== false)
    .sort((a, b) => String(a.startOn || a.month || '').localeCompare(String(b.startOn || b.month || '')));
  const classes = dbClasses.length ? dbClasses : fallbackClasses;
  const calendarItems = buildCalendarItems(events, classes);
  const calendarYear = chooseCalendarYear(events, classes);
  const months = Array.from({ length: 12 }, (_, monthIndex) => buildMonthDays(calendarYear, monthIndex, calendarItems));
  const totalHighlightedDays = [...calendarItems.keys()].filter((key) => key.startsWith(`${calendarYear}-`)).length;

  return (
    <>
      <PageHero
        eyebrow="Calendar"
        title="Kannada Bharati Calendar"
        text="A quick view of upcoming classes, cultural events, volunteer dates, and community programs."
        className="calendar-page-hero"
      />

      <section className="section calendar-page">
        <div className="section-heading calendar-year-heading">
          <p className="eyebrow">Year View</p>
          <h2>{calendarYear} Calendar</h2>
          <p>Event dates and class days are highlighted across the full year.</p>
        </div>
        <div className="calendar-overview">
          {months.map((month) => {
            const itemCount = month.items.reduce((sum, entry) => sum + entry.items.length, 0);
            return (
              <article className="calendar-card calendar-page-board" key={month.label}>
                <div className="calendar-card-heading">
                  <span>{month.label}</span>
                  <strong>{itemCount} {itemCount === 1 ? 'item' : 'items'}</strong>
                </div>
                <div className="calendar-weekdays">
                  {weekdays.map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="calendar-days">
                  {month.days.map((item, index) => (
                    item
                      ? (
                        <span
                          className={item.hasItem ? 'calendar-day has-event' : 'calendar-day'}
                          key={`${month.label}-${item.day}`}
                          title={item.items.map((entry) => entry.title).join(', ')}
                        >
                          {item.day}
                        </span>
                      )
                      : <span className="calendar-day" key={`blank-${index}`} />
                  ))}
                </div>
                <div className="calendar-board-events">
                  {month.items.length ? month.items.slice(0, 4).map(({ date, items }) => (
                    <article key={dateKey(date)}>
                      <time>{formatDate(date)}</time>
                      <h3>{items[0].title}{items.length > 1 ? ` + ${items.length - 1} more` : ''}</h3>
                      <p>{items[0].body}</p>
                    </article>
                  )) : (
                    <article>
                      <time>No dates</time>
                      <h3>No events or classes</h3>
                      <p>Nothing is scheduled for this month yet.</p>
                    </article>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="calendar-stats">
          <article><CalendarDays size={22} /><strong>{events.length}</strong><span>Published events</span></article>
          <article><BookOpen size={22} /><strong>{classes.length}</strong><span>Class schedules</span></article>
          <article><Clock size={22} /><strong>{totalHighlightedDays}</strong><span>Highlighted days</span></article>
        </div>

        <div className="section-heading calendar-list-heading">
          <p className="eyebrow">Upcoming</p>
          <h2>Events and important dates</h2>
        </div>
        <div className="calendar-list">
          {events.length ? events.slice(0, 8).map((event) => (
            <article key={event.id || event.title} className="calendar-list-item">
              <time>{formatDate(getEventDate(event))}</time>
              <div>
                <h3>{event.title}</h3>
                <p>{event.body || event.location || 'Details will be shared soon.'}</p>
                {event.location && <span><MapPin size={15} /> {event.location}</span>}
              </div>
            </article>
          )) : (
            <article className="calendar-list-item">
              <time>Coming soon</time>
              <div>
              <h3>No events published yet</h3>
              <p>New announcements and event dates will appear here once they are added.</p>
              </div>
            </article>
          )}
        </div>
      </section>

      <section className="section calendar-classes-section">
        <div className="section-heading">
          <p className="eyebrow">Classes</p>
          <h2>Class schedule</h2>
        </div>
        <div className="calendar-class-grid">
          {classes.length ? classes.slice(0, 6).map((item) => (
            <article className="calendar-class-card" key={item.id || item.title}>
              <span>{item.category || 'Class'}</span>
              <h3>{item.title}</h3>
              <p><CalendarDays size={16} /> {item.date || 'Dates to be announced'}</p>
              <p><Clock size={16} /> {item.time || 'Time to be announced'}</p>
              {item.location && <p><MapPin size={16} /> {item.location}</p>}
            </article>
          )) : (
            <article className="calendar-class-card">
              <h3>No classes published yet</h3>
              <p>Class dates will appear here after admin adds them.</p>
            </article>
          )}
        </div>
      </section>
    </>
  );
}
