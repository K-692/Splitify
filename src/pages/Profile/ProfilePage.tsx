import React, { useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { useTheme } from '@/app/providers/ThemeContext';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import {
  Moon,
  Sun,
  LogOut,
  Mail,
  User,
  Palette,
  Edit2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, signOut, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!user) return null;

  const handleOpenEditName = () => {
    setNewName(user.displayName || '');
    setNameError(null);
    setIsEditNameModalOpen(true);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError('Name cannot be empty');
      return;
    }
    if (trimmed.length > 50) {
      setNameError('Name must be 50 characters or less');
      return;
    }
    setNameError(null);
    setIsSavingName(true);
    try {
      await updateProfile({ displayName: trimmed });
      setIsEditNameModalOpen(false);
      setSuccessMsg('Name updated successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to update name';
      setNameError(errMsg);
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-xl mx-auto">
      {/* Toast Alert */}
      {successMsg && (
        <div className="fixed top-20 right-4 z-50 bg-[#203D62] text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4 text-teal-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#203D62] dark:text-white tracking-tight flex items-center gap-2">
          <span>👤</span> Profile
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
          Manage your Splitify profile, display preferences, and account
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center">
        <Avatar src={user.photoURL} name={user.displayName} size="xl" className="mb-3" />
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {user.displayName}
          </h2>
          <button
            type="button"
            onClick={handleOpenEditName}
            className="p-1 text-slate-400 hover:text-teal-500 transition-colors"
            title="Edit Name"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3 text-left">
          <div className="flex items-center justify-between text-xs font-semibold py-1">
            <span className="text-slate-400 flex items-center gap-2">
              <User className="w-4 h-4 text-teal-500" /> Display Name
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-800 dark:text-slate-200 font-bold">{user.displayName}</span>
              <button
                type="button"
                onClick={handleOpenEditName}
                className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold py-1">
            <span className="text-slate-400 flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-500" /> Email
            </span>
            <span className="text-slate-800 dark:text-slate-200">{user.email || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Preferences Card */}
      <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Palette className="w-4 h-4 text-teal-500" />
          Preferences
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
      </div>

      {/* Account Action */}
      <div className="flex justify-center pt-2">
        <Button
          variant="outline"
          size="md"
          onClick={signOut}
          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out of Splitify
        </Button>
      </div>

      {/* Edit Name Modal */}
      <Modal
        isOpen={isEditNameModalOpen}
        onClose={() => setIsEditNameModalOpen(false)}
        title="Edit Name"
        emoji="✏️"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveName} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Update your display name. This name will be visible to members of events you join.
          </p>

          {nameError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{nameError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. John"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              minLength={1}
              maxLength={50}
              autoFocus
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsEditNameModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSavingName}>
              Save Name
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
