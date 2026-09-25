import { NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardCheck,
  Gauge,
  HandCoins,
  Megaphone,
  ShieldCheck,
  UserCog
} from 'lucide-react';
import { getCurrentUser, isAdmin } from '../utils/storage.js';

const groups = [
  {
    title: 'Account',
    icon: UserCog,
    links: [{ label: 'Profile', to: '/admin/profile' }]
  },
  {
    title: 'Reception',
    icon: ClipboardCheck,
    links: [{ label: 'CheckInNew', to: '/admin/registrations' }]
  },
  {
    title: 'Volunteer',
    icon: HandCoins,
    links: [{ label: 'Expense', to: '/admin/expense' }]
  },
  {
    title: 'Admin',
    icon: ShieldCheck,
    links: [
      { label: 'User', to: '/admin/users' },
      { label: 'Event', to: '/admin/events' },
      { label: 'Announcement', to: '/admin/announcements' },
      { label: 'Fund Raising', to: '/admin/fundraising' },
      { label: 'Registration', to: '/admin/registrations' },
      { label: 'Student View', to: '/admin/student-view' }
    ]
  }
];

export default function AdminShell() {
  const user = getCurrentUser();

  if (!isAdmin(user)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-app-shell">
      <aside className="admin-side-menu">
        <NavLink className="admin-side-root" to="/admin">
          <Gauge size={18} /> Dashboard
        </NavLink>
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.title}>
              <h3><Icon size={17} /> {group.title}</h3>
              <nav>
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
