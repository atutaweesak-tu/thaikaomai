/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PopupBanner from './components/PopupBanner';
import SiteNoticeBar from './components/SiteNoticeBar';
import ScrollToTop from './components/ScrollToTop';
import ScrollProgress from './components/ScrollProgress';
import ThemeApplier from './components/ThemeApplier';
import HomePage from './pages/HomePage';

const AboutPage = lazy(() => import('./pages/AboutPage'));
const PoliciesPage = lazy(() => import('./pages/PoliciesPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const TeamDetailPage = lazy(() => import('./pages/TeamDetailPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const NewsDetailPage = lazy(() => import('./pages/NewsDetailPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const PollsPage = lazy(() => import('./pages/PollsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const VolunteerPage = lazy(() => import('./pages/VolunteerPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <ScrollProgress />
          <ThemeApplier />
          <div className="min-h-screen flex flex-col">
            <ErrorBoundary fallback={null}>
              <PopupBanner />
            </ErrorBoundary>
            <ErrorBoundary fallback={null}>
              <SiteNoticeBar />
            </ErrorBoundary>
            <Navbar />
            <div className="flex-grow">
              <Suspense fallback={<div className="min-h-[60vh]" />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/policies" element={<PoliciesPage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/team/:id" element={<TeamDetailPage />} />
                  <Route path="/news" element={<NewsPage />} />
                  <Route path="/news/:id" element={<NewsDetailPage />} />
                  <Route path="/events/:id" element={<EventDetailPage />} />
                  <Route path="/polls" element={<PollsPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/volunteer" element={<VolunteerPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </div>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
