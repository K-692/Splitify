import React, { useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { useTheme } from '@/app/providers/ThemeContext';
import { dataService } from '@/services/dataService';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import {
  Moon,
  Sun,
  LogOut,
  Mail,
  AtSign,
  Palette,
  Edit2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, signOut, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isEditHandleModalOpen, setIsEditHandleModalOpen] = useState(false);
  const [newHandle, setNewHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [alternativeSuggestions, setAlternativeSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSavingHandle, setIsSavingHandle] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!user) return null;

  const handleOpenEditHandle = () => {
    setNewHandle(user.username || '');
    setHandleError(null);
    setAlternativeSuggestions([]);
    setIsEditHandleModalOpen(true);
  };

  const handleSaveHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    setHandleError(null);
    setIsSavingHandle(true);
    try {
      const updatedUsername = await dataService.changeUsernameHandle(user, newHandle);
      await updateProfile({ username: updatedUsername });
      setIsEditHandleModalOpen(false);
      setAlternativeSuggestions([]);
      setSuccessMsg(`Handle updated to @${updatedUsername}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to update handle';
      setHandleError(errMsg);
      setIsLoadingSuggestions(true);
      try {
        const sugs = await dataService.suggestAlternativeUsernames(user.displayName, newHandle);
        setAlternativeSuggestions(sugs);
      } catch {
        // Silently ignore suggestion retrieval error
      } finally {
        setIsLoadingSuggestions(false);
      }
    } finally {
      setIsSavingHandle(false);
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
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-3 py-1 rounded-full font-mono">
            @{user.username}
          </span>
          <button
            type="button"
            onClick={handleOpenEditHandle}
            className="p-1 text-slate-400 hover:text-teal-500 transition-colors"
            title="Edit Splitify Handle"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>

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
            <div className="flex items-center gap-2">
              <span className="text-slate-800 dark:text-slate-200 font-mono">@{user.username}</span>
              <button
                type="button"
                onClick={handleOpenEditHandle}
                className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
              >
                Edit
              </button>
            </div>
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

      {/* Edit Handle Modal */}
      <Modal
        isOpen={isEditHandleModalOpen}
        onClose={() => setIsEditHandleModalOpen(false)}
        title="Edit Splitify Handle"
        emoji="🏷️"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveHandle} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose a unique handle for your Splitify profile. Your friends can find and add you by
            this handle.
          </p>

          {handleError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{handleError}</span>
            </div>
          )}

          {alternativeSuggestions.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
              <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 block">
                Available handles related to your name (click to select):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {alternativeSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setNewHandle(sug);
                      setHandleError(null);
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 hover:bg-teal-100/60 dark:hover:bg-teal-900/50 transition-colors shadow-sm"
                  >
                    @{sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoadingSuggestions && (
            <div className="text-center py-1 text-xs text-slate-400">
              Finding available handle suggestions...
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Handle
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 font-bold text-sm">@</span>
              <input
                type="text"
                placeholder="e.g. rahul_s"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                minLength={3}
                maxLength={20}
                autoFocus
                className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              3-20 characters. Lowercase letters, numbers, and underscores only.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsEditHandleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSavingHandle}>
              Save Handle
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
