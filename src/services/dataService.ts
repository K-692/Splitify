import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
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
  PaymentConfirmation,
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

export function getFriendshipDocId(uid1: string, uid2: string): string {
  const [u1, u2] = [uid1, uid2].sort();
  return `${u1}_${u2}`;
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

function getActorHandle(user: { username?: string; displayName?: string }): string {
  if (user.displayName) return user.displayName;
  if (user.username) return user.username.replace(/^@/, '');
  return 'User';
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
    return onSnapshot(
      q,
      (snapshot) => {
        const events: SplitifyEvent[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as SplitifyEvent;
          if (data.members && data.members[userId] && !data.deleted) {
            events.push({ ...data, id: doc.id });
          }
        });
        callback(events);
      },
      (error) => {
        console.error('subscribeEvents error:', error);
      }
    );
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

    return onSnapshot(
      doc(db, 'events', eventId),
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        callback({ ...snap.data(), id: snap.id } as SplitifyEvent);
      },
      (error) => {
        console.error(`subscribeEvent error for ${eventId}:`, error);
        callback(null);
      }
    );
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
    return onSnapshot(
      q,
      (snapshot) => {
        const items: EventItem[] = [];
        snapshot.forEach((d) => {
          const item = { ...d.data(), id: d.id } as EventItem;
          if (!item.deleted) items.push(item);
        });
        callback(items);
      },
      (error) => {
        console.error(`subscribeItems error for ${eventId}:`, error);
        callback([]);
      }
    );
  },

  async createItem(eventId: string, name: string, user?: UserProfile): Promise<string> {
    const isSettlement = name.toLowerCase().includes('settlement');
    const emoji = isSettlement ? '💸' : getEmojiForName(name);

    const newItem: Omit<EventItem, 'id'> = {
      eventId,
      name,
      emoji,
      isSettlementsItem: isSettlement,
      createdBy: user?.uid,
      createdByName: user ? getFirstName(user.displayName) : undefined,
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
      expenseTime?: string;
      occurredAt?: number;
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
    const actorHandle = getActorHandle(user);
    const expenseDate = params.expenseDate || getTodayLocalDateString();
    const expenseTime = params.expenseTime || '12:00';
    const parsedOccurred = new Date(`${expenseDate}T${expenseTime}`).getTime();
    const occurredAt = params.occurredAt || (!isNaN(parsedOccurred) ? parsedOccurred : now);

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
      expenseTime,
      occurredAt,
      comment: comment || '',
      createdBy: user.uid,
      createdByName: actorHandle,
      createdAt: now,
      updatedAt: now,
      deleted: false,
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
          senderName: actorHandle,
          senderPhotoURL: user.photoURL,
          eventId,
          amountMinor: costMinor,
          title: 'New Expense',
          description: `${actorHandle} added "${name}"`,
        });
      }
    }

    return itemId;
  },

  async convertItemToCategory(eventId: string, itemId: string, user: UserProfile, eventMembers?: Record<string, any>): Promise<void> {
    const now = Date.now();
    const actorHandle = getActorHandle(user);

    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx === -1) throw new Error('Item not found');
      const item = items[idx];
      if (item.isCategory) return;

      if (item.costMinor && item.costMinor > 0) {
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
          createdByName: item.createdByName || actorHandle,
          createdAt: item.createdAt || now,
          deleted: false,
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
        updatedAt: Date.now(),
      };
      setLocal(`items_${eventId}`, items);

      if (eventMembers) {
        for (const memberUid of Object.keys(eventMembers)) {
          if (memberUid !== user.uid) {
            await dataService.createNotification({
              recipientUid: memberUid,
              type: 'expense_modified',
              senderUid: user.uid,
              senderName: actorHandle,
              senderPhotoURL: user.photoURL,
              eventId,
              title: 'Item Converted',
              description: `${actorHandle} converted "${item.name}" into a category`,
            });
          }
        }
      }
      return;
    }

    const itemRef = doc(db, 'events', eventId, 'items', itemId);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) throw new Error('Item not found');
    const existing = snap.data() as EventItem;
    if (existing.isCategory) return;

    if (existing.costMinor && existing.costMinor > 0) {
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
        createdByName: existing.createdByName || actorHandle,
        createdAt: existing.createdAt || now,
        deleted: false,
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
      expenseTime?: string;
      occurredAt?: number;
    }>,
    user: UserProfile,
    eventMembers: Record<string, any>
  ): Promise<void> {
    const actorHandle = getActorHandle(user);

    const applyUpdates = (current: EventItem): EventItem => {
      const name = updates.name !== undefined ? updates.name : current.name;
      const costMinor = updates.costMinor !== undefined ? updates.costMinor : (current.costMinor || 0);
      const paidBy = updates.paidBy !== undefined ? updates.paidBy : (current.paidBy || '');
      const splitBy = updates.splitBy !== undefined ? updates.splitBy : (current.splitBy || 'equal');
      const participants = updates.participants !== undefined ? updates.participants : (current.participants || []);
      const comment = updates.comment !== undefined ? updates.comment : (current.comment || '');
      const expenseDate = updates.expenseDate !== undefined ? updates.expenseDate : current.expenseDate;
      const expenseTime = updates.expenseTime !== undefined ? updates.expenseTime : current.expenseTime;

      let occurredAt = updates.occurredAt !== undefined ? updates.occurredAt : current.occurredAt;
      if (updates.expenseDate !== undefined || updates.expenseTime !== undefined) {
        const d = expenseDate || getTodayLocalDateString();
        const t = expenseTime || '12:00';
        const parsed = new Date(`${d}T${t}`).getTime();
        if (!isNaN(parsed)) occurredAt = parsed;
      }

      const shares =
        splitBy === 'equal'
          ? calculateEqualShares(costMinor, participants)
          : (updates.customShares || current.shares || {});

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
        expenseTime,
        occurredAt,
        comment,
        updatedAt: Date.now(),
      };
    };

    let itemName = '';
    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        items[idx] = applyUpdates(items[idx]);
        itemName = items[idx].name;
        setLocal(`items_${eventId}`, items);
      }
    } else {
      const ref = doc(db, 'events', eventId, 'items', itemId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const updated = applyUpdates({ ...snap.data(), id: snap.id } as EventItem);
        itemName = updated.name;
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
          senderName: actorHandle,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Item Modified',
          description: `${actorHandle} modified "${itemName || 'an item'}"`,
        });
      }
    }
  },

  async updateItemName(
    eventId: string,
    itemId: string,
    newName: string,
    customEmoji?: string,
    user?: UserProfile,
    eventMembers?: Record<string, any>
  ): Promise<void> {
    const emoji = customEmoji || getEmojiForName(newName);
    const now = Date.now();

    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        items[idx].name = newName;
        items[idx].emoji = emoji;
        items[idx].updatedAt = now;
        setLocal(`items_${eventId}`, items);
      }
    } else {
      const itemRef = doc(db, 'events', eventId, 'items', itemId);
      const updatePayload: any = {
        name: newName,
        emoji,
        updatedAt: now,
      };
      await updateDoc(itemRef, sanitizeForFirestore(updatePayload));
    }

    if (user && eventMembers) {
      const actorHandle = getActorHandle(user);
      for (const memberUid of Object.keys(eventMembers)) {
        if (memberUid !== user.uid) {
          await dataService.createNotification({
            recipientUid: memberUid,
            type: 'expense_modified',
            senderUid: user.uid,
            senderName: actorHandle,
            senderPhotoURL: user.photoURL,
            eventId,
            title: 'Category Modified',
            description: `${actorHandle} modified category "${newName}"`,
          });
        }
      }
    }
  },

  async deleteItem(
    eventId: string,
    itemId: string,
    user: UserProfile,
    eventMembers?: Record<string, any>
  ): Promise<void> {
    const actorHandle = getActorHandle(user);
    let deletedName = 'item';

    // Delete item and soft-delete all active subitems inside this item
    if (!isFirebaseConfigured() || !db) {
      const items = getLocal<EventItem[]>(`items_${eventId}`, []);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        deletedName = items[idx].name;
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
        }
      }
      setLocal(`expenses_${eventId}`, expenses);
    } else {
      const itemRef = doc(db, 'events', eventId, 'items', itemId);
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        deletedName = (itemSnap.data() as EventItem).name || 'item';
      }

      await updateDoc(itemRef, {
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
        });
      });
      await batch.commit();
    }

    if (eventMembers) {
      for (const memberUid of Object.keys(eventMembers)) {
        if (memberUid !== user.uid) {
          await dataService.createNotification({
            recipientUid: memberUid,
            type: 'expense_deleted',
            senderUid: user.uid,
            senderName: actorHandle,
            senderPhotoURL: user.photoURL,
            eventId,
            title: 'Item Deleted',
            description: `${actorHandle} deleted "${deletedName}"`,
          });
        }
      }
    }
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
    return onSnapshot(
      q,
      (snapshot) => {
        const expenses: ExpenseEntry[] = [];
        snapshot.forEach((d) => {
          const exp = { ...d.data(), id: d.id } as ExpenseEntry;
          if (!exp.deleted) expenses.push(exp);
        });
        callback(expenses);
      },
      (error) => {
        console.error(`subscribeExpenses error for ${eventId}:`, error);
        callback([]);
      }
    );
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
      expenseTime?: string;
      occurredAt?: number;
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
    const actorHandle = getActorHandle(user);
    const expenseDate = params.expenseDate || getTodayLocalDateString();
    const expenseTime = params.expenseTime || '12:00';
    const parsedOccurred = new Date(`${expenseDate}T${expenseTime}`).getTime();
    const occurredAt = params.occurredAt || (!isNaN(parsedOccurred) ? parsedOccurred : now);

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
      expenseTime,
      occurredAt,
      comment: comment || '',
      createdBy: user.uid,
      createdByName: actorHandle,
      createdAt: now,
      deleted: false,
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
          senderName: actorHandle,
          senderPhotoURL: user.photoURL,
          eventId,
          amountMinor: costMinor,
          title: 'New Expense',
          description: `${actorHandle} added "${name}"`,
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
      expenseTime?: string;
      occurredAt?: number;
    },
    user: UserProfile,
    eventMembers: Record<string, any>
  ): Promise<void> {
    const actorHandle = getActorHandle(user);

    const applyUpdatesToEntry = (current: ExpenseEntry): ExpenseEntry => {
      const name = updates.name !== undefined ? updates.name : current.name;
      const costMinor = updates.costMinor !== undefined ? updates.costMinor : current.costMinor;
      const paidBy = updates.paidBy !== undefined ? updates.paidBy : current.paidBy;
      const splitBy = updates.splitBy !== undefined ? updates.splitBy : current.splitBy;
      const participants = updates.participants !== undefined ? updates.participants : current.participants;
      const comment = updates.comment !== undefined ? updates.comment : current.comment;
      const expenseDate = updates.expenseDate !== undefined ? updates.expenseDate : current.expenseDate;
      const expenseTime = updates.expenseTime !== undefined ? updates.expenseTime : current.expenseTime;

      let occurredAt = updates.occurredAt !== undefined ? updates.occurredAt : current.occurredAt;
      if (updates.expenseDate !== undefined || updates.expenseTime !== undefined) {
        const d = expenseDate || getTodayLocalDateString();
        const t = expenseTime || '12:00';
        const parsed = new Date(`${d}T${t}`).getTime();
        if (!isNaN(parsed)) occurredAt = parsed;
      }

      const shares = splitBy === 'equal'
        ? calculateEqualShares(costMinor, participants)
        : (updates.customShares || current.shares);

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
        expenseTime,
        occurredAt,
        comment,
      };
    };

    let updatedName = '';
    if (!isFirebaseConfigured() || !db) {
      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      const idx = expenses.findIndex((e) => e.id === expenseId);
      if (idx !== -1) {
        expenses[idx] = applyUpdatesToEntry(expenses[idx]);
        updatedName = expenses[idx].name;
        setLocal(`expenses_${eventId}`, expenses);
      }
    } else {
      const ref = doc(db, 'events', eventId, 'expenses', expenseId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const updated = applyUpdatesToEntry({ ...snap.data(), id: snap.id } as ExpenseEntry);
        updatedName = updated.name;
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
          senderName: actorHandle,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Item Modified',
          description: `${actorHandle} modified "${updatedName || 'an expense'}"`,
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
    const actorHandle = getActorHandle(user);
    let deletedName = 'an expense';

    if (!isFirebaseConfigured() || !db) {
      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      const idx = expenses.findIndex((e) => e.id === expenseId);
      if (idx !== -1) {
        deletedName = expenses[idx].name;
        expenses[idx].deleted = true;
        expenses[idx].deletedAt = now;
        expenses[idx].deletedBy = user.uid;
        setLocal(`expenses_${eventId}`, expenses);
      }
    } else {
      const ref = doc(db, 'events', eventId, 'expenses', expenseId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        deletedName = (snap.data() as ExpenseEntry).name || 'an expense';
        await updateDoc(ref, {
          deleted: true,
          deletedAt: now,
          deletedBy: user.uid,
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
          senderName: actorHandle,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Item Deleted',
          description: `${actorHandle} deleted "${deletedName}"`,
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
    const actorHandle = getActorHandle(user);

    if (!isFirebaseConfigured() || !db) {
      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      for (const exp of expenses) {
        if (expenseIds.includes(exp.id)) {
          exp.deleted = true;
          exp.deletedAt = now;
          exp.deletedBy = user.uid;
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
          senderName: actorHandle,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Items Deleted',
          description: `${actorHandle} deleted ${expenseIds.length} expense(s)`,
        });
      }
    }
  },

  async bulkDeleteEventItems(
    eventId: string,
    itemIds: string[],
    expenseIds: string[],
    user: UserProfile,
    eventMembers: Record<string, any>,
    eventName?: string
  ): Promise<void> {
    const now = Date.now();
    const actorHandle = getActorHandle(user);

    if (!isFirebaseConfigured() || !db) {
      if (itemIds.length > 0) {
        const items = getLocal<EventItem[]>(`items_${eventId}`, []);
        for (const item of items) {
          if (itemIds.includes(item.id)) {
            item.deleted = true;
            item.updatedAt = now;
          }
        }
        setLocal(`items_${eventId}`, items);
      }

      const expenses = getLocal<ExpenseEntry[]>(`expenses_${eventId}`, []);
      for (const exp of expenses) {
        if (expenseIds.includes(exp.id) || (exp.itemId && itemIds.includes(exp.itemId))) {
          exp.deleted = true;
          exp.deletedAt = now;
          exp.deletedBy = user.uid;
        }
      }
      setLocal(`expenses_${eventId}`, expenses);
    } else {
      const batch = writeBatch(db);
      for (const id of itemIds) {
        batch.update(doc(db, 'events', eventId, 'items', id), {
          deleted: true,
          updatedAt: now,
        });
      }
      for (const id of expenseIds) {
        batch.update(doc(db, 'events', eventId, 'expenses', id), {
          deleted: true,
          deletedAt: now,
          deletedBy: user.uid,
        });
      }

      if (itemIds.length > 0) {
        for (const itemId of itemIds) {
          const expQ = query(collection(db, 'events', eventId, 'expenses'), where('itemId', '==', itemId));
          const snaps = await getDocs(expQ);
          snaps.forEach((d) => {
            batch.update(d.ref, {
              deleted: true,
              deletedAt: now,
              deletedBy: user.uid,
            });
          });
        }
      }
      await batch.commit();
    }

    const totalCount = itemIds.length + expenseIds.length;
    for (const memberUid of Object.keys(eventMembers || {})) {
      if (memberUid !== user.uid) {
        await dataService.createNotification({
          recipientUid: memberUid,
          type: 'expense_deleted',
          senderUid: user.uid,
          senderName: actorHandle,
          senderPhotoURL: user.photoURL,
          eventId,
          title: 'Items Deleted',
          description: `${actorHandle} deleted ${totalCount} item(s) in "${eventName || 'the event'}"`,
        });
      }
    }
  },

  async deleteSettlement(
    eventId: string,
    settlementId: string,
    user: UserProfile,
    eventMembers?: Record<string, any>
  ): Promise<void> {
    const actorHandle = getActorHandle(user);

    if (!isFirebaseConfigured() || !db) {
      const settlements = getLocal<SettlementEntry[]>(`settlements_${eventId}`, []);
      const idx = settlements.findIndex((s) => s.id === settlementId);
      if (idx === -1) throw new Error('Settlement not found');
      settlements.splice(idx, 1);
      setLocal(`settlements_${eventId}`, settlements);
    } else {
      const ref = doc(db, 'events', eventId, 'settlements', settlementId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Settlement not found');
      await deleteDoc(ref);
    }

    if (eventMembers) {
      for (const memberUid of Object.keys(eventMembers)) {
        if (memberUid !== user.uid) {
          await dataService.createNotification({
            recipientUid: memberUid,
            type: 'expense_deleted',
            senderUid: user.uid,
            senderName: actorHandle,
            senderPhotoURL: user.photoURL,
            eventId,
            title: 'Settlement Deleted',
            description: `${actorHandle} deleted a settlement`,
          });
        }
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
    return onSnapshot(
      q,
      (snapshot) => {
        const settlements: SettlementEntry[] = [];
        snapshot.forEach((d) => {
          settlements.push({ ...d.data(), id: d.id } as SettlementEntry);
        });
        callback(settlements);
      },
      (error) => {
        console.error(`subscribeSettlements error for ${eventId}:`, error);
        callback([]);
      }
    );
  },

  // ==========================================
  // PAYMENT CONFIRMATIONS & TWO-STEP SETTLEMENTS
  // ==========================================
  subscribePaymentConfirmations(
    eventId: string,
    callback: (confirmations: PaymentConfirmation[]) => void
  ): () => void {
    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<PaymentConfirmation[]>(`payment_confirmations_${eventId}`, []);
        callback(all);
      };
      load();
      const handler = () => load();
      window.addEventListener('splitify_data_changed', handler);
      return () => window.removeEventListener('splitify_data_changed', handler);
    }

    const q = query(
      collection(db, 'events', eventId, 'paymentConfirmations'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const confirmations: PaymentConfirmation[] = [];
        snapshot.forEach((d) => {
          confirmations.push({ ...d.data(), id: d.id } as PaymentConfirmation);
        });
        callback(confirmations);
      },
      (error) => {
        console.error(`subscribePaymentConfirmations error for ${eventId}:`, error);
        callback([]);
      }
    );
  },

  async createPaymentConfirmation(
    params: {
      eventId: string;
      eventName: string;
      debtorUid: string;
      debtorName: string;
      creditorUid: string;
      creditorName: string;
      amountMinor: number;
      paymentMethod?: string;
      paymentReference?: string;
      paymentNote?: string;
      paidDate: string;
      paidTime: string;
      occurredAt?: number;
    },
    user: UserProfile
  ): Promise<string> {
    const {
      eventId,
      eventName,
      debtorUid,
      debtorName,
      creditorUid,
      creditorName,
      amountMinor,
      paymentMethod,
      paymentReference,
      paymentNote,
      paidDate,
      paidTime,
    } = params;

    if (user.uid !== debtorUid) {
      throw new Error('Only the debtor can mark a payment as paid.');
    }
    if (amountMinor <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const now = Date.now();
    const parsedTime = new Date(`${paidDate}T${paidTime}`).getTime();
    const occurredAt = params.occurredAt || (!isNaN(parsedTime) ? parsedTime : now);

    const newConfirmation: Omit<PaymentConfirmation, 'id'> = {
      eventId,
      debtorUid,
      debtorName,
      creditorUid,
      creditorName,
      amountMinor,
      paymentMethod: paymentMethod || 'UPI',
      paymentReference: paymentReference || '',
      paymentNote: paymentNote || '',
      paidDate,
      paidTime,
      occurredAt,
      status: 'awaiting_confirmation',
      createdAt: now,
    };

    let confirmationId: string;

    if (!isFirebaseConfigured() || !db) {
      confirmationId = 'pc_' + now;
      const list = getLocal<PaymentConfirmation[]>(`payment_confirmations_${eventId}`, []);
      list.unshift({ ...newConfirmation, id: confirmationId });
      setLocal(`payment_confirmations_${eventId}`, list);
    } else {
      const ref = await addDoc(
        collection(db, 'events', eventId, 'paymentConfirmations'),
        sanitizeForFirestore(newConfirmation)
      );
      confirmationId = ref.id;
    }

    // Send notification to creditor
    const formattedAmount = (amountMinor / 100).toFixed(0);
    await dataService.createNotification({
      recipientUid: creditorUid,
      type: 'payment_confirmation_required',
      senderUid: user.uid,
      senderName: debtorName,
      senderPhotoURL: user.photoURL,
      eventId,
      eventName,
      amountMinor,
      paymentConfirmationId: confirmationId,
      title: `${debtorName} marked ₹${formattedAmount} as paid`,
      description: `${debtorName} marked ₹${formattedAmount} as paid in ${eventName}. Please confirm whether you received it.`,
      actionData: {
        eventId,
        paymentConfirmationId: confirmationId,
        amountMinor,
        paymentMethod: paymentMethod || 'UPI',
      },
    });

    // Also send confirmation notification to debtor
    await dataService.createNotification({
      recipientUid: debtorUid,
      type: 'payment_marked_paid',
      senderUid: user.uid,
      senderName: debtorName,
      senderPhotoURL: user.photoURL,
      eventId,
      eventName,
      amountMinor,
      paymentConfirmationId: confirmationId,
      title: 'Payment Awaiting Confirmation',
      description: `You marked ₹${formattedAmount} as paid to ${creditorName} in ${eventName}. Awaiting receiver confirmation.`,
      actionData: {
        eventId,
        paymentConfirmationId: confirmationId,
        amountMinor,
      },
    });

    return confirmationId;
  },

  async confirmPaymentReceipt(
    confirmation: PaymentConfirmation,
    creditorUser: UserProfile,
    eventName: string
  ): Promise<string> {
    if (creditorUser.uid !== confirmation.creditorUid) {
      throw new Error('Only the intended receiver can confirm receipt of this payment.');
    }
    if (confirmation.status !== 'awaiting_confirmation') {
      throw new Error('This payment is no longer awaiting confirmation.');
    }

    const { eventId } = confirmation;
    const now = Date.now();
    const formattedTimestamp = formatAuditTimestamp(now);

    // 1. Ensure system-generated 💸 Settlements item exists
    const settlementsItemId = await dataService.getOrCreateSettlementsItem(eventId);

    const completedSettlement: Omit<SettlementEntry, 'id'> = {
      eventId,
      itemId: settlementsItemId,
      paymentConfirmationId: confirmation.id,
      payerUid: confirmation.debtorUid,
      payerName: confirmation.debtorName,
      receiverUid: confirmation.creditorUid,
      receiverName: confirmation.creditorName,
      amountMinor: confirmation.amountMinor,
      paymentMethod: confirmation.paymentMethod || 'UPI',
      paymentReference: confirmation.paymentReference || '',
      paymentNote: confirmation.paymentNote || '',
      paidDate: confirmation.paidDate,
      paidTime: confirmation.paidTime,
      occurredAt: confirmation.occurredAt || now,
      recordedBy: creditorUser.uid,
      recordedByName: creditorUser.displayName,
      createdAt: now,
      formattedTimestamp,
      confirmedAt: now,
      confirmedByUid: creditorUser.uid,
      status: 'completed',
      note: confirmation.paymentNote || '',
    };

    let settlementId: string;

    if (!isFirebaseConfigured() || !db) {
      settlementId = 'set_' + now;
      // Update confirmation
      const list = getLocal<PaymentConfirmation[]>(`payment_confirmations_${eventId}`, []);
      const pc = list.find((c) => c.id === confirmation.id);
      if (pc) {
        pc.status = 'completed';
        pc.confirmedAt = now;
        pc.confirmedByUid = creditorUser.uid;
        setLocal(`payment_confirmations_${eventId}`, list);
      }
      // Add settlement
      const settlements = getLocal<SettlementEntry[]>(`settlements_${eventId}`, []);
      settlements.unshift({ ...completedSettlement, id: settlementId });
      setLocal(`settlements_${eventId}`, settlements);
    } else {
      const confirmationRef = doc(db, 'events', eventId, 'paymentConfirmations', confirmation.id);
      const settlementCol = collection(db, 'events', eventId, 'settlements');
      const newSettlementRef = doc(settlementCol);
      settlementId = newSettlementRef.id;

      await runTransaction(db, async (txn) => {
        const snap = await txn.get(confirmationRef);
        if (!snap.exists()) {
          throw new Error('Payment confirmation document not found.');
        }
        const data = snap.data() as PaymentConfirmation;
        if (data.status !== 'awaiting_confirmation') {
          throw new Error('Payment confirmation has already been processed.');
        }

        txn.update(confirmationRef, {
          status: 'completed',
          confirmedAt: now,
          confirmedByUid: creditorUser.uid,
        });

        txn.set(newSettlementRef, sanitizeForFirestore({ ...completedSettlement, id: settlementId }));
      });
    }

    // Notify debtor of confirmation
    const formattedAmount = (confirmation.amountMinor / 100).toFixed(0);
    await dataService.createNotification({
      recipientUid: confirmation.debtorUid,
      type: 'payment_confirmed',
      senderUid: creditorUser.uid,
      senderName: creditorUser.displayName,
      senderPhotoURL: creditorUser.photoURL,
      eventId,
      eventName,
      amountMinor: confirmation.amountMinor,
      paymentConfirmationId: confirmation.id,
      settlementId,
      title: 'Payment Confirmed!',
      description: `Your payment of ₹${formattedAmount} was confirmed by ${creditorUser.displayName} in ${eventName}.`,
    });

    return settlementId;
  },

  async rejectPaymentConfirmation(
    confirmation: PaymentConfirmation,
    creditorUser: UserProfile,
    eventName: string,
    rejectionReason?: string
  ): Promise<void> {
    if (creditorUser.uid !== confirmation.creditorUid) {
      throw new Error('Only the intended receiver can report payment as not received.');
    }
    if (confirmation.status !== 'awaiting_confirmation') {
      throw new Error('This payment is no longer awaiting confirmation.');
    }

    const { eventId } = confirmation;
    const now = Date.now();

    if (!isFirebaseConfigured() || !db) {
      const list = getLocal<PaymentConfirmation[]>(`payment_confirmations_${eventId}`, []);
      const pc = list.find((c) => c.id === confirmation.id);
      if (pc) {
        pc.status = 'rejected';
        pc.rejectedAt = now;
        pc.rejectedByUid = creditorUser.uid;
        pc.rejectionReason = rejectionReason || 'Payment not received';
        setLocal(`payment_confirmations_${eventId}`, list);
      }
    } else {
      const confirmationRef = doc(db, 'events', eventId, 'paymentConfirmations', confirmation.id);
      await updateDoc(confirmationRef, {
        status: 'rejected',
        rejectedAt: now,
        rejectedByUid: creditorUser.uid,
        rejectionReason: rejectionReason || 'Payment not received',
      });
    }

    // Notify debtor of rejection
    const formattedAmount = (confirmation.amountMinor / 100).toFixed(0);
    await dataService.createNotification({
      recipientUid: confirmation.debtorUid,
      type: 'payment_rejected',
      senderUid: creditorUser.uid,
      senderName: creditorUser.displayName,
      senderPhotoURL: creditorUser.photoURL,
      eventId,
      eventName,
      amountMinor: confirmation.amountMinor,
      paymentConfirmationId: confirmation.id,
      title: 'Payment Marked Not Received',
      description: `Your payment confirmation for ₹${formattedAmount} in ${eventName} was marked as not received by ${creditorUser.displayName}. Please check with them.`,
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
        const map = new Map<string, Friendship>();
        for (const f of userFriends) {
          const pairKey = [f.user1Uid, f.user2Uid].sort().join('_');
          if (!map.has(pairKey)) map.set(pairKey, f);
        }
        callback(Array.from(map.values()));
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
      for (const f of list1) {
        const pairKey = [f.user1Uid, f.user2Uid].sort().join('_');
        if (!map.has(pairKey)) map.set(pairKey, f);
      }
      for (const f of list2) {
        const pairKey = [f.user1Uid, f.user2Uid].sort().join('_');
        if (!map.has(pairKey)) map.set(pairKey, f);
      }
      callback(Array.from(map.values()));
    };

    const q1 = query(collection(db, 'friendships'), where('user1Uid', '==', userId));
    const q2 = query(collection(db, 'friendships'), where('user2Uid', '==', userId));

    const unsub1 = onSnapshot(
      q1,
      (snapshot) => {
        list1 = [];
        snapshot.forEach((d) => {
          list1.push({ ...d.data(), id: d.id } as Friendship);
        });
        emit();
      },
      (error) => {
        console.error('subscribeFriends q1 error:', error);
      }
    );

    const unsub2 = onSnapshot(
      q2,
      (snapshot) => {
        list2 = [];
        snapshot.forEach((d) => {
          list2.push({ ...d.data(), id: d.id } as Friendship);
        });
        emit();
      },
      (error) => {
        console.error('subscribeFriends q2 error:', error);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  },

  async sendFriendRequest(fromUser: UserProfile, toUser: UserProfile): Promise<void> {
    if (fromUser.uid === toUser.uid) {
      throw new Error('You cannot send a friend request to yourself');
    }

    if (!isFirebaseConfigured() || !db) {
      const friendships = getLocal<Friendship[]>('friendships', []);
      const alreadyFriends = friendships.some(
        (f) =>
          (f.user1Uid === fromUser.uid && f.user2Uid === toUser.uid) ||
          (f.user1Uid === toUser.uid && f.user2Uid === fromUser.uid)
      );
      if (alreadyFriends) {
        throw new Error('You are already friends with this user');
      }

      const all = getLocal<FriendRequest[]>('friend_requests', []);
      const existingOutgoing = all.find(
        (r) => r.fromUid === fromUser.uid && r.toUid === toUser.uid && r.status === 'pending'
      );
      if (existingOutgoing) {
        throw new Error('A friend request has already been sent to this user.');
      }

      const existingIncoming = all.find(
        (r) => r.fromUid === toUser.uid && r.toUid === fromUser.uid && r.status === 'pending'
      );
      if (existingIncoming) {
        throw new Error('This user has already sent you a friend request. You can accept it from your Received Requests.');
      }

      const reqId = 'req_' + Date.now();
      const newRequest: FriendRequest = {
        id: reqId,
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
      all.unshift(sanitizeForFirestore(newRequest));
      setLocal('friend_requests', all);

      try {
        await dataService.createNotification({
          recipientUid: toUser.uid,
          type: 'friend_request_received',
          senderUid: fromUser.uid,
          senderName: fromUser.displayName,
          senderPhotoURL: fromUser.photoURL,
          title: 'Friend Request',
          description: `${fromUser.displayName} (@${fromUser.username}) sent you a friend request`,
          actionData: { requestId: reqId, fromUid: fromUser.uid },
        });
      } catch (notifErr) {
        console.warn('Friend request was saved, but notification could not be created:', notifErr);
      }
      return;
    }

    // 1. Check if already friends via deterministic doc ID
    const fsDocId = getFriendshipDocId(fromUser.uid, toUser.uid);
    const fsDocRef = doc(db, 'friendships', fsDocId);
    const fsSnap = await getDoc(fsDocRef);
    if (fsSnap.exists()) {
      throw new Error('You are already friends with this user');
    }

    // Check legacy friendships where user1Uid or user2Uid matches
    const [legacySnap1, legacySnap2] = await Promise.all([
      getDocs(query(collection(db, 'friendships'), where('user1Uid', '==', fromUser.uid))),
      getDocs(query(collection(db, 'friendships'), where('user2Uid', '==', fromUser.uid))),
    ]);
    const isLegacyFriend =
      legacySnap1.docs.some((d) => d.data().user2Uid === toUser.uid) ||
      legacySnap2.docs.some((d) => d.data().user1Uid === toUser.uid);
    if (isLegacyFriend) {
      throw new Error('You are already friends with this user');
    }

    // 2. Check for pending outgoing request
    const qOutgoing = query(
      collection(db, 'friendRequests'),
      where('fromUid', '==', fromUser.uid),
      where('status', '==', 'pending')
    );
    const outgoingSnap = await getDocs(qOutgoing);
    if (outgoingSnap.docs.some((d) => d.data().toUid === toUser.uid)) {
      throw new Error('A friend request has already been sent to this user.');
    }

    // 3. Check for pending incoming reverse request
    const qIncoming = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', fromUser.uid),
      where('status', '==', 'pending')
    );
    const incomingSnap = await getDocs(qIncoming);
    if (incomingSnap.docs.some((d) => d.data().fromUid === toUser.uid)) {
      throw new Error('This user has already sent you a friend request. You can accept it from your Received Requests.');
    }

    // 4. Construct request payload and sanitize undefined values
    const newRequest: any = {
      fromUid: fromUser.uid,
      toUid: toUser.uid,
      fromDisplayName: fromUser.displayName,
      fromUsername: fromUser.username,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (fromUser.photoURL) newRequest.fromPhotoURL = fromUser.photoURL;
    if (toUser.displayName) newRequest.toDisplayName = toUser.displayName;
    if (toUser.username) newRequest.toUsername = toUser.username;
    if (toUser.photoURL) newRequest.toPhotoURL = toUser.photoURL;

    const sanitized = sanitizeForFirestore(newRequest);
    const docRef = await addDoc(collection(db, 'friendRequests'), sanitized);
    const reqId = docRef.id;

    // 5. Send notification (safely wrapped so notification failure does not fail the friend request)
    try {
      await dataService.createNotification({
        recipientUid: toUser.uid,
        type: 'friend_request_received',
        senderUid: fromUser.uid,
        senderName: fromUser.displayName,
        senderPhotoURL: fromUser.photoURL,
        title: 'Friend Request',
        description: `${fromUser.displayName} (@${fromUser.username}) sent you a friend request`,
        actionData: { requestId: reqId, fromUid: fromUser.uid },
      });
    } catch (notifErr) {
      console.warn('Friend request was saved, but notification could not be created:', notifErr);
    }
  },

  async respondToFriendRequest(requestId: string, accept: boolean, currentUser: UserProfile): Promise<void> {
    const firestore = db;
    if (!isFirebaseConfigured() || !firestore) {
      const all = getLocal<FriendRequest[]>('friend_requests', []);
      const req = all.find((r) => r.id === requestId);
      if (req && req.status === 'pending') {
        req.status = accept ? 'accepted' : 'declined';
        req.updatedAt = Date.now();
        setLocal('friend_requests', all);

        if (accept) {
          const friendships = getLocal<Friendship[]>('friendships', []);
          const [u1, u2] = [req.fromUid, req.toUid].sort();
          const fsDocId = `${u1}_${u2}`;
          const already = friendships.some(
            (f) =>
              (f.user1Uid === u1 && f.user2Uid === u2) ||
              (f.user1Uid === u2 && f.user2Uid === u1)
          );
          if (!already) {
            friendships.push({
              id: fsDocId,
              user1Uid: u1,
              user2Uid: u2,
              createdAt: Date.now(),
              requestId: req.id,
            });
            setLocal('friendships', friendships);
          }

          try {
            await dataService.createNotification({
              recipientUid: req.fromUid,
              type: 'friend_request_accepted',
              senderUid: currentUser.uid,
              senderName: currentUser.displayName,
              senderPhotoURL: currentUser.photoURL,
              title: 'Friend Request Accepted',
              description: `${currentUser.displayName} accepted your friend request`,
            });
          } catch (notifErr) {
            console.warn('Friendship created locally, but notification could not be created:', notifErr);
          }
        }
      }
      return;
    }

    let senderUid = '';
    // Run Firestore transaction to atomically update request and create friendship
    await runTransaction(firestore, async (transaction) => {
      const reqRef = doc(firestore, 'friendRequests', requestId);
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) {
        throw new Error('Friend request not found');
      }
      const req = reqSnap.data() as FriendRequest;
      if (req.status !== 'pending') {
        throw new Error('Friend request is no longer pending');
      }
      if (req.toUid !== currentUser.uid) {
        throw new Error('You are not authorized to respond to this friend request');
      }
      if (req.fromUid === req.toUid) {
        throw new Error('Invalid friend request: sender and recipient cannot be the same');
      }

      senderUid = req.fromUid;
      const now = Date.now();

      if (accept) {
        const [u1, u2] = [req.fromUid, req.toUid].sort();
        const fsDocId = `${u1}_${u2}`;
        const fsRef = doc(firestore, 'friendships', fsDocId);
        const fsSnap = await transaction.get(fsRef);

        transaction.update(reqRef, {
          status: 'accepted',
          updatedAt: now,
        });

        if (!fsSnap.exists()) {
          const friendshipData: Omit<Friendship, 'id'> = {
            user1Uid: u1,
            user2Uid: u2,
            createdAt: now,
            requestId: requestId,
          };
          transaction.set(fsRef, sanitizeForFirestore(friendshipData));
        }
      } else {
        transaction.update(reqRef, {
          status: 'declined',
          updatedAt: now,
        });
      }
    });

    if (accept && senderUid) {
      try {
        await dataService.createNotification({
          recipientUid: senderUid,
          type: 'friend_request_accepted',
          senderUid: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhotoURL: currentUser.photoURL,
          title: 'Friend Request Accepted',
          description: `${currentUser.displayName} accepted your friend request`,
        });
      } catch (notifErr) {
        console.warn('Friendship created, but acceptance notification could not be created:', notifErr);
      }
    }
  },

  async repairAcceptedFriendRequests(currentUser: UserProfile): Promise<number> {
    const firestore = db;
    if (!isFirebaseConfigured() || !firestore) {
      const allReqs = getLocal<FriendRequest[]>('friend_requests', []);
      const acceptedReqs = allReqs.filter(
        (r) => (r.fromUid === currentUser.uid || r.toUid === currentUser.uid) && r.status === 'accepted'
      );
      const friendships = getLocal<Friendship[]>('friendships', []);
      let repairedCount = 0;
      for (const req of acceptedReqs) {
        if (req.fromUid === req.toUid) continue;
        const [u1, u2] = [req.fromUid, req.toUid].sort();
        const exists = friendships.some(
          (f) => (f.user1Uid === u1 && f.user2Uid === u2) || (f.user1Uid === u2 && f.user2Uid === u1)
        );
        if (!exists) {
          friendships.push({
            id: `${u1}_${u2}`,
            user1Uid: u1,
            user2Uid: u2,
            createdAt: req.updatedAt || Date.now(),
            requestId: req.id,
          });
          repairedCount++;
        }
      }
      if (repairedCount > 0) setLocal('friendships', friendships);
      return repairedCount;
    }

    const q1 = query(
      collection(firestore, 'friendRequests'),
      where('toUid', '==', currentUser.uid),
      where('status', '==', 'accepted')
    );
    const q2 = query(
      collection(firestore, 'friendRequests'),
      where('fromUid', '==', currentUser.uid),
      where('status', '==', 'accepted')
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const acceptedRequests: FriendRequest[] = [];
    snap1.forEach((d) => acceptedRequests.push({ ...d.data(), id: d.id } as FriendRequest));
    snap2.forEach((d) => acceptedRequests.push({ ...d.data(), id: d.id } as FriendRequest));

    let repaired = 0;
    for (const req of acceptedRequests) {
      if (req.fromUid === req.toUid) continue;
      const [u1, u2] = [req.fromUid, req.toUid].sort();
      const fsDocId = `${u1}_${u2}`;
      const fsRef = doc(firestore, 'friendships', fsDocId);
      const fsSnap = await getDoc(fsRef);

      if (!fsSnap.exists()) {
        const qLegacy1 = query(
          collection(firestore, 'friendships'),
          where('user1Uid', '==', currentUser.uid)
        );
        const qLegacy2 = query(
          collection(firestore, 'friendships'),
          where('user2Uid', '==', currentUser.uid)
        );
        const [legSnap1, legSnap2] = await Promise.all([getDocs(qLegacy1), getDocs(qLegacy2)]);
        const otherUid = req.fromUid === currentUser.uid ? req.toUid : req.fromUid;
        const legacyExists =
          legSnap1.docs.some((d) => d.data().user2Uid === otherUid) ||
          legSnap2.docs.some((d) => d.data().user1Uid === otherUid);

        if (!legacyExists) {
          const friendshipData = {
            user1Uid: u1,
            user2Uid: u2,
            createdAt: req.updatedAt || Date.now(),
            requestId: req.id,
          };
          await setDoc(fsRef, sanitizeForFirestore(friendshipData));
          repaired++;
        }
      }
    }
    return repaired;
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
    const actorHandle = getActorHandle(user);
    const membersCount = Object.keys(event.members || {}).length;
    const availableSlots = Object.values(event.slots || {})
      .filter((s) => !s.isClaimed)
      .map((s) => ({ id: s.id, placeholderName: s.placeholderName }));

    const newLink: Omit<EventInvitationLink, 'id'> = {
      token,
      eventId,
      eventName: event.name,
      eventEmoji: event.emoji,
      createdByUid: user.uid,
      createdByName: actorHandle,
      createdAt: Date.now(),
      scope: options?.scope || 'full',
      allowedItemIds: options?.allowedItemIds || [],
      availableSlots,
      revoked: false,
      usesCount: 0,
      membersCount,
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
    slotId?: string,
    newSlotName?: string
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

    const slots = { ...(event.slots || {}) };
    let assignedSlotId = slotId;

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
    } else if (newSlotName !== undefined) {
      // User creates a new slot to join
      const createdSlotId = 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const placeholder = newSlotName.trim() || userFirstName;
      slots[createdSlotId] = {
        id: createdSlotId,
        eventId: event.id,
        placeholderName: placeholder,
        isClaimed: true,
        claimedByUid: user.uid,
        claimedByName: userFirstName,
        claimedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      assignedSlotId = createdSlotId;
    }

    const memberEntry: EventMember = {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      username: user.username,
      joinedAt: existingMember ? existingMember.joinedAt : Date.now(),
      role: existingMember ? existingMember.role : 'member',
      scope: link.scope,
      allowedItemIds: link.allowedItemIds || [],
      slotId: assignedSlotId || existingMember?.slotId,
    };

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
        links[lIdx].membersCount = Object.keys(event.members).length;
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
      let liveAssignedSlotId = slotId;

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
      } else if (newSlotName !== undefined) {
        const createdSlotId = 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const placeholder = newSlotName.trim() || userFirstName;
        liveSlots[createdSlotId] = {
          id: createdSlotId,
          eventId: liveEvent.id,
          placeholderName: placeholder,
          isClaimed: true,
          claimedByUid: user.uid,
          claimedByName: userFirstName,
          claimedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        liveAssignedSlotId = createdSlotId;
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
        slotId: liveAssignedSlotId || currentMember?.slotId,
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
        const updatedMembersCount = Object.keys(liveEvent.members || {}).length + 1;
        transaction.update(linkRef, {
          usesCount: (liveLink.usesCount || 0) + 1,
          membersCount: updatedMembersCount,
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
            updatedAt: Date.now(),
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

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  subscribeNotifications(userId: string, callback: (notifications: AppNotification[]) => void): () => void {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    if (!isFirebaseConfigured() || !db) {
      const load = () => {
        const all = getLocal<AppNotification[]>(`notifications_${userId}`, []);
        const active = all.filter((n) => Date.now() - n.createdAt < THIRTY_DAYS_MS);
        if (active.length !== all.length) {
          setLocal(`notifications_${userId}`, active);
        }
        callback(active.sort((a, b) => b.createdAt - a.createdAt));
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
      const expiredIds: string[] = [];
      const currentNow = Date.now();
      snapshot.forEach((d) => {
        const item = { ...d.data(), id: d.id } as AppNotification;
        if (currentNow - item.createdAt < THIRTY_DAYS_MS) {
          notifs.push(item);
        } else {
          expiredIds.push(d.id);
        }
      });
      callback(notifs);

      if (expiredIds.length > 0 && db) {
        const batch = writeBatch(db);
        expiredIds.forEach((id) => {
          batch.delete(doc(db!, 'users', userId, 'notifications', id));
        });
        batch.commit().catch(() => {});
      }
    });
  },

  async purgeOldNotifications(userId: string): Promise<void> {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!isFirebaseConfigured() || !db) {
      const all = getLocal<AppNotification[]>(`notifications_${userId}`, []);
      const active = all.filter((n) => now - n.createdAt < THIRTY_DAYS_MS);
      setLocal(`notifications_${userId}`, active);
      return;
    }

    const q = query(
      collection(db, 'users', userId, 'notifications'),
      where('createdAt', '<', now - THIRTY_DAYS_MS)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
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

    const sanitized = sanitizeForFirestore(newNotif);
    await addDoc(collection(db, 'users', params.recipientUid, 'notifications'), sanitized);
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
    const senderHandle = getActorHandle(sender);

    await dataService.createNotification({
      recipientUid: debtorUid,
      type: 'payment_reminder',
      senderUid: sender.uid,
      senderName: senderHandle,
      senderPhotoURL: sender.photoURL,
      eventName,
      amountMinor,
      title: 'Payment Reminder',
      description: `${senderHandle} sent a friendly reminder for ${formattedAmount} unsettled in "${eventName}"`,
    });
  },
};
