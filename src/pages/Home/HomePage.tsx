import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { SplitifyEvent } from '@/types';
import { dataService } from '@/services/dataService';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import {
  Plus,
  KeyRound,
  UserPlus,
  ArrowRight,
  Calendar,
  Users,
  Compass,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<SplitifyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [eventNameInput, setEventNameInput] = useState('');
  const [currencyInput, setCurrencyInput] = useState('INR');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = dataService.subscribeEvents(user.uid, (list) => {
      setEvents(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !eventNameInput.trim()) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      const eventId = await dataService.createEvent(
        eventNameInput.trim(),
        user,
        currencyInput
      );
      setIsCreateModalOpen(false);
      setEventNameInput('');
      navigate(`/events/${eventId}`);
    } catch (err: any) {
      setModalError(err.message || 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCodeInput.trim()) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      const event = await dataService.joinEventByCode(joinCodeInput.trim(), user);
      setIsJoinModalOpen(false);
      setJoinCodeInput('');
      navigate(`/events/${event.id}`);
    } catch (err: any) {
      setModalError(err.message || 'Invalid or expired join code');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-[#203D62] via-[#1a3250] to-[#16AA88] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <span className="text-xs font-black uppercase tracking-wider text-teal-300 bg-teal-900/40 px-2.5 py-1 rounded-full border border-teal-400/20">
            Welcome Back
          </span>
          <h1 className="text-2xl sm:text-4xl font-black mt-2 tracking-tight">
            Hello, {user.displayName.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-200 text-xs sm:text-sm mt-1 font-medium">
            Manage trips, household expenses, and settle balances seamlessly with your friends.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Button
              variant="teal"
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Event
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsJoinModalOpen(true)}
              leftIcon={<KeyRound className="w-4 h-4" />}
              className="!bg-white/10 hover:!bg-white/20 border border-white/20 text-white"
            >
              Join with Code
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/friends')}
              leftIcon={<UserPlus className="w-4 h-4" />}
              className="!bg-white/10 hover:!bg-white/20 border border-white/20 text-white"
            >
              Add Friends
            </Button>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <div className="bg-white dark:bg-[#15263C] p-4 sm:p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Active Events
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {events.length}
          </p>
        </div>

        <div className="bg-white dark:bg-[#15263C] p-4 sm:p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-[#F36B2C]/10 text-[#F36B2C] flex items-center justify-center mb-2">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Your Friends
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            Explore
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white dark:bg-[#15263C] p-4 sm:p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="w-8 h-8 rounded-xl bg-[#60BCE8]/10 text-[#203D62] dark:text-[#60BCE8] flex items-center justify-center mb-2">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Split Mode
            </span>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
              Equal & Exact Amount
            </p>
          </div>
        </div>
      </div>

      {/* Events Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🏖️</span> Your Events
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/events')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            View All
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <span className="text-4xl">🏝️</span>
            <h3 className="text-base font-bold text-slate-800 dark:text-white mt-2">
              No events found
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Create an event for your next trip, dinner, or room expenses.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Create New Event
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((ev) => {
              const memberList = Object.values(ev.members);
              return (
                <div
                  key={ev.id}
                  onClick={() => navigate(`/events/${ev.id}`)}
                  className="bg-white dark:bg-[#15263C] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-teal-500/50 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform">
                        {ev.emoji}
                      </span>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {ev.name}
                        </h3>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          Created {new Date(ev.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-full">
                      {ev.currency || 'INR'}
                    </span>
                  </div>

                  {/* Members Avatars preview */}
                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center -space-x-2">
                      {memberList.slice(0, 4).map((m) => (
                        <Avatar
                          key={m.uid}
                          src={m.photoURL}
                          name={m.displayName}
                          size="xs"
                          className="ring-2 ring-white dark:ring-[#15263C]"
                        />
                      ))}
                      {memberList.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#15263C]">
                          +{memberList.length - 4}
                        </div>
                      )}
                    </div>

                    <span className="text-xs font-bold text-slate-500 group-hover:text-teal-500 flex items-center gap-1 transition-colors">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create Event */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Event"
        emoji="🏖️"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs font-semibold">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Event Name
            </label>
            <input
              type="text"
              placeholder="e.g. Goa Trip, Flat 402 Expenses, Dinner"
              value={eventNameInput}
              onChange={(e) => setEventNameInput(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              autoFocus
              required
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Emoji will be automatically selected based on the name.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Currency
            </label>
            <select
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="INR">INR (₹) - Indian Rupee (Default)</option>
              <option value="USD">USD ($) - US Dollar</option>
              <option value="EUR">EUR (€) - Euro</option>
              <option value="GBP">GBP (£) - British Pound</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="CAD">CAD (CA$) - Canadian Dollar</option>
              <option value="AUD">AUD (AU$) - Australian Dollar</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
              Create Event
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Join with Code */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join Event with Code"
        emoji="🔑"
        maxWidth="sm"
      >
        <form onSubmit={handleJoinEvent} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs font-semibold">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              6-Character Join Code
            </label>
            <input
              type="text"
              placeholder="e.g. GOA202"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-center text-lg tracking-widest uppercase focus:ring-2 focus:ring-teal-500 focus:outline-none"
              autoFocus
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsJoinModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
              Join Event
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
