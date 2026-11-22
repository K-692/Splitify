import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { SplitifyEvent, EventItem, ExpenseEntry, SettlementEntry } from '@/types';
import { dataService } from '@/services/dataService';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { ShareInviteModal } from '@/components/events/ShareInviteModal';
import { calculateEventFinancialOverview } from '@/domain/calculations/finance';
import { formatCurrency } from '@/utils/currency';
import { getFirstName } from '@/utils/name';
import { resolvePersonName } from '@/utils/people';
import { searchHome, EventSearchData } from '@/domain/search/homeSearch';
import { HomeSearchResults } from '@/components/home/HomeSearchResults';
import { HiddenEventsSection } from '@/components/home/HiddenEventsSection';
import {
  Plus,
  Share2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Search,
  X,
  EyeOff,
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
  const [eventStats, setEventStats] = useState<Record<string, EventFinancialStats>>({});

  // Create Event modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [eventNameInput, setEventNameInput] = useState('');
  const [currencyInput, setCurrencyInput] = useState('INR');
  const [personInput, setPersonInput] = useState('');
  const [expectedPeople, setExpectedPeople] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Share Modal
  const [sharingEvent, setSharingEvent] = useState<SplitifyEvent | null>(null);

  // Search + hide/unhide
  const [searchQuery, setSearchQuery] = useState('');
  const [eventData, setEventData] = useState<Record<string, EventSearchData>>({});
  const [hidingIds, setHidingIds] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Subscribe to user events
  useEffect(() => {
    if (!user) return;
    const unsub = dataService.subscribeEvents(user.uid, (list) => {
      setEvents(list);
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
      let settlementsList: SettlementEntry[] = [];

      const recalc = () => {
        const completedSettlements = settlementsList.filter((s) => s.status === 'completed');
        const overview = calculateEventFinancialOverview(
          ev.members,
          expensesList,
          completedSettlements,
          user.uid,
          itemsList,
          ev.slots
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

      const publishSearchData = () =>
        setEventData((prev) => ({ ...prev, [ev.id]: { items: itemsList, expenses: expensesList } }));

      const unsubItems = dataService.subscribeItems(ev.id, (items) => {
        itemsList = items;
        recalc();
        publishSearchData();
      });

      const unsubExpenses = dataService.subscribeExpenses(ev.id, (expenses) => {
        expensesList = expenses;
        recalc();
        publishSearchData();
      });

      const unsubSettlements = dataService.subscribeSettlements(ev.id, (settlements) => {
        settlementsList = settlements;
        recalc();
      });

      unsubs.push(unsubItems, unsubExpenses, unsubSettlements);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, events]);

  const handleAddPerson = () => {
    const trimmed = personInput.trim();
    if (!trimmed) return;
    if (!expectedPeople.includes(trimmed)) {
      setExpectedPeople([...expectedPeople, trimmed]);
    }
    setPersonInput('');
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !eventNameInput.trim()) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      const initialPeople = expectedPeople.map((name) => ({ name }));
      const eventId = await dataService.createEvent(
        eventNameInput.trim(),
        user,
        currencyInput,
        undefined,
        initialPeople
      );
      setIsCreateModalOpen(false);
      setEventNameInput('');
      setExpectedPeople([]);
      setPersonInput('');
      navigate(`/events/${eventId}`);
    } catch (err: any) {
      setModalError(err.message || 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPersonName = (ev: SplitifyEvent, uid: string) => resolvePersonName(uid, ev.members, ev.slots);

  const visibleEvents = useMemo(
    () => events.filter((ev) => !(user && ev.members?.[user.uid]?.hidden)),
    [events, user]
  );
  const hiddenEvents = useMemo(
    () => events.filter((ev) => Boolean(user && ev.members?.[user.uid]?.hidden)),
    [events, user]
  );

  const searchResult = useMemo(
    () => (user && searchQuery.trim() ? searchHome(searchQuery, events, eventData, user.uid, getPersonName) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, events, eventData, user]
  );
  const searchDataLoading = events.some((ev) => !eventData[ev.id]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleSetHidden = async (ev: SplitifyEvent, hidden: boolean) => {
    if (!user) return;
    setHidingIds((prev) => ({ ...prev, [ev.id]: true }));
    try {
      await dataService.setEventHidden(ev.id, user.uid, hidden);
      showToast(hidden ? `"${ev.name}" moved to Hidden events` : `"${ev.name}" is back on Home`);
    } catch (err: any) {
      alert(err.message || 'Could not update the event');
    } finally {
      setHidingIds((prev) => ({ ...prev, [ev.id]: false }));
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header: ONLY My Events with Create Event Button */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="min-w-0">
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
          className="shadow-md shadow-teal-500/20 flex-shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Create Event</span>
        </Button>
      </div>

      {/* Search events and items (including hidden events) */}
      {events.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchQuery('');
            }}
            placeholder="Search events, items, categories or people"
            aria-label="Search events and items"
            enterKeyHint="search"
            className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#15263C] text-slate-900 dark:text-white text-sm font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none shadow-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {searchResult ? (
        <HomeSearchResults
          query={searchQuery}
          result={searchResult}
          loadingItems={searchDataLoading}
          getPersonName={getPersonName}
          onOpenEvent={(ev) => navigate(`/events/${ev.id}`)}
          onOpenItem={(ev, itemName) => navigate(`/events/${ev.id}?q=${encodeURIComponent(itemName)}`)}
        />
      ) : (
      <>
      {/* Events List — No artificial loading screen */}
      {events.length === 0 ? (
        <div className="text-center py-16 px-6 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-3xl mb-4">
            🏖️
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Empty
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            You don't have any active events. Create an event to start recording expenses and splitting with friends.
          </p>
          <Button
            variant="primary"
            size="md"
            className="mt-5"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Event
          </Button>
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="text-center py-10 px-6 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <EyeOff className="w-7 h-7 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">All your events are hidden</p>
          <p className="text-xs text-slate-400 mt-1">Open Hidden events below to bring one back.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleEvents.map((ev) => {
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

                  <div className="flex items-center gap-0.5 flex-shrink-0">
                  {/* Hide button */}
                  <button
                    type="button"
                    disabled={hidingIds[ev.id]}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetHidden(ev, true);
                    }}
                    title="Hide from Home"
                    aria-label={`Hide ${ev.name} from Home`}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
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
                </div>

                {/* Financial Summary */}
                <div
                  onClick={() => navigate(`/events/${ev.id}`)}
                  className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 font-semibold truncate">Total Event Expense:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(totalMinor, ev.currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 font-semibold truncate">Your Share:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatCurrency(yourShare, ev.currency)}
                    </span>
                  </div>

                  {/* Balance Badge */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-400 font-medium truncate">Your Balance:</span>
                    {netBalance > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-teal-500/15 text-teal-600 dark:text-teal-400 whitespace-nowrap flex-shrink-0">
                        <TrendingUp className="w-3.5 h-3.5" />
                        +{formatCurrency(netBalance, ev.currency)} (you get)
                      </span>
                    ) : netBalance < 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#F36B2C]/15 text-[#F36B2C] whitespace-nowrap flex-shrink-0">
                        <TrendingDown className="w-3.5 h-3.5" />
                        -{formatCurrency(Math.abs(netBalance), ev.currency)} (you owe)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 whitespace-nowrap flex-shrink-0">
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
                        name={getFirstName(m.displayName)}
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

      {events.length > 0 && (
        <HiddenEventsSection
          events={hiddenEvents}
          totals={Object.fromEntries(hiddenEvents.map((ev) => [ev.id, eventStats[ev.id]?.totalExpenseMinor]))}
          busyIds={hidingIds}
          onUnhide={(ev) => handleSetHidden(ev, false)}
          onOpen={(ev) => navigate(`/events/${ev.id}`)}
        />
      )}
      </>
      )}

      {toast && (
        <div role="status" className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-xl max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      {/* Modal: Create Event */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Event"
        emoji="🏖️"
        maxWidth="md"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs font-semibold">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Event Name
            </label>
            <input
              type="text"
              placeholder="e.g. Goa Trip, Flat 402 Expenses, Dinner"
              value={eventNameInput}
              onChange={(e) => setEventNameInput(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none transition-shadow shadow-sm"
              autoFocus
              required
            />
            <span className="text-[11px] text-slate-400 mt-1.5 block">
              Emoji will be automatically selected based on the name.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Currency
            </label>
            <select
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none shadow-sm cursor-pointer"
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

          {/* People Joining (Expected slots) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              People Joining (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Rahul, Priya, Amit"
                value={personInput}
                onChange={(e) => setPersonInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPerson();
                  }
                }}
                className="flex-1 h-11 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none shadow-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPerson}
                className="text-xs font-bold text-teal-600 dark:text-teal-400 h-11 px-4 rounded-2xl"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Person
              </Button>
            </div>
            {expectedPeople.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {expectedPeople.map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => setExpectedPeople(expectedPeople.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-rose-500 ml-0.5 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <span className="text-[11px] text-slate-400 mt-1 block">
              Creates slots for expected members. They can claim their slot when they join!
            </span>
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
