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
  runTransaction,
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
  EventSlot,
  EventInvitationLink,
  EventMember,
} from '@/types';
import { getEmojiForName } from '@/utils/emoji';
import { formatAuditTimestamp, getTodayLocalDateString } from '@/utils/date';
import { calculateEqualShares } from '@/domain/calculations/finance';
import { sanitizeForFirestore } from '@/utils/firestoreSanitizer';
import { getFirstName } from '@/utils/name';
import { generateHandleCandidates } from '@/utils/handleSuggestions';

function generateInvitationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(22);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 22; i++) {
      token += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 22; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return token;
}

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
        const userEvents = allEvents.filter(
          (e) => Boolean(e.members && e.members[userId]) && !e.deleted
        );
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
        if (data.members && data.members[userId] && !data.deleted) {
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
    customEmoji?: string,
    initialPeople?: { name: string; expectedUid?: string }[]
  ): Promise<string> {
    const emoji = customEmoji || getEmojiForName(name);

    const initialSlots: Record<string, EventSlot> = {};
    if (initialPeople && initialPeople.length > 0) {
      initialPeople.forEach((p, idx) => {
        if (!p.name?.trim()) return;
        const slotId = 'slot_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6);
        initialSlots[slotId] = {
          id: slotId,
          eventId: '',
          placeholderName: p.name.trim(),
          expectedUid: p.expectedUid,
          isClaimed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      });
    }

    const newEvent: Omit<SplitifyEvent, 'id'> = {
      name,
      emoji,
      currency,
      hostUid: host.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
      members: {
        [host.uid]: {
          uid: host.uid,
          displayName: host.displayName,
          photoURL: host.photoURL,
          username: host.username,
          joinedAt: Date.now(),
          role: 'host',
          scope: 'full',
        },
      },
      slots: initialSlots,
    };

    if (!isFirebaseConfigured() || !db) {
      const id = 'event_' + Date.now();
      const all = getLocal<SplitifyEvent[]>('events', []);
      all.unshift({ ...newEvent, id });
      setLocal('events', all);
      return id;
    }

    const sanitized = sanitizeForFirestore(newEvent);
    const ref = await addDoc(collection(db, 'events'), sanitized);
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

  async deleteEvent(eventId: string, user: UserProfile): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      const idx = all.findIndex((e) => e.id === eventId);
      if (idx !== -1) {
        if (all[idx].hostUid !== user.uid) {
          throw new Error('Only the event host can delete this event.');
        }
        all[idx].deleted = true;
        all[idx].deletedAt = Date.now();
        all[idx].deletedBy = user.uid;
        all[idx].updatedAt = Date.now();
        setLocal('events', all);
      }
      return;
    }

    const eventRef = doc(db, 'events', eventId);
    const snap = await getDoc(eventRef);
    if (!snap.exists()) throw new Error('Event not found');
    const ev = snap.data() as SplitifyEvent;
    if (ev.hostUid !== user.uid) {
      throw new Error('Only the event host can delete this event.');
    }

    await updateDoc(eventRef, {
      deleted: true,
      deletedAt: Date.now(),
      deletedBy: user.uid,
      updatedAt: Date.now(),
    });
  },

  async leaveEvent(eventId: string, user: UserProfile): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      const idx = all.findIndex((e) => e.id === eventId);
      if (idx !== -1) {
        const ev = all[idx];
        if (ev.hostUid === user.uid) {
          throw new Error('The event host cannot leave the event. Delete the event instead.');
        }
        delete ev.members[user.uid];
        if (ev.slots) {
          for (const slot of Object.values(ev.slots)) {
            if (slot.claimedByUid === user.uid) {
              slot.isClaimed = false;
              delete slot.claimedByUid;
              delete slot.claimedByName;
              delete slot.claimedAt;
            }
          }
        }
        ev.updatedAt = Date.now();
        setLocal('events', all);
      }
      return;
    }

    const eventRef = doc(db, 'events', eventId);
    const snap = await getDoc(eventRef);
    if (!snap.exists()) throw new Error('Event not found');
    const ev = snap.data() as SplitifyEvent;
    if (ev.hostUid === user.uid) {
      throw new Error('The event host cannot leave the event. Delete the event instead.');
    }

    const updatedMembers = { ...ev.members };
    delete updatedMembers[user.uid];

    const updatedSlots = { ...(ev.slots || {}) };
    for (const slotId of Object.keys(updatedSlots)) {
      if (updatedSlots[slotId].claimedByUid === user.uid) {
        updatedSlots[slotId] = {
          ...updatedSlots[slotId],
          isClaimed: false,
          claimedByUid: undefined,
          claimedByName: undefined,
          claimedAt: undefined,
          updatedAt: Date.now(),
        };
      }
    }

    const payload = sanitizeForFirestore({
      members: updatedMembers,
      slots: updatedSlots,
      updatedAt: Date.now(),
    });
    await updateDoc(eventRef, payload);
  },

  // ==========================================
  // ITEMS (Expense Buckets & Settlements Item)
  // ==========================================
  async getItems(eventId: string): Promise<EventItem[]> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<EventItem[]>(`items_${eventId}`, []);
      return all.filter((i) => !i.deleted);
    }
    const snap = await getDocs(query(collection(db, 'events', eventId, 'items'), orderBy('createdAt', 'asc')));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as EventItem)).filter((i) => !i.deleted);
  },

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

  async createExpenseItem(
    params: {
      eventId: string;
      name: string;
      costMinor: number;
      paidBy: string;
      splitBy: SplitMode;
      participants: string[];
      customShares?: Record<string, number>;
      comment?: string;
      expenseDate?: string;
    },
    user: UserProfile,
    eventMembers: Record<string, any> = {}
  ): Promise<string> {
    const { eventId, name, costMinor, paidBy, splitBy, participants, customShares, comment } = params;
    const emoji = getEmojiForName(name);
    const shares =
      splitBy === 'equal'
        ? calculateEqualShares(costMinor, participants)
        : (customShares || {});

    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);
    const authorFirstName = getFirstName(user.displayName);
    const expenseDate = params.expenseDate || getTodayLocalDateString();

    const initialAuditLog = {
      id: 'log_' + now,
      type: 'created' as const,
      byUid: user.uid,
      byName: authorFirstName,
      timestamp: now,
      formattedTimestamp,
      summary: `Created expense item "${name}" for ${(costMinor / 100).toFixed(2)}`,
    };

    const newItem: Omit<EventItem, 'id'> = {
      eventId,
      name,
      emoji,
      isCategory: false,
      isSettlementsItem: false,
      costMinor,
      paidBy,
      splitBy,
      participants,
      shares,
      expenseDate,
      comment: comment || '',
      createdBy: user.uid,
      createdByName: authorFirstName,
      createdAt: now,
      updatedAt: now,
      lastModifiedBy: user.uid,
      lastModifiedByName: authorFirstName,
      lastModifiedAt: now,
      deleted: false,
      auditLogs: [initialAuditLog],
    };

    let itemId: string;
    if (!isFirebaseConfigured() || !db) {
      itemId = 'item_' + now;
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      items.push({ ...newItem, id: itemId });
      setLocal(`items_${eventId}`, items);
    } else {
      const sanitized = sanitizeForFirestore(newItem);
      const ref = await addDoc(collection(db, 'events', eventId, 'items'), sanitized);
      itemId = ref.id;
    }

    for (const memberUid of Object.keys(eventMembers || {})) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_created',
          senderUid: user.uid,
          senderName: authorFirstName,
          senderPhotoURL: user.photoURL,
          eventId,
          amountMinor: costMinor,
          title: 'New Expense',
          description: `${authorFirstName} added "${name}"`,
        });
      }
    }

    return itemId;
  },

  async convertItemToCategory(eventId: string, itemId: string, user: UserProfile): Promise<void> {
    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);

    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx === -1) throw new Error('Item not found');
      const item = items[idx];
      if (item.isCategory) return;

      if (item.costMinor && item.costMinor > 0) {
        const subitemAuditLog = {
          id: 'log_' + now,
          type: 'created' as const,
          byUid: user.uid,
          byName: user.displayName,
          timestamp: now,
          formattedTimestamp,
          summary: `Converted from standalone item to category subitem`,
        };

        const newSubitem: ExpenseEntry = {
          id: 'exp_' + now,
          eventId,
          itemId,
          name: item.name,
          emoji: item.emoji,
          costMinor: item.costMinor,
          paidBy: item.paidBy || user.uid,
          splitBy: item.splitBy || 'equal',
          participants: item.participants || [],
          shares: item.shares || {},
          comment: item.comment || '',
          createdBy: item.createdBy || user.uid,
          createdByName: item.createdByName || user.displayName,
          createdAt: item.createdAt || now,
          lastModifiedBy: user.uid,
          lastModifiedByName: user.displayName,
          lastModifiedAt: now,
          deleted: false,
          auditLogs: [...(item.auditLogs || []), subitemAuditLog],
        };

        const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
        expenses.push(newSubitem);
        setLocal(`expenses_${eventId}`, expenses);
      }

      items[idx] = {
        ...item,
        isCategory: true,
        costMinor: 0,
        paidBy: '',
        participants: [],
        shares: {},
        comment: '',
        updatedAt: now,
        lastModifiedAt: now,
        lastModifiedBy: user.uid,
        lastModifiedByName: user.displayName,
      };
      setLocal(`items_${eventId}`, items);
      return;
    }

    const itemRef = doc(db, 'events', eventId, 'items', itemId);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) throw new Error('Item not found');
    const existing = snap.data() as EventItem;
    if (existing.isCategory) return;

    if (existing.costMinor && existing.costMinor > 0) {
      const subitemAuditLog = {
        id: 'log_' + now,
        type: 'created' as const,
        byUid: user.uid,
        byName: user.displayName,
        timestamp: now,
        formattedTimestamp,
        summary: `Converted from standalone item to category subitem`,
      };

      const newSubitem: Omit<ExpenseEntry, 'id'> = {
        eventId,
        itemId,
        name: existing.name,
        emoji: existing.emoji,
        costMinor: existing.costMinor,
        paidBy: existing.paidBy || user.uid,
        splitBy: existing.splitBy || 'equal',
        participants: existing.participants || [],
        shares: existing.shares || {},
        comment: existing.comment || '',
        createdBy: existing.createdBy || user.uid,
        createdByName: existing.createdByName || user.displayName,
        createdAt: existing.createdAt || now,
        lastModifiedBy: user.uid,
        lastModifiedByName: user.displayName,
        lastModifiedAt: now,
        deleted: false,
        auditLogs: [...(existing.auditLogs || []), subitemAuditLog],
      };

      await addDoc(collection(db, 'events', eventId, 'expenses'), newSubitem);
    }

    await updateDoc(itemRef, {
      isCategory: true,
      costMinor: 0,
      paidBy: '',
      participants: [],
      shares: {},
      comment: '',
      updatedAt: now,
      lastModifiedAt: now,
      lastModifiedBy: user.uid,
      lastModifiedByName: user.displayName,
    });
  },

  async updateExpenseItem(
    eventId: string,
    itemId: string,
    updates: Partial<{
      name: string;
      costMinor: number;
      paidBy: string;
      splitBy: SplitMode;
      participants: string[];
      customShares?: Record<string, number>;
      comment?: string;
      expenseDate?: string;
    }>,
    user: UserProfile,
    eventMembers: Record<string, any>
  ): Promise<void> {
    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);
    const authorFirstName = getFirstName(user.displayName);

    const applyUpdates = (current: EventItem): EventItem => {
      const name = updates.name !== undefined ? updates.name : current.name;
      const costMinor = updates.costMinor !== undefined ? updates.costMinor : (current.costMinor || 0);
      const paidBy = updates.paidBy !== undefined ? updates.paidBy : (current.paidBy || '');
      const splitBy = updates.splitBy !== undefined ? updates.splitBy : (current.splitBy || 'equal');
      const participants = updates.participants !== undefined ? updates.participants : (current.participants || []);
      const comment = updates.comment !== undefined ? updates.comment : (current.comment || '');
      const expenseDate = updates.expenseDate !== undefined ? updates.expenseDate : current.expenseDate;

      const shares =
        splitBy === 'equal'
          ? calculateEqualShares(costMinor, participants)
          : (updates.customShares || current.shares || {});

      const changedFields: string[] = [];
      const previousValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};

      if (updates.name && updates.name !== current.name) {
        changedFields.push('name');
        previousValues.name = current.name;
        newValues.name = updates.name;
      }
      if (updates.costMinor !== undefined && updates.costMinor !== current.costMinor) {
        changedFields.push('cost');
        previousValues.costMinor = current.costMinor;
        newValues.costMinor = updates.costMinor;
      }
      if (updates.paidBy && updates.paidBy !== current.paidBy) {
        changedFields.push('payer');
        previousValues.paidBy = current.paidBy;
        newValues.paidBy = updates.paidBy;
      }
      if (updates.splitBy && updates.splitBy !== current.splitBy) {
        changedFields.push('split mode');
        previousValues.splitBy = current.splitBy;
        newValues.splitBy = updates.splitBy;
      }
      if (updates.participants) {
        changedFields.push('participants');
        previousValues.participants = current.participants;
        newValues.participants = updates.participants;
      }
      if (updates.expenseDate && updates.expenseDate !== current.expenseDate) {
        changedFields.push('date');
        previousValues.expenseDate = current.expenseDate;
        newValues.expenseDate = updates.expenseDate;
      }

      const auditLog = {
        id: 'log_' + now,
        type: 'edited' as const,
        byUid: user.uid,
        byName: authorFirstName,
        timestamp: now,
        formattedTimestamp,
        changedFields,
        previousValues,
        newValues,
        summary: `Edited by ${authorFirstName} at ${formattedTimestamp}`,
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
        expenseDate,
        comment,
        lastModifiedBy: user.uid,
        lastModifiedByName: authorFirstName,
        lastModifiedAt: now,
        updatedAt: now,
        auditLogs: [...(current.auditLogs || []), auditLog],
      };
    };

    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        items[idx] = applyUpdates(items[idx]);
        setLocal(`items_${eventId}`, items);
      }
    } else {
      const ref = doc(db, 'events', eventId, 'items', itemId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const updated = applyUpdates({ ...snap.data(), id: snap.id } as EventItem);
        const { id, ...docData } = updated;
        await updateDoc(ref, sanitizeForFirestore(docData));
      }
    }

    for (const memberUid of Object.keys(eventMembers || {})) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_modified',
          senderUid: user.uid,
          senderName: authorFirstName,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Expense Modified',
          description: `${authorFirstName} modified an expense`,
        });
      }
    }
  },

  async updateItemName(
    eventId: string,
    itemId: string,
    newName: string,
    customEmoji?: string,
    user?: UserProfile
  ): Promise<void> {
    const emoji = customEmoji || getEmojiForName(newName);
    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);
    const authorFirstName = user ? getFirstName(user.displayName) : 'Member';

    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        const prevName = items[idx].name;
        items[idx].name = newName;
        items[idx].emoji = emoji;
        items[idx].updatedAt = now;
        if (user) {
          items[idx].lastModifiedBy = user.uid;
          items[idx].lastModifiedByName = authorFirstName;
          items[idx].lastModifiedAt = now;
          const auditLog = {
            id: 'log_' + now,
            type: 'edited' as const,
            byUid: user.uid,
            byName: authorFirstName,
            timestamp: now,
            formattedTimestamp,
            summary: `Category renamed from "${prevName}" to "${newName}"`,
            previousValues: { name: prevName },
            newValues: { name: newName },
          };
          items[idx].auditLogs = [...(items[idx].auditLogs || []), auditLog];
        }
        setLocal(`items_${eventId}`, items);
      }
      return;
    }

    const itemRef = doc(db, 'events', eventId, 'items', itemId);
    const snap = await getDoc(itemRef);
    const existing = snap.exists() ? (snap.data() as EventItem) : null;
    const prevName = existing ? existing.name : '';

    const updatePayload: any = {
      name: newName,
      emoji,
      updatedAt: now,
    };

    if (user) {
      updatePayload.lastModifiedBy = user.uid;
      updatePayload.lastModifiedByName = authorFirstName;
      updatePayload.lastModifiedAt = now;
      const auditLog = {
        id: 'log_' + now,
        type: 'edited' as const,
        byUid: user.uid,
        byName: authorFirstName,
        timestamp: now,
        formattedTimestamp,
        summary: `Category renamed from "${prevName}" to "${newName}"`,
        previousValues: { name: prevName },
        newValues: { name: newName },
      };
      updatePayload.auditLogs = [...(existing?.auditLogs || []), auditLog];
    }

    await updateDoc(itemRef, sanitizeForFirestore(updatePayload));
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
      expenseDate?: string;
    },
    user: UserProfile,
    eventMembers: Record<string, any> = {}
  ): Promise<string> {
    const { eventId, itemId, name, costMinor, paidBy, splitBy, participants, customShares, comment } = params;

    const emoji = getEmojiForName(name);
    const shares = splitBy === 'equal'
      ? calculateEqualShares(costMinor, participants)
      : (customShares || {});

    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);
    const authorFirstName = getFirstName(user.displayName);
    const expenseDate = params.expenseDate || getTodayLocalDateString();

    const initialAuditLog = {
      id: 'log_' + now,
      type: 'created' as const,
      byUid: user.uid,
      byName: authorFirstName,
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
      expenseDate,
      comment: comment || '',
      createdBy: user.uid,
      createdByName: authorFirstName,
      createdAt: now,
      lastModifiedBy: user.uid,
      lastModifiedByName: authorFirstName,
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
      const sanitized = sanitizeForFirestore(newExpense);
      const ref = await addDoc(collection(db, 'events', eventId, 'expenses'), sanitized);
      expenseId = ref.id;
    }

    // Notify other event members
    for (const memberUid of Object.keys(eventMembers || {})) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_created',
          senderUid: user.uid,
          senderName: authorFirstName,
          senderPhotoURL: user.photoURL,
          eventId,
          amountMinor: costMinor,
          title: 'New Expense',
          description: `${authorFirstName} added "${name}"`,
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
      expenseDate?: string;
    },
    user: UserProfile,
    eventMembers: Record<string, any>
  ): Promise<void> {
    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);
    const authorFirstName = getFirstName(user.displayName);

    const applyUpdatesToEntry = (current: ExpenseEntry): ExpenseEntry => {
      const name = updates.name !== undefined ? updates.name : current.name;
      const costMinor = updates.costMinor !== undefined ? updates.costMinor : current.costMinor;
      const paidBy = updates.paidBy !== undefined ? updates.paidBy : current.paidBy;
      const splitBy = updates.splitBy !== undefined ? updates.splitBy : current.splitBy;
      const participants = updates.participants !== undefined ? updates.participants : current.participants;
      const comment = updates.comment !== undefined ? updates.comment : current.comment;
      const expenseDate = updates.expenseDate !== undefined ? updates.expenseDate : current.expenseDate;

      const shares = splitBy === 'equal'
        ? calculateEqualShares(costMinor, participants)
        : (updates.customShares || current.shares);

      const changedFields: string[] = [];
      const previousValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};

      if (updates.name && updates.name !== current.name) {
        changedFields.push('name');
        previousValues.name = current.name;
        newValues.name = updates.name;
      }
      if (updates.costMinor !== undefined && updates.costMinor !== current.costMinor) {
        changedFields.push('cost');
        previousValues.costMinor = current.costMinor;
        newValues.costMinor = updates.costMinor;
      }
      if (updates.paidBy && updates.paidBy !== current.paidBy) {
        changedFields.push('payer');
        previousValues.paidBy = current.paidBy;
        newValues.paidBy = updates.paidBy;
      }
      if (updates.splitBy && updates.splitBy !== current.splitBy) {
        changedFields.push('split mode');
        previousValues.splitBy = current.splitBy;
        newValues.splitBy = updates.splitBy;
      }
      if (updates.participants) {
        changedFields.push('participants');
        previousValues.participants = current.participants;
        newValues.participants = updates.participants;
      }
      if (updates.expenseDate && updates.expenseDate !== current.expenseDate) {
        changedFields.push('date');
        previousValues.expenseDate = current.expenseDate;
        newValues.expenseDate = updates.expenseDate;
      }

      const auditLog = {
        id: 'log_' + now,
        type: 'edited' as const,
        byUid: user.uid,
        byName: authorFirstName,
        timestamp: now,
        formattedTimestamp,
        changedFields,
        previousValues,
        newValues,
        summary: `Edited by ${authorFirstName} at ${formattedTimestamp}`,
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
        expenseDate,
        comment,
        lastModifiedBy: user.uid,
        lastModifiedByName: authorFirstName,
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
        const { id, ...docData } = updated;
        await updateDoc(ref, sanitizeForFirestore(docData));
      }
    }

    // Notify other event members
    for (const memberUid of Object.keys(eventMembers || {})) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_modified',
          senderUid: user.uid,
          senderName: authorFirstName,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Expense Modified',
          description: `${authorFirstName} modified an expense`,
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
    for (const memberUid of Object.keys(eventMembers || {})) {
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

    for (const memberUid of Object.keys(eventMembers || {})) {
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
    return { ...userSnap.data(), uid } as UserProfile;
  },

  async getUserByUid(uid: string): Promise<UserProfile | null> {
    if (!uid) return null;

    if (!isFirebaseConfigured() || !db) {
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
      const found = mockUsers.find(
        (u) => u.uid === uid || u.uid === `demo_user_${uid}` || uid.replace('demo_user_', '') === u.username
      );
      if (found) return found;

      const currentUser = getLocal<UserProfile | null>('current_user', null);
      if (currentUser && (currentUser.uid === uid || currentUser.uid === `demo_user_${uid}`)) {
        return currentUser;
      }

      const localUsers = getLocal<UserProfile[]>('mock_users', []);
      return localUsers.find((u) => u.uid === uid) || null;
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (!userSnap.exists()) return null;
      return { ...userSnap.data(), uid } as UserProfile;
    } catch (err) {
      console.error(`Error looking up user by uid ${uid}:`, err);
      return null;
    }
  },

  async getUsersByUids(uids: string[]): Promise<Record<string, UserProfile>> {
    const uniqueUids = Array.from(new Set(uids.filter(Boolean)));
    const profiles: Record<string, UserProfile> = {};

    await Promise.all(
      uniqueUids.map(async (uid) => {
        const user = await dataService.getUserByUid(uid);
        if (user) {
          profiles[uid] = user;
        }
      })
    );

    return profiles;
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

    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<EventInvitation[]>('event_invitations', []);
      const existing = all.find(
        (i) => i.eventId === event.id && i.toUid === toFriend.uid && i.status === 'pending'
      );
      if (existing) {
        throw new Error(`An invitation has already been sent to ${toFriend.displayName}.`);
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
        scope: 'full',
        createdAt: Date.now(),
      };
      all.unshift({ ...invite, id: 'inv_' + Date.now() });
      setLocal('event_invitations', all);
    } else {
      const q = query(
        collection(db, 'eventInvitations'),
        where('eventId', '==', event.id),
        where('toUid', '==', toFriend.uid),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error(`An invitation has already been sent to ${toFriend.displayName}.`);
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
        scope: 'full',
        createdAt: Date.now(),
      };
      await addDoc(collection(db, 'eventInvitations'), sanitizeForFirestore(invite));
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
            let matchedSlotId: string | undefined;
            if (ev.slots) {
              const userFirst = getFirstName(user.displayName).toLowerCase();
              const found = Object.values(ev.slots).find(
                (s) =>
                  !s.isClaimed &&
                  (s.expectedUid === user.uid || s.placeholderName.toLowerCase() === userFirst)
              );
              if (found) {
                matchedSlotId = found.id;
                ev.slots[found.id] = {
                  ...found,
                  isClaimed: true,
                  claimedByUid: user.uid,
                  claimedByName: getFirstName(user.displayName),
                  claimedAt: Date.now(),
                  updatedAt: Date.now(),
                };
              }
            }

            ev.members[user.uid] = {
              uid: user.uid,
              displayName: user.displayName,
              photoURL: user.photoURL,
              username: user.username,
              joinedAt: Date.now(),
              role: 'member',
              scope: invitation.scope || 'full',
              slotId: matchedSlotId,
            };
            ev.updatedAt = Date.now();
            setLocal('events', events);

            if (matchedSlotId) {
              await dataService.migrateSlotExpenses(ev.id, matchedSlotId, user);
            }
          }
        }
      }
      return;
    }

    const invRef = doc(db, 'eventInvitations', invitation.id);
    await updateDoc(invRef, { status: accept ? 'accepted' : 'declined' });

    if (accept) {
      const ev = await dataService.getEventById(invitation.eventId);
      let matchedSlotId: string | undefined;
      const slotsUpdate: Record<string, any> = {};

      if (ev && ev.slots) {
        const userFirst = getFirstName(user.displayName).toLowerCase();
        const found = Object.values(ev.slots).find(
          (s) =>
            !s.isClaimed &&
            (s.expectedUid === user.uid || s.placeholderName.toLowerCase() === userFirst)
        );
        if (found) {
          matchedSlotId = found.id;
          slotsUpdate[`slots.${found.id}`] = {
            ...found,
            isClaimed: true,
            claimedByUid: user.uid,
            claimedByName: getFirstName(user.displayName),
            claimedAt: Date.now(),
            updatedAt: Date.now(),
          };
        }
      }

      const eventRef = doc(db, 'events', invitation.eventId);
      await updateDoc(
        eventRef,
        sanitizeForFirestore({
          [`members.${user.uid}`]: {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            username: user.username,
            joinedAt: Date.now(),
            role: 'member',
            scope: invitation.scope || 'full',
            slotId: matchedSlotId,
          },
          ...slotsUpdate,
          updatedAt: Date.now(),
        })
      );

      if (matchedSlotId) {
        await dataService.migrateSlotExpenses(invitation.eventId, matchedSlotId, user);
      }

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

  // ==========================================
  // INVITATION LINKS (Replacing Join With Code)
  // ==========================================
  async createInvitationLink(
    eventId: string,
    user: UserProfile,
    options?: {
      scope?: 'full' | 'selected_items';
      allowedItemIds?: string[];
      expiresAt?: number;
      maxUses?: number;
    }
  ): Promise<EventInvitationLink> {
    const event = await dataService.getEventById(eventId);
    if (!event) throw new Error('Event not found');

    const token = generateInvitationToken();
    const authorFirstName = getFirstName(user.displayName);
    const availableSlots = Object.values(event.slots || {})
      .filter((s) => !s.isClaimed)
      .map((s) => ({ id: s.id, placeholderName: s.placeholderName }));

    const newLink: Omit<EventInvitationLink, 'id'> = {
      token,
      eventId,
      eventName: event.name,
      eventEmoji: event.emoji,
      createdByUid: user.uid,
      createdByName: authorFirstName,
      createdAt: Date.now(),
      scope: options?.scope || 'full',
      allowedItemIds: options?.allowedItemIds || [],
      availableSlots,
      revoked: false,
      usesCount: 0,
      maxUses: options?.maxUses,
      expiresAt: options?.expiresAt,
    };

    if (!isFirebaseConfigured() || !db) {
      const id = 'link_' + Date.now();
      const links = getLocal<EventInvitationLink[]>('invitation_links', []);
      const saved = { ...newLink, id };
      links.push(saved);
      setLocal('invitation_links', links);
      return saved;
    }

    const sanitized = sanitizeForFirestore(newLink);
    const ref = await addDoc(collection(db, 'eventInvitationLinks'), sanitized);
    return { ...newLink, id: ref.id };
  },

  async getInvitationLinkByToken(token: string): Promise<EventInvitationLink | null> {
    if (!isFirebaseConfigured() || !db) {
      const links = getLocal<EventInvitationLink[]>('invitation_links', []);
      return links.find((l) => l.token === token) || null;
    }

    const q = query(collection(db, 'eventInvitationLinks'), where('token', '==', token));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    return { ...docSnap.data(), id: docSnap.id } as EventInvitationLink;
  },

  async revokeInvitationLink(linkId: string): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const links = getLocal<EventInvitationLink[]>('invitation_links', []);
      const idx = links.findIndex((l) => l.id === linkId);
      if (idx !== -1) {
        links[idx].revoked = true;
        setLocal('invitation_links', links);
      }
      return;
    }

    await updateDoc(doc(db, 'eventInvitationLinks', linkId), { revoked: true });
  },

  async joinEventByInvitationToken(
    token: string,
    user: UserProfile,
    slotId?: string
  ): Promise<{ event: SplitifyEvent; link: EventInvitationLink }> {
    const link = await dataService.getInvitationLinkByToken(token);
    if (!link) throw new Error('Invalid or non-existent invitation link.');
    if (link.revoked) throw new Error('This invitation link has been revoked.');
    if (link.expiresAt && link.expiresAt < Date.now()) {
      throw new Error('This invitation link has expired.');
    }
    if (link.maxUses && link.usesCount >= link.maxUses) {
      throw new Error('This invitation link has reached its maximum uses limit.');
    }

    const event = await dataService.getEventById(link.eventId);
    if (!event || event.deleted) {
      throw new Error('The associated event does not exist or has been deleted.');
    }

    const userFirstName = getFirstName(user.displayName);
    const existingMember = event.members[user.uid];
    const memberEntry: EventMember = {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      username: user.username,
      joinedAt: existingMember ? existingMember.joinedAt : Date.now(),
      role: existingMember ? existingMember.role : 'member',
      scope: link.scope,
      allowedItemIds: link.allowedItemIds || [],
      slotId: slotId || existingMember?.slotId,
    };

    const slots = { ...(event.slots || {}) };
    if (slotId && slots[slotId]) {
      const slot = slots[slotId];
      if (slot.isClaimed && slot.claimedByUid !== user.uid) {
        throw new Error(`Slot "${slot.placeholderName}" has already been claimed.`);
      }
      slots[slotId] = {
        ...slot,
        isClaimed: true,
        claimedByUid: user.uid,
        claimedByName: userFirstName,
        claimedAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    if (!isFirebaseConfigured() || !db) {
      event.members[user.uid] = memberEntry;
      event.slots = slots;
      event.updatedAt = Date.now();
      const events = getLocal<SplitifyEvent[]>('events', []);
      const idx = events.findIndex((e) => e.id === event.id);
      if (idx !== -1) events[idx] = event;
      setLocal('events', events);

      const links = getLocal<EventInvitationLink[]>('invitation_links', []);
      const lIdx = links.findIndex((l) => l.id === link.id);
      if (lIdx !== -1) {
        links[lIdx].usesCount = (links[lIdx].usesCount || 0) + 1;
        setLocal('invitation_links', links);
      }

      if (slotId) {
        await dataService.migrateSlotExpenses(event.id, slotId, user);
      }

      return { event, link };
    }

    const eventRef = doc(db, 'events', link.eventId);
    const linkRef = doc(db, 'eventInvitationLinks', link.id);

    let joinedEvent: SplitifyEvent = event;
    await runTransaction(db, async (transaction) => {
      const linkSnap = await transaction.get(linkRef);
      if (!linkSnap.exists()) {
        throw new Error('This invitation link does not exist or has expired.');
      }
      const liveLink = linkSnap.data() as EventInvitationLink;
      if (liveLink.revoked) {
        throw new Error('This invitation link has been revoked by the event host.');
      }
      if (liveLink.expiresAt && liveLink.expiresAt < Date.now()) {
        throw new Error('This invitation link has expired.');
      }
      if (liveLink.maxUses && liveLink.usesCount >= liveLink.maxUses) {
        throw new Error('This invitation link has reached its maximum uses limit.');
      }

      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists()) {
        throw new Error('The associated event does not exist.');
      }
      const liveEvent = { ...eventSnap.data(), id: eventSnap.id } as SplitifyEvent;
      if (liveEvent.deleted) {
        throw new Error('The associated event has been deleted.');
      }

      const liveSlots = { ...(liveEvent.slots || {}) };
      if (slotId) {
        const slot = liveSlots[slotId];
        if (!slot) {
          throw new Error('The selected spot does not exist.');
        }
        if (slot.isClaimed && slot.claimedByUid !== user.uid) {
          throw new Error(`Slot "${slot.placeholderName}" has already been claimed by someone else.`);
        }
        liveSlots[slotId] = {
          ...slot,
          isClaimed: true,
          claimedByUid: user.uid,
          claimedByName: userFirstName,
          claimedAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      const isAlreadyMember = Boolean(liveEvent.members && liveEvent.members[user.uid]);
      const currentMember = liveEvent.members?.[user.uid];
      const finalMemberEntry: EventMember = {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        username: user.username,
        joinedAt: currentMember ? currentMember.joinedAt : Date.now(),
        role: currentMember ? currentMember.role : 'member',
        scope: liveLink.scope,
        allowedItemIds: liveLink.allowedItemIds || [],
        slotId: slotId || currentMember?.slotId,
      };

      transaction.update(
        eventRef,
        sanitizeForFirestore({
          [`members.${user.uid}`]: finalMemberEntry,
          slots: liveSlots,
          updatedAt: Date.now(),
        })
      );

      if (!isAlreadyMember) {
        transaction.update(linkRef, {
          usesCount: (liveLink.usesCount || 0) + 1,
        });
      }

      joinedEvent = {
        ...liveEvent,
        members: { ...(liveEvent.members || {}), [user.uid]: finalMemberEntry },
        slots: liveSlots,
        updatedAt: Date.now(),
      };
    });

    if (slotId) {
      await dataService.migrateSlotExpenses(link.eventId, slotId, user);
    }

    return { event: joinedEvent, link };
  },

  // ==========================================
  // SLOTS MANAGEMENT (Individual Person Placeholders)
  // ==========================================
  async createPersonSlot(
    eventId: string,
    placeholderName: string,
    expectedUid?: string
  ): Promise<EventSlot> {
    const slotId = 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newSlot: EventSlot = {
      id: slotId,
      eventId,
      placeholderName: placeholderName.trim(),
      expectedUid,
      isClaimed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      const idx = all.findIndex((e) => e.id === eventId);
      if (idx !== -1) {
        if (!all[idx].slots) all[idx].slots = {};
        all[idx].slots![slotId] = newSlot;
        all[idx].updatedAt = Date.now();
        setLocal('events', all);
      }
      return newSlot;
    }

    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, sanitizeForFirestore({
      [`slots.${slotId}`]: newSlot,
      updatedAt: Date.now(),
    }));
    return newSlot;
  },

  async deletePersonSlot(eventId: string, slotId: string): Promise<void> {
    const event = await dataService.getEventById(eventId);
    if (!event) return;
    const slot = event.slots?.[slotId];
    if (!slot) return;
    if (slot.isClaimed) {
      throw new Error('Claimed slots cannot be deleted.');
    }

    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      const idx = all.findIndex((e) => e.id === eventId);
      if (idx !== -1 && all[idx].slots) {
        delete all[idx].slots![slotId];
        all[idx].updatedAt = Date.now();
        setLocal('events', all);
      }
      return;
    }

    const eventRef = doc(db, 'events', eventId);
    const slots = { ...(event.slots || {}) };
    delete slots[slotId];
    await updateDoc(eventRef, sanitizeForFirestore({
      slots,
      updatedAt: Date.now(),
    }));
  },

  async claimPersonSlot(eventId: string, slotId: string, user: UserProfile): Promise<void> {
    const event = await dataService.getEventById(eventId);
    if (!event) throw new Error('Event not found');
    const slot = event.slots?.[slotId];
    if (!slot) throw new Error('Slot not found');
    if (slot.isClaimed && slot.claimedByUid !== user.uid) {
      throw new Error(`Slot "${slot.placeholderName}" is already claimed by ${slot.claimedByName || 'someone else'}.`);
    }

    const userFirstName = getFirstName(user.displayName);
    const updatedSlot: EventSlot = {
      ...slot,
      isClaimed: true,
      claimedByUid: user.uid,
      claimedByName: userFirstName,
      claimedAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      const idx = all.findIndex((e) => e.id === eventId);
      if (idx !== -1 && all[idx].slots) {
        all[idx].slots![slotId] = updatedSlot;
        if (all[idx].members[user.uid]) {
          all[idx].members[user.uid].slotId = slotId;
        }
        all[idx].updatedAt = Date.now();
        setLocal('events', all);
      }
      await dataService.migrateSlotExpenses(eventId, slotId, user);
      return;
    }

    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, sanitizeForFirestore({
      [`slots.${slotId}`]: updatedSlot,
      [`members.${user.uid}.slotId`]: slotId,
      updatedAt: Date.now(),
    }));

    await dataService.migrateSlotExpenses(eventId, slotId, user);
  },

  async migrateSlotExpenses(eventId: string, slotId: string, user: UserProfile): Promise<void> {
    const userFirstName = getFirstName(user.displayName);
    const now = Date.now();

    if (!isFirebaseConfigured() || !db) {
      // LocalStorage migration
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      let itemsChanged = false;
      for (const item of items) {
        let changed = false;
        if (item.paidBy === slotId) {
          item.paidBy = user.uid;
          item.createdByName = userFirstName;
          changed = true;
        }
        if (item.participants?.includes(slotId)) {
          item.participants = item.participants.map((p) => (p === slotId ? user.uid : p));
          changed = true;
        }
        if (item.shares && item.shares[slotId] !== undefined) {
          item.shares[user.uid] = item.shares[slotId];
          delete item.shares[slotId];
          changed = true;
        }
        if (changed) {
          item.updatedAt = now;
          itemsChanged = true;
        }
      }
      if (itemsChanged) setLocal(`items_${eventId}`, items);

      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      let expensesChanged = false;
      for (const exp of expenses) {
        let changed = false;
        if (exp.paidBy === slotId) {
          exp.paidBy = user.uid;
          exp.createdByName = userFirstName;
          changed = true;
        }
        if (exp.participants?.includes(slotId)) {
          exp.participants = exp.participants.map((p) => (p === slotId ? user.uid : p));
          changed = true;
        }
        if (exp.shares && exp.shares[slotId] !== undefined) {
          exp.shares[user.uid] = exp.shares[slotId];
          delete exp.shares[slotId];
          changed = true;
        }
        if (changed) {
          exp.lastModifiedBy = user.uid;
          exp.lastModifiedByName = userFirstName;
          exp.lastModifiedAt = now;
          expensesChanged = true;
        }
      }
      if (expensesChanged) setLocal(`expenses_${eventId}`, expenses);
      return;
    }

    // Firestore migration
    try {
      const itemsColl = collection(db, 'events', eventId, 'items');
      const itemsSnap = await getDocs(itemsColl);
      for (const docSnap of itemsSnap.docs) {
        const item = docSnap.data() as EventItem;
        let needsUpdate = false;
        let newPaidBy = item.paidBy;
        let newParticipants = item.participants;
        let newShares = item.shares ? { ...item.shares } : undefined;

        if (item.paidBy === slotId) {
          newPaidBy = user.uid;
          needsUpdate = true;
        }
        if (item.participants?.includes(slotId)) {
          newParticipants = item.participants.map((p) => (p === slotId ? user.uid : p));
          needsUpdate = true;
        }
        if (newShares && newShares[slotId] !== undefined) {
          newShares[user.uid] = newShares[slotId];
          delete newShares[slotId];
          needsUpdate = true;
        }
        if (needsUpdate) {
          await updateDoc(docSnap.ref, sanitizeForFirestore({
            paidBy: newPaidBy,
            participants: newParticipants,
            shares: newShares,
            lastModifiedBy: user.uid,
            lastModifiedByName: userFirstName,
            lastModifiedAt: now,
            updatedAt: now,
          }));
        }
      }

      const expensesColl = collection(db, 'events', eventId, 'expenses');
      const expSnap = await getDocs(expensesColl);
      for (const docSnap of expSnap.docs) {
        const exp = docSnap.data() as ExpenseEntry;
        let needsUpdate = false;
        let newPaidBy = exp.paidBy;
        let newParticipants = exp.participants;
        let newShares = exp.shares ? { ...exp.shares } : undefined;

        if (exp.paidBy === slotId) {
          newPaidBy = user.uid;
          needsUpdate = true;
        }
        if (exp.participants?.includes(slotId)) {
          newParticipants = exp.participants.map((p) => (p === slotId ? user.uid : p));
          needsUpdate = true;
        }
        if (newShares && newShares[slotId] !== undefined) {
          newShares[user.uid] = newShares[slotId];
          delete newShares[slotId];
          needsUpdate = true;
        }
        if (needsUpdate) {
          await updateDoc(docSnap.ref, sanitizeForFirestore({
            paidBy: newPaidBy,
            participants: newParticipants,
            shares: newShares,
            lastModifiedBy: user.uid,
            lastModifiedByName: userFirstName,
            lastModifiedAt: now,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to migrate slot expenses:', err);
    }
  },

  // Backwards compatibility aliases
  async createSlot(
    eventId: string,
    name: string,
    _maxCapacity?: number,
    _description?: string
  ): Promise<EventSlot> {
    return dataService.createPersonSlot(eventId, name);
  },

  async deleteSlot(eventId: string, slotId: string): Promise<void> {
    return dataService.deletePersonSlot(eventId, slotId);
  },

  async assignMemberToSlot(eventId: string, slotId: string, memberUid: string): Promise<void> {
    // Forward to claim if user object available or assign slotId
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      const idx = all.findIndex((e) => e.id === eventId);
      if (idx !== -1 && all[idx].slots && all[idx].slots![slotId]) {
        const slot = all[idx].slots![slotId];
        slot.isClaimed = true;
        slot.claimedByUid = memberUid;
        slot.claimedByName = all[idx].members[memberUid]?.displayName || 'Member';
        slot.claimedAt = Date.now();
        if (all[idx].members[memberUid]) {
          all[idx].members[memberUid].slotId = slotId;
        }
        setLocal('events', all);
      }
      return;
    }
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, sanitizeForFirestore({
      [`slots.${slotId}.isClaimed`]: true,
      [`slots.${slotId}.claimedByUid`]: memberUid,
      [`slots.${slotId}.claimedAt`]: Date.now(),
      [`members.${memberUid}.slotId`]: slotId,
      updatedAt: Date.now(),
    }));
  },

  async removeMemberFromSlot(eventId: string, slotId: string, memberUid: string): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<SplitifyEvent[]>('events', []);
      const idx = all.findIndex((e) => e.id === eventId);
      if (idx !== -1 && all[idx].slots && all[idx].slots![slotId]) {
        const slot = all[idx].slots![slotId];
        if (slot.claimedByUid === memberUid) {
          slot.isClaimed = false;
          delete slot.claimedByUid;
          delete slot.claimedByName;
          delete slot.claimedAt;
        }
        if (all[idx].members[memberUid]?.slotId === slotId) {
          delete all[idx].members[memberUid].slotId;
        }
        setLocal('events', all);
      }
      return;
    }

    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, sanitizeForFirestore({
      [`slots.${slotId}.isClaimed`]: false,
      [`slots.${slotId}.claimedByUid`]: null,
      [`slots.${slotId}.claimedByName`]: null,
      [`slots.${slotId}.claimedAt`]: null,
      [`members.${memberUid}.slotId`]: null,
      updatedAt: Date.now(),
    }));
  },

  // ==========================================
  // PROFILE & HANDLE RENAMING
  // ==========================================
  async changeUsernameHandle(user: UserProfile, newHandleRaw: string): Promise<string> {
    const cleanHandle = newHandleRaw.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanHandle)) {
      throw new Error('Username must be 3-20 characters and contain only lowercase letters, numbers, and underscores.');
    }
    if (user.username?.toLowerCase() === cleanHandle) {
      return cleanHandle;
    }

    if (!isFirebaseConfigured() || !db) {
      user.username = cleanHandle;
      const currentUser = getLocal<UserProfile | null>('current_user', null);
      if (currentUser && currentUser.uid === user.uid) {
        setLocal('current_user', { ...currentUser, username: cleanHandle });
      }
      return cleanHandle;
    }

    const firestore = db;
    const oldHandle = (user.username || '').toLowerCase();
    const newUsernameRef = doc(firestore, 'usernames', cleanHandle);
    const userRef = doc(firestore, 'users', user.uid);

    await runTransaction(firestore, async (transaction) => {
      const newSnap = await transaction.get(newUsernameRef);
      if (newSnap.exists()) {
        const data = newSnap.data();
        if (data && data.uid !== user.uid) {
          throw new Error(`@${cleanHandle} is already taken. Please choose another.`);
        }
      }

      transaction.set(newUsernameRef, {
        uid: user.uid,
        createdAt: Date.now(),
      });

      if (oldHandle && oldHandle !== cleanHandle) {
        const oldRef = doc(firestore, 'usernames', oldHandle);
        transaction.delete(oldRef);
      }

      transaction.update(userRef, {
        username: cleanHandle,
        updatedAt: Date.now(),
      });
    });

    return cleanHandle;
  },

  async checkUsernameAvailable(handle: string): Promise<boolean> {
    const clean = handle.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) return false;

    if (!isFirebaseConfigured() || !db) {
      const mockUsernames = ['krish', 'rahul', 'priya', 'ananya'];
      const localUsers = getLocal<UserProfile[]>('mock_users', []);
      return !mockUsernames.includes(clean) && !localUsers.some((u) => u.username === clean);
    }

    try {
      const uSnap = await getDoc(doc(db, 'usernames', clean));
      return !uSnap.exists();
    } catch {
      return false;
    }
  },

  async suggestAlternativeUsernames(
    displayName: string,
    requestedHandle: string,
    maxSuggestions: number = 5
  ): Promise<string[]> {
    const candidates = generateHandleCandidates(displayName, requestedHandle);
    const available: string[] = [];

    for (const cand of candidates) {
      const isAvail = await dataService.checkUsernameAvailable(cand);
      if (isAvail) {
        available.push(cand);
        if (available.length >= maxSuggestions) break;
      }
    }

    return available;
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
