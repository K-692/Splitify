import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/Login/LoginPage';
import { HomePage } from '@/pages/Home/HomePage';
import { EventDetailsPage } from '@/pages/EventDetails/EventDetailsPage';
import { FriendsPage } from '@/pages/Friends/FriendsPage';
import { NotificationsPage } from '@/pages/Notifications/NotificationsPage';
import { ProfilePage } from '@/pages/Profile/ProfilePage';
import { JoinPage } from '@/pages/Join/JoinPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0D1B2A]">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AppRouter: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join/:token" element={<JoinPage />} />

        {/* Protected App Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="events" element={<Navigate to="/" replace />} />
          <Route path="events/:eventId" element={<EventDetailsPage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};
