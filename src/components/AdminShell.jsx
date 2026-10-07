import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Banknote,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Gauge,
  GraduationCap,
  HandCoins,
  Info,
  Images,
  KeyRound,
  Mail,
  Menu,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  UserCog,
  Wrench,
  X
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { canAccessAdminPath, canUseAdminArea, defaultAdminPath, getCurrentUser, hasAnyRole, isAdmin } from '../utils/storage.js';

const groups = [
  {
    title: 'Account',
    icon: UserCog,
    links: [{ label: 'Profile', to: '/admin/profile', icon: UserCog }]
  },
  {
    title: 'Welcome Desk',
    icon: ClipboardCheck,
    roles: ['admin', 'superadmin', 'welcomeDesk', 'welcomedesk', 'receptionist'],
    links: [
      { label: 'Check-in', to: '/admin/checkin', icon: ClipboardCheck },
      { label: 'Guest Check-in', to: '/admin/guest-checkin', icon: UserCog },
      { label: 'Seat Management', to: '/admin/seats', icon: Gauge }
    ]
  },
  {
    title: 'Volunteer',
    icon: HandCoins,
    roles: ['admin', 'superadmin', 'volunteer'],
    links: [{ label: 'Expense', to: '/admin/expense', icon: HandCoins }]
  },
  {
    title: 'Teacher',
    icon: BookOpen,
    roles: ['admin', 'superadmin', 'teacher'],
    links: [
      { label: 'Class Area', to: '/admin/teacher', icon: BookOpen },
      { label: 'Attendance', to: '/admin/teacher-attendance', icon: ClipboardCheck }
    ]
  },
  {
    title: 'Treasurer',
    icon: Banknote,
    roles: ['admin', 'superadmin', 'treasurer'],
    links: [{ label: 'Expense Review', to: '/admin/treasurer', icon: Banknote }]
  },
  {
    title: 'Event Registration',
    icon: ClipboardCheck,
    roles: ['admin', 'superadmin'],
    links: [
      { label: 'Class Details', to: '/admin/registration-classes', icon: BookOpen },
      { label: 'Event Details', to: '/admin/registrations', icon: ClipboardCheck },
      { label: 'Payment Details', to: '/admin/registration-payments', icon: Banknote }
    ]
  },
  {
    title: 'Admin',
    icon: ShieldCheck,
    roles: ['admin', 'superadmin'],
    links: [
      { label: 'User', to: '/admin/users', icon: UserCog },
      { label: 'Find User', to: '/admin/user-search', icon: Search },
      { label: 'Roles & Access', to: '/admin/role-access', icon: KeyRound },
      { label: 'Classes', to: '/admin/classes', icon: BookOpen },
      { label: 'Event', to: '/admin/events', icon: ClipboardCheck },
      { label: 'Event Settings', to: '/admin/event-settings', icon: Wrench },
      { label: 'Event Hero Photos', to: '/admin/event-hero', icon: Images },
      { label: 'Teacher Allotment', to: '/admin/teacher-allotments', icon: GraduationCap },
      { label: 'Announcement', to: '/admin/announcements', icon: Megaphone },
      { label: 'About Us', to: '/admin/about', icon: Info },
      { label: 'Paata Teachers', to: '/admin/paata-teachers', icon: BookOpen },
      { label: 'Fund Raising', to: '/admin/fundraising', icon: HandCoins },
      { label: 'Donations', to: '/admin/donations', icon: Banknote },
      { label: 'Messages', to: '/admin/messages', icon: Mail },
      { label: 'Volunteer Interest', to: '/admin/volunteer-interest', icon: HandCoins },
      { label: 'Student View', to: '/admin/student-view', icon: BookOpen },
      { label: 'Email Outbox', to: '/admin/email-outbox', icon: Mail },
      { label: 'Developer Tools', to: '/admin/developer', icon: Wrench }
    ]
  }
];

export default function AdminShell() {
  const user = getCurrentUser();
  const location = useLocation();
  const { tr } = useLanguage();
  const userAccessKey = `${user?.email || ''}:${user?.role || ''}:${Array.isArray(user?.roles) ? user.roles.join(',') : ''}`;
  const visibleGroups = useMemo(() => groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => canAccessAdminPath(user, link.to))
    }))
    .filter((group) => group.links.length && (!group.roles || isAdmin(user) || hasAnyRole(user, group.roles) || group.links.some((link) => canAccessAdminPath(user, link.to)))),
    [userAccessKey]
  );
  const activeGroupTitle = visibleGroups.find((group) => group.links.some((link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)))?.title;
  const activeLinkLabel = visibleGroups
    .flatMap((group) => group.links)
    .find((link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`))?.label || 'Dashboard';
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(groups.map((group) => group.title)));
  const [sideCollapsed, setSideCollapsed] = useState(() => localStorage.getItem('kb-admin-side-collapsed') === 'true');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setCollapsedGroups(new Set(visibleGroups.filter((group) => group.title !== activeGroupTitle).map((group) => group.title)));
  }, [activeGroupTitle, visibleGroups]);

  useEffect(() => {
    localStorage.setItem('kb-admin-side-collapsed', sideCollapsed ? 'true' : 'false');
  }, [sideCollapsed]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!canUseAdminArea(user)) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessAdminPath(user, location.pathname)) {
    return <Navigate to={defaultAdminPath(user)} replace />;
  }

  function isGroupOpen(group) {
    return group.title === activeGroupTitle || !collapsedGroups.has(group.title);
  }

  function toggleGroup(groupTitle) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupTitle)) next.delete(groupTitle);
      else next.add(groupTitle);
      return next;
    });
  }

  return (
    <div className={sideCollapsed ? 'admin-app-shell side-collapsed' : 'admin-app-shell'}>
      <aside className={mobileMenuOpen ? 'admin-side-menu is-mobile-open' : 'admin-side-menu'}>
        <div className="admin-mobile-nav-header">
          <button
            className="admin-mobile-menu-toggle"
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-navigation-panel"
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            <span>
              <small>{tr('Admin menu')}</small>
              <strong>{tr(activeLinkLabel)}</strong>
            </span>
          </button>
        </div>
        <div className="admin-side-menu-content" id="admin-navigation-panel">
          <div className="admin-kannada-motto" title="ಕನ್ನಡವೇ ಸತ್ಯ, ಕನ್ನಡವೇ ನಿತ್ಯ">
            <span>ಕನ್ನಡವೇ ಸತ್ಯ, ಕನ್ನಡವೇ ನಿತ್ಯ</span>
          </div>
          <button
            className="admin-side-collapse"
            type="button"
            aria-label={tr(sideCollapsed ? 'Expand side panel' : 'Collapse side panel')}
            title={tr(sideCollapsed ? 'Expand side panel' : 'Collapse side panel')}
            onClick={() => setSideCollapsed((value) => !value)}
          >
            {sideCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <NavLink className="admin-side-root" to="/admin" title={sideCollapsed ? tr('Dashboard') : undefined}>
            <Gauge size={18} /> <span className="admin-nav-label">{tr('Dashboard')}</span>
          </NavLink>
          {visibleGroups.map((group) => {
            const Icon = group.icon;
            const open = isGroupOpen(group);
            return (
              <section key={group.title} className={open ? 'admin-nav-group is-open' : 'admin-nav-group'} data-label={tr(group.title)}>
                <button
                  className="admin-nav-group-toggle"
                  type="button"
                  aria-expanded={open}
                  aria-controls={`admin-nav-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => toggleGroup(group.title)}
                  title={sideCollapsed ? tr(group.title) : undefined}
                >
                  <Icon className="admin-nav-main-icon" size={17} />
                  <span className="admin-nav-label">{tr(group.title)}</span>
                  <ChevronDown size={16} />
                </button>
                <nav
                  id={`admin-nav-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                  className={open ? 'admin-nav-links is-open' : 'admin-nav-links is-collapsed'}
                >
                  {group.links.map((link) => {
                    const LinkIcon = link.icon || group.icon;
                    return (
                      <NavLink key={link.to} to={link.to} end={link.to === '/admin'} title={sideCollapsed ? tr(link.label) : undefined}>
                        <LinkIcon size={16} />
                        <span>{tr(link.label)}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </section>
            );
          })}
        </div>
      </aside>
      {mobileMenuOpen && (
        <button
          className="admin-mobile-nav-backdrop"
          type="button"
          aria-label={tr('Close admin menu')}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <main className="admin-route-content">
        <Outlet />
      </main>
    </div>
  );
}
