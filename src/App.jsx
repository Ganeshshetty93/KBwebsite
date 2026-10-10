import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { BellRing, Camera, Gauge, Globe2, HeartHandshake, LogIn, LogOut, Mail, Megaphone, Menu, MessagesSquare, Play, UserCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from './context/LanguageContext.jsx';
import { getCurrentUser, readJson, setCurrentUser, writeJson } from './utils/storage.js';
import { apiReadRecords, apiReadSiteSetting, apiSubscribeNewsletter } from './utils/api.js';
import PageLoader from './components/PageLoader.jsx';

const nav = [
  ['navAbout', '/about'],
  ['navClasses', '/classes'],
  ['navPaata', '/kannada-shaale'],
  ['navEvents', '/events'],
  ['navVolunteer', '/volunteer'],
  ['navDonate', '/donate'],
  ['navContact', '/contact']
];

function getAnnouncementHref(item) {
  const url = item.ctaUrl || '';
  const isRegistrationCta = /register/i.test(`${item.ctaText || ''} ${item.text || ''}`);
  if (isRegistrationCta && /kannada-shaale/i.test(url) && !/[?&]register=/.test(url)) {
    return `${url}${url.includes('?') ? '&' : '?'}register=1`;
  }
  return url;
}

function isEnabledValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', 'yes', '1', 'on', 'enabled'].includes(String(value).trim().toLowerCase());
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

export default function App() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());
  const [memberProfile, setMemberProfile] = useState(() => {
    const current = getCurrentUser();
    return current?.email ? readJson(`kb-member-profile-${current.email.toLowerCase()}`, {}) : {};
  });
  const [announcements, setAnnouncements] = useState(() => readJson('kb-announcement-submissions', []));
  const [siteMessage, setSiteMessage] = useState(() => readJson('kb-site-message', { enabled: false, title: '', message: '', ctaText: '', ctaUrl: '' }));
  const [messageOpen, setMessageOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);
  const [newsletter, setNewsletter] = useState({ email: '', status: 'idle', message: '' });
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function syncUser() {
      const current = getCurrentUser();
      setUser(current);
      setMemberProfile(current?.email ? readJson(`kb-member-profile-${current.email.toLowerCase()}`, {}) : {});
    }

    window.addEventListener('kb-auth-change', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('kb-auth-change', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    apiReadRecords('kb-announcement-submissions')
      .then((records) => {
        if (!ignore && records.length) {
          writeJson('kb-announcement-submissions', records);
          setAnnouncements(records);
        }
      })
      .catch(() => {});
    apiReadSiteSetting('site-message')
      .then((setting) => {
        if (ignore) return;
        const nextMessage = setting || { enabled: false, title: '', message: '', ctaText: '', ctaUrl: '' };
        writeJson('kb-site-message', nextMessage);
        setSiteMessage(nextMessage);
      })
      .catch(() => {});

    function syncData() {
      setAnnouncements(readJson('kb-announcement-submissions', []));
      setSiteMessage(readJson('kb-site-message', { enabled: false, title: '', message: '', ctaText: '', ctaUrl: '' }));
      const current = getCurrentUser();
      setMemberProfile(current?.email ? readJson(`kb-member-profile-${current.email.toLowerCase()}`, {}) : {});
    }

    window.addEventListener('kb-data-change', syncData);
    window.addEventListener('storage', syncData);
    return () => {
      ignore = true;
      window.removeEventListener('kb-data-change', syncData);
      window.removeEventListener('storage', syncData);
    };
  }, []);

  useEffect(() => {
    setRouteLoading(true);
    setOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const timer = window.setTimeout(() => setRouteLoading(false), 520);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  function handleLogout() {
    setCurrentUser(null);
    setOpen(false);
    setProfileOpen(false);
    navigate('/');
  }

  async function handleNewsletterSubmit(event) {
    event.preventDefault();
    const email = newsletter.email.trim().toLowerCase();
    const atIndex = email.indexOf('@');
    const lastDotIndex = email.lastIndexOf('.');
    const hasWhitespace = [...email].some((character) => character.charCodeAt(0) <= 32);
    const isValidEmail = email.length <= 254
      && atIndex > 0
      && atIndex === email.lastIndexOf('@')
      && lastDotIndex > atIndex + 1
      && lastDotIndex < email.length - 1
      && !hasWhitespace;
    if (!isValidEmail) {
      setNewsletter((current) => ({ ...current, status: 'error', message: 'Enter a valid email address.' }));
      return;
    }

    setNewsletter((current) => ({ ...current, status: 'submitting', message: '' }));
    try {
      const result = await apiSubscribeNewsletter(email);
      setNewsletter({ email: '', status: 'success', message: result.message || 'You are subscribed to Kannada Bharati updates.' });
    } catch (error) {
      setNewsletter((current) => ({ ...current, status: 'error', message: error.message || 'Subscription failed. Please try again.' }));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const activeAnnouncements = announcements.filter((item) => {
    const enabled = isEnabledValue(item.enabled);
    const startOn = dateOnly(item.startOn);
    const endOn = dateOnly(item.endOn);
    const starts = !startOn || startOn <= today;
    const ends = !endOn || endOn >= today;
    return enabled && starts && ends;
  });

  const isAdminRoute = location.pathname.startsWith('/admin');
  const showSiteMessage = !isAdminRoute && isEnabledValue(siteMessage.enabled) && siteMessage.title && siteMessage.message;

  return (
    <div className={isAdminRoute ? 'site-shell is-admin-route' : 'site-shell'}>
      <PageLoader active={routeLoading} />
      <header className="site-header">
        <Link className="brand" to="/" onClick={() => setOpen(false)}>
          <img className="brand-logo" src="/assets/kannada-bharati-logo.png" alt="Kannada Bharati logo" />
          <span>
            <strong>ಕನ್ನಡ ಭಾರತಿ</strong>
            <small>Kannada Bharati</small>
          </span>
        </Link>

        <button
          className="icon-button menu-button"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className={open ? 'main-nav is-open' : 'main-nav'}>
          {nav.map(([label, href]) => (
            <NavLink key={href} to={href} onClick={() => setOpen(false)}>
              {t(label)}
            </NavLink>
          ))}
          {user && (
            <NavLink className="nav-login" to="/admin" onClick={() => setOpen(false)}>
              <Gauge size={17} /> {t('navDashboard')}
            </NavLink>
          )}
          <button className="nav-tool" type="button" onClick={toggleLanguage}>
            <Globe2 size={17} /> {t('langToggle')}
          </button>
          {user ? (
            <div className="nav-profile-menu">
              <button
                className="nav-profile-button"
                type="button"
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((value) => !value)}
              >
                {memberProfile.photo ? <img src={memberProfile.photo} alt="" /> : <UserCircle size={24} />}
              </button>
              {profileOpen && (
                <div className="nav-profile-dropdown">
                  <Link to="/admin/profile" onClick={() => { setOpen(false); setProfileOpen(false); }}>
                    <UserCircle size={17} /> Profile
                  </Link>
                  <button type="button" onClick={handleLogout}>
                    <LogOut size={17} /> {t('navLogout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <NavLink className="nav-login" to="/login" onClick={() => setOpen(false)}>
              <LogIn size={17} /> {t('navLogin')}
            </NavLink>
          )}
        </nav>
      </header>

      {!isAdminRoute && activeAnnouncements.length > 0 && (
        <section className="announcement-strip" aria-label="Kannada Bharati announcements">
          <div className="announcement-viewport">
            <div className="announcement-track">
              {[...activeAnnouncements, ...activeAnnouncements].map((item, index) => {
                const duplicate = index >= activeAnnouncements.length;
                return (
                  <article className="announcement-card" key={`${item.id || item.text}-${index}`} aria-hidden={duplicate}>
                    <span className="announcement-kicker"><Megaphone size={16} /> Update</span>
                    <strong>{item.text}</strong>
                    {item.ctaUrl && <Link to={getAnnouncementHref(item)} tabIndex={duplicate ? -1 : 0}>{item.ctaText || 'Learn more'}</Link>}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <main>
        <Outlet />
      </main>

      {showSiteMessage && (
        <div className={messageOpen ? 'site-message-widget is-open' : 'site-message-widget'}>
          <button
            className="site-message-button"
            type="button"
            aria-label={messageOpen ? 'Close message' : 'Open site message'}
            aria-expanded={messageOpen}
            onClick={() => setMessageOpen((value) => !value)}
          >
            {messageOpen ? <X size={20} /> : <BellRing size={21} />}
            <span />
          </button>
          {messageOpen && (
            <aside className="site-message-popup" aria-label="Kannada Bharati message">
              <div>
                <span className="announcement-kicker"><Megaphone size={15} /> Message</span>
                <button type="button" aria-label="Close message" onClick={() => setMessageOpen(false)}><X size={18} /></button>
              </div>
              <h2>{siteMessage.title}</h2>
              <p>{siteMessage.message}</p>
              {siteMessage.ctaUrl && (
                <Link className="button compact" to={getAnnouncementHref({ ctaUrl: siteMessage.ctaUrl, ctaText: siteMessage.ctaText, text: siteMessage.title })} onClick={() => setMessageOpen(false)}>
                  {siteMessage.ctaText || 'Learn more'}
                </Link>
              )}
            </aside>
          )}
        </div>
      )}

      {!isAdminRoute && (
        <>
          <section className="footer-motto" aria-label="Kannada cultural motto">
            <span aria-hidden="true" />
            <div>
              <strong lang="kn">ಸಿರಿಗನ್ನಡಂ ಗೆಲ್ಗೆ, ಸಿರಿಗನ್ನಡಂ ಬಾಳ್ಗೆ</strong>
              <p>Siri Gannadam Gelge, Siri Gannadam Balge</p>
            </div>
            <span aria-hidden="true" />
          </section>

          <footer className="footer">
            <section className="footer-brand-column">
              <Link className="footer-brand-lockup" to="/">
                <img src="/assets/kannada-bharati-logo.png" alt="Kannada Bharati logo" />
                <span><strong lang="kn">ಕನ್ನಡ ಭಾರತಿ</strong><small>Kannada Bharati</small></span>
              </Link>
              <p>{t('footerLine')}</p>
              <div className="footer-social">
                <span>Connect with Kannada Bharati</span>
                <div>
                  <a href="https://www.facebook.com/kannada.bharati.92" target="_blank" rel="noopener noreferrer" aria-label="Kannada Bharati on Facebook" title="Facebook">
                    <MessagesSquare size={18} aria-hidden="true" />
                  </a>
                  <a href="https://www.youtube.com/@KannadaBharati" target="_blank" rel="noopener noreferrer" aria-label="Kannada Bharati on YouTube" title="YouTube">
                    <Play size={19} aria-hidden="true" />
                  </a>
                  <a href="https://www.instagram.com/kannadabharati/" target="_blank" rel="noopener noreferrer" aria-label="Kannada Bharati on Instagram" title="Instagram">
                    <Camera size={18} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </section>
            <nav className="footer-nav-column" aria-label="Get involved">
              <h2>Get Involved</h2>
              <Link className="footer-link" to="/volunteer"><HeartHandshake size={17} /> {t('navVolunteer')}</Link>
              <Link className="footer-link" to="/donate">{t('navDonate')}</Link>
              <Link className="footer-link" to="/calendar">Calendar</Link>
            </nav>
            <nav className="footer-nav-column" aria-label="Resources">
              <h2>Resources</h2>
              <Link className="footer-link" to="/kannada-literature">Kannada Literature</Link>
              <Link className="footer-link" to="/sportsdayrules">Sports Rules</Link>
              <Link className="footer-link" to="/webrequirements">Web Requirements</Link>
            </nav>
            <nav className="footer-nav-column" aria-label="Member area">
              <h2>Member Area</h2>
              {user && <Link className="footer-link" to="/admin">{t('navDashboard')}</Link>}
              <Link className="footer-link" to="/login">{t('memberLogin')}</Link>
              <Link className="footer-link" to="/privacy">Privacy</Link>
            </nav>
            <section className="footer-connect-column">
              <h2>Newsletter</h2>
              <p>Stay connected with Kannada culture, upcoming events, classes, and community updates.</p>
              <form className="footer-newsletter-form" onSubmit={handleNewsletterSubmit} noValidate>
                <div className="footer-newsletter-control">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    type="email"
                    value={newsletter.email}
                    onChange={(event) => setNewsletter({ email: event.target.value, status: 'idle', message: '' })}
                    placeholder="Your email address"
                    aria-label="Email address for newsletter"
                    autoComplete="email"
                    maxLength="254"
                    disabled={newsletter.status === 'submitting'}
                    required
                  />
                  <button type="submit" disabled={newsletter.status === 'submitting'}>
                    {newsletter.status === 'submitting' ? 'Subscribing...' : 'Subscribe'}
                  </button>
                </div>
                {newsletter.message && (
                  <p
                    className={newsletter.status === 'error' ? 'footer-newsletter-message is-error' : 'footer-newsletter-message is-success'}
                    role={newsletter.status === 'error' ? 'alert' : 'status'}
                  >
                    {newsletter.message}
                  </p>
                )}
              </form>
              <small className="footer-newsletter-note">
                Occasional updates only. <Link to="/contact">Contact Kannada Bharati</Link>
              </small>
            </section>
          </footer>
        </>
      )}
    </div>
  );
}
