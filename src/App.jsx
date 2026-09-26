import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Gauge, Globe2, HeartHandshake, LogIn, LogOut, Menu, UserCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from './context/LanguageContext.jsx';
import { getCurrentUser, isAdmin, readJson, setCurrentUser } from './utils/storage.js';
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

export default function App() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());
  const [memberProfile, setMemberProfile] = useState(() => {
    const current = getCurrentUser();
    return current?.email ? readJson(`kb-member-profile-${current.email.toLowerCase()}`, {}) : {};
  });
  const [announcements, setAnnouncements] = useState(() => readJson('kb-announcement-submissions', []));
  const [routeLoading, setRouteLoading] = useState(true);
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
    function syncData() {
      setAnnouncements(readJson('kb-announcement-submissions', []));
      const current = getCurrentUser();
      setMemberProfile(current?.email ? readJson(`kb-member-profile-${current.email.toLowerCase()}`, {}) : {});
    }

    window.addEventListener('kb-data-change', syncData);
    window.addEventListener('storage', syncData);
    return () => {
      window.removeEventListener('kb-data-change', syncData);
      window.removeEventListener('storage', syncData);
    };
  }, []);

  useEffect(() => {
    setRouteLoading(true);
    setProfileOpen(false);
    const timer = window.setTimeout(() => setRouteLoading(false), 520);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  function handleLogout() {
    setCurrentUser(null);
    setOpen(false);
    setProfileOpen(false);
    navigate('/');
  }

  const today = new Date().toISOString().slice(0, 10);
  const activeAnnouncements = announcements.filter((item) => {
    const enabled = item.enabled === true || item.enabled === 'Yes' || item.enabled === 'yes';
    const starts = !item.startOn || item.startOn <= today;
    const ends = !item.endOn || item.endOn >= today;
    return enabled && starts && ends;
  });

  const isAdminRoute = location.pathname.startsWith('/admin');

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
          {isAdmin(user) && (
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
                  <Link to="/profile" onClick={() => { setOpen(false); setProfileOpen(false); }}>
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

      {activeAnnouncements.length > 0 && (
        <section className="announcement-strip" aria-label="Kannada Bharati announcements">
          {activeAnnouncements.slice(0, 2).map((item, index) => (
            <article key={`${item.text}-${index}`}>
              <strong>{item.text}</strong>
              {item.ctaUrl && <Link to={item.ctaUrl}>{item.ctaText || 'Learn more'}</Link>}
            </article>
          ))}
        </section>
      )}

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <div>
          <strong>ಕನ್ನಡ ಭಾರತಿ</strong>
          <p>{t('footerLine')}</p>
        </div>
        <div className="footer-actions">
          <Link className="footer-link" to="/volunteer">
            <HeartHandshake size={18} /> {t('navVolunteer')}
          </Link>
          <Link className="footer-link" to="/donate">{t('navDonate')}</Link>
          {isAdmin(user) && <Link className="footer-link" to="/admin">{t('navDashboard')}</Link>}
          <Link className="footer-link" to="/login">{t('memberLogin')}</Link>
        </div>
      </footer>
    </div>
  );
}
