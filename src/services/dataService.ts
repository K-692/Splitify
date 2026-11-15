import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase/config';
import {
  SplitifyEvent,
  EventItem,
  ExpenseEntry,
  SettlementEntry,
  FriendRequest,
  Friendship,
  EventInvitation,
  AppNotification,
  UserProfile,
  SplitMode,
} from '@/types';
import { getEmojiForName } from '@/utils/emoji';
import { formatAuditTimestamp } from '@/utils/date';
import { calculateEqualShares } from '@/domain/calculations/finance';

// Local storage keys for mock/offline fallback
const STORAGE_PREFIX = 'splitify_store_';
function getLocal<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}
function setLocal<T>(key: string, value: T): void {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('splitify_data_changed', { detail: { key } }));
}

export const dataService = {
  // ==========================================
  // EVENTS
  // ==========================================
  subscribeEvents(userId: string, callback: (events: SplitifyEvent[]) => void): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const allEvents = getLocal<SplitifyEvent[]>('events', []);
        const userEvents = allEvents.filter((e) => Boolean(e.members && e.members[userId]));
        callback(userEvents);
      };
      load();
      const handler = (e: any) => {
        if (!e.detail?.key || e.detail.key === 'events') load();
      };
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    const q = query(collection(db, 'events'));
    return onSnapshot(q, (snapshot) => {
      const events: SplitifyEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as SplitifyEvent;
        if (data.members && data.members[userId]) {
          events.push({ ...data, id: doc.id });
        }
      });
      callback(events);
    });
  },

  async createEvent(
    name: string,
    host: UserProfile,
    currency: string = 'INR',
    customEmoji?: string
  ): Promise<string> {
    const emoji = customEmoji || getEmojiForName(name);
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newEvent: Omit<SplitifyEvent, 'id'> = {
      name,
      emoji,
      currency,
      hostUid: host.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      joinCode,
      members: {
        [host.uid]: {
          uid: host.uid,
          displayName: host.displayName,
          photoURL: host.photoURL,
          username: host.username,
          joinedAt: Date.now(),
          role: 'host',
        },
      },
    };

    if (!isFirebaseConfigured() || !db) {
      const id = 'event_' + Date.now();
      const all = getLocal<SplitifyEvent[]>('events', []);
      all.unshift({ ...newEvent, id });
      setLocal('events', all);
      return id;
    }

    const ref = await addDoc(collection(db, 'events'), newEvent);
    return ref.id;
  },

  async updateEventName(eventId: string, newName: string, editor: UserProfile): Promise<void> {
    const emoji = getEmojiForName(newName);
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      const idx = all.findIndex((e) => e.id === eventId);
      if (idx !== -1) {
        all[idx].name = newName;
        all[idx].emoji = emoji;
        all[idx].updatedAt = Date.now();
        setLocal('events', all);

        // Notify other members
        for (const memberUid of Object.keys(all[idx].members)) {
          if (memberUid !== editor.uid) {
            await dataService.createNotification({
              recipientUid: memberUid,
              type: 'event_name_modified',
              senderUid: editor.uid,
              senderName: editor.displayName,
              senderPhotoURL: editor.photoURL,
              eventId,
              eventName: newName,
              title: 'Event Renamed',
              description: `${editor.displayName} renamed the event to "${newName}"`,
            });
          }
        }
      }
      return;
    }

    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      name: newName,
      emoji,
      updatedAt: Date.now(),
    });
  },

  async getEventById(eventId: string): Promise<SplitifyEvent | null> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      return all.find((e) => e.id === eventId) || null;
    }

    const snap = await getDoc(doc(db, 'events', eventId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as SplitifyEvent;
  },

  subscribeEvent(eventId: string, callback: (event: SplitifyEvent | null) => void): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<SplitifyEvent[]>('events', []);
        callback(all.find((e) => e.id === eventId) || null);
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    return onSnapshot(doc(db, 'events', eventId), (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback({ ...snap.data(), id: snap.id } as SplitifyEvent);
    });
  },

  // ==========================================
  // ITEMS (Expense Buckets & Settlements Item)
  // ==========================================
  subscribeItems(eventId: string, callback: (items: EventItem[]) => void): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<EventItem[]>(`items_${eventId}`, []);
        callback(all.filter((i) => !i.deleted));
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    const q = query(collection(db, 'events', eventId, 'items'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const items: EventItem[] = [];
      snapshot.forEach((d) => {
        const item = { ...d.data(), id: d.id } as EventItem;
        if (!item.deleted) items.push(item);
      });
      callback(items);
    });
  },

  async createItem(eventId: string, name: string): Promise<string> {
    const isSettlement = name.toLowerCase().includes('settlement');
    const emoji = isSettlement ? '💸' : getEmojiForName(name);

    const newItem: Omit<EventItem, 'id'> = {
      eventId,
      name,
      emoji,
      isSettlementsItem: isSettlement,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    if (!isFirebaseConfigured() || !db) {
      const id = 'item_' + Date.now();
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      items.push({ ...newItem, id });
      setLocal(`items_${eventId}`, items);
      return id;
    }

    const ref = await addDoc(collection(db, 'events', eventId, 'items'), newItem);
    return ref.id;
  },

  async updateItemName(eventId: string, itemId: string, newName: string): Promise<void> {
    const emoji = getEmojiForName(newName);
    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        items[idx].name = newName;
        items[idx].emoji = emoji;
        items[idx].updatedAt = Date.now();
        setLocal(`items_${eventId}`, items);
      }
      return;
    }

    await updateDoc(doc(db, 'events', eventId, 'items', itemId), {
      name: newName,
      emoji,
      updatedAt: Date.now(),
    });
  },

  async deleteItem(eventId: string, itemId: string, user: UserProfile): Promise<void> {
    // Delete item and soft-delete all active subitems inside this item
    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        items[idx].deleted = true;
        setLocal(`items_${eventId}`, items);
      }

      // Soft delete expenses belonging to this item
      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      for (const exp of expenses) {
        if (exp.itemId === itemId && !exp.deleted) {
          exp.deleted = true;
          exp.deletedAt = Date.now();
          exp.deletedBy = user.uid;
          exp.auditLogs.push({
            id: 'log_' + Date.now(),
            type: 'deleted',
            byUid: user.uid,
            byName: user.displayName,
            timestamp: Date.now(),
            formattedTimestamp: formatAuditTimestamp(Date.now()),
            summary: `Deleted with parent item`,
          });
        }
      }
      setLocal(`expenses_${eventId}`, expenses);
      return;
    }

    await updateDoc(doc(db, 'events', eventId, 'items', itemId), {
      deleted: true,
      updatedAt: Date.now(),
    });

    // Also mark expenses as deleted
    const expQ = query(collection(db, 'events', eventId, 'expenses'), where('itemId', '==', itemId));
    const snaps = await getDocs(expQ);
    const batch = writeBatch(db);
    snaps.forEach((d) => {
      batch.update(d.ref, {
        deleted: true,
        deletedAt: Date.now(),
        deletedBy: user.uid,
        lastModifiedBy: user.uid,
        lastModifiedByName: user.displayName,
        lastModifiedAt: Date.now(),
      });
    });
    await batch.commit();
  },

  /**
   * Helper to get or auto-create the system-generated "💸 Settlements" item
   */
  async getOrCreateSettlementsItem(eventId: string): Promise<string> {
    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const existing = items.find((i) => i.isSettlementsItem && !i.deleted);
      if (existing) return existing.id;

      const newId = 'settlements_item_' + Date.now();
      items.push({
        id: newId,
        eventId,
        name: '💸 Settlements',
        emoji: '💸',
        isSettlementsItem: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: false,
      });
      setLocal(`items_${eventId}`, items);
      return newId;
    }

    const q = query(
      collection(db, 'events', eventId, 'items'),
      where('isSettlementsItem', '==', true)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    }

    const ref = await addDoc(collection(db, 'events', eventId, 'items'), {
      eventId,
      name: '💸 Settlements',
      emoji: '💸',
      isSettlementsItem: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    });
    return ref.id;
  },

  // ==========================================
  // EXPENSES (Subitems)
  // ==========================================
  subscribeExpenses(eventId: string, callback: (expenses: ExpenseEntry[]) => void): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
        callback(all.filter((e) => !e.deleted));
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    const q = query(
      collection(db, 'events', eventId, 'expenses'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const expenses: ExpenseEntry[] = [];
      snapshot.forEach((d) => {
        const exp = { ...d.data(), id: d.id } as ExpenseEntry;
        if (!exp.deleted) expenses.push(exp);
      });
      callback(expenses);
    });
  },

  async createExpense(
    params: {
      eventId: string;
      itemId: string;
      name: string;
      costMinor: number;
      paidBy: string;
      splitBy: SplitMode;
      participants: string[];
      customShares?: Record<string, number>;
      comment?: string;
    },
    user: UserProfile,
    eventMembers: Record<string, any>
  ): Promise<string> {
    const { eventId, itemId, name, costMinor, paidBy, splitBy, participants, customShares, comment } = params;

    const emoji = getEmojiForName(name);
    const shares = splitBy === 'equal'
      ? calculateEqualShares(costMinor, participants)
      : (customShares || {});

    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);

    const initialAuditLog = {
      id: 'log_' + now,
      type: 'created' as const,
      byUid: user.uid,
      byName: user.displayName,
      timestamp: now,
      formattedTimestamp,
      summary: `Created expense ${name} for ${(costMinor / 100).toFixed(2)}`,
    };

    const newExpense: Omit<ExpenseEntry, 'id'> = {
      eventId,
      itemId,
      name,
      emoji,
      costMinor,
      paidBy,
      splitBy,
      participants,
      shares,
      comment: comment || '',
      createdBy: user.uid,
      createdByName: user.displayName,
      createdAt: now,
      lastModifiedBy: user.uid,
      lastModifiedByName: user.displayName,
      lastModifiedAt: now,
      deleted: false,
      auditLogs: [initialAuditLog],
    };

    let expenseId: string;

    if (!isFirebaseConfigured() || !db) {
      expenseId = 'exp_' + now;
      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      expenses.unshift({ ...newExpense, id: expenseId });
      setLocal(`expenses_${eventId}`, expenses);
    } else {
      const ref = await addDoc(collection(db, 'events', eventId, 'expenses'), newExpense);
      expenseId = ref.id;
    }

    // Notify other event members
    for (const memberUid of Object.keys(eventMembers)) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_created',
          senderUid: user.uid,
          senderName: user.displayName,
          senderPhotoURL: user.photoURL,
          eventId,
          amountMinor: costMinor,
          title: 'New Expense Added',
          description: `${user.displayName} added "${name}"`,
        });
      }
    }

    return expenseId;
  },

  async updateExpense(
    eventId: string,
    expenseId: string,
    updates: {
      name?: string;
      costMinor?: number;
      paidBy?: string;
      splitBy?: SplitMode;
      participants?: string[];
      customShares?: Record<string, number>;
      comment?: string;
    },
    user: UserProfile,
    eventMembers: Record<string, any>
  ): Promise<void> {
    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);

    const applyUpdatesToEntry = (current: ExpenseEntry): ExpenseEntry => {
      const name = updates.name !== undefined ? updates.name : current.name;
      const costMinor = updates.costMinor !== undefined ? updates.costMinor : current.costMinor;
      const paidBy = updates.paidBy !== undefined ? updates.paidBy : current.paidBy;
      const splitBy = updates.splitBy !== undefined ? updates.splitBy : current.splitBy;
      const participants = updates.participants !== undefined ? updates.participants : current.participants;
      const comment = updates.comment !== undefined ? updates.comment : current.comment;

      const shares = splitBy === 'equal'
        ? calculateEqualShares(costMinor, participants)
        : (updates.customShares || current.shares);

      const changedFields: string[] = [];
      if (updates.name && updates.name !== current.name) changedFields.push('name');
      if (updates.costMinor && updates.costMinor !== current.costMinor) changedFields.push('cost');
      if (updates.paidBy && updates.paidBy !== current.paidBy) changedFields.push('payer');
      if (updates.splitBy && updates.splitBy !== current.splitBy) changedFields.push('split mode');
      if (updates.participants) changedFields.push('participants');

      const auditLog = {
        id: 'log_' + now,
        type: 'edited' as const,
        byUid: user.uid,
        byName: user.displayName,
        timestamp: now,
        formattedTimestamp,
        changedFields,
        summary: `Edited by ${user.displayName} at ${formattedTimestamp}`,
      };

      return {
        ...current,
        name,
        emoji: getEmojiForName(name),
        costMinor,
        paidBy,
        splitBy,
        participants,
        shares,
        comment,
        lastModifiedBy: user.uid,
        lastModifiedByName: user.displayName,
        lastModifiedAt: now,
        auditLogs: [...(current.auditLogs || []), auditLog],
      };
    };

    if (!isFirebaseConfigured() || !db) {
      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      const idx = expenses.findIndex((e) => e.id === expenseId);
      if (idx !== -1) {
        expenses[idx] = applyUpdatesToEntry(expenses[idx]);
        setLocal(`expenses_${eventId}`, expenses);
      }
    } else {
      const ref = doc(db, 'events', eventId, 'expenses', expenseId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const updated = applyUpdatesToEntry({ ...snap.data(), id: snap.id } as ExpenseEntry);
        await updateDoc(ref, { ...updated });
      }
    }

    // Notify other event members
    for (const memberUid of Object.keys(eventMembers)) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_modified',
          senderUid: user.uid,
          senderName: user.displayName,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Expense Modified',
          description: `${user.displayName} modified an expense`,
        });
      }
    }
  },

  async deleteExpense(
    eventId: string,
    expenseId: string,
    user: UserProfile,
    eventMembers: Record<string, any>
  ): Promise<void> {
    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);

    const auditLog = {
      id: 'log_' + now,
      type: 'deleted' as const,
      byUid: user.uid,
      byName: user.displayName,
      timestamp: now,
      formattedTimestamp,
      summary: `Deleted by ${user.displayName} at ${formattedTimestamp}`,
    };

    if (!isFirebaseConfigured() || !db) {
      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      const idx = expenses.findIndex((e) => e.id === expenseId);
      if (idx !== -1) {
        expenses[idx].deleted = true;
        expenses[idx].deletedAt = now;
        expenses[idx].deletedBy = user.uid;
        expenses[idx].auditLogs.push(auditLog);
        setLocal(`expenses_${eventId}`, expenses);
      }
    } else {
      const ref = doc(db, 'events', eventId, 'expenses', expenseId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existingLogs = (snap.data().auditLogs || []);
        await updateDoc(ref, {
          deleted: true,
          deletedAt: now,
          deletedBy: user.uid,
          lastModifiedBy: user.uid,
          lastModifiedByName: user.displayName,
          lastModifiedAt: now,
          auditLogs: [...existingLogs, auditLog],
        });
      }
    }

    // Notify members
    for (const memberUid of Object.keys(eventMembers)) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_deleted',
          senderUid: user.uid,
          senderName: user.displayName,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Expense Deleted',
          description: `${user.displayName} deleted an expense`,
        });
      }
    }
  },

  async bulkDeleteExpenses(
    eventId: string,
    expenseIds: string[],
    user: UserProfile,
    eventMembers: Record<string, any>
  ): Promise<void> {
    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);

    if (!isFirebaseConfigured() || !db) {
      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      for (const exp of expenses) {
        if (expenseIds.includes(exp.id)) {
          exp.deleted = true;
          exp.deletedAt = now;
          exp.deletedBy = user.uid;
          exp.auditLogs.push({
            id: 'log_' + now,
            type: 'deleted',
            byUid: user.uid,
            byName: user.displayName,
            timestamp: now,
            formattedTimestamp,
            summary: `Bulk deleted`,
          });
        }
      }
      setLocal(`expenses_${eventId}`, expenses);
    } else {
      const batch = writeBatch(db);
      for (const id of expenseIds) {
        const ref = doc(db, 'events', eventId, 'expenses', id);
        batch.update(ref, {
          deleted: true,
          deletedAt: now,
          deletedBy: user.uid,
          lastModifiedBy: user.uid,
          lastModifiedByName: user.displayName,
          lastModifiedAt: now,
        });
      }
      await batch.commit();
    }

    for (const memberUid of Object.keys(eventMembers)) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_deleted',
          senderUid: user.uid,
          senderName: user.displayName,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Expenses Deleted',
          description: `${user.displayName} deleted ${expenseIds.length} expense(s)`,
        });
      }
    }
  },

  // ==========================================
  // SETTLEMENTS (💸 Settled!)
  // ==========================================
  subscribeSettlements(eventId: string, callback: (settlements: SettlementEntry[]) => void): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<SettlementEntry[]>(`settlements_${eventId}`, []);
        callback(all.filter((s) => s.status === 'completed'));
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    const q = query(
      collection(db, 'events', eventId, 'settlements'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const settlements: SettlementEntry[] = [];
      snapshot.forEach((d) => {
        settlements.push({ ...d.data(), id: d.id } as SettlementEntry);
      });
      callback(settlements);
    });
  },

  async recordSettlement(
    params: {
      eventId: string;
      payerUid: string;
      payerName: string;
      receiverUid: string;
      receiverName: string;
      amountMinor: number;
      note?: string;
    },
    user: UserProfile
  ): Promise<string> {
    const { eventId, payerUid, payerName, receiverUid, receiverName, amountMinor, note } = params;

    // 1. Ensure system-generated 💸 Settlements item exists
    const settlementsItemId = await dataService.getOrCreateSettlementsItem(eventId);

    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);

    const newSettlement: Omit<SettlementEntry, 'id'> = {
      eventId,
      itemId: settlementsItemId,
      payerUid,
      payerName,
      receiverUid,
      receiverName,
      amountMinor,
      recordedBy: user.uid,
      recordedByName: user.displayName,
      createdAt: now,
      formattedTimestamp,
      status: 'completed',
      note: note || '',
    };

    let settlementId: string;

    if (!isFirebaseConfigured() || !db) {
      settlementId = 'set_' + now;
      const settlements = getLocal<SettlementEntry[]>(`settlements_${eventId}`, []);
      settlements.unshift({ ...newSettlement, id: settlementId });
      setLocal(`settlements_${eventId}`, settlements);
    } else {
      const ref = await addDoc(collection(db, 'events', eventId, 'settlements'), newSettlement);
      settlementId = ref.id;
    }

    // Notify payer and receiver
    const recipients = [payerUid, receiverUid].filter((uid) => uid !== user.uid);
    for (const uid of recipients) {
      await dataService.createNotification({
        recipientUid: uid,
        type: 'settlement_recorded',
        senderUid: user.uid,
        senderName: user.displayName,
        senderPhotoURL: user.photoURL,
        eventId,
        amountMinor,
        title: 'Settlement Recorded',
        description: `${payerName} paid ${receiverName} ${(amountMinor / 100).toFixed(2)}`,
      });
    }

    return settlementId;
  },

  // ==========================================
  // FRIENDS & FRIEND REQUESTS
  // ==========================================
  async searchUserByUsername(username: string): Promise<UserProfile | null> {
    const cleanUsername = username.toLowerCase().trim().replace(/^@/, '');
    if (!cleanUsername) return null;

    if (!isFirebaseConfigured() || !db) {
      // Demo mock directory
      const mockUsers: UserProfile[] = [
        {
          uid: 'demo_user_krish',
          displayName: 'Krishnendu Pal',
          email: 'krish@splitify.app',
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          username: 'krish',
          createdAt: Date.now(),
        },
        {
          uid: 'demo_user_rahul',
          displayName: 'Rahul Sharma',
          email: 'rahul@splitify.app',
          photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          username: 'rahul',
          createdAt: Date.now(),
        },
        {
          uid: 'demo_user_priya',
          displayName: 'Priya Patel',
          email: 'priya@splitify.app',
          photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          username: 'priya',
          createdAt: Date.now(),
        },
        {
          uid: 'demo_user_ananya',
          displayName: 'Ananya Verma',
          email: 'ananya@splitify.app',
          photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
          username: 'ananya',
          createdAt: Date.now(),
        },
      ];
      return mockUsers.find((u) => u.username === cleanUsername) || null;
    }

    // Lookup username in usernames collection
    const uSnap = await getDoc(doc(db, 'usernames', cleanUsername));
    if (!uSnap.exists()) return null;
    const uid = uSnap.data().uid;

    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return null;
    return userSnap.data() as UserProfile;
  },

  subscribeFriendRequests(
    userId: string,
    callback: (received: FriendRequest[], sent: FriendRequest[]) => void
  ): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<FriendRequest[]>('friend_requests', []);
        const received = all.filter((r) => r.toUid === userId && r.status === 'pending');
        const sent = all.filter((r) => r.fromUid === userId && r.status === 'pending');
        callback(received, sent);
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    let receivedList: FriendRequest[] = [];
    let sentList: FriendRequest[] = [];

    const qReceived = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', userId),
      where('status', '==', 'pending')
    );
    const qSent = query(
      collection(db, 'friendRequests'),
      where('fromUid', '==', userId),
      where('status', '==', 'pending')
    );

    const unsubReceived = onSnapshot(qReceived, (snapshot) => {
      receivedList = [];
      snapshot.forEach((d) => {
        receivedList.push({ ...d.data(), id: d.id } as FriendRequest);
      });
      callback(receivedList, sentList);
    });

    const unsubSent = onSnapshot(qSent, (snapshot) => {
      sentList = [];
      snapshot.forEach((d) => {
        sentList.push({ ...d.data(), id: d.id } as FriendRequest);
      });
      callback(receivedList, sentList);
    });

    return () => {
      unsubReceived();
      unsubSent();
    };
  },

  subscribeFriends(userId: string, callback: (friends: Friendship[]) => void): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<Friendship[]>('friendships', []);
        const userFriends = all.filter((f) => f.user1Uid === userId || f.user2Uid === userId);
        callback(userFriends);
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    let list1: Friendship[] = [];
    let list2: Friendship[] = [];

    const emit = () => {
      const map = new Map<string, Friendship>();
      for (const f of list1) map.set(f.id, f);
      for (const f of list2) map.set(f.id, f);
      callback(Array.from(map.values()));
    };

    const q1 = query(collection(db, 'friendships'), where('user1Uid', '==', userId));
    const q2 = query(collection(db, 'friendships'), where('user2Uid', '==', userId));

    const unsub1 = onSnapshot(q1, (snapshot) => {
      list1 = [];
      snapshot.forEach((d) => {
        list1.push({ ...d.data(), id: d.id } as Friendship);
      });
      emit();
    });

    const unsub2 = onSnapshot(q2, (snapshot) => {
      list2 = [];
      snapshot.forEach((d) => {
        list2.push({ ...d.data(), id: d.id } as Friendship);
      });
      emit();
    });

    return () => {
      unsub1();
      unsub2();
    };
  },

  async sendFriendRequest(fromUser: UserProfile, toUser: UserProfile): Promise<void> {
    if (fromUser.uid === toUser.uid) {
      throw new Error('You cannot send a friend request to yourself');
    }

    const newRequest: Omit<FriendRequest, 'id'> = {
      fromUid: fromUser.uid,
      toUid: toUser.uid,
      fromDisplayName: fromUser.displayName,
      fromUsername: fromUser.username,
      fromPhotoURL: fromUser.photoURL,
      toDisplayName: toUser.displayName,
      toUsername: toUser.username,
      toPhotoURL: toUser.photoURL,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<FriendRequest[]>('friend_requests', []);
      const existing = all.find(
        (r) =>
          ((r.fromUid === fromUser.uid && r.toUid === toUser.uid) ||
            (r.fromUid === toUser.uid && r.toUid === fromUser.uid)) &&
          r.status === 'pending'
      );
      if (existing) throw new Error('A friend request already exists between you');
      all.unshift({ ...newRequest, id: 'req_' + Date.now() });
      setLocal('friend_requests', all);
    } else {
      await addDoc(collection(db, 'friendRequests'), newRequest);
    }

    // Send notification
    await dataService.createNotification({
      recipientUid: toUser.uid,
      type: 'friend_request_received',
      senderUid: fromUser.uid,
      senderName: fromUser.displayName,
      senderPhotoURL: fromUser.photoURL,
      title: 'Friend Request',
      description: `${fromUser.displayName} (@${fromUser.username}) sent you a friend request`,
    });
  },

  async respondToFriendRequest(requestId: string, accept: boolean, currentUser: UserProfile): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<FriendRequest[]>('friend_requests', []);
      const req = all.find((r) => r.id === requestId);
      if (req) {
        req.status = accept ? 'accepted' : 'declined';
        req.updatedAt = Date.now();
        setLocal('friend_requests', all);

        if (accept) {
          const friendships = getLocal<Friendship[]>('friendships', []);
          friendships.push({
            id: 'fs_' + Date.now(),
            user1Uid: req.fromUid,
            user2Uid: req.toUid,
            createdAt: Date.now(),
          });
          setLocal('friendships', friendships);

          await dataService.createNotification({
            recipientUid: req.fromUid,
            type: 'friend_request_accepted',
            senderUid: currentUser.uid,
            senderName: currentUser.displayName,
            senderPhotoURL: currentUser.photoURL,
            title: 'Friend Request Accepted',
            description: `${currentUser.displayName} accepted your friend request`,
          });
        }
      }
      return;
    }

    const ref = doc(db, 'friendRequests', requestId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const req = snap.data() as FriendRequest;

    await updateDoc(ref, {
      status: accept ? 'accepted' : 'declined',
      updatedAt: Date.now(),
    });

    if (accept) {
      await addDoc(collection(db, 'friendships'), {
        user1Uid: req.fromUid,
        user2Uid: req.toUid,
        createdAt: Date.now(),
      });

      await dataService.createNotification({
        recipientUid: req.fromUid,
        type: 'friend_request_accepted',
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        senderPhotoURL: currentUser.photoURL,
        title: 'Friend Request Accepted',
        description: `${currentUser.displayName} accepted your friend request`,
      });
    }
  },

  async cancelFriendRequest(requestId: string): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<FriendRequest[]>('friend_requests', []);
      const idx = all.findIndex((r) => r.id === requestId);
      if (idx !== -1) {
        all[idx].status = 'cancelled';
        setLocal('friend_requests', all);
      }
      return;
    }

    await deleteDoc(doc(db, 'friendRequests', requestId));
  },

  async removeFriend(friendshipId: string): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const friendships = getLocal<Friendship[]>('friendships', []);
      const filtered = friendships.filter((f) => f.id !== friendshipId);
      setLocal('friendships', filtered);
      return;
    }

    await deleteDoc(doc(db, 'friendships', friendshipId));
  },

  // ==========================================
  // EVENT INVITATIONS
  // ==========================================
  subscribeEventInvitations(userId: string, callback: (invitations: EventInvitation[]) => void): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<EventInvitation[]>('event_invitations', []);
        callback(all.filter((i) => i.toUid === userId && i.status === 'pending'));
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    const q = query(
      collection(db, 'eventInvitations'),
      where('toUid', '==', userId),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (snapshot) => {
      const invites: EventInvitation[] = [];
      snapshot.forEach((d) => {
        invites.push({ ...d.data(), id: d.id } as EventInvitation);
      });
      callback(invites);
    });
  },

  async sendEventInvitation(
    event: SplitifyEvent,
    fromUser: UserProfile,
    toFriend: { uid: string; displayName: string }
  ): Promise<void> {
    if (event.members[toFriend.uid]) {
      throw new Error(`${toFriend.displayName} is already a member of this event`);
    }

    const invite: Omit<EventInvitation, 'id'> = {
      eventId: event.id,
      eventName: event.name,
      eventEmoji: event.emoji,
      fromUid: fromUser.uid,
      fromDisplayName: fromUser.displayName,
      toUid: toFriend.uid,
      toDisplayName: toFriend.displayName,
      status: 'pending',
      createdAt: Date.now(),
    };

    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<EventInvitation[]>('event_invitations', []);
      all.unshift({ ...invite, id: 'inv_' + Date.now() });
      setLocal('event_invitations', all);
    } else {
      await addDoc(collection(db, 'eventInvitations'), invite);
    }

    // Send notification
    await dataService.createNotification({
      recipientUid: toFriend.uid,
      type: 'event_invitation_received',
      senderUid: fromUser.uid,
      senderName: fromUser.displayName,
      senderPhotoURL: fromUser.photoURL,
      eventId: event.id,
      eventName: event.name,
      title: 'Event Invitation',
      description: `${fromUser.displayName} invited you to join "${event.name}"`,
    });
  },

  async respondToEventInvitation(
    invitation: EventInvitation,
    accept: boolean,
    user: UserProfile
  ): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<EventInvitation[]>('event_invitations', []);
      const inv = all.find((i) => i.id === invitation.id);
      if (inv) {
        inv.status = accept ? 'accepted' : 'declined';
        setLocal('event_invitations', all);

        if (accept) {
          const events = getLocal<SplitifyEvent[]>('events', []);
          const ev = events.find((e) => e.id === invitation.eventId);
          if (ev) {
            ev.members[user.uid] = {
              uid: user.uid,
              displayName: user.displayName,
              photoURL: user.photoURL,
              username: user.username,
              joinedAt: Date.now(),
              role: 'member',
            };
            setLocal('events', events);
          }
        }
      }
      return;
    }

    const invRef = doc(db, 'eventInvitations', invitation.id);
    await updateDoc(invRef, { status: accept ? 'accepted' : 'declined' });

    if (accept) {
      const eventRef = doc(db, 'events', invitation.eventId);
      await updateDoc(eventRef, {
        [`members.${user.uid}`]: {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          username: user.username,
          joinedAt: Date.now(),
          role: 'member',
        },
      });

      await dataService.createNotification({
        recipientUid: invitation.fromUid,
        type: 'event_invitation_accepted',
        senderUid: user.uid,
        senderName: user.displayName,
        senderPhotoURL: user.photoURL,
        eventId: invitation.eventId,
        eventName: invitation.eventName,
        title: 'Invitation Accepted',
        description: `${user.displayName} joined "${invitation.eventName}"`,
      });
    }
  },

  async joinEventByCode(joinCode: string, user: UserProfile): Promise<SplitifyEvent> {
    const code = joinCode.trim().toUpperCase();
    if (!isFirebaseConfigured() || !db) {
      const events = getLocal<SplitifyEvent[]>('events', []);
      const event = events.find((e) => e.joinCode === code);
      if (!event) throw new Error('No event found with this join code');

      event.members[user.uid] = {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        username: user.username,
        joinedAt: Date.now(),
        role: 'member',
      };
      setLocal('events', events);
      return event;
    }

    const q = query(collection(db, 'events'), where('joinCode', '==', code));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('No event found with this join code');

    const eventDoc = snap.docs[0];
    const event = { ...eventDoc.data(), id: eventDoc.id } as SplitifyEvent;

    await updateDoc(eventDoc.ref, {
      [`members.${user.uid}`]: {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        username: user.username,
        joinedAt: Date.now(),
        role: 'member',
      },
    });

    return event;
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  subscribeNotifications(userId: string, callback: (notifications: AppNotification[]) => void): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<AppNotification[]>(`notifications_${userId}`, []);
        callback(all.sort((a, b) => b.createdAt - a.createdAt));
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((d) => {
        notifs.push({ ...d.data(), id: d.id } as AppNotification);
      });
      callback(notifs);
    });
  },

  async createNotification(params: Omit<AppNotification, 'id' | 'read' | 'createdAt'>): Promise<void> {
    const newNotif: Omit<AppNotification, 'id'> = {
      ...params,
      read: false,
      createdAt: Date.now(),
    };

    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<AppNotification[]>(`notifications_${params.recipientUid}`, []);
      all.unshift({ ...newNotif, id: 'notif_' + Date.now() });
      setLocal(`notifications_${params.recipientUid}`, all);
      return;
    }

    await addDoc(collection(db, 'users', params.recipientUid, 'notifications'), newNotif);
  },

  async markNotificationRead(userId: string, notificationId: string): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<AppNotification[]>(`notifications_${userId}`, []);
      const n = all.find((item) => item.id === notificationId);
      if (n) {
        n.read = true;
        setLocal(`notifications_${userId}`, all);
      }
      return;
    }

    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), { read: true });
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<AppNotification[]>(`notifications_${userId}`, []);
      for (const n of all) n.read = true;
      setLocal(`notifications_${userId}`, all);
      return;
    }

    const q = query(collection(db, 'users', userId, 'notifications'), where('read', '==', false));
    const snaps = await getDocs(q);
    const batch = writeBatch(db);
    snaps.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  },

  /**
   * Payment reminder action from section 14 of specification:
   * "Rahul owes you ₹1,500 [ Send Reminder ]"
   */
  async sendPaymentReminder(
    debtorUid: string,
    amountMinor: number,
    eventName: string,
    sender: UserProfile
  ): Promise<void> {
    const formattedAmount = (amountMinor / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
    });

    await dataService.createNotification({
      recipientUid: debtorUid,
      type: 'payment_reminder',
      senderUid: sender.uid,
      senderName: sender.displayName,
      senderPhotoURL: sender.photoURL,
      eventName,
      amountMinor,
      title: 'Payment Reminder',
      description: `${sender.displayName} sent a friendly reminder for ${formattedAmount} unsettled in "${eventName}"`,
    });
  },
};
