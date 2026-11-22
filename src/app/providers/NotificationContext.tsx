import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppNotification } from '@/types';
import { dataService } from '@/services/dataService';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  /** True once the first snapshot for the signed-in user has arrived */
  loaded: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendReminder: (debtorUid: string, amountMinor: number, eventName: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (!user) {
      setNotifications([]);
      return;
    }

    const unsubscribe = dataService.subscribeNotifications(user.uid, (items) => {
      setNotifications(items);
      setLoaded(true);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    if (!user) return;
    await dataService.markNotificationRead(user.uid, id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await dataService.markAllNotificationsRead(user.uid);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const sendReminder = async (debtorUid: string, amountMinor: number, eventName: string) => {
    if (!user) return;
    await dataService.sendPaymentReminder(debtorUid, amountMinor, eventName, user);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loaded,
        unreadCount,
        markAsRead,
        markAllAsRead,
        sendReminder,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
