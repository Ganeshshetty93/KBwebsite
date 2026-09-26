import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
import { LanguageProvider } from './context/LanguageContext.jsx';

import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Classes from './pages/Classes.jsx';
import KannadaShaale from './pages/KannadaShaale.jsx';
import Events from './pages/Events.jsx';
import Donate from './pages/Donate.jsx';
import Volunteer from './pages/Volunteer.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import Contact from './pages/Contact.jsx';
import AdminShell from './components/AdminShell.jsx';
import AdminSectionPage from './pages/AdminSectionPage.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
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
            <Route path="profile" element={<Profile />} />
            <Route path="contact" element={<Contact />} />
            <Route path="admin" element={<AdminShell />}>
              <Route index element={<AdminSectionPage view="dashboard" />} />
              <Route path="profile" element={<AdminSectionPage view="profile" />} />
              <Route path="register-member" element={<AdminSectionPage view="register-member" />} />
              <Route path="expense" element={<AdminSectionPage view="expense" />} />
              <Route path="users" element={<AdminSectionPage view="users" />} />
              <Route path="events" element={<AdminSectionPage view="events" />} />
              <Route path="event-settings" element={<AdminSectionPage view="event-settings" />} />
              <Route path="announcements" element={<AdminSectionPage view="announcements" />} />
              <Route path="fundraising" element={<AdminSectionPage view="fundraising" />} />
              <Route path="donations" element={<AdminSectionPage view="donations" />} />
              <Route path="messages" element={<AdminSectionPage view="messages" />} />
              <Route path="volunteer-interest" element={<AdminSectionPage view="volunteer-interest" />} />
              <Route path="checkin" element={<AdminSectionPage view="checkin" />} />
              <Route path="registrations" element={<AdminSectionPage view="registrations" />} />
              <Route path="student-view" element={<AdminSectionPage view="student-view" />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
