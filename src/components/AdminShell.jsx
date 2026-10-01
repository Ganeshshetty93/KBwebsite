import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Banknote,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Gauge,
  HandCoins,
  Mail,
  Megaphone,
  Search,
  ShieldCheck,
  UserCog,
  Wrench
} from 'lucide-react';
import { canUseAdminArea, getCurrentUser, hasAnyRole, isAdmin } from '../utils/storage.js';

const groups = [
  {
    title: 'Account',
    icon: UserCog,
    links: [{ label: 'Profile', to: '/admin/profile' }]
  },
  {
    title: 'Reception',
    icon: ClipboardCheck,
    roles: ['admin', 'superadmin', 'receptionist'],
    links: [
      { label: 'CheckInNew', to: '/admin/checkin' },
      { label: 'Guest Check-in', to: '/admin/guest-checkin' },
      { label: 'Seat Management', to: '/admin/seats' }
    ]
  },
  {
    title: 'Volunteer',
    icon: HandCoins,
    roles: ['admin', 'superadmin', 'volunteer'],
    links: [{ label: 'Expense', to: '/admin/expense' }]
  },
  {
    title: 'Teacher',
    icon: BookOpen,
    roles: ['admin', 'superadmin', 'teacher'],
    links: [{ label: 'Class Area', to: '/admin/teacher' }]
  },
  {
    title: 'Treasurer',
    icon: Banknote,
    roles: ['admin', 'superadmin', 'treasurer'],
    links: [{ label: 'Expense Review', to: '/admin/treasurer' }]
  },
  {
    title: 'Admin',
    icon: ShieldCheck,
    roles: ['admin', 'superadmin'],
    links: [
      { label: 'User', to: '/admin/users' },
      { label: 'Find User', to: '/admin/user-search', icon: Search },
      { label: 'Event', to: '/admin/events' },
      { label: 'Event Settings', to: '/admin/event-settings' },
      { label: 'Announcement', to: '/admin/announcements' },
      { label: 'Fund Raising', to: '/admin/fundraising' },
      { label: 'Donations', to: '/admin/donations' },
      { label: 'Messages', to: '/admin/messages' },
      { label: 'Volunteer Interest', to: '/admin/volunteer-interest' },
      { label: 'Registration', to: '/admin/registrations' },
      { label: 'Student View', to: '/admin/student-view' },
      { label: 'Email Outbox', to: '/admin/email-outbox', icon: Mail },
      { label: 'Developer Tools', to: '/admin/developer', icon: Wrench }
    ]
  }
];

export default function AdminShell() {
  const user = getCurrentUser();
  const location = useLocation();
  const userAccessKey = `${user?.email || ''}:${user?.role || ''}:${Array.isArray(user?.roles) ? user.roles.join(',') : ''}`;
  const visibleGroups = useMemo(
    () => groups.filter((group) => !group.roles || isAdmin(user) || hasAnyRole(user, group.roles)),
    [userAccessKey]
  );
  const activeGroupTitle = visibleGroups.find((group) => group.links.some((link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)))?.title;
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(groups.map((group) => group.title)));

  useEffect(() => {
    setCollapsedGroups(new Set(visibleGroups.filter((group) => group.title !== activeGroupTitle).map((group) => group.title)));
  }, [activeGroupTitle, visibleGroups]);

  if (!canUseAdminArea(user)) {
    return <Navigate to="/login" replace />;
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
    <div className="admin-app-shell">
      <aside className="admin-side-menu">
        <NavLink className="admin-side-root" to="/admin">
          <Gauge size={18} /> Dashboard
        </NavLink>
        {visibleGroups.map((group) => {
          const Icon = group.icon;
          const open = isGroupOpen(group);
          return (
            <section key={group.title} className={open ? 'admin-nav-group is-open' : 'admin-nav-group'}>
              <button
                className="admin-nav-group-toggle"
                type="button"
                aria-expanded={open}
                aria-controls={`admin-nav-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => toggleGroup(group.title)}
              >
                <span><Icon size={17} /> {group.title}</span>
                <ChevronDown size={16} />
              </button>
              <nav
                id={`admin-nav-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                className={open ? 'admin-nav-links is-open' : 'admin-nav-links is-collapsed'}
              >
                {group.links.map((link) => (
                  <NavLink key={link.to} to={link.to} end={link.to === '/admin'}>
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </section>
          );
        })}
      </aside>
      <main className="admin-route-content">
        <Outlet />
      </main>
    </div>
  );
}
