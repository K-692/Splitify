import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { SplitifyEvent, EventItem, ExpenseEntry } from '@/types';
import { dataService } from '@/services/dataService';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { ShareInviteModal } from '@/components/events/ShareInviteModal';
import { calculateEventFinancialOverview } from '@/domain/calculations/finance';
import { formatCurrency } from '@/utils/currency';
import {
  Plus,
  Share2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';

interface EventFinancialStats {
  totalExpenseMinor: number;
  userSpentMinor: number;
  userShareMinor: number;
  userNetBalanceMinor: number;
}

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<SplitifyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventStats, setEventStats] = useState<Record<string, EventFinancialStats>>({});

  // Create Event modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [eventNameInput, setEventNameInput] = useState('');
  const [currencyInput, setCurrencyInput] = useState('INR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Share Modal
  const [sharingEvent, setSharingEvent] = useState<SplitifyEvent | null>(null);

  // Subscribe to user events
  useEffect(() => {
    if (!user) return;
    const unsub = dataService.subscribeEvents(user.uid, (list) => {
      setEvents(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Load items & expenses for financial summaries on event cards
  useEffect(() => {
    if (!user || events.length === 0) return;

    const unsubs: (() => void)[] = [];

    events.forEach((ev) => {
      let itemsList: EventItem[] = [];
      let expensesList: ExpenseEntry[] = [];

      const recalc = () => {
        const overview = calculateEventFinancialOverview(
          ev.members,
          expensesList,
          [],
          user.uid,
          itemsList
        );
        setEventStats((prev) => ({
          ...prev,
          [ev.id]: {
            totalExpenseMinor: overview.totalExpenseMinor,
            userSpentMinor: overview.currentUserSpentMinor,
            userShareMinor: overview.currentUserShareMinor,
            userNetBalanceMinor: overview.currentUserNetBalanceMinor,
          },
        }));
      };

      const unsubItems = dataService.subscribeItems(ev.id, (items) => {
        itemsList = items;
        recalc();
      });

      const unsubExpenses = dataService.subscribeExpenses(ev.id, (expenses) => {
        expensesList = expenses;
        recalc();
      });

      unsubs.push(unsubItems, unsubExpenses);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, events]);

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

  if (!user) return null;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header: ONLY My Events with Create Event Button */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#203D62] dark:text-white tracking-tight">
            My Events
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your shared trips, household expenses, and friend outings
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsCreateModalOpen(true)}
          className="shadow-md shadow-teal-500/20"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Create Event</span>
        </Button>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-9 h-9 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs font-semibold text-slate-400">Loading your events...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 px-6 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-3xl mb-4">
            🏖️
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            No events yet
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Create an event to start recording expenses, generating invitation links, and splitting with friends.
          </p>
          <Button
            variant="primary"
            size="md"
            className="mt-5"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Your First Event
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => {
            const memberList = Object.values(ev.members || {});
            const stats = eventStats[ev.id];
            const totalMinor = stats ? stats.totalExpenseMinor : 0;
            const netBalance = stats ? stats.userNetBalanceMinor : 0;
            const yourShare = stats ? stats.userShareMinor : 0;

            return (
              <div
                key={ev.id}
                className="bg-white dark:bg-[#15263C] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-teal-500/50 transition-all flex flex-col justify-between group"
              >
                {/* Event Top Bar */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => navigate(`/events/${ev.id}`)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <span className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                      {ev.emoji}
                    </span>
                    <div className="truncate">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                        {ev.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {memberList.length} {memberList.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                  </div>

                  {/* Share button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSharingEvent(ev);
                    }}
                    title="Share Event Invitation Link"
                    className="p-2 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Financial Summary */}
                <div
                  onClick={() => navigate(`/events/${ev.id}`)}
                  className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Total Event Expense:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(totalMinor, ev.currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Your Share:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(yourShare, ev.currency)}
                    </span>
                  </div>

                  {/* Balance Badge */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400 font-medium">Your Balance:</span>
                    {netBalance > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-teal-500/15 text-teal-600 dark:text-teal-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        +{formatCurrency(netBalance, ev.currency)} (you get)
                      </span>
                    ) : netBalance < 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#F36B2C]/15 text-[#F36B2C]">
                        <TrendingDown className="w-3.5 h-3.5" />
                        -{formatCurrency(Math.abs(netBalance), ev.currency)} (you owe)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                        Settled
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Avatars & Quick View */}
                <div
                  onClick={() => navigate(`/events/${ev.id}`)}
                  className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between cursor-pointer"
                >
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
                    View Details
                    <ArrowRight className="w-3.5 h-3.5" />
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

      {/* Share / Invite Modal */}
      {sharingEvent && (
        <ShareInviteModal
          isOpen={Boolean(sharingEvent)}
          onClose={() => setSharingEvent(null)}
          event={sharingEvent}
        />
      )}
    </div>
  );
};
