import React from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { useTheme } from '@/app/providers/ThemeContext';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import {
  Moon,
  Sun,
  ShieldCheck,
  LogOut,
  Mail,
  AtSign,
  Palette,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, signOut, isFirebaseConnected } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  return (
    <div className="space-y-6 pb-12 max-w-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#203D62] dark:text-white tracking-tight flex items-center gap-2">
          <span>👤</span> Profile & Settings
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
          Manage your Splitify profile, display preferences, and account
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center">
        <Avatar src={user.photoURL} name={user.displayName} size="xl" className="mb-3" />
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          {user.displayName}
        </h2>
        <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-3 py-1 rounded-full mt-1">
          @{user.username}
        </span>

        <div className="w-full mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3 text-left">
          <div className="flex items-center justify-between text-xs font-semibold py-1">
            <span className="text-slate-400 flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-500" /> Email
            </span>
            <span className="text-slate-800 dark:text-slate-200">{user.email || 'N/A'}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold py-1">
            <span className="text-slate-400 flex items-center gap-2">
              <AtSign className="w-4 h-4 text-teal-500" /> Splitify Handle
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-mono">@{user.username}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold py-1">
            <span className="text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-500" /> Backend
            </span>
            <span className="text-slate-800 dark:text-slate-200">
              {isFirebaseConnected ? 'Cloud Firestore (Production)' : 'Interactive Local / Demo'}
            </span>
          </div>
        </div>
      </div>

      {/* Preferences Card */}
      <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Palette className="w-4 h-4 text-teal-500" />
          Appearance & Preferences
        </h3>

        {/* Theme switcher */}
        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white">Theme Mode</p>
            <p className="text-[11px] text-slate-400">
              Current: {theme === 'dark' ? 'Dark Navy' : 'Clean Light'}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold transition-all"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-600" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Brand Theme Palette Info */}
        <div className="py-2">
          <p className="text-xs font-extrabold text-slate-900 dark:text-white mb-2">
            Splitify Brand Palette
          </p>
          <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-bold">
            <div className="bg-[#203D62] text-white p-2 rounded-xl">Navy</div>
            <div className="bg-[#16AA88] text-white p-2 rounded-xl">Teal</div>
            <div className="bg-[#F36B2C] text-white p-2 rounded-xl">Orange</div>
            <div className="bg-[#F5A623] text-white p-2 rounded-xl">Yellow</div>
            <div className="bg-[#60BCE8] text-white p-2 rounded-xl">Blue</div>
          </div>
        </div>
      </div>

      {/* Sign Out Button */}
      <div className="pt-2">
        <Button
          variant="danger"
          size="lg"
          onClick={signOut}
          className="w-full !rounded-2xl shadow-sm"
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Sign Out of Splitify
        </Button>
      </div>
    </div>
  );
};
