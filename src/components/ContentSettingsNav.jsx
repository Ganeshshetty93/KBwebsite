import { NavLink } from 'react-router-dom';
import { CalendarDays, GalleryHorizontal, Image, Megaphone, Settings, UserRoundCog, UsersRound } from 'lucide-react';

export const contentSettingsRoutes = [
  { label: 'Events', to: '/admin/events', icon: CalendarDays },
  { label: 'Event Settings', to: '/admin/event-settings', icon: Settings },
  { label: 'Gallery', to: '/admin/event-hero', icon: Image },
  { label: 'Announcements', to: '/admin/announcements', icon: Megaphone },
  { label: 'About', to: '/admin/about', icon: UserRoundCog },
  { label: 'Paata Teachers', to: '/admin/paata-teachers', icon: UsersRound }
];

export const contentSettingsTitles = new Set([
  'Manage events',
  'Manage event dropdowns',
  'Manage announcements',
  'About page content',
  'Paata teacher details'
]);

export default function ContentSettingsNav() {
  return (
    <nav className="content-settings-tabs" aria-label="Content and settings sections">
      {contentSettingsRoutes.map((item) => {
        const Icon = item.icon || GalleryHorizontal;
        return (
          <NavLink key={item.to} to={item.to}>
            <Icon size={21} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
