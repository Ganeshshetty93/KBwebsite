import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Gauge, Globe2, HeartHandshake, LogIn, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from './context/LanguageContext.jsx';
import { getCurrentUser, isAdmin, setCurrentUser } from './utils/storage.js';
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
  const [user, setUser] = useState(() => getCurrentUser());
  const [routeLoading, setRouteLoading] = useState(true);
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function syncUser() {
      setUser(getCurrentUser());
    }

    window.addEventListener('kb-auth-change', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('kb-auth-change', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    setRouteLoading(true);
    const timer = window.setTimeout(() => setRouteLoading(false), 520);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  function handleLogout() {
    setCurrentUser(null);
    setOpen(false);
    navigate('/');
  }

  return (
    <div className="site-shell">
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
            <button className="nav-tool" type="button" onClick={handleLogout}>
              <LogOut size={17} /> {t('navLogout')}
            </button>
          ) : (
            <NavLink className="nav-login" to="/login" onClick={() => setOpen(false)}>
              <LogIn size={17} /> {t('navLogin')}
            </NavLink>
          )}
        </nav>
      </header>

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
