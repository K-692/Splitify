import { EventItem, ExpenseEntry, EventSlot, SettlementEntry, PaymentConfirmation, PaymentAllocation } from '@/types';

export interface AllocatableShare {
  entryId: string;
  name: string;
  emoji: string;
  categoryName?: string;
  paidByUid?: string;
  occurredAt: number;
  shareMinor: number;
  /** Already covered by earlier (completed or pending) linked payments */
  alreadyLinkedMinor: number;
  remainingMinor: number;
}

const resolver = (slots?: Record<string, EventSlot>) => (raw?: string) => {
  if (!raw) return '';
  const slot = slots?.[raw];
  return slot?.isClaimed && slot.claimedByUid ? slot.claimedByUid : raw;
};

/**
 * Expense entries in which `payerUid` has a share that is not yet covered by
 * earlier linked payments. Entries paid by `receiverUid` come first, then the
 * most recent.
 */
export function getAllocatableShares(
  payerUid: string,
  items: EventItem[],
  expenses: ExpenseEntry[],
  slots: Record<string, EventSlot> | undefined,
  settlements: SettlementEntry[] = [],
  pendingConfirmations: PaymentConfirmation[] = [],
  receiverUid?: string
): AllocatableShare[] {
  const resolve = resolver(slots);
  const linked = new Map<string, number>();
  const addLinks = (fromUid: string, allocations?: PaymentAllocation[]) => {
    if (resolve(fromUid) !== payerUid || !allocations) return;
    for (const a of allocations) linked.set(a.entryId, (linked.get(a.entryId) || 0) + (a.amountMinor || 0));
  };
  for (const s of settlements) if (s.status === 'completed') addLinks(s.payerUid, s.allocations);
  for (const pc of pendingConfirmations) if (pc.status === 'awaiting_confirmation') addLinks(pc.debtorUid, pc.allocations);

  const shareOf = (shares?: Record<string, number>) => {
    let total = 0;
    for (const [uid, v] of Object.entries(shares || {})) if (resolve(uid) === payerUid) total += v || 0;
    return total;
  };

  const out: AllocatableShare[] = [];
  const push = (entryId: string, name: string, emoji: string, occurredAt: number, shares?: Record<string, number>, paidBy?: string, categoryName?: string) => {
    const shareMinor = shareOf(shares);
    if (shareMinor <= 0) return;
    const alreadyLinkedMinor = Math.min(linked.get(entryId) || 0, shareMinor);
    const remainingMinor = shareMinor - alreadyLinkedMinor;
    if (remainingMinor <= 0) return;
    out.push({ entryId, name, emoji, categoryName, paidByUid: resolve(paidBy) || undefined, occurredAt, shareMinor, alreadyLinkedMinor, remainingMinor });
  };

  const active = items.filter((i) => !i.deleted && !i.isSettlementsItem);
  const categories = new Map(active.filter((i) => i.isCategory).map((i) => [i.id, i]));
  for (const it of active) {
    if (it.isCategory || !it.costMinor) continue;
    if (resolve(it.paidBy) === payerUid) continue; // paying yourself back is not a debt
    push(it.id, it.name, it.emoji || '📌', it.occurredAt || it.createdAt || 0, it.shares, it.paidBy);
  }
  for (const ex of expenses) {
    if (ex.deleted) continue;
    const cat = categories.get(ex.itemId);
    if (!cat || resolve(ex.paidBy) === payerUid) continue;
    push(ex.id, ex.name, ex.emoji || cat.emoji || '📌', ex.occurredAt || ex.createdAt || 0, ex.shares, ex.paidBy, cat.name);
  }

  out.sort(
    (a, b) =>
      Number(b.paidByUid === receiverUid) - Number(a.paidByUid === receiverUid) ||
      b.occurredAt - a.occurredAt ||
      a.name.localeCompare(b.name)
  );
  return out;
}

/**
 * Select entries in order while they still fit within `amountMinor`.
 * Used for "Select all" and to trim a selection when the amount drops.
 */
export function fitSelection(candidates: AllocatableShare[], amountMinor: number, preferred?: Set<string>): Set<string> {
  const chosen = new Set<string>();
  let left = amountMinor;
  for (const c of candidates) {
    if (preferred && !preferred.has(c.entryId)) continue;
    if (c.remainingMinor <= left) {
      chosen.add(c.entryId);
      left -= c.remainingMinor;
    }
  }
  return chosen;
}

export function buildAllocations(candidates: AllocatableShare[], selected: Set<string>): PaymentAllocation[] {
  return candidates
    .filter((c) => selected.has(c.entryId))
    .map((c) => ({ entryId: c.entryId, itemName: c.name, amountMinor: c.remainingMinor, occurredAt: c.occurredAt }));
}

/** "21 Nov 2026, 7:30 pm" — date and time so same-named items are distinguishable. */
export function formatEntryDateTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}
