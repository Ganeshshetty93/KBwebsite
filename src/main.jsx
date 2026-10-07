import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
import { LanguageProvider } from './context/LanguageContext.jsx';
import PageLoader from './components/PageLoader.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Classes = lazy(() => import('./pages/Classes.jsx'));
const KannadaShaale = lazy(() => import('./pages/KannadaShaale.jsx'));
const Events = lazy(() => import('./pages/Events.jsx'));
const Donate = lazy(() => import('./pages/Donate.jsx'));
const Volunteer = lazy(() => import('./pages/Volunteer.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const Calendar = lazy(() => import('./pages/Calendar.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const SportsDayRules = lazy(() => import('./pages/SportsDayRules.jsx'));
const WebRequirements = lazy(() => import('./pages/WebRequirements.jsx'));
const KannadaLiterature = lazy(() => import('./pages/KannadaLiterature.jsx'));
const AdminShell = lazy(() => import('./components/AdminShell.jsx'));
const AdminSectionPage = lazy(() => import('./pages/AdminSectionPage.jsx'));
const EventHeroManager = lazy(() => import('./pages/EventHeroManager.jsx'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader active label="Loading Kannada Bharati" />}>
          <Routes>
            <Route element={<App />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="classes" element={<Classes />} />
              <Route path="kannada-shaale" element={<KannadaShaale />} />
              <Route path="events" element={<Events />} />
              <Route path="donate" element={<Donate />} />
              <Route path="volunteer" element={<Volunteer />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="profile" element={<Navigate to="/admin/profile" replace />} />
              <Route path="contact" element={<Contact />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="kannada-literature" element={<KannadaLiterature />} />
              <Route path="kannada-sahitya" element={<KannadaLiterature />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="privacypolicy" element={<Privacy />} />
              <Route path="terms" element={<Privacy />} />
              <Route path="termsofuse" element={<Privacy />} />
              <Route path="sportsdayrules" element={<SportsDayRules />} />
              <Route path="sports-rules" element={<SportsDayRules />} />
              <Route path="webrequirements" element={<WebRequirements />} />
              <Route path="web-requirements" element={<WebRequirements />} />
              <Route path="admin" element={<AdminShell />}>
                <Route index element={<AdminSectionPage view="dashboard" />} />
                <Route path="profile" element={<Profile />} />
                <Route path="register-member" element={<AdminSectionPage view="register-member" />} />
                <Route path="expense" element={<AdminSectionPage view="expense" />} />
                <Route path="users" element={<AdminSectionPage view="users" />} />
                <Route path="role-access" element={<AdminSectionPage view="role-access" />} />
                <Route path="classes" element={<AdminSectionPage view="classes" />} />
                <Route path="events" element={<AdminSectionPage view="events" />} />
                <Route path="event-settings" element={<AdminSectionPage view="event-settings" />} />
                <Route path="event-hero" element={<EventHeroManager />} />
                <Route path="teacher-allotments" element={<AdminSectionPage view="teacher-allotments" />} />
                <Route path="announcements" element={<AdminSectionPage view="announcements" />} />
                <Route path="about" element={<AdminSectionPage view="about" />} />
                <Route path="paata-teachers" element={<AdminSectionPage view="paata-teachers" />} />
                <Route path="fundraising" element={<AdminSectionPage view="fundraising" />} />
                <Route path="donations" element={<AdminSectionPage view="donations" />} />
                <Route path="messages" element={<AdminSectionPage view="messages" />} />
                <Route path="volunteer-interest" element={<AdminSectionPage view="volunteer-interest" />} />
                <Route path="checkin" element={<AdminSectionPage view="checkin" />} />
                <Route path="guest-checkin" element={<AdminSectionPage view="guest-checkin" />} />
                <Route path="seats" element={<AdminSectionPage view="seats" />} />
                <Route path="teacher" element={<AdminSectionPage view="teacher" />} />
                <Route path="teacher-attendance" element={<AdminSectionPage view="teacher-attendance" />} />
                <Route path="treasurer" element={<AdminSectionPage view="treasurer" />} />
                <Route path="user-search" element={<AdminSectionPage view="user-search" />} />
                <Route path="email-outbox" element={<AdminSectionPage view="email-outbox" />} />
                <Route path="developer" element={<AdminSectionPage view="developer" />} />
                <Route path="registrations" element={<AdminSectionPage view="registrations" />} />
                <Route path="registration-classes" element={<AdminSectionPage view="registration-classes" />} />
                <Route path="registration-payments" element={<AdminSectionPage view="registration-payments" />} />
                <Route path="student-view" element={<AdminSectionPage view="student-view" />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
