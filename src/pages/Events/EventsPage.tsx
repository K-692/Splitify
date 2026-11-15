import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { SplitifyEvent } from '@/types';
import { dataService } from '@/services/dataService';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Plus, Search, KeyRound, Calendar, ArrowRight } from 'lucide-react';

export const EventsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [events, setEvents] = useState<SplitifyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(
    searchParams.get('action') === 'create'
  );
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
      setModalError(err.message || 'Invalid join code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEvents = events.filter((ev) =>
    ev.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#203D62] dark:text-white tracking-tight flex items-center gap-2">
            <span>📅</span> Events
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            All your shared expense events, trips, and groups
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsJoinModalOpen(true)}
            leftIcon={<KeyRound className="w-4 h-4 text-teal-500" />}
          >
            Join with Code
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Event
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search events by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#15263C] text-slate-900 dark:text-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none shadow-sm"
        />
      </div>

      {/* Events List */}
      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400">Loading events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white mt-3">
            {searchQuery ? 'No matching events found' : 'No events yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching for a different keyword or create a new event.'
              : 'Create an event for a trip, household, or party to split expenses effortlessly.'}
          </p>
          <Button
            variant="primary"
            size="md"
            className="mt-4"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Event
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev) => {
            const memberList = Object.values(ev.members);
            return (
              <div
                key={ev.id}
                onClick={() => navigate(`/events/${ev.id}`)}
                className="bg-white dark:bg-[#15263C] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-teal-500/50 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
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
                </div>

                <div className="flex items-center justify-between mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/80">
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
                    View <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
