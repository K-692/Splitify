import React from 'react';
import { AuthProvider } from '@/app/providers/AuthContext';
import { ThemeProvider } from '@/app/providers/ThemeContext';
import { NotificationProvider } from '@/app/providers/NotificationContext';
import { AppRouter } from '@/app/router';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppRouter />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
