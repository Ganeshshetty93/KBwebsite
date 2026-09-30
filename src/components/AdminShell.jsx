import { NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  Banknote,
  BookOpen,
  ClipboardCheck,
  Gauge,
  HandCoins,
  Mail,
  Megaphone,
  Search,
  ShieldCheck,
  UserCog
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
      { label: 'Email Outbox', to: '/admin/email-outbox', icon: Mail }
    ]
  }
];

export default function AdminShell() {
  const user = getCurrentUser();

  if (!canUseAdminArea(user)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-app-shell">
      <aside className="admin-side-menu">
        <NavLink className="admin-side-root" to="/admin">
          <Gauge size={18} /> Dashboard
        </NavLink>
        {groups.filter((group) => !group.roles || isAdmin(user) || hasAnyRole(user, group.roles)).map((group) => {
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
