import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { useNotifications } from '@/app/providers/NotificationContext';
import {
  SplitifyEvent,
  EventItem,
  ExpenseEntry,
  SettlementEntry,
  PaymentConfirmation,
  Friendship,
  FriendRequest,
  EventMember,
} from '@/types';
import { dataService } from '@/services/dataService';
import { calculateEventFinancialOverview } from '@/domain/calculations/finance';
import { formatCurrency } from '@/utils/currency';
import { generatePlainTextExpenseReport } from '@/utils/exportReport';
import { formatDisplayExpenseDate } from '@/utils/date';
import { getEmojiForName } from '@/utils/emoji';
import { sortItemsChronologicalDesc, sortEntriesChronologicalDesc } from '@/utils/sorting';
import {
  isReminderOnCooldown,
  setReminderCooldown,
  isFriendRequestOnCooldown,
  setFriendRequestCooldown,
} from '@/utils/cooldown';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ExpenseModal } from '@/components/expenses/ExpenseModal';
import { PaymentDetailsModal } from '@/components/dashboard/PaymentDetailsModal';
import { ConfirmPaymentReceiptModal } from '@/components/dashboard/ConfirmPaymentReceiptModal';
import { BulkDeleteModal } from '@/components/expenses/BulkDeleteModal';
import { ShareInviteModal } from '@/components/events/ShareInviteModal';
import { SlotsModal } from '@/components/events/SlotsModal';
import { ItemInfoModal } from '@/components/expenses/ItemInfoModal';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Users,
  CheckSquare,
  Square,
  BellRing,
  CheckCircle,
  CheckCircle2,
  FolderPlus,
  Share2,
  Copy,
  LogOut,
  AlertTriangle,
  Search,
  X,
  CreditCard,
  Clock,
  Check,
  Info,
  UserPlus,
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
  const [paymentConfirmations, setPaymentConfirmations] = useState<PaymentConfirmation[]>([]);
  const [loading, setLoading] = useState(true);

  // Friends & friend request subscriptions
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [sentFriendRequests, setSentFriendRequests] = useState<FriendRequest[]>([]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'dashboard' | 'members'>('hierarchy');

  // Accordion open states for items (all open by default)
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  // Selection states for items and expenses
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Record<string, boolean>>({});

  // Item Info Modal
  const [isItemInfoModalOpen, setIsItemInfoModalOpen] = useState(false);
  const [activeInfoItem, setActiveInfoItem] = useState<EventItem | ExpenseEntry | null>(null);
  const [activeInfoCategoryName, setActiveInfoCategoryName] = useState<string | undefined>(undefined);
  const [activeInfoCategoryEmoji, setActiveInfoCategoryEmoji] = useState<string | undefined>(undefined);

  // Inline event rename state
  const [isEditingEventName, setIsEditingEventName] = useState(false);
  const [newEventName, setNewEventName] = useState('');

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [targetCategoryItemId, setTargetCategoryItemId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [editingItem, setEditingItem] = useState<EventItem | null>(null);

  // Two-Step Settlement Modals
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false);
  const [activeDebtorPayment, setActiveDebtorPayment] = useState<{
    creditorUid: string;
    creditorName: string;
    maxAmountMinor: number;
  } | null>(null);

  const [isConfirmReceiptModalOpen, setIsConfirmReceiptModalOpen] = useState(false);
  const [activePaymentConfirmation, setActivePaymentConfirmation] = useState<PaymentConfirmation | null>(null);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Feature expansion modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSlotsModalOpen, setIsSlotsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [sendingReminders, setSendingReminders] = useState<Record<string, boolean>>({});
  const [, setCooldownTick] = useState(0);

  // Periodically refresh 5-minute cooldown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubFriends = dataService.subscribeFriends(user.uid, setFriends);
    const unsubReqs = dataService.subscribeFriendRequests(user.uid, (reqs) => {
      setSentFriendRequests(reqs.filter((r) => r.fromUid === user.uid && r.status === 'pending'));
    });
    return () => {
      unsubFriends();
      unsubReqs();
    };
  }, [user]);

  const friendUids = useMemo(() => {
    const set = new Set<string>();
    for (const f of friends) {
      if (f.user1Uid === user?.uid) set.add(f.user2Uid);
      else if (f.user2Uid === user?.uid) set.add(f.user1Uid);
    }
    return set;
  }, [friends, user?.uid]);
  const pendingSentFriendRequestUids = useMemo(
    () => new Set(sentFriendRequests.map((r) => r.toUid)),
    [sentFriendRequests]
  );

  const handleSendFriendRequest = async (targetMember: EventMember) => {
    if (!user || targetMember.uid === user.uid || isFriendRequestOnCooldown(targetMember.uid)) return;
    try {
      const toUser = {
        uid: targetMember.uid,
        displayName: targetMember.displayName,
        username: targetMember.username || targetMember.displayName.toLowerCase().replace(/\s+/g, '_'),
        photoURL: targetMember.photoURL,
        email: '',
        createdAt: targetMember.joinedAt || Date.now(),
      };
      await dataService.sendFriendRequest(user, toUser);
      setFriendRequestCooldown(targetMember.uid);
      setCooldownTick((t) => t + 1);
      showToast(`Friend request sent to @${toUser.username}`);
    } catch (err: any) {
      alert(err.message || 'Failed to send friend request');
    }
  };

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

    const unsubPaymentConfirmations = dataService.subscribePaymentConfirmations(
      eventId,
      (confs) => {
        setPaymentConfirmations(confs);
      }
    );

    return () => {
      unsubEvent();
      unsubItems();
      unsubExpenses();
      unsubSettlements();
      unsubPaymentConfirmations();
    };
  }, [eventId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compute authoritative financial overview (includes standalone items, category subitems, and pending person slots)
  const financialOverview = useMemo(() => {
    if (!event) return null;
    return calculateEventFinancialOverview(
      event.members,
      expenses,
      settlements,
      user?.uid,
      items,
      event.slots || {}
    );
  }, [event, expenses, settlements, user?.uid, items]);

  const getMemberHandle = (member?: EventMember | null, fallbackUid?: string): string => {
    if (!member) {
      if (!fallbackUid) return '@unknown';
      return fallbackUid.startsWith('@') ? fallbackUid : `@${fallbackUid}`;
    }
    if (member.username) {
      return member.username.startsWith('@') ? member.username : `@${member.username}`;
    }
    const cleanName = member.displayName ? member.displayName.toLowerCase().replace(/\s+/g, '_') : 'user';
    return `@${cleanName}`;
  };

  const getPersonDisplayName = (id: string): string => {
    if (!id || !event) return '';
    if (event.members[id]) return getMemberHandle(event.members[id]);
    if (event.slots?.[id]) {
      const slot = event.slots[id];
      if (slot.isClaimed && slot.claimedByUid && event.members[slot.claimedByUid]) {
        return getMemberHandle(event.members[slot.claimedByUid]);
      }
      return `${slot.placeholderName} (Pending)`;
    }
    return id.startsWith('@') ? id : `@${id}`;
  };

  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategoryItem, setEditingCategoryItem] = useState<EventItem | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryEmoji, setEditingCategoryEmoji] = useState('📁');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const handleOpenEditCategory = (item: EventItem) => {
    setEditingCategoryItem(item);
    setEditingCategoryName(item.name);
    setEditingCategoryEmoji(item.emoji || '📁');
    setIsEditCategoryModalOpen(true);
  };

  const handleSaveCategoryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !user || !editingCategoryItem || !editingCategoryName.trim()) return;
    setIsSavingCategory(true);
    try {
      await dataService.updateItemName(
        event.id,
        editingCategoryItem.id,
        editingCategoryName.trim(),
        editingCategoryEmoji,
        user,
        event.members
      );
      showToast('Category updated');
      setIsEditCategoryModalOpen(false);
      setEditingCategoryItem(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Map expenses by itemId (sorted chronologically descending)
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
    for (const id of Object.keys(map)) {
      map[id] = sortEntriesChronologicalDesc(map[id]);
    }
    return map;
  }, [items, expenses]);

  // Compute item totals
  const itemTotalsMinor = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      if (item.isCategory) {
        const exps = expensesByItem[item.id] || [];
        map[item.id] = exps.reduce((sum, e) => sum + (e.costMinor || 0), 0);
      } else {
        map[item.id] = item.costMinor || 0;
      }
    }
    return map;
  }, [items, expensesByItem]);

  // Selected items & expenses calculations
  const selectedStandaloneItems = useMemo(() => {
    return items.filter(
      (i) => !i.deleted && !i.isSettlementsItem && !i.isCategory && selectedItemIds[i.id]
    );
  }, [items, selectedItemIds]);

  const selectedCategoryItems = useMemo(() => {
    return items.filter(
      (i) => !i.deleted && !i.isSettlementsItem && i.isCategory && selectedItemIds[i.id]
    );
  }, [items, selectedItemIds]);

  const selectedExpenses = useMemo(() => {
    return expenses.filter((e) => selectedExpenseIds[e.id] && !e.deleted);
  }, [expenses, selectedExpenseIds]);

  const totalSelectedCount = useMemo(() => {
    return selectedStandaloneItems.length + selectedCategoryItems.length + selectedExpenses.length;
  }, [selectedStandaloneItems, selectedCategoryItems, selectedExpenses]);

  const selectedTotalMinor = useMemo(() => {
    const standaloneSum = selectedStandaloneItems.reduce((sum, i) => sum + (i.costMinor || 0), 0);
    const expenseSum = selectedExpenses.reduce((sum, e) => sum + (e.costMinor || 0), 0);
    return standaloneSum + expenseSum;
  }, [selectedStandaloneItems, selectedExpenses]);

  // Handlers
  const handleToggleItemCollapse = (itemId: string) => {
    setCollapsedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
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

  const handleDeleteSettlement = async (settlement: SettlementEntry) => {
    if (!event || !user) return;
    const fromName = getPersonDisplayName(settlement.payerUid) || settlement.payerName || 'Member';
    const toName = getPersonDisplayName(settlement.receiverUid) || settlement.receiverName || 'Member';
    if (
      !window.confirm(
        `Delete settlement payment of ${formatCurrency(settlement.amountMinor, currency)} from ${fromName} to ${toName}?`
      )
    )
      return;
    try {
      await dataService.deleteSettlement(event.id, settlement.id, user, event.members);
      showToast('Settlement deleted');
    } catch (err: any) {
      alert(err.message || 'Failed to delete settlement');
    }
  };

  const handleDeleteItem = async (item: EventItem) => {
    if (!event || !user) return;
    const itemExps = expensesByItem[item.id] || [];
    const count = itemExps.length;
    const msg = count > 0
      ? `Delete "${item.name}" and all ${count} active expense(s) inside it?`
      : `Delete "${item.name}"?`;
    if (!window.confirm(msg)) return;

    try {
      await dataService.deleteItem(event.id, item.id, user, event.members);
      showToast('Expense item deleted');
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  // Convert standalone item to category with subitems
  const handleConvertToCategory = async (itemId: string) => {
    if (!event || !user) return;
    try {
      await dataService.convertItemToCategory(event.id, itemId, user);
      showToast('Converted to category! You can now add subitems.');
    } catch (err: any) {
      alert(err.message || 'Failed to convert item');
    }
  };

  // Plain-Text Export
  const handleCopyExpenses = async () => {
    if (!event) return;
    try {
      const origin = window?.location?.origin || 'https://k-692.github.io';
      const cleanEventUrl = `${origin}/Splitify/events/${event.id}`;
      const report = generatePlainTextExpenseReport(
        event,
        items,
        expenses,
        settlements,
        cleanEventUrl
      );

      await navigator.clipboard.writeText(report);
      showToast('📋 Expenses report copied to clipboard!');

      // Offer native share on mobile if supported
      if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        try {
          await navigator.share({
            title: `${event.name} — Expenses Report`,
            text: report,
          });
        } catch {
          // User dismissed share dialog
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to copy expenses report');
    }
  };

  // Delete event (host only)
  const handleConfirmDeleteEvent = async () => {
    if (!event || !user) return;
    try {
      await dataService.deleteEvent(event.id, user);
      setIsDeleteModalOpen(false);
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to delete event');
    }
  };

  // Leave event (member only)
  const handleConfirmLeaveEvent = async () => {
    if (!event || !user) return;
    try {
      await dataService.leaveEvent(event.id, user);
      setIsLeaveModalOpen(false);
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to leave event');
    }
  };

  // Save Expense (Handles standalone items, subitems, and edits)
  const handleSaveExpense = async (data: any) => {
    if (!event || !user) return;

    if (editingItem) {
      // Editing a standalone item
      await dataService.updateExpenseItem(
        event.id,
        editingItem.id,
        data,
        user,
        event.members
      );
      showToast('Expense updated');
    } else if (editingExpense) {
      // Editing a subitem
      await dataService.updateExpense(
        event.id,
        editingExpense.id,
        data,
        user,
        event.members
      );
      showToast('Expense updated');
    } else if (targetCategoryItemId) {
      // Adding a subitem to a category
      await dataService.createExpense(
        {
          ...data,
          eventId: event.id,
          itemId: targetCategoryItemId,
        },
        user,
        event.members
      );
      showToast('Subitem added');
    } else {
      // Item-First: Adding a standalone expense item directly!
      await dataService.createExpenseItem(
        {
          ...data,
          eventId: event.id,
        },
        user,
        event.members
      );
      showToast('New expense item added');
    }

    setIsExpenseModalOpen(false);
    setEditingItem(null);
    setEditingExpense(null);
    setTargetCategoryItemId(null);
  };

  const handleSaveCategoryWithSubitems = async (
    categoryName: string,
    subitems: any[]
  ) => {
    if (!event || !user) return;
    try {
      const categoryId = await dataService.createItem(event.id, categoryName, user);
      await dataService.convertItemToCategory(event.id, categoryId, user);
      for (const sub of subitems) {
        await dataService.createExpense(
          {
            ...sub,
            eventId: event.id,
            itemId: categoryId,
          },
          user,
          event.members
        );
      }
      showToast(`Created category "${categoryName}" with ${subitems.length} subitem(s)`);
      setIsExpenseModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create category and subitems');
    }
  };

  const handleToggleSelectAllEvent = () => {
    const activeEventItems = items.filter((i) => !i.deleted && !i.isSettlementsItem);
    const activeExps = expenses.filter((e) => !e.deleted);
    const isAllSelected =
      activeEventItems.length > 0 &&
      activeEventItems.every((i) => selectedItemIds[i.id]) &&
      (activeExps.length === 0 || activeExps.every((e) => selectedExpenseIds[e.id]));

    if (isAllSelected) {
      setSelectedItemIds({});
      setSelectedExpenseIds({});
    } else {
      const newItems: Record<string, boolean> = {};
      for (const i of activeEventItems) newItems[i.id] = true;
      const newExps: Record<string, boolean> = {};
      for (const e of activeExps) newExps[e.id] = true;
      setSelectedItemIds(newItems);
      setSelectedExpenseIds(newExps);
    }
  };

  const handleToggleSelectItem = (itemId: string) => {
    const itemExps = expensesByItem[itemId] || [];
    const isCurrentlySelected = Boolean(selectedItemIds[itemId]);
    const newState = !isCurrentlySelected;

    setSelectedItemIds((prev) => ({ ...prev, [itemId]: newState }));
    setSelectedExpenseIds((prev) => {
      const updated = { ...prev };
      for (const e of itemExps) {
        updated[e.id] = newState;
      }
      return updated;
    });
  };

  const handleToggleSelectDirectItem = (itemId: string) => {
    setSelectedItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
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
      const itemIds = [
        ...selectedStandaloneItems.map((i) => i.id),
        ...selectedCategoryItems.map((i) => i.id),
      ];
      const expIds = selectedExpenses.map((e) => e.id);
      await dataService.bulkDeleteEventItems(
        event.id,
        itemIds,
        expIds,
        user,
        event.members,
        event.name
      );
      setSelectedItemIds({});
      setSelectedExpenseIds({});
      setIsBulkDeleteModalOpen(false);
      showToast(`Deleted ${itemIds.length + expIds.length} item(s)`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected items');
    } finally {
      setIsBulkDeleting(false);
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

  const handleOpenDebtorPaymentModal = (
    creditorUid: string,
    creditorName: string,
    maxAmountMinor: number
  ) => {
    setActiveDebtorPayment({
      creditorUid,
      creditorName,
      maxAmountMinor,
    });
    setIsPaymentDetailsModalOpen(true);
  };

  const handleOpenConfirmReceiptModal = (confirmation: PaymentConfirmation) => {
    setActivePaymentConfirmation(confirmation);
    setIsConfirmReceiptModalOpen(true);
  };

  const handleCreatePaymentConfirmation = async (data: {
    debtorUid: string;
    debtorName: string;
    creditorUid: string;
    creditorName: string;
    amountMinor: number;
    paymentMethod: string;
    paymentReference: string;
    paymentNote: string;
    paidDate: string;
    paidTime: string;
    occurredAt: number;
  }) => {
    if (!event || !user) return;
    try {
      await dataService.createPaymentConfirmation(
        {
          ...data,
          eventId: event.id,
          eventName: event.name,
        },
        user
      );
      showToast('Payment marked as paid! Awaiting creditor confirmation. ⏳');
      setIsPaymentDetailsModalOpen(false);
      setActiveDebtorPayment(null);
    } catch (err: any) {
      alert(err.message || 'Failed to submit payment details');
    }
  };

  const handleConfirmPaymentReceipt = async (confirmation: PaymentConfirmation) => {
    if (!event || !user) return;
    try {
      await dataService.confirmPaymentReceipt(confirmation, user, event.name);
      showToast('Payment confirmed! Settlement recorded. 💸');
      setIsConfirmReceiptModalOpen(false);
      setActivePaymentConfirmation(null);
    } catch (err: any) {
      alert(err.message || 'Failed to confirm payment receipt');
    }
  };

  const handleReportNotReceived = async (
    confirmation: PaymentConfirmation,
    reason?: string
  ) => {
    if (!event || !user) return;
    try {
      await dataService.rejectPaymentConfirmation(confirmation, user, event.name, reason);
      showToast('Payment marked as not received. Debt restored.');
      setIsConfirmReceiptModalOpen(false);
      setActivePaymentConfirmation(null);
    } catch (err: any) {
      alert(err.message || 'Failed to reject payment confirmation');
    }
  };

  const handleSendReminder = async (debtorUid: string, amountMinor: number) => {
    if (!event || !user || sendingReminders[debtorUid] || isReminderOnCooldown(debtorUid, event.id)) return;
    setSendingReminders((prev) => ({ ...prev, [debtorUid]: true }));
    try {
      await sendReminder(debtorUid, amountMinor, event.name);
      setReminderCooldown(debtorUid, event.id);
      setCooldownTick((t) => t + 1);
      showToast('Payment reminder sent! 🔔');
    } catch (err: any) {
      alert(err.message || 'Failed to send reminder');
    } finally {
      setSendingReminders((prev) => ({ ...prev, [debtorUid]: false }));
    }
  };

  const currency = event?.currency || 'INR';
  const isHost = Boolean(event && user && event.hostUid === user.uid);
  const activeItems = useMemo(() => {
    const nonDeleted = items.filter((i) => !i.deleted);
    return sortItemsChronologicalDesc(nonDeleted, expenses);
  }, [items, expenses]);
  const slotsCount = event?.slots ? Object.keys(event.slots).length : 0;

  const { debtsOwedToCurrentUser, userOwesMember } = useMemo(() => {
    const owed: Record<string, number> = {};
    const owes: Record<string, number> = {};
    if (financialOverview && user) {
      for (const sug of financialOverview.settlementSuggestions) {
        if (sug.toUid === user.uid && sug.amountMinor > 0) {
          owed[sug.fromUid] = (owed[sug.fromUid] || 0) + sug.amountMinor;
        }
        if (sug.fromUid === user.uid && sug.amountMinor > 0) {
          owes[sug.toUid] = (owes[sug.toUid] || 0) + sug.amountMinor;
        }
      }
    }
    return { debtsOwedToCurrentUser: owed, userOwesMember: owes };
  }, [financialOverview, user]);

  const normalizedSearchQuery = expenseSearchQuery.trim().toLowerCase();

  const { displayedItems, matchingSubitemIdsByItem } = useMemo(() => {
    if (!normalizedSearchQuery) {
      return { displayedItems: activeItems, matchingSubitemIdsByItem: {} as Record<string, Set<string>> };
    }

    const matchesPayer = (paidByUid?: string, payerName?: string) => {
      if (!paidByUid && !payerName) return false;
      if (payerName && payerName.toLowerCase().includes(normalizedSearchQuery)) return true;
      if (paidByUid) {
        const member = event?.members?.[paidByUid];
        if (member?.displayName?.toLowerCase().includes(normalizedSearchQuery)) return true;
        const slot = event?.slots?.[paidByUid];
        if (slot?.placeholderName?.toLowerCase().includes(normalizedSearchQuery)) return true;
      }
      return false;
    };

    const matchingIds: Record<string, Set<string>> = {};
    const filtered: EventItem[] = [];

    for (const item of activeItems) {
      if (item.isSettlementsItem) {
        if (
          item.name.toLowerCase().includes(normalizedSearchQuery) ||
          'settlements'.includes(normalizedSearchQuery) ||
          'payments'.includes(normalizedSearchQuery)
        ) {
          filtered.push(item);
        }
        continue;
      }

      if (item.isCategory) {
        const categoryNameMatches = item.name.toLowerCase().includes(normalizedSearchQuery);
        const categorySubs = expensesByItem[item.id] || [];
        const matchingSubs = categorySubs.filter(
          (exp) =>
            exp.name.toLowerCase().includes(normalizedSearchQuery) ||
            (exp.comment && exp.comment.toLowerCase().includes(normalizedSearchQuery)) ||
            matchesPayer(exp.paidBy, exp.createdByName)
        );

        if (categoryNameMatches) {
          filtered.push(item);
          matchingIds[item.id] = new Set(categorySubs.map((s) => s.id));
        } else if (matchingSubs.length > 0) {
          filtered.push(item);
          matchingIds[item.id] = new Set(matchingSubs.map((s) => s.id));
        }
        continue;
      }

      // Standalone item
      const itemMatches =
        item.name.toLowerCase().includes(normalizedSearchQuery) ||
        (item.comment && item.comment.toLowerCase().includes(normalizedSearchQuery)) ||
        matchesPayer(item.paidBy, item.createdByName);

      if (itemMatches) {
        filtered.push(item);
      }
    }

    return { displayedItems: filtered, matchingSubitemIdsByItem: matchingIds };
  }, [activeItems, normalizedSearchQuery, expensesByItem, event]);

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
        <Button variant="primary" className="mt-4" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#203D62] text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Event Header */}
      <div className="bg-white dark:bg-[#15263C] rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#203D62] dark:text-white tracking-tight truncate">
                    {event.name}
                  </h1>
                  <button
                    onClick={() => {
                      setNewEventName(event.name);
                      setIsEditingEventName(true);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit event name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2.5 mt-1 text-xs text-slate-500 dark:text-slate-400 font-semibold flex-wrap">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-teal-500" />
                  {Object.keys(event.members).length} members
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  {slotsCount} {slotsCount === 1 ? 'person' : 'people'}
                </span>
                <span>•</span>
                <span>Currency: {currency}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Prominent Add Expense FIRST, then secondary actions at the end */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Primary Add Expense Button */}
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setTargetCategoryItemId(null);
                setEditingExpense(null);
                setEditingItem(null);
                setIsExpenseModalOpen(true);
              }}
              className="shadow-md shadow-teal-500/20 px-4 font-bold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Add Expense</span>
            </Button>

            {/* Secondary Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyExpenses}
              title="Copy formatted expenses summary with invitation link at the top"
              className="text-teal-700 dark:text-teal-300 font-bold"
            >
              <Copy className="w-3.5 h-3.5 mr-1 text-teal-500" />
              <span>Copy Expenses</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsShareModalOpen(true)}
              className="font-bold"
            >
              <Share2 className="w-3.5 h-3.5 mr-1 text-teal-500" />
              <span>Invite</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSlotsModalOpen(true)}
              className="font-bold"
            >
              <Users className="w-3.5 h-3.5 mr-1 text-amber-500" />
              <span>People</span>
            </Button>

            {/* Event Management: Delete Event (Host) or Leave Event (Member) */}
            {isHost ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                title="Delete Event"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
                <span>Delete Event</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLeaveModalOpen(true)}
                title="Leave Event"
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 border-amber-200 dark:border-amber-900 font-bold"
              >
                <LogOut className="w-3.5 h-3.5 mr-1 text-amber-500" />
                <span>Leave Event</span>
              </Button>
            )}
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        {financialOverview && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800/80">
            {/* Total Expense */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Event Expense
              </span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatCurrency(financialOverview.totalExpenseMinor, currency)}
              </p>
              <span className="text-[10px] text-slate-400">Combined items</span>
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
                You paid {formatCurrency(financialOverview.currentUserSpentMinor, currency)}
              </span>
            </div>

            {/* Your Net Balance */}
            <div
              className={`p-4 rounded-2xl border ${
                financialOverview.currentUserNetBalanceMinor > 0
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60'
                  : financialOverview.currentUserNetBalanceMinor < 0
                  ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-800/60'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Your Net Balance
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
                  ? 'Other members owe you'
                  : financialOverview.currentUserNetBalanceMinor < 0
                  ? 'You need to settle with others'
                  : 'No outstanding debt for you'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'hierarchy'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Expenses ({activeItems.length})
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Settlements</span>
          {financialOverview && financialOverview.settlementSuggestions.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#F36B2C]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          People ({Object.keys(event.members).length})
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: ITEM-FIRST EXPENSES */}
      {/* ==================================================== */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          {/* Search bar immediately above expenses hierarchy (Section 6) */}
          {activeItems.length > 0 && (
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search expenses by name, category, comment, or payer..."
                value={expenseSearchQuery}
                onChange={(e) => setExpenseSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#15263C] text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder:text-slate-400 transition-all shadow-sm"
              />
              {expenseSearchQuery && (
                <button
                  type="button"
                  onClick={() => setExpenseSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Global Selection Bar for All Items and Expenses under the event */}
          {activeItems.length > 0 && !normalizedSearchQuery && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAllEvent}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-teal-600"
                >
                  {totalSelectedCount > 0 &&
                  activeItems.every((i) => selectedItemIds[i.id]) &&
                  (expenses.filter((e) => !e.deleted).length === 0 ||
                    expenses.filter((e) => !e.deleted).every((e) => selectedExpenseIds[e.id])) ? (
                    <CheckSquare className="w-4 h-4 text-teal-500" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Select All ({totalSelectedCount} selected)</span>
                </button>

                {totalSelectedCount > 0 && (
                  <span className="text-xs font-extrabold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 rounded-full">
                    Total: {formatCurrency(selectedTotalMinor, currency)}
                  </span>
                )}
              </div>

              {totalSelectedCount > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete Selected ({totalSelectedCount})
                </Button>
              )}
            </div>
          )}

          {/* Empty state when no expenses exist in the event */}
          {activeItems.length === 0 && (
            <div className="text-center py-16 px-4 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-4xl">🧾</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-2">
                No expenses recorded yet
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Add an expense item directly (like Airport Cab, Dinner, or Tickets) and split with members or slots!
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-5"
                onClick={() => {
                  setTargetCategoryItemId(null);
                  setEditingExpense(null);
                  setEditingItem(null);
                  setIsExpenseModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Your First Expense
              </Button>
            </div>
          )}

          {/* Empty search results state (Section 6) */}
          {activeItems.length > 0 && normalizedSearchQuery && displayedItems.length === 0 && (
            <div className="text-center py-14 px-4 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
              <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-2">
                No matching expenses found.
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                No expenses, categories, or comments matched &quot;{expenseSearchQuery}&quot;.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpenseSearchQuery('')}
                className="mt-4 text-xs"
              >
                Clear Search
              </Button>
            </div>
          )}

          {/* Item-First List */}
          <div className="space-y-4">
            {displayedItems.map((item) => {
              const isCategory = Boolean(item.isCategory);
              const isSettlement = Boolean(item.isSettlementsItem);
              const isCollapsed = !normalizedSearchQuery && Boolean(collapsedItems[item.id]);
              const rawItemExpenses = expensesByItem[item.id] || [];
              const itemExpenses =
                normalizedSearchQuery && matchingSubitemIdsByItem[item.id]
                  ? rawItemExpenses.filter((e) => matchingSubitemIdsByItem[item.id].has(e.id))
                  : rawItemExpenses;
              const itemTotalMinor = itemTotalsMinor[item.id] || 0;
              const allItemExpensesSelected =
                Boolean(selectedItemIds[item.id]) ||
                (itemExpenses.length > 0 && itemExpenses.every((e) => selectedExpenseIds[e.id]));

              // ----------------------------------------------------
              // A. CATEGORY ITEM (Contains subitems)
              // ----------------------------------------------------
              if (isCategory) {
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-[#15263C] rounded-3xl border border-teal-500/30 dark:border-teal-500/20 shadow-sm overflow-hidden transition-all"
                  >
                    {/* Category Header */}
                    <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-teal-500/5 dark:bg-teal-950/20 border-b border-teal-500/10 select-none">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
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

                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(item.id)}
                          className="text-slate-400 hover:text-teal-600 transition-colors"
                          title="Select all subitems in this category"
                        >
                          {allItemExpensesSelected || selectedItemIds[item.id] ? (
                            <CheckSquare className="w-4 h-4 text-teal-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <span className="text-2xl flex-shrink-0">{item.emoji}</span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400">
                              Category
                            </span>
                            <h3
                              onClick={() => handleToggleItemCollapse(item.id)}
                              className="text-base sm:text-lg font-black text-[#203D62] dark:text-white truncate cursor-pointer hover:text-teal-600"
                            >
                              {item.name}
                            </h3>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {itemExpenses.length} {itemExpenses.length === 1 ? 'subitem' : 'subitems'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="text-right mr-1">
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block text-[10px] uppercase">
                            Total
                          </span>
                          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                            {formatCurrency(itemTotalMinor, currency)}
                          </span>
                        </div>

                        <Button
                          variant="teal"
                          size="sm"
                          onClick={() => {
                            setTargetCategoryItemId(item.id);
                            setEditingExpense(null);
                            setEditingItem(null);
                            setIsExpenseModalOpen(true);
                          }}
                          className="!py-1 !px-2.5 text-xs font-bold"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add Subitem
                        </Button>

                        {/* Info Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveInfoItem(item);
                            setActiveInfoCategoryName(undefined);
                            setActiveInfoCategoryEmoji(undefined);
                            setIsItemInfoModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Category info"
                        >
                          <Info className="w-4 h-4" />
                        </button>

                        {/* Edit Category */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditCategory(item)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Category */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Delete Category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Subitems List under Category */}
                    {!isCollapsed && (
                      <div className="p-3 sm:p-4 space-y-2.5 bg-slate-50/40 dark:bg-slate-900/40">
                        {itemExpenses.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400">
                            No subitems in this category yet. Click "Add Subitem" above!
                          </div>
                        ) : (
                          itemExpenses.map((expense) => {
                            const isSelected = Boolean(selectedExpenseIds[expense.id]);

                            return (
                              <div
                                key={expense.id}
                                className={`p-3.5 rounded-2xl border transition-all ${
                                  isSelected
                                    ? 'border-teal-500/50 bg-teal-50/40 dark:bg-teal-950/20'
                                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#15263C]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSelectExpense(expense.id)}
                                      className="text-slate-400 hover:text-teal-600 transition-colors"
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-4 h-4 text-teal-500" />
                                      ) : (
                                        <Square className="w-4 h-4" />
                                      )}
                                    </button>

                                    <span className="text-xl flex-shrink-0">{expense.emoji}</span>

                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {expense.name}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                                        <span>
                                          Paid by{' '}
                                          <strong className="text-slate-700 dark:text-slate-200">
                                            {getPersonDisplayName(expense.paidBy) || (expense.createdByName?.startsWith('@') ? expense.createdByName : `@${(expense.createdByName || 'unknown').toLowerCase().replace(/\s+/g, '_')}`)}
                                          </strong>
                                        </span>
                                        {expense.expenseDate && (
                                          <>
                                            <span>•</span>
                                            <span>{formatDisplayExpenseDate(expense.expenseDate)}</span>
                                          </>
                                        )}
                                        <span>•</span>
                                        <span>
                                          Split ({expense.participants.length} members)
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-base font-extrabold text-slate-900 dark:text-white mr-1">
                                      {formatCurrency(expense.costMinor, currency)}
                                    </span>

                                    {/* Info Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveInfoItem(expense);
                                        setActiveInfoCategoryName(item.name);
                                        setActiveInfoCategoryEmoji(item.emoji);
                                        setIsItemInfoModalOpen(true);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                      title="Item details"
                                    >
                                      <Info className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Edit Subitem */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingExpense(expense);
                                        setEditingItem(null);
                                        setTargetCategoryItemId(item.id);
                                        setIsExpenseModalOpen(true);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                      title="Edit Subitem"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete Subitem */}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSingleExpense(expense)}
                                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10"
                                      title="Delete Subitem"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}

                        {itemExpenses.length > 0 && (
                          <div className="pt-2 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTargetCategoryItemId(item.id);
                                setEditingExpense(null);
                                setEditingItem(null);
                                setIsExpenseModalOpen(true);
                              }}
                              className="text-xs font-bold text-teal-600 dark:text-teal-400 !py-1 !px-2.5 rounded-xl border-dashed border-teal-300 dark:border-teal-700/60 hover:bg-teal-50 dark:hover:bg-teal-950/20"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Add Subitem
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // ----------------------------------------------------
              // B. SETTLEMENTS ITEM (Special ledger view)
              // ----------------------------------------------------
              if (isSettlement) {
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-[#15263C] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
                  >
                    <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-amber-500/5 dark:bg-amber-950/20 border-b border-amber-500/10">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl flex-shrink-0">💸</span>
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-[#203D62] dark:text-white">
                            Settlements Ledger
                          </h3>
                          <span className="text-[11px] text-slate-400">
                            {settlements.filter((s) => s.status === 'completed').length} completed payments
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveTab('dashboard')}
                      >
                        Settle
                      </Button>
                    </div>

                    <div className="p-4 space-y-2">
                      {settlements.length === 0 ? (
                        <div className="text-center py-4 text-xs text-slate-400">
                          No settlements recorded yet.
                        </div>
                      ) : (
                        sortEntriesChronologicalDesc(settlements).map((s) => {
                          const fromName = getPersonDisplayName(s.payerUid) || s.payerName || 'Member';
                          const toName = getPersonDisplayName(s.receiverUid) || s.receiverName || 'Member';

                          return (
                            <div
                              key={s.id}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                <span>
                                  <strong className="text-slate-800 dark:text-white font-bold">
                                    {fromName}
                                  </strong>{' '}
                                  paid{' '}
                                  <strong className="text-slate-800 dark:text-white font-bold">
                                    {toName}
                                  </strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <span className="font-extrabold text-slate-900 dark:text-white">
                                  {formatCurrency(s.amountMinor, currency)}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteSettlement(s)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                                  title="Delete settlement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              }

              // ----------------------------------------------------
              // C. STANDALONE ITEM (Item-First Direct Expense)
              // ----------------------------------------------------
              const isDirectItemSelected = Boolean(selectedItemIds[item.id]);

              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-[#15263C] rounded-3xl border shadow-sm p-4 sm:p-5 transition-all ${
                    isDirectItemSelected
                      ? 'border-teal-500/60 bg-teal-50/20 dark:bg-teal-950/20'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-teal-500/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Checkbox, Emoji, Name, Payer, Participants */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectDirectItem(item.id)}
                        className="text-slate-400 hover:text-teal-600 transition-colors mt-1 shrink-0"
                        title="Select this expense"
                      >
                        {isDirectItemSelected ? (
                          <CheckSquare className="w-4 h-4 text-teal-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <span className="text-3xl flex-shrink-0 mt-0.5">{item.emoji}</span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-[#203D62] dark:text-white truncate">
                            {item.name}
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                            Direct Expense
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                          <span>
                            Paid by{' '}
                            <strong className="text-slate-700 dark:text-slate-200 font-bold">
                              {getPersonDisplayName(item.paidBy || '') || (item.createdByName?.startsWith('@') ? item.createdByName : `@${(item.createdByName || 'unknown').toLowerCase().replace(/\s+/g, '_')}`)}
                            </strong>
                          </span>
                          {item.expenseDate && (
                            <>
                              <span>•</span>
                              <span>{formatDisplayExpenseDate(item.expenseDate)}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            Split ({item.participants?.length || Object.keys(item.shares || {}).length} participants)
                          </span>
                          {item.comment && (
                            <>
                              <span>•</span>
                              <span className="italic text-slate-500 truncate max-w-xs">
                                "{item.comment}"
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mr-1">
                        {formatCurrency(item.costMinor || 0, currency)}
                      </span>

                      {/* Info Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInfoItem(item);
                          setActiveInfoCategoryName(undefined);
                          setActiveInfoCategoryEmoji(undefined);
                          setIsItemInfoModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Item details"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      {/* Convert to category button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConvertToCategory(item.id)}
                        title="Convert to Category so you can add subitems under this expense"
                        className="text-xs font-bold text-teal-600 dark:text-teal-400 !py-1 !px-2.5"
                      >
                        <FolderPlus className="w-3.5 h-3.5 mr-1" />
                        Add Subitems
                      </Button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setEditingExpense(null);
                          setTargetCategoryItemId(null);
                          setIsExpenseModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit Expense"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Expense */}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: SETTLEMENTS */}
      {/* ==================================================== */}
      {activeTab === 'dashboard' && financialOverview && (
        <div className="space-y-6">
          {/* 1. Debt Simplification / Optimal Settlement Suggestions */}
          <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🤝</span> Optimal Settlement Suggestions
                </h3>
                <p className="text-xs text-slate-400">
                  Minimal transactions calculated automatically to settle all debts.
                </p>
              </div>

              {financialOverview.isBalanced && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Zero-Sum Balanced
                </span>
              )}
            </div>

            {financialOverview.settlementSuggestions.length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-teal-600 dark:text-teal-400">
                🎉 All event expenses are completely settled! No outstanding payments.
              </div>
            ) : (
              <div className="space-y-2.5">
                {financialOverview.settlementSuggestions.map((sug, idx) => {
                  const fromMember = event.members[sug.fromUid];
                  const fromName = getPersonDisplayName(sug.fromUid) || sug.fromName || 'Member';
                  const toName = getPersonDisplayName(sug.toUid) || sug.toName || 'Member';
                  const isUserInvolved = sug.fromUid === user.uid || sug.toUid === user.uid;

                  // Check if there is an active pending confirmation between these two
                  const pendingConf = paymentConfirmations.find(
                    (pc) =>
                      pc.debtorUid === sug.fromUid &&
                      pc.creditorUid === sug.toUid &&
                      pc.status === 'awaiting_confirmation'
                  );

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isUserInvolved
                          ? 'border-teal-500/40 bg-teal-50/20 dark:bg-teal-950/15'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={fromMember?.photoURL}
                          name={fromName}
                          size="sm"
                        />
                        <div className="text-xs">
                          <span className="font-extrabold text-slate-800 dark:text-white">
                            {fromName} {sug.fromUid === user.uid ? '(You)' : ''}
                          </span>
                          <span className="text-slate-400 mx-1.5">owes</span>
                          <strong className="text-slate-800 dark:text-white font-extrabold">
                            {toName} {sug.toUid === user.uid ? '(You)' : ''}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {formatCurrency(sug.amountMinor, currency)}
                        </span>

                        {/* Debtor Action: Paid or Awaiting Confirmation */}
                        {sug.fromUid === user.uid && (
                          pendingConf ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              Awaiting Confirmation ({formatCurrency(pendingConf.amountMinor, currency)})
                            </span>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                handleOpenDebtorPaymentModal(sug.toUid, toName, sug.amountMinor)
                              }
                              leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                            >
                              Paid
                            </Button>
                          )
                        )}

                        {/* Creditor Action: Settle Now (Confirm Receipt) */}
                        {sug.toUid === user.uid && pendingConf && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleOpenConfirmReceiptModal(pendingConf)}
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                          >
                            Settle Now
                          </Button>
                        )}

                        {/* Send Reminder: Anybody can do it. No permissions required. Prevents spamming for 5 mins */}
                        {sug.fromUid !== user.uid && !pendingConf && (
                          isReminderOnCooldown(sug.fromUid, event.id) ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              Reminder sent
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={Boolean(sendingReminders[sug.fromUid])}
                              isLoading={Boolean(sendingReminders[sug.fromUid])}
                              onClick={() => handleSendReminder(sug.fromUid, sug.amountMinor)}
                              leftIcon={<BellRing className="w-3.5 h-3.5 text-amber-500" />}
                            >
                              Send Reminder
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Individual Member Totals */}
          <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>👥</span> Individual Member Totals
                </h3>
                <p className="text-xs text-slate-400">
                  Individual spending, fair share allocation, and current net balances.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {Object.entries(financialOverview.memberSummaries).map(([uid, summary]) => {
                const member = event.members[uid];
                const displayName = getPersonDisplayName(uid) || summary.displayName;
                const owesYou = debtsOwedToCurrentUser[uid] || 0;
                const youOwe = userOwesMember[uid] || 0;

                const debtorPending = paymentConfirmations.find(
                  (pc) => pc.debtorUid === user.uid && pc.creditorUid === uid && pc.status === 'awaiting_confirmation'
                );
                const creditorPending = paymentConfirmations.find(
                  (pc) => pc.debtorUid === uid && pc.creditorUid === user.uid && pc.status === 'awaiting_confirmation'
                );

                return (
                  <div
                    key={uid}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2.5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          src={member?.photoURL}
                          name={displayName}
                          size="sm"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-white block">
                            {displayName} {uid === user.uid ? '(You)' : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {member?.role || 'Member'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                          summary.netBalanceMinor > 0
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : summary.netBalanceMinor < 0
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}
                      >
                        {summary.netBalanceMinor > 0
                          ? `+${formatCurrency(summary.netBalanceMinor, currency)} (gets)`
                          : summary.netBalanceMinor < 0
                          ? `-${formatCurrency(Math.abs(summary.netBalanceMinor), currency)} (owes)`
                          : 'Settled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Paid:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {formatCurrency(summary.spentMinor, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Fair Share:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {formatCurrency(summary.shareMinor, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Member owes money: anybody can remind them! No permissions required. Prevents spamming for 5 mins */}
                    {summary.netBalanceMinor < 0 && uid !== user.uid && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          {owesYou > 0
                            ? `Owes you ${formatCurrency(owesYou, currency)}`
                            : `Owes ${formatCurrency(Math.abs(summary.netBalanceMinor), currency)}`}
                        </span>
                        {creditorPending ? (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 px-2.5 rounded-xl"
                            onClick={() => handleOpenConfirmReceiptModal(creditorPending)}
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                          >
                            Settle Now
                          </Button>
                        ) : isReminderOnCooldown(uid, event.id) ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-xl">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            Reminder sent
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={Boolean(sendingReminders[uid])}
                            isLoading={Boolean(sendingReminders[uid])}
                            onClick={() => handleSendReminder(uid, Math.abs(summary.netBalanceMinor))}
                            leftIcon={<BellRing className="w-3.5 h-3.5 text-amber-500" />}
                            className="text-xs py-1 px-2.5 rounded-xl border-amber-300 dark:border-amber-700/60 hover:bg-amber-50 dark:hover:bg-amber-950/20 shadow-none"
                          >
                            Send Reminder
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Current user owes member */}
                    {youOwe > 0 && uid !== user.uid && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          You owe {formatCurrency(youOwe, currency)}
                        </span>
                        {debtorPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-lg">
                            <Clock className="w-3 h-3" />
                            Awaiting Confirmation ({formatCurrency(debtorPending.amountMinor, currency)})
                          </span>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenDebtorPaymentModal(uid, displayName, youOwe)}
                            leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                            className="text-xs py-1 px-2.5 rounded-xl"
                          >
                            Paid
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Pending Payment Confirmations */}
          {paymentConfirmations.filter((pc) => pc.status === 'awaiting_confirmation').length > 0 && (
            <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 border border-amber-200/80 dark:border-amber-900/40 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Pending Payment Confirmations (
                    {paymentConfirmations.filter((pc) => pc.status === 'awaiting_confirmation').length}
                    )
                  </h3>
                  <p className="text-xs text-slate-400">
                    Payments marked as Paid awaiting creditor verification and confirmation.
                  </p>
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full">
                  Awaiting Receipt
                </span>
              </div>

              <div className="space-y-3">
                {sortEntriesChronologicalDesc(
                  paymentConfirmations.filter((pc) => pc.status === 'awaiting_confirmation')
                ).map((pc) => {
                  const fromName = getPersonDisplayName(pc.debtorUid) || pc.debtorName || 'Member';
                  const toName = getPersonDisplayName(pc.creditorUid) || pc.creditorName || 'Member';
                  const isCreditor = pc.creditorUid === user.uid;

                  return (
                    <div
                      key={pc.id}
                      className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
                          ₹
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>{fromName} {pc.debtorUid === user.uid ? '(You)' : ''}</span>
                            <span className="text-slate-400">paid</span>
                            <span>{toName} {pc.creditorUid === user.uid ? '(You)' : ''}</span>
                            <span className="text-amber-600 dark:text-amber-400 font-extrabold ml-1">
                              {formatCurrency(pc.amountMinor, currency)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                            {pc.paymentMethod && <span className="capitalize">{pc.paymentMethod.replace('_', ' ')}</span>}
                            {pc.paymentReference && <span>• Ref: {pc.paymentReference}</span>}
                            {pc.paidDate && <span>• {pc.paidDate} {pc.paidTime || ''}</span>}
                            {pc.paymentNote && <span className="italic">• "{pc.paymentNote}"</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        {isCreditor ? (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleOpenConfirmReceiptModal(pc)}
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                          >
                            Settle Now
                          </Button>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Awaiting Creditor Confirmation
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Settlement History (Completed Settlements) */}
          <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Settlement History (
                  {settlements.filter((s) => s.status === 'completed').length}
                  )
                </h3>
                <p className="text-xs text-slate-400">
                  Record of all confirmed and completed payment settlements.
                </p>
              </div>
            </div>

            {settlements.filter((s) => s.status === 'completed').length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No confirmed settlements yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortEntriesChronologicalDesc(
                  settlements.filter((s) => s.status === 'completed')
                ).map((s) => {
                  const fromName = getPersonDisplayName(s.payerUid) || s.payerName || 'Member';
                  const toName = getPersonDisplayName(s.receiverUid) || s.receiverName || 'Member';

                  return (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <div>
                          <div>
                            <strong className="text-slate-800 dark:text-white font-bold">
                              {fromName} {s.payerUid === user.uid ? '(You)' : ''}
                            </strong>{' '}
                            paid{' '}
                            <strong className="text-slate-800 dark:text-white font-bold">
                              {toName} {s.receiverUid === user.uid ? '(You)' : ''}
                            </strong>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {s.paymentMethod && <span className="capitalize">{s.paymentMethod.replace('_', ' ')}</span>}
                            {s.paymentReference && <span>• Ref: {s.paymentReference}</span>}
                            {s.paidDate && <span>• {formatDisplayExpenseDate(s.paidDate)}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="text-right">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white block">
                            {formatCurrency(s.amountMinor, currency)}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Confirmed ✓
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSettlement(s)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Delete settlement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: PEOPLE */}
      {/* ==================================================== */}
      {activeTab === 'members' && (
        <div className="bg-white dark:bg-[#15263C] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                People ({Object.keys(event.members).length})
              </h3>
              <p className="text-xs text-slate-400">
                All friends who have joined this event.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSlotsModalOpen(true)}
              >
                <Users className="w-3.5 h-3.5 mr-1 text-amber-500" />
                People
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsShareModalOpen(true)}
              >
                <Share2 className="w-3.5 h-3.5 mr-1" />
                Invite
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.values(event.members).map((member) => {
              const assignedSlot = member.slotId && event.slots ? event.slots[member.slotId] : null;
              const handle = getMemberHandle(member);

              return (
                <div
                  key={member.uid}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar src={member.photoURL} name={handle} size="sm" />
                    <div className="min-w-0">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate block">
                        {handle} {member.uid === user.uid ? '(You)' : ''}
                      </span>
                      {member.displayName && (
                        <span className="text-[11px] text-slate-400 truncate block">
                          {member.displayName}
                        </span>
                      )}
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 capitalize font-semibold">
                        {member.role}
                      </span>
                      {assignedSlot && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-bold">
                          Slot: {assignedSlot.placeholderName}
                        </span>
                      )}
                    </div>
                  </div>

                  {member.uid !== user.uid && (
                    <div className="shrink-0">
                      {friendUids.has(member.uid) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                          <Check className="w-3 h-3" />
                          Friend
                        </span>
                      ) : (pendingSentFriendRequestUids.has(member.uid) || isFriendRequestOnCooldown(member.uid)) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40">
                          <Clock className="w-3 h-3" />
                          Request sent
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSendFriendRequest(member)}
                          className="text-[11px] h-7 px-2"
                          leftIcon={<UserPlus className="w-3 h-3 text-teal-600 dark:text-teal-400" />}
                        >
                          Add Friend
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* People Section */}
          <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-500" />
                  People ({Object.keys(event.slots || {}).length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Individual participant slots and joined people under this event.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSlotsModalOpen(true)}
                className="text-xs font-bold"
              >
                Manage People
              </Button>
            </div>

            {Object.keys(event.slots || {}).length === 0 ? (
              <p className="text-xs text-slate-400 italic">No individual slots created yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.values(event.slots || {}).map((slot) => {
                  const claimedMember = slot.claimedByUid ? event.members[slot.claimedByUid] : null;
                  const displayName = slot.isClaimed
                    ? claimedMember
                      ? getMemberHandle(claimedMember)
                      : slot.claimedByName || slot.placeholderName
                    : slot.placeholderName;

                  return (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                        slot.isClaimed
                          ? 'border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          src={claimedMember?.photoURL}
                          name={displayName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">
                            {displayName}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {slot.isClaimed
                              ? `Claimed "${slot.placeholderName}"`
                              : `Placeholder: ${slot.placeholderName}`}
                          </span>
                        </div>
                      </div>

                      {slot.isClaimed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                          Joined ✓
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">
                          Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODALS */}
      {/* ==================================================== */}

      {/* Expense Modal (Add/Edit) */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingItem(null);
          setEditingExpense(null);
          setTargetCategoryItemId(null);
        }}
        event={event}
        currentUser={user}
        initialExpense={editingExpense}
        initialItem={editingItem}
        title={
          editingItem
            ? 'Edit Expense Item'
            : editingExpense
            ? 'Edit Subitem'
            : targetCategoryItemId
            ? 'Add Subitem to Category'
            : 'Add Expense Item'
        }
        onSave={handleSaveExpense}
        onSaveCategoryWithSubitems={handleSaveCategoryWithSubitems}
      />

      {/* Debtor Payment Details Modal */}
      {activeDebtorPayment && (
        <PaymentDetailsModal
          isOpen={isPaymentDetailsModalOpen}
          onClose={() => {
            setIsPaymentDetailsModalOpen(false);
            setActiveDebtorPayment(null);
          }}
          debtorUser={user}
          creditor={{
            uid: activeDebtorPayment.creditorUid,
            displayName: activeDebtorPayment.creditorName,
          }}
          maxAmountMinor={activeDebtorPayment.maxAmountMinor}
          currency={currency}
          onSubmit={handleCreatePaymentConfirmation}
        />
      )}

      {/* Creditor Confirm Receipt Modal */}
      {activePaymentConfirmation && (
        <ConfirmPaymentReceiptModal
          isOpen={isConfirmReceiptModalOpen}
          onClose={() => {
            setIsConfirmReceiptModalOpen(false);
            setActivePaymentConfirmation(null);
          }}
          confirmation={activePaymentConfirmation}
          currency={currency}
          onConfirmReceipt={handleConfirmPaymentReceipt}
          onReportNotReceived={handleReportNotReceived}
        />
      )}

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        selectedCount={totalSelectedCount}
        totalAffectedAmountMinor={selectedTotalMinor}
        currency={currency}
        isLoading={isBulkDeleting}
        onConfirm={handleConfirmBulkDelete}
      />

      {/* Share / Invite Modal */}
      <ShareInviteModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        event={event}
      />

      {/* Slots Modal */}
      <SlotsModal
        isOpen={isSlotsModalOpen}
        onClose={() => setIsSlotsModalOpen(false)}
        event={event}
      />

      {/* Delete Event Confirmation Modal (Host) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Event"
        emoji="⚠️"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Are you sure you want to delete <strong className="font-bold">{event.name}</strong>?
            This will archive the event for all members. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmDeleteEvent}>
              Delete Event
            </Button>
          </div>
        </div>
      </Modal>

      {/* Leave Event Confirmation Modal (Member) */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Leave Event"
        emoji="🚪"
        maxWidth="sm"
      >
        <div className="space-y-4">
          {financialOverview && financialOverview.currentUserNetBalanceMinor !== 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" />
              <div>
                <strong className="font-bold">Outstanding Balance Warning:</strong>
                <p className="mt-0.5">
                  You currently have a balance of{' '}
                  {formatCurrency(Math.abs(financialOverview.currentUserNetBalanceMinor), currency)} (
                  {financialOverview.currentUserNetBalanceMinor > 0 ? 'owed to you' : 'you owe'}).
                  Please settle before leaving if possible.
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Are you sure you want to leave <strong className="font-bold">{event.name}</strong>? Your
            historical expense entries will remain in the event calculations.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsLeaveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmLeaveEvent}>
              Leave Event
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditCategoryModalOpen}
        onClose={() => {
          setIsEditCategoryModalOpen(false);
          setEditingCategoryItem(null);
        }}
        title="Edit Category"
        emoji={editingCategoryEmoji || '📁'}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveCategoryEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Category Name
            </label>
            <input
              type="text"
              value={editingCategoryName}
              onChange={(e) => {
                setEditingCategoryName(e.target.value);
                setEditingCategoryEmoji(getEmojiForName(e.target.value));
              }}
              required
              className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              autoFocus
            />
            <span className="text-[11px] text-slate-400 mt-1.5 block">
              Emoji is automatically updated based on the category name.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setIsEditCategoryModalOpen(false);
                setEditingCategoryItem(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSavingCategory}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item Info Modal ("i" button) */}
      {event && user && (
        <ItemInfoModal
          isOpen={isItemInfoModalOpen}
          onClose={() => {
            setIsItemInfoModalOpen(false);
            setActiveInfoItem(null);
          }}
          item={activeInfoItem}
          categoryName={activeInfoCategoryName}
          categoryEmoji={activeInfoCategoryEmoji}
          currency={currency}
          currentUser={user}
          eventMembers={event.members}
          friendUids={friendUids}
          pendingSentFriendRequestUids={pendingSentFriendRequestUids}
          onSendFriendRequest={handleSendFriendRequest}
          onEdit={() => {
            if (!activeInfoItem) return;
            if ('isCategory' in activeInfoItem && activeInfoItem.isCategory) {
              handleOpenEditCategory(activeInfoItem as EventItem);
            } else if ('itemId' in activeInfoItem && activeInfoItem.itemId) {
              setEditingExpense(activeInfoItem as ExpenseEntry);
              setEditingItem(null);
              setTargetCategoryItemId(activeInfoItem.itemId);
              setIsExpenseModalOpen(true);
            } else {
              setEditingItem(activeInfoItem as EventItem);
              setEditingExpense(null);
              setTargetCategoryItemId(null);
              setIsExpenseModalOpen(true);
            }
          }}
          onDelete={() => {
            if (!activeInfoItem) return;
            if ('itemId' in activeInfoItem && activeInfoItem.itemId) {
              handleDeleteSingleExpense(activeInfoItem as ExpenseEntry);
            } else {
              handleDeleteItem(activeInfoItem as EventItem);
            }
          }}
        />
      )}
    </div>
  );
};
