import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { useNotifications } from '@/app/providers/NotificationContext';
import {
  SplitifyEvent,
  EventItem,
  ExpenseEntry,
  SettlementEntry,
  SettlementSuggestion,
} from '@/types';
import { dataService } from '@/services/dataService';
import {
  calculateEventFinancialOverview,
} from '@/domain/calculations/finance';
import { formatCurrency } from '@/utils/currency';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { ExpenseModal } from '@/components/expenses/ExpenseModal';
import { SettlementModal } from '@/components/dashboard/SettlementModal';
import { BulkDeleteModal } from '@/components/expenses/BulkDeleteModal';
import { InviteFriendModal } from '@/components/expenses/InviteFriendModal';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Users,
  CheckSquare,
  Square,
  History,
  BellRing,
  CheckCircle,
  FolderPlus,
  Share2,
} from 'lucide-react';

export const EventDetailsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sendReminder } = useNotifications();

  const [event, setEvent] = useState<SplitifyEvent | null>(null);
  const [items, setItems] = useState<EventItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [settlements, setSettlements] = useState<SettlementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'dashboard' | 'members'>('hierarchy');

  // Accordion open states for items (all open by default)
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  // Selection state for subitem / expenses (keys are expense IDs)
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Record<string, boolean>>({});

  // Inline event rename state
  const [isEditingEventName, setIsEditingEventName] = useState(false);
  const [newEventName, setNewEventName] = useState('');

  // Inline item rename state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [activeTargetItemId, setActiveTargetItemId] = useState<string>('');
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);

  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<SettlementSuggestion | null>(null);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Expanded audit log view under subitems
  const [expandedAuditLogs, setExpandedAuditLogs] = useState<Record<string, boolean>>({});

  // New Item input modal/trigger
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemInput, setNewItemInput] = useState('');

  useEffect(() => {
    if (!eventId) return;

    const unsubEvent = dataService.subscribeEvent(eventId, (ev) => {
      setEvent(ev);
      if (ev) setNewEventName(ev.name);
      setLoading(false);
    });

    const unsubItems = dataService.subscribeItems(eventId, (its) => {
      setItems(its);
    });

    const unsubExpenses = dataService.subscribeExpenses(eventId, (exps) => {
      setExpenses(exps);
    });

    const unsubSettlements = dataService.subscribeSettlements(eventId, (sets) => {
      setSettlements(sets);
    });

    return () => {
      unsubEvent();
      unsubItems();
      unsubExpenses();
      unsubSettlements();
    };
  }, [eventId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compute authoritative financial overview
  const financialOverview = useMemo(() => {
    if (!event) return null;
    return calculateEventFinancialOverview(
      event.members,
      expenses,
      settlements,
      user?.uid
    );
  }, [event, expenses, settlements, user?.uid]);

  // Map expenses by itemId
  const expensesByItem = useMemo(() => {
    const map: Record<string, ExpenseEntry[]> = {};
    for (const item of items) {
      map[item.id] = [];
    }
    for (const exp of expenses) {
      if (!exp.deleted) {
        if (!map[exp.itemId]) map[exp.itemId] = [];
        map[exp.itemId].push(exp);
      }
    }
    return map;
  }, [items, expenses]);

  // Compute item totals
  const itemTotalsMinor = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [itemId, exps] of Object.entries(expensesByItem)) {
      map[itemId] = exps.reduce((sum, e) => sum + (e.costMinor || 0), 0);
    }
    return map;
  }, [expensesByItem]);

  // Selected expenses calculations
  const selectedExpenses = useMemo(() => {
    return expenses.filter((e) => selectedExpenseIds[e.id] && !e.deleted);
  }, [expenses, selectedExpenseIds]);

  const selectedTotalMinor = useMemo(() => {
    return selectedExpenses.reduce((sum, e) => sum + (e.costMinor || 0), 0);
  }, [selectedExpenses]);

  // Handlers
  const handleToggleItemCollapse = (itemId: string) => {
    setCollapsedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleToggleAuditLog = (expenseId: string) => {
    setExpandedAuditLogs((prev) => ({ ...prev, [expenseId]: !prev[expenseId] }));
  };

  const handleRenameEvent = async () => {
    if (!event || !user || !newEventName.trim()) return;
    try {
      await dataService.updateEventName(event.id, newEventName.trim(), user);
      setIsEditingEventName(false);
      showToast('Event renamed successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to rename event');
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !newItemInput.trim()) return;
    try {
      await dataService.createItem(event.id, newItemInput.trim());
      setNewItemInput('');
      setIsAddingItem(false);
      showToast('New item added');
    } catch (err: any) {
      alert(err.message || 'Failed to add item');
    }
  };

  const handleRenameItem = async (itemId: string) => {
    if (!event || !newItemName.trim()) return;
    try {
      await dataService.updateItemName(event.id, itemId, newItemName.trim());
      setEditingItemId(null);
      showToast('Item renamed');
    } catch (err: any) {
      alert(err.message || 'Failed to rename item');
    }
  };

  const handleDeleteItem = async (item: EventItem) => {
    if (!event || !user) return;
    const itemExps = expensesByItem[item.id] || [];
    const count = itemExps.length;
    const msg = count > 0
      ? `Delete "${item.name}" and all ${count} active expense(s) inside it?`
      : `Delete empty item "${item.name}"?`;
    if (!window.confirm(msg)) return;

    try {
      await dataService.deleteItem(event.id, item.id, user);
      showToast('Item deleted');
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  const handleToggleSelectAllEvent = () => {
    const allActive = expenses.filter((e) => !e.deleted);
    if (selectedExpenses.length === allActive.length) {
      setSelectedExpenseIds({});
    } else {
      const newSel: Record<string, boolean> = {};
      for (const e of allActive) newSel[e.id] = true;
      setSelectedExpenseIds(newSel);
    }
  };

  const handleToggleSelectItem = (itemId: string) => {
    const itemExps = expensesByItem[itemId] || [];
    const allSelected = itemExps.every((e) => selectedExpenseIds[e.id]);

    const newSel = { ...selectedExpenseIds };
    for (const e of itemExps) {
      newSel[e.id] = !allSelected;
    }
    setSelectedExpenseIds(newSel);
  };

  const handleToggleSelectExpense = (expenseId: string) => {
    setSelectedExpenseIds((prev) => ({
      ...prev,
      [expenseId]: !prev[expenseId],
    }));
  };

  const handleConfirmBulkDelete = async () => {
    if (!event || !user) return;
    setIsBulkDeleting(true);
    try {
      const ids = selectedExpenses.map((e) => e.id);
      await dataService.bulkDeleteExpenses(event.id, ids, user, event.members);
      setSelectedExpenseIds({});
      setIsBulkDeleteModalOpen(false);
      showToast(`Deleted ${ids.length} expense(s)`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected expenses');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSaveExpense = async (data: any) => {
    if (!event || !user) return;
    if (editingExpense) {
      await dataService.updateExpense(
        event.id,
        editingExpense.id,
        data,
        user,
        event.members
      );
      showToast('Expense updated');
    } else {
      await dataService.createExpense(
        {
          ...data,
          eventId: event.id,
          itemId: activeTargetItemId,
        },
        user,
        event.members
      );
      showToast('Expense created');
    }
  };

  const handleDeleteSingleExpense = async (expense: ExpenseEntry) => {
    if (!event || !user) return;
    if (!window.confirm(`Delete expense "${expense.name}"?`)) return;
    try {
      await dataService.deleteExpense(event.id, expense.id, user, event.members);
      showToast('Expense deleted');
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  const handleRecordSettlement = async (data: any) => {
    if (!event || !user) return;
    await dataService.recordSettlement({ ...data, eventId: event.id }, user);
    showToast('Settlement recorded! 💸');
  };

  const handleSendReminder = async (debtorUid: string, amountMinor: number) => {
    if (!event || !user) return;
    await sendReminder(debtorUid, amountMinor, event.name);
    showToast('Payment reminder sent! 🔔');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event || !user) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold">Event not found</h2>
        <Button variant="primary" className="mt-4" onClick={() => navigate('/events')}>
          Back to Events
        </Button>
      </div>
    );
  }

  const currency = event.currency || 'INR';

  return (
    <div className="space-y-6 pb-12">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#203D62] text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Event Header */}
      <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Emoji */}
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <span className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-3xl shadow-inner flex-shrink-0 select-none">
              {event.emoji}
            </span>
            <div className="min-w-0 flex-1">
              {isEditingEventName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white px-2 py-1 rounded-xl border border-teal-500 bg-white dark:bg-slate-800 focus:outline-none"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleRenameEvent}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingEventName(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#203D62] dark:text-white tracking-tight truncate">
                    {event.name}
                  </h1>
                  <button
                    onClick={() => {
                      setNewEventName(event.name);
                      setIsEditingEventName(true);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit event name (all members can edit)"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-teal-500" />
                  {Object.keys(event.members).length} members
                </span>
                <span>•</span>
                <span>Currency: {currency}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              leftIcon={<Share2 className="w-3.5 h-3.5 text-teal-500" />}
            >
              Invite / Code
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (items.length === 0) {
                  setIsAddingItem(true);
                } else {
                  setActiveTargetItemId(items[0].id);
                  setEditingExpense(null);
                  setIsExpenseModalOpen(true);
                }
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Expense
            </Button>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        {financialOverview && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
            {/* Total Expense */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Event Expense
              </span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatCurrency(financialOverview.totalExpenseMinor, currency)}
              </p>
              <span className="text-[10px] text-slate-400">Ordinary active expenses</span>
            </div>

            {/* Your Fair Share */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Your Fair Share
              </span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatCurrency(financialOverview.currentUserShareMinor, currency)}
              </p>
              <span className="text-[10px] text-slate-400">
                You spent {formatCurrency(financialOverview.currentUserSpentMinor, currency)}
              </span>
            </div>

            {/* Net Position (You Owe / You're Owed) */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                financialOverview.currentUserNetBalanceMinor > 0
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                  : financialOverview.currentUserNetBalanceMinor < 0
                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                {financialOverview.currentUserNetBalanceMinor > 0
                  ? "You're Owed (Get Back)"
                  : financialOverview.currentUserNetBalanceMinor < 0
                  ? 'You Owe'
                  : 'Your Balance'}
              </span>
              <p
                className={`text-xl sm:text-2xl font-black mt-1 ${
                  financialOverview.currentUserNetBalanceMinor > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : financialOverview.currentUserNetBalanceMinor < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {financialOverview.currentUserNetBalanceMinor === 0
                  ? 'All Settled! 🎉'
                  : formatCurrency(
                      Math.abs(financialOverview.currentUserNetBalanceMinor),
                      currency,
                      { includeSign: false }
                    )}
              </p>
              <span className="text-[10px] opacity-75">
                {financialOverview.currentUserNetBalanceMinor > 0
                  ? 'Other members need to pay you'
                  : financialOverview.currentUserNetBalanceMinor < 0
                  ? 'You need to pay other members'
                  : 'No outstanding debt for you'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all ${
            activeTab === 'hierarchy'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Expenses ({expenses.filter((e) => !e.deleted).length})
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 ${
            activeTab === 'dashboard'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Balances & Settlements</span>
          {financialOverview && financialOverview.settlementSuggestions.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#F36B2C]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all ${
            activeTab === 'members'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Members ({Object.keys(event.members).length})
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: EXPENSE HIERARCHY */}
      {/* ==================================================== */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          {/* Global Event-Level Selection Bar (Floating or Top) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleSelectAllEvent}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-teal-600"
              >
                {selectedExpenses.length > 0 &&
                selectedExpenses.length === expenses.filter((e) => !e.deleted).length ? (
                  <CheckSquare className="w-4 h-4 text-teal-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All Expenses ({selectedExpenses.length} selected)</span>
              </button>

              {selectedExpenses.length > 0 && (
                <span className="text-xs font-extrabold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 rounded-full">
                  Total: {formatCurrency(selectedTotalMinor, currency)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedExpenses.length > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete Selected ({selectedExpenses.length})
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingItem(true)}
                leftIcon={<FolderPlus className="w-3.5 h-3.5 text-teal-500" />}
              >
                New Category / Item
              </Button>
            </div>
          </div>

          {/* Add Item Form (Inline) */}
          {isAddingItem && (
            <form
              onSubmit={handleCreateItem}
              className="p-4 rounded-3xl bg-white dark:bg-[#15263C] border-2 border-teal-500/50 shadow-md space-y-3"
            >
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-teal-500" />
                Add New Item / Category
              </h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Transportation, Accommodation, Food, Shopping..."
                  value={newItemInput}
                  onChange={(e) => setNewItemInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  autoFocus
                  required
                />
                <Button type="submit" size="sm">
                  Add Item
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingItem(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Empty state */}
          {items.length === 0 && !isAddingItem && (
            <div className="text-center py-16 px-4 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <span className="text-4xl">🏝️</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-2">
                No items or expenses yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Create your first category (like Transportation, Hotel, or Food) to start logging
                shared expenses!
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-4"
                onClick={() => setIsAddingItem(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create First Item
              </Button>
            </div>
          )}

          {/* Hierarchical Item List */}
          <div className="space-y-4">
            {items.map((item) => {
              const isCollapsed = Boolean(collapsedItems[item.id]);
              const itemExpenses = expensesByItem[item.id] || [];
              const itemTotalMinor = itemTotalsMinor[item.id] || 0;
              const allItemExpensesSelected =
                itemExpenses.length > 0 && itemExpenses.every((e) => selectedExpenseIds[e.id]);

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#15263C] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden transition-all"
                >
                  {/* Item Header Accordion */}
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/60 select-none">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Collapse toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleItemCollapse(item.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>

                      {/* Item level select all */}
                      {!item.isSettlementsItem && itemExpenses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(item.id)}
                          className="text-slate-400 hover:text-teal-600 transition-colors"
                          title="Select all subitems in this item"
                        >
                          {allItemExpensesSelected ? (
                            <CheckSquare className="w-4 h-4 text-teal-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {/* Emoji & Name */}
                      <span className="text-2xl flex-shrink-0">{item.emoji}</span>

                      {editingItemId === item.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="px-2 py-1 text-sm font-black rounded-lg border border-teal-500 bg-white dark:bg-slate-800"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => handleRenameItem(item.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingItemId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <h3
                            onClick={() => handleToggleItemCollapse(item.id)}
                            className="text-base sm:text-lg font-black text-[#203D62] dark:text-white truncate cursor-pointer hover:text-teal-600"
                          >
                            {item.name}
                          </h3>
                          {!item.isSettlementsItem && (
                            <button
                              onClick={() => {
                                setNewItemName(item.name);
                                setEditingItemId(item.id);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              title="Rename Item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Calculated Total & Item Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block text-[10px] uppercase">
                          Item Total
                        </span>
                        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                          {formatCurrency(itemTotalMinor, currency)}
                        </span>
                      </div>

                      {!item.isSettlementsItem && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="teal"
                            size="sm"
                            onClick={() => {
                              setActiveTargetItemId(item.id);
                              setEditingExpense(null);
                              setIsExpenseModalOpen(true);
                            }}
                            className="!px-2.5 !py-1.5 text-xs font-bold"
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                          >
                            Add
                          </Button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subitems List */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {itemExpenses.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          No expenses in this item yet.{' '}
                          <button
                            onClick={() => {
                              setActiveTargetItemId(item.id);
                              setEditingExpense(null);
                              setIsExpenseModalOpen(true);
                            }}
                            className="text-teal-500 font-bold hover:underline ml-1"
                          >
                            + Add first subitem
                          </button>
                        </div>
                      ) : (
                        itemExpenses.map((expense) => {
                          const isSelected = Boolean(selectedExpenseIds[expense.id]);
                          const isAuditOpen = Boolean(expandedAuditLogs[expense.id]);
                          const payerMember = event.members[expense.paidBy];

                          return (
                            <div
                              key={expense.id}
                              className={`p-4 transition-colors ${
                                isSelected
                                  ? 'bg-teal-50/50 dark:bg-teal-950/20'
                                  : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                {/* Left checkbox & details */}
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSelectExpense(expense.id)}
                                    className="mt-1 text-slate-400 hover:text-teal-600 transition-colors flex-shrink-0"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-teal-500" />
                                    ) : (
                                      <Square className="w-4 h-4" />
                                    )}
                                  </button>

                                  <span className="text-xl select-none flex-shrink-0 mt-0.5">
                                    {expense.emoji}
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                        {expense.name}
                                      </h4>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        {expense.splitBy === 'equal'
                                          ? 'Equal Split'
                                          : 'Custom Split'}{' '}
                                        ({expense.participants.length} people)
                                      </span>
                                    </div>

                                    {/* Payer info */}
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                      <span>Paid by</span>
                                      <Avatar
                                        src={payerMember?.photoURL}
                                        name={payerMember?.displayName || expense.createdByName}
                                        size="xs"
                                      />
                                      <span className="font-bold text-slate-700 dark:text-slate-300">
                                        {payerMember?.displayName || expense.createdByName}
                                      </span>
                                      {expense.paidBy === user.uid && (
                                        <span className="text-teal-600 font-bold">(You)</span>
                                      )}
                                    </div>

                                    {/* Optional comment */}
                                    {expense.comment && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                                        &quot;{expense.comment}&quot;
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Right amount & edit/delete buttons */}
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                  <span className="text-base font-black text-slate-900 dark:text-white">
                                    {formatCurrency(expense.costMinor, currency)}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAuditLog(expense.id)}
                                      className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                                        isAuditOpen
                                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                      }`}
                                      title="View Modification History"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                      <span className="text-[10px]">Audit</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTargetItemId(item.id);
                                        setEditingExpense(expense);
                                        setIsExpenseModalOpen(true);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                      title="Edit Expense"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSingleExpense(expense)}
                                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                      title="Delete Expense"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Exact Audit Log displayed under subitem only */}
                              {isAuditOpen && (
                                <div className="mt-3 p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1.5">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800 font-sans font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                                    <span>Audit & Modification History</span>
                                    <span>
                                      {expense.auditLogs?.length || 1} record(s)
                                    </span>
                                  </div>
                                  {expense.auditLogs && expense.auditLogs.length > 0 ? (
                                    expense.auditLogs.map((log) => (
                                      <div
                                        key={log.id}
                                        className="text-slate-700 dark:text-slate-300 text-[11px]"
                                      >
                                        {log.type === 'created' ? (
                                          <span>
                                            Created by {log.byName} at {log.formattedTimestamp}
                                          </span>
                                        ) : log.type === 'edited' ? (
                                          <span>
                                            Edited by {log.byName} at {log.formattedTimestamp}
                                            {log.changedFields && log.changedFields.length > 0 && (
                                              <span className="text-slate-500 ml-1">
                                                (modified: {log.changedFields.join(', ')})
                                              </span>
                                            )}
                                          </span>
                                        ) : (
                                          <span>
                                            Deleted by {log.byName} at {log.formattedTimestamp}
                                          </span>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-slate-700 dark:text-slate-300 text-[11px]">
                                      Created by {expense.createdByName} at{' '}
                                      {new Date(expense.createdAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* System-Generated Settlements Item Display */}
            {settlements.length > 0 && (
              <div className="bg-white dark:bg-[#15263C] rounded-3xl border-2 border-teal-500/40 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-teal-50/50 dark:bg-teal-950/20 border-b border-teal-100 dark:border-teal-900/30">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl select-none">💸</span>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-teal-800 dark:text-teal-300">
                        💸 Settlements
                      </h3>
                      <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                        System-generated financial settlement ledger (does not affect Total Expense)
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-teal-500 text-white px-2.5 py-1 rounded-full">
                    {settlements.length} settled
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                  {settlements.map((set) => (
                    <div
                      key={set.id}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                        <div>
                          <p className="font-extrabold text-slate-800 dark:text-white">
                            {set.payerName} paid {set.receiverName}{' '}
                            <span className="text-teal-600 dark:text-teal-400 font-black">
                              {formatCurrency(set.amountMinor, currency)}
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Recorded by {set.recordedByName} at {set.formattedTimestamp}
                            {set.note ? ` • "${set.note}"` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                        Completed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: FINANCIAL DASHBOARD & SETTLEMENTS */}
      {/* ==================================================== */}
      {activeTab === 'dashboard' && financialOverview && (
        <div className="space-y-6">
          {/* Section: Who pays whom? (Settlement Suggestions) */}
          <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>💸</span> Suggested Settlements (Who pays whom?)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Deterministic minimum cash flow calculations to settle all debts with the fewest transactions.
            </p>

            {financialOverview.settlementSuggestions.length === 0 ? (
              <div className="text-center py-10 px-4 mt-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                <span className="text-3xl">🎉</span>
                <p className="font-extrabold text-sm mt-1">All balances are completely settled!</p>
                <p className="text-xs opacity-80">Nobody owes money in this event.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
                {financialOverview.settlementSuggestions.map((sug, idx) => {
                  const isUserDebtor = sug.fromUid === user.uid;
                  const isUserCreditor = sug.toUid === user.uid;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        isUserDebtor
                          ? 'border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20'
                          : isUserCreditor
                          ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={sug.fromName} size="xs" />
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {sug.fromName} {isUserDebtor ? '(You)' : ''}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">owes</span>
                          <Avatar name={sug.toName} size="xs" />
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {sug.toName} {isUserCreditor ? '(You)' : ''}
                          </span>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {formatCurrency(sug.amountMinor, currency)}
                        </span>
                      </div>

                      {/* Action buttons: Settled! and Remind */}
                      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                        {/* Remind button: only for creditor */}
                        {isUserCreditor && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendReminder(sug.fromUid, sug.amountMinor)}
                            leftIcon={<BellRing className="w-3.5 h-3.5 text-amber-500" />}
                          >
                            Send Reminder
                          </Button>
                        )}

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setActiveSuggestion(sug);
                            setIsSettlementModalOpen(true);
                          }}
                          className="!bg-teal-500 hover:!bg-teal-600 shadow-sm"
                        >
                          Settled! 💸
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Individual Spending Table */}
          <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
              Individual Member Spending & Balances
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-extrabold">
                    <th className="pb-3">Member</th>
                    <th className="pb-3 text-right">Total Spent</th>
                    <th className="pb-3 text-right">Fair Share</th>
                    <th className="pb-3 text-right">Net Position</th>
                    <th className="pb-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                  {Object.values(financialOverview.memberSummaries).map((memberSummary) => {
                    const isPositive = memberSummary.netBalanceMinor > 0;
                    const isNegative = memberSummary.netBalanceMinor < 0;

                    return (
                      <tr key={memberSummary.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={memberSummary.photoURL}
                              name={memberSummary.displayName}
                              size="xs"
                            />
                            <span className="font-extrabold text-slate-800 dark:text-white">
                              {memberSummary.displayName}{' '}
                              {memberSummary.uid === user.uid ? '(You)' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                          {formatCurrency(memberSummary.spentMinor, currency)}
                        </td>
                        <td className="py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                          {formatCurrency(memberSummary.shareMinor, currency)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`font-black ${
                              isPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isNegative
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {formatCurrency(memberSummary.netBalanceMinor, currency, {
                              includeSign: true,
                            })}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          {isPositive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              Receives
                            </span>
                          ) : isNegative ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                              Owes
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: MEMBERS */}
      {/* ==================================================== */}
      {activeTab === 'members' && (
        <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Event Members ({Object.keys(event.members).length})
            </h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              leftIcon={<Share2 className="w-3.5 h-3.5" />}
            >
              Invite Friends
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.values(event.members).map((m) => (
              <div
                key={m.uid}
                className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-3"
              >
                <Avatar src={m.photoURL} name={m.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {m.displayName} {m.uid === user.uid ? '(You)' : ''}
                  </p>
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold truncate">
                    @{m.username || 'member'}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {m.role === 'host' ? '👑 Host' : 'Member'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        event={event}
        itemId={activeTargetItemId}
        currentUser={user}
        initialExpense={editingExpense}
        onSave={handleSaveExpense}
      />

      <SettlementModal
        isOpen={isSettlementModalOpen}
        onClose={() => setIsSettlementModalOpen(false)}
        suggestion={activeSuggestion}
        currency={currency}
        currentUser={user}
        onConfirm={handleRecordSettlement}
      />

      <BulkDeleteModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        selectedCount={selectedExpenses.length}
        totalAffectedAmountMinor={selectedTotalMinor}
        currency={currency}
        onConfirm={handleConfirmBulkDelete}
        isLoading={isBulkDeleting}
      />

      <InviteFriendModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        event={event}
        currentUser={user}
      />
    </div>
  );
};
