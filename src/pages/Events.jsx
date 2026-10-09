import { useEffect, useState } from 'react';
import { CheckCircle2, Images, ReceiptText, UsersRound, X } from 'lucide-react';
import EventHeroCarousel from '../components/EventHeroCarousel.jsx';
import { events } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { apiAppendRecord, apiCompleteFlowPayment, apiCreateFlowPayment, apiReadRecords, apiReadSiteSetting } from '../utils/api.js';
import { appendRecord, getCurrentUser, readJson } from '../utils/storage.js';
import { cleanText, firstError, validateEmail, validatePhone, validateRequired } from '../utils/validation.js';
import { normalizeEventMemories } from '../utils/eventMemories.js';

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

function eventAmount(event) {
  return Number(String(event.fee || event.price || event.donationAmount || event.amount || 0).replace(/[^\d.]/g, '')) || 0;
}

function eventPriceOptions(event) {
  const menu = event.priceMenu || event.price_menu;
  const items = Array.isArray(menu) ? menu : menu?.items || menu?.options || [];
  return items.map((item, index) => ({
    key: item.id || item.key || item.name || item.label || `price-${index}`,
    label: item.label || item.name || item.title || `Option ${index + 1}`,
    amount: Number(item.amount || item.price || 0)
  }));
}

function priceSelectionKeys(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function shouldSelectPriceOption(option, index, draft) {
  const selected = priceSelectionKeys(draft?.priceSelections || draft?.priceSelection);
  if (selected.length) return selected.includes(String(option.key));
  const label = String(option.label || '').toLowerCase();
  if (label.includes('adult')) return Number(draft?.adults || 0) > 0;
  if (label.includes('child') || label.includes('kid')) return Number(draft?.kids || 0) + Number(draft?.youngKids || 0) > 0;
  return index === 0;
}

function memberOptions(user) {
  if (!user?.email) return [];
  const email = String(user.email).toLowerCase();
  const profile = readJson(`kb-member-profile-${email}`, {});
  const children = readJson(`kb-member-children-${email}`, []);
  const names = [
    [`${profile.firstName || user.name || user.email} ${profile.lastName || ''}`.trim(), 'Self'],
    profile.spouseFirstName ? [`${profile.spouseFirstName} ${profile.spouseLastName || ''}`.trim(), 'Spouse'] : null,
    ...children.map((child) => [`${child.firstName || child.childFirstName} ${child.lastName || child.childLastName || ''}`.trim(), 'Child'])
  ].filter(Boolean);
  return names.map(([name, relation]) => ({ name, relation, label: `${name} (${relation.toLowerCase()})` }));
}

export default function Events() {
  const { t, tr } = useLanguage();
  const [dbEvents, setDbEvents] = useState([]);
  const [eventMemories, setEventMemories] = useState([]);

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

  useEffect(() => {
    let ignore = false;
    apiReadSiteSetting('event-memories')
      .then((value) => {
        if (!ignore) setEventMemories(normalizeEventMemories(value, { includeDisabled: false }));
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  const allEvents = dbEvents.length ? dbEvents : events;
  const [featuredEvent, ...upcomingEvents] = allEvents;
  const uploadedPastPhotos = allEvents.filter((event) => event.photo).map((event) => ({
    title: event.title,
    date: event.month,
    image: event.photo
  }));
  const fallbackPastCelebrations = [
    ...uploadedPastPhotos,
    { title: 'Kannada Rajyotsava Memories', date: 'Past celebration', initial: 'ರ' },
    { title: 'Student Showcase Highlights', date: 'Past celebration', initial: 'ಶ' },
    { title: 'Community Food Festival', date: 'Past celebration', initial: 'ಊ' },
    { title: 'Music and Dance Night', date: 'Past celebration', initial: 'ಸ' }
  ];
  const pastCelebrations = eventMemories.length ? eventMemories : fallbackPastCelebrations;
  const [showPastPhotos, setShowPastPhotos] = useState(false);
  const [registeringEvent, setRegisteringEvent] = useState(null);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [eventError, setEventError] = useState('');
  const [eventSaved, setEventSaved] = useState(false);
  const [eventMessage, setEventMessage] = useState('');
  const [eventDraft, setEventDraft] = useState(null);
  const [eventNotice, setEventNotice] = useState(null);
  const user = getCurrentUser();
  const availableMembers = memberOptions(user);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const token = params.get('token');
    const registrationId = params.get('registrationId');
    const kind = params.get('kind') || 'guest-event';
    if (payment === 'cancel') {
      setEventError('Payment was cancelled. Your registration remains pending.');
      return;
    }
    if (payment !== 'complete' || !token || !registrationId) return;
    setEventMessage('Confirming payment...');
    apiCompleteFlowPayment(kind, { token, registrationId })
      .then(() => setEventMessage('Payment confirmed. Your registration is complete.'))
      .catch((error) => setEventError(error.message || 'Payment could not be confirmed.'));
  }, []);

  function openRegistration(event) {
    setRegisteringEvent(event);
    setRegistrationStep(1);
    setEventError('');
    setEventSaved(false);
    setEventDraft(null);
    setEventNotice(null);
  }

  function buildRegistrationRecord(form) {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const priceSelections = priceSelectionKeys(formData.getAll('priceSelection'));
    if (registrationStep === 3 && eventDraft) return eventDraft;
    if (registrationStep > 1 && eventDraft) {
      const amount = eventAmount(registeringEvent);
      const priceOptions = eventPriceOptions(registeringEvent);
      if (priceOptions.length && !priceSelections.length) throw new Error('Select at least one price option.');
      const selectedOptions = priceOptions.filter((option) => priceSelections.includes(String(option.key)));
      return {
        ...eventDraft,
        amount: selectedOptions.length
          ? selectedOptions.reduce((sum, option) => sum + option.amount, 0)
          : eventDraft.amount || amount,
        rsvp: payload.rsvp || eventDraft.rsvp || '',
        priceSelections,
        priceSelection: priceSelections.join(', ')
      };
    }
    const guest = payload.registrationMode === 'guest' || !user;
    const validation = guest ? firstError([
      validateRequired(payload.name, 'Name'),
      validateEmail(cleanText(payload.email)),
      validatePhone(cleanText(payload.phone))
    ]) : validateRequired(payload.memberName, 'Member');
    if (validation) throw new Error(validation);

    const amount = eventAmount(registeringEvent);
    const adults = Number(payload.adults || 1);
    const kids = Number(payload.kids || 0);
    const youngKids = Number(payload.youngKids || 0);
    return {
      parentName: guest ? cleanText(payload.name) : user.name || user.email,
      studentName: guest ? cleanText(payload.name) : cleanText(payload.memberName),
      familyMember: guest ? cleanText(payload.name) : cleanText(payload.memberName),
      email: guest ? cleanText(payload.email).toLowerCase() : user.email,
      phone: guest ? cleanText(payload.phone) : user.phone || '-',
      program: registeringEvent.title,
      eventId: registeringEvent.eventId,
      status: 'Submitted',
      registrationType: guest ? 'guest' : 'event',
      adults,
      kids,
      youngKids,
      totalMembers: adults + kids + youngKids,
      seats: adults + kids + youngKids,
      amount,
      rsvp: payload.rsvp || '',
      priceSelections: [],
      priceSelection: '',
      priceMenu: registeringEvent.priceMenu || registeringEvent.price_menu || null
    };
  }

  async function handleEventRegistration(eventSubmit) {
    eventSubmit.preventDefault();
    setEventError('');
    setEventSaved(false);
    const form = eventSubmit.currentTarget;
    let record;
    try {
      record = buildRegistrationRecord(form);
    } catch (error) {
      setEventError(error.message);
      return;
    }

    if (registrationStep < 3) {
      setEventDraft(record);
      setRegistrationStep((step) => step + 1);
      return;
    }

    let savedRegistration = record;
    try {
      savedRegistration = await apiAppendRecord('kb-registration-submissions', record);
    } catch (error) {
      appendRecord('kb-registration-submissions', record);
      setEventError('Registration was saved locally, but payment cannot start until the server is reachable.');
      return;
    }
    setEventSaved(true);
    setEventNotice({
      title: record.amount > 0 ? 'Registration saved' : 'Registration submitted',
      message: record.amount > 0
        ? 'We saved your registration and sent the email confirmation. Opening payment now.'
        : 'We saved your registration and sent the email confirmation.'
    });
    if (record.amount > 0) {
      try {
        const payment = await apiCreateFlowPayment(record.registrationType === 'guest' ? 'guest-event' : 'event', {
          registrationId: savedRegistration?.id,
          email: record.email,
          name: record.parentName,
          familyMember: record.familyMember,
          program: record.program,
          eventId: record.eventId,
          amount: record.amount,
          rsvp: record.rsvp,
          priceSelection: record.priceSelection,
          returnUrl: `${window.location.origin}/events?payment=complete&kind=${record.registrationType === 'guest' ? 'guest-event' : 'event'}&registrationId=${encodeURIComponent(savedRegistration?.id || '')}`,
          cancelUrl: `${window.location.origin}/events?payment=cancel`
        });
        if (payment.approvalUrl) {
          window.setTimeout(() => {
            window.location.href = payment.approvalUrl;
          }, 900);
        }
      } catch (error) {
        setEventError(error.message || 'Payment could not be started.');
      }
    }
  }

  return (
    <>
      <EventHeroCarousel
        pageKey="events"
        eyebrow={t('eventsTitle')}
        title={t('eventsHeroTitle')}
        text={t('eventsHeroText')}
      />
      <section className="section events-page">
        <div className="section-toolbar events-toolbar">
          <div>
            <p className="eyebrow">{t('eventsTitle')}</p>
            <h2>{t('calendarTitle')}</h2>
            <p className="events-intro">Celebrate culture, learning, and community through Kannada Bharati gatherings across Washington.</p>
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
              <button className="button primary" type="button" onClick={() => openRegistration(featuredEvent)}>{tr('Register')}</button>
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
                <button className="button compact" type="button" onClick={() => openRegistration(event)}>{tr('Register')}</button>
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
                    <img src={item.image} alt={item.alt || item.title} />
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
      {eventMessage && <p className="success floating-payment-message">{eventMessage}</p>}
      {registeringEvent && (
        <div className="popup-backdrop" role="presentation">
          <form className="popup-panel class-detail-popup" onSubmit={handleEventRegistration} role="dialog" aria-modal="true" aria-label={`${registeringEvent.title} registration`}>
            <button className="popup-close" type="button" aria-label="Close registration" onClick={() => setRegisteringEvent(null)}><X size={20} /></button>
            <div className="registration-stepper">
              {['Details', 'Pricing', 'Review'].map((label, index) => (
                <span key={label} className={registrationStep >= index + 1 ? 'is-active' : ''}>{index + 1}. {tr(label)}</span>
              ))}
            </div>
            <div className="event-registration-heading">
              <span>{tr(user ? 'Member registration' : 'Guest registration')}</span>
              <h2>{registeringEvent.title}</h2>
              <p>{registeringEvent.body}</p>
            </div>
            {registrationStep === 1 && (
              <section className="event-registration-step">
                {user && availableMembers.length > 0 ? (
                  <>
                    <label>Register as
                      <select name="memberName" required>
                        {availableMembers.map((member) => <option key={member.label} value={member.name}>{member.label}</option>)}
                      </select>
                    </label>
                    <input type="hidden" name="registrationMode" value="member" />
                  </>
                ) : (
                  <>
                    <input type="hidden" name="registrationMode" value="guest" />
                    <div className="form-two">
                      <label>Name <input name="name" required /></label>
                      <label>Email <input name="email" type="email" required /></label>
                    </div>
                    <label>Phone <input name="phone" type="tel" /></label>
                  </>
                )}
                <div className="form-three">
                  <label>Adults <input name="adults" type="number" min="0" defaultValue="1" /></label>
                  <label>Kids 6-12 <input name="kids" type="number" min="0" defaultValue="0" /></label>
                  <label>Kids 5 below <input name="youngKids" type="number" min="0" defaultValue="0" /></label>
                </div>
              </section>
            )}
            {registrationStep === 2 && (
              <section className="event-registration-step">
                {(registeringEvent.rsvp || registeringEvent.rsvp === true) && (
                  <label>RSVP
                    <select name="rsvp" defaultValue="Yes">
                      <option>Yes</option>
                      <option>No</option>
                      <option>Maybe</option>
                    </select>
                  </label>
                )}
                {eventPriceOptions(registeringEvent).length > 0 ? (
                  <fieldset className="price-option-fieldset">
                    <legend>Select all that apply</legend>
                    <div className="price-option-grid">
                      {eventPriceOptions(registeringEvent).map((option, index) => (
                        <label key={option.key} className="price-option-card">
                          <input
                            name="priceSelection"
                            type="checkbox"
                            value={option.key}
                            defaultChecked={shouldSelectPriceOption(option, index, eventDraft)}
                          />
                          <span>{option.label}</span>
                          <strong>${option.amount.toFixed(2)}</strong>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <p className="notice-box">Base payment amount: ${eventAmount(registeringEvent).toFixed(2)}</p>
                )}
              </section>
            )}
            {registrationStep === 3 && (
              <section className="event-registration-review">
                <article><UsersRound size={20} /><span>{tr('Registrant')}</span><strong>{eventDraft?.familyMember || tr('Ready to submit')}</strong></article>
                <article><ReceiptText size={20} /><span>{tr('Total members')}</span><strong>{eventDraft?.totalMembers || 1}</strong></article>
                <article><CheckCircle2 size={20} /><span>{tr('Amount')}</span><strong>${Number(eventDraft?.amount || eventAmount(registeringEvent)).toFixed(2)}</strong></article>
              </section>
            )}
            {eventError && <p className="form-error">{eventError}</p>}
            {eventSaved && <p className="success">Registration submitted. {Number(eventDraft?.amount || 0) > 0 ? 'Opening payment...' : 'No payment is required.'}</p>}
            <div className="event-registration-actions">
              {registrationStep > 1 && <button className="button secondary-dark" type="button" onClick={() => setRegistrationStep((step) => step - 1)}>{tr('Back')}</button>}
              <button className="button primary" type="submit">{tr(registrationStep < 3 ? 'Continue' : Number(eventDraft?.amount || eventAmount(registeringEvent)) > 0 ? 'Save & Pay' : 'Submit Registration')}</button>
            </div>
          </form>
        </div>
      )}
      {eventNotice && (
        <div className="popup-backdrop registration-message-backdrop" role="presentation">
          <div className="popup-panel registration-message-popup" role="dialog" aria-modal="true" aria-label={eventNotice.title}>
            <button className="popup-close" type="button" aria-label="Close message" onClick={() => setEventNotice(null)}><X size={20} /></button>
            <span className="registration-message-icon"><CheckCircle2 size={34} /></span>
            <h2>{eventNotice.title}</h2>
            <p>{eventNotice.message}</p>
            <button className="button primary" type="button" onClick={() => setEventNotice(null)}>Done</button>
          </div>
        </div>
      )}
    </>
  );
}
