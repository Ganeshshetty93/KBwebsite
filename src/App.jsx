import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { BellRing, Camera, CheckCircle2, ChevronDown, ClipboardCheck, Gauge, Globe2, HeartHandshake, LogIn, LogOut, Mail, Megaphone, Menu, MessagesSquare, Play, Search, UserCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from './context/LanguageContext.jsx';
import { getCurrentUser, readJson, setCurrentUser, writeJson } from './utils/storage.js';
import { apiAdminDashboard, apiReadRecords, apiReadSiteSetting, apiSubscribeNewsletter } from './utils/api.js';
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

const adminPageTitles = {
  '/admin': 'Dashboard',
  '/admin/profile': 'My account',
  '/admin/checkin': 'Check-in',
  '/admin/guest-checkin': 'Guest Check-in',
  '/admin/seats': 'Seat Management',
  '/admin/expense': 'Volunteer Expenses',
  '/admin/teacher': 'Class Area',
  '/admin/teacher-attendance': 'Attendance',
  '/admin/treasurer': 'Expense Review',
  '/admin/registration-classes': 'Class Registrations',
  '/admin/registrations': 'Event Registrations',
  '/admin/registration-payments': 'Payment Details',
  '/admin/users': 'Users',
  '/admin/user-search': 'Find User',
  '/admin/role-access': 'Roles & Access',
  '/admin/classes': 'Classes',
  '/admin/events': 'Content & Settings',
  '/admin/teacher-allotments': 'Teacher Allotment',
  '/admin/fundraising': 'Fund Raising',
  '/admin/donations': 'Donations',
  '/admin/messages': 'Messages',
  '/admin/volunteer-interest': 'Volunteer Interest',
  '/admin/student-view': 'Student View',
  '/admin/email-outbox': 'Email Outbox',
  '/admin/developer': 'Developer Tools'
};

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
  const [profileMenuPosition, setProfileMenuPosition] = useState(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [user, setUser] = useState(() => getCurrentUser());
  const [memberProfile, setMemberProfile] = useState(() => {
    const current = getCurrentUser();
    return current?.email ? readJson(`kb-member-profile-${current.email.toLowerCase()}`, {}) : {};
  });
  const [announcements, setAnnouncements] = useState(() => readJson('kb-announcement-submissions', []));
  const [notificationActivity, setNotificationActivity] = useState(() => ({
    registrations: readJson('kb-registration-submissions', []),
    volunteers: readJson('kb-volunteer-submissions', []),
    users: []
  }));
  const [siteMessage, setSiteMessage] = useState(() => readJson('kb-site-message', { enabled: false, title: '', message: '', ctaText: '', ctaUrl: '' }));
  const [messageOpen, setMessageOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);
  const [newsletter, setNewsletter] = useState({ email: '', status: 'idle', message: '' });
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const profileButtonRef = useRef(null);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) {
      setProfileMenuPosition(null);
      return undefined;
    }

    const updateProfileMenuPosition = () => {
      const button = profileButtonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const headerRect = button.closest('.site-header')?.getBoundingClientRect();
      const edgeGap = window.innerWidth <= 420 ? 8 : 10;
      const menuWidth = Math.min(window.innerWidth <= 1080 ? 180 : 190, window.innerWidth - (edgeGap * 2));
      const menuHeight = profileDropdownRef.current?.offsetHeight || 100;
      const left = Math.min(
        Math.max(edgeGap, rect.right - menuWidth),
        window.innerWidth - menuWidth - edgeGap
      );
      const belowTop = Math.max(rect.bottom, headerRect?.bottom || rect.bottom) + 8;
      const top = belowTop + menuHeight <= window.innerHeight - edgeGap
        ? belowTop
        : Math.max(edgeGap, rect.top - menuHeight - 8);

      setProfileMenuPosition({ top, left, width: menuWidth });
    };

    updateProfileMenuPosition();
    window.addEventListener('resize', updateProfileMenuPosition);
    window.addEventListener('scroll', updateProfileMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateProfileMenuPosition);
      window.removeEventListener('scroll', updateProfileMenuPosition, true);
    };
  }, [profileOpen]);

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
    if (!user || !location.pathname.startsWith('/admin')) return undefined;

    let ignore = false;
    const loadLocalActivity = () => {
      if (ignore) return;
      setNotificationActivity((current) => ({
        ...current,
        registrations: readJson('kb-registration-submissions', []),
        volunteers: readJson('kb-volunteer-submissions', [])
      }));
    };

    loadLocalActivity();
    apiAdminDashboard()
      .then((records) => {
        if (!ignore) {
          const localRegistrations = readJson('kb-registration-submissions', []);
          const remoteRegistrationKeys = new Set((records.registrations || []).map((item) => (
            item.id || item.registrationId || `${item.email || ''}-${item.program || ''}-${item.createdAt || item.registeredOn || ''}`
          )));
          const registrations = [
            ...(records.registrations || []),
            ...localRegistrations.filter((item) => !remoteRegistrationKeys.has(
              item.id || item.registrationId || `${item.email || ''}-${item.program || ''}-${item.createdAt || item.registeredOn || ''}`
            ))
          ];
          setNotificationActivity({
            registrations,
            volunteers: records.volunteers || [],
            users: records.users || []
          });
        }
      })
      .catch(() => {
        // Local activity still gives the notification menu a useful offline fallback.
      });

    window.addEventListener('kb-data-change', loadLocalActivity);
    window.addEventListener('storage', loadLocalActivity);
    return () => {
      ignore = true;
      window.removeEventListener('kb-data-change', loadLocalActivity);
      window.removeEventListener('storage', loadLocalActivity);
    };
  }, [location.pathname, user]);

  useEffect(() => {
    let ignore = false;
    apiReadRecords('kb-announcement-submissions')
      .then((records) => {
        if (!ignore) {
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
    setNotificationOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const timer = window.setTimeout(() => setRouteLoading(false), 520);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  function handleLogout() {
    setCurrentUser(null);
    setOpen(false);
    setProfileOpen(false);
    setNotificationOpen(false);
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
  const announcementKey = (item, index = 0) => String(item.id || item.createdAt || item.startOn || item.text || index);

  const currentEmail = String(user?.email || '').trim().toLowerCase();
  const userRoles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])].filter(Boolean).join(' ');
  const managesCommunity = /admin|superadmin|welcome.?desk|receptionist/i.test(userRoles);
  const pendingPattern = /pending|submitted|awaiting|requested|new/i;
  const sortedRegistrations = [...notificationActivity.registrations].sort((left, right) => (
    new Date(right.registeredOn || right.createdAt || right.created_at || right.date || 0)
    - new Date(left.registeredOn || left.createdAt || left.created_at || left.date || 0)
  ));
  const relevantRegistrations = managesCommunity
    ? sortedRegistrations.filter((item) => pendingPattern.test(String(item.status || '')))
    : sortedRegistrations.filter((item) => String(item.email || '').trim().toLowerCase() === currentEmail);
  const headerNotifications = [
    ...relevantRegistrations.map((item, index) => ({
      id: `registration-${item.id || item.registrationId || index}`,
      type: 'registration',
      title: managesCommunity
        ? 'Registration needs review'
        : pendingPattern.test(String(item.status || '')) ? 'Registration awaiting approval' : 'Registration updated',
      detail: `${item.program || item.eventTitle || item.registrationType || 'Community program'}${managesCommunity && (item.parentName || item.registeredName || item.name || item.email) ? ` - ${item.parentName || item.registeredName || item.name || item.email}` : ''}`,
      href: managesCommunity
        ? (/class|paata|shaale|dance|music|guitar/i.test(`${item.registrationType || ''} ${item.program || ''}`)
          ? '/admin/registration-classes'
          : '/admin/registrations')
        : '/admin'
    })),
    ...(managesCommunity ? notificationActivity.volunteers
      .filter((item) => pendingPattern.test(String(item.status || 'pending')))
      .map((item, index) => ({
        id: `volunteer-${item.id || item.email || index}`,
        type: 'volunteer',
        title: 'Volunteer request awaiting review',
        detail: item.name || item.email || 'A member submitted a volunteer request.',
        href: '/admin/volunteer-interest'
      })) : []),
    ...(managesCommunity ? notificationActivity.users
      .filter((item) => item.enabled === false || pendingPattern.test(String(item.status || '')))
      .map((item, index) => ({
        id: `access-${item.id || item.email || index}`,
        type: 'access',
        title: 'Access request needs review',
        detail: item.name || item.email || 'A member is waiting for access.',
        href: '/admin/role-access'
      })) : []),
    ...activeAnnouncements.map((item, index) => ({
      id: `announcement-${announcementKey(item, index)}`,
      type: 'announcement',
      title: item.title || item.text || 'Community update',
      detail: item.title && item.text ? item.text : '',
      href: getAnnouncementHref(item) || '/admin'
    })),
    ...(!managesCommunity && !(memberProfile.phone || user?.phone) ? [{
      id: 'profile-completion',
      type: 'profile',
      title: 'Complete your account',
      detail: 'Add and verify your phone number to finish setup.',
      href: '/admin/profile'
    }] : [])
  ];

  function notificationIcon(type) {
    if (type === 'registration') return <ClipboardCheck size={15} />;
    if (type === 'volunteer') return <HeartHandshake size={15} />;
    if (type === 'access' || type === 'profile') return <UserCircle size={15} />;
    if (type === 'announcement') return <Megaphone size={15} />;
    return <CheckCircle2 size={15} />;
  }

  function toggleNotifications() {
    setNotificationOpen((current) => !current);
    setProfileOpen(false);
  }

  const isAdminRoute = location.pathname.startsWith('/admin');
  const showSiteMessage = !isAdminRoute && isEnabledValue(siteMessage.enabled) && siteMessage.title && siteMessage.message;
  const adminInitials = [
    memberProfile.firstName || user?.firstName || user?.name?.split(' ')?.[0],
    memberProfile.lastName || user?.lastName || user?.name?.split(' ')?.slice(1).join(' ')
  ]
    .filter(Boolean)
    .map((part) => String(part).trim().charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || String(user?.email || 'KB').slice(0, 2).toUpperCase();
  const adminPageTitle = adminPageTitles[location.pathname]
    || Object.entries(adminPageTitles).find(([path]) => path !== '/admin' && location.pathname.startsWith(`${path}/`))?.[1]
    || 'Dashboard';
  const rawAdminRole = String(user?.role || user?.roles?.[0] || 'Member');
  const adminRoleLabel = /super.?admin/i.test(rawAdminRole) ? 'Super Admin' : /admin/i.test(rawAdminRole) ? 'Admin' : rawAdminRole;

  function handleAdminSearch(event) {
    event.preventDefault();
    const query = adminSearch.trim();
    navigate(query ? `/admin/user-search?query=${encodeURIComponent(query)}` : '/admin/user-search');
  }

  const profileMenu = user ? (
    <div className={`nav-profile-menu${isAdminRoute ? '' : ' public-profile-menu'}`}>
      <button
        ref={profileButtonRef}
        className="nav-profile-button"
        type="button"
        aria-label="Open profile menu"
        aria-expanded={profileOpen}
        onClick={() => { setNotificationOpen(false); setProfileOpen((value) => !value); }}
      >
        {memberProfile.photo ? <img src={memberProfile.photo} alt="" /> : isAdminRoute ? <span>{adminInitials}</span> : <UserCircle size={24} />}
        {isAdminRoute && <b className="admin-profile-role">{adminRoleLabel}</b>}
        {isAdminRoute && <ChevronDown className="admin-profile-chevron" size={15} />}
      </button>
      {profileOpen && (
        <div
          ref={profileDropdownRef}
          className={`nav-profile-dropdown${profileMenuPosition ? ' is-positioned' : ''}`}
          style={profileMenuPosition ? {
            '--profile-menu-top': `${profileMenuPosition.top}px`,
            '--profile-menu-left': `${profileMenuPosition.left}px`,
            '--profile-menu-width': `${profileMenuPosition.width}px`
          } : undefined}
        >
          <Link to="/admin/profile" onClick={() => { setOpen(false); setProfileOpen(false); }}>
            <UserCircle size={17} /> Profile
          </Link>
          <button type="button" onClick={handleLogout}>
            <LogOut size={17} /> {t('navLogout')}
          </button>
        </div>
      )}
    </div>
  ) : null;

  const loginLink = (
    <NavLink className="nav-login" to="/login" onClick={() => setOpen(false)}>
      <LogIn size={17} /> {t('navLogin')}
    </NavLink>
  );

  return (
    <div className={isAdminRoute ? 'site-shell is-admin-route' : 'site-shell'}>
      <PageLoader active={routeLoading} />
      <header className={isAdminRoute ? 'site-header admin-site-header' : 'site-header'}>
        {isAdminRoute && <h1 className="admin-toolbar-title">{adminPageTitle}</h1>}
        {isAdminRoute && <div className="admin-toolbar-actions">
          <form className="admin-toolbar-search" role="search" onSubmit={handleAdminSearch}>
            <Search size={17} aria-hidden="true" />
            <input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Search members, events..." aria-label="Search members and events" />
          </form>
          <Link className="admin-view-site" to="/"><Globe2 size={17} />View website</Link>
        </div>}
        {!isAdminRoute && (
          <Link className="brand" to="/" onClick={() => setOpen(false)}>
            <>
              <img className="brand-logo" src="/assets/kannada-bharati-logo.png" alt="Kannada Bharati logo" />
              <span>
                <strong>ಕನ್ನಡ ಭಾರತಿ</strong>
                <small>Kannada Bharati</small>
              </span>
            </>
          </Link>
        )}

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
            <NavLink
              key={href}
              to={href}
              className={({ isActive }) => `${href === '/donate' ? 'nav-donate' : ''}${isActive ? ' active' : ''}`.trim() || undefined}
              onClick={() => setOpen(false)}
            >
              {href === '/donate' && <HeartHandshake size={17} />}
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
          {user && isAdminRoute && (
            <div className="admin-notification-menu">
              <button
                className="admin-notification-button"
                type="button"
                aria-label="Open notifications"
                aria-expanded={notificationOpen}
                onClick={toggleNotifications}
              >
                <BellRing size={19} />
                {headerNotifications.length > 0 && <span>{Math.min(headerNotifications.length, 99)}</span>}
              </button>
              {notificationOpen && (
                <aside className="admin-notification-dropdown" aria-label="Notifications">
                  <div className="admin-notification-heading"><strong>Notifications</strong><small>{headerNotifications.length} active</small></div>
                  <div className="admin-notification-items">
                    {headerNotifications.slice(0, 5).map((item) => (
                      <Link to={item.href} key={item.id} onClick={() => setNotificationOpen(false)}>
                        <span>{notificationIcon(item.type)}</span>
                        <div><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</div>
                      </Link>
                    ))}
                    {headerNotifications.length === 0 && <p>You're all caught up.</p>}
                  </div>
                  <Link to="/admin" onClick={() => setNotificationOpen(false)}>View dashboard <ChevronDown size={14} /></Link>
                </aside>
              )}
            </div>
          )}
          {isAdminRoute && (profileMenu || loginLink)}
          {!isAdminRoute && !user && loginLink}
        </nav>
        {!isAdminRoute && profileMenu}
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
