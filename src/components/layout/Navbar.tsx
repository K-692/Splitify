import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { useTheme } from '@/app/providers/ThemeContext';
import { useNotifications } from '@/app/providers/NotificationContext';
import { Avatar } from '@/components/common/Avatar';
import {
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  PlusCircle,
  Home,
  Calendar,
  Users,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Events', path: '/events', icon: Calendar },
    { label: 'Friends', path: '/friends', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#0D1B2A]/85 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/80 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <Link to="/" className="flex items-center gap-3 group select-none">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform bg-[#203D62] flex items-center justify-center p-0.5">
            <img
              src="./assets/splitify-logo.png"
              alt="Splitify Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-[#203D62] dark:text-white flex items-center gap-0.5">
              Split<span className="text-teal-500">ify</span>
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              link.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl font-bold text-sm transition-all ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-500' : ''}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Create Event Button */}
          {user && (
            <button
              onClick={() => navigate('/events?action=create')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs shadow-sm transition-transform active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Event</span>
            </button>
          )}

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-slate-600" />
            ) : (
              <Sun className="w-5 h-5 text-amber-400" />
            )}
          </button>

          {/* Notifications Bell */}
          {user && (
            <Link
              to="/notifications"
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-[#F36B2C] text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#0D1B2A] animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* User Menu Dropdown */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
              >
                <Avatar
                  src={user.photoURL}
                  name={user.displayName}
                  size="sm"
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#15263C] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold truncate">
                      @{user.username}
                    </p>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Profile & Settings
                  </Link>

                  <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm shadow-md shadow-teal-500/20 transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
