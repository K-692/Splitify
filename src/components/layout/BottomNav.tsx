import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Users, Bell, User } from 'lucide-react';
import { useNotifications } from '@/app/providers/NotificationContext';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  const links = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Events', path: '/events', icon: Calendar },
    { label: 'Friends', path: '/friends', icon: Users },
    { label: 'Inbox', path: '/notifications', icon: Bell, badge: unreadCount },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0D1B2A]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe transition-colors">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            link.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col items-center justify-center gap-1 transition-all relative ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                {Boolean(link.badge && link.badge > 0) && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-[#F36B2C] text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#0D1B2A]">
                    {link.badge! > 9 ? '9+' : link.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{link.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-teal-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
