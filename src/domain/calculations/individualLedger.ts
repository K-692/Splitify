import { EventItem, ExpenseEntry, SettlementEntry, EventSlot } from '@/types';

/**
 * One line in a person's individual ledger.
 *
 * Accounting convention (matches calculateEventFinancialOverview):
 * - creditMinor: money that counts in the person's favour
 *     • the full cost of an expense they paid for
 *     • a settlement payment they made to someone
 * - debitMinor: money that counts against the person
 *     • their share of an expense
 *     • a settlement payment they received
 * Net (credit - debit) summed across all lines equals the member's net balance.
 */
export interface IndividualLedgerLine {
  key: string;
  personUid: string;
  kind: 'expense' | 'settlement';
  /** Top-level item (standalone expense, category, or the settlements bucket) */
  groupId: string;
  groupName: string;
  groupEmoji: string;
  /** Specific entry (standalone item itself, or a subitem under a category) */
  entryId: string;
  entryName: string;
  entryEmoji: string;
  isSubitem: boolean;
  costMinor: number;
  paidByUid?: string;
  counterpartyUid?: string;
  creditMinor: number;
  debitMinor: number;
  occurredAt: number;
  /** Settlement payments the person linked to this item (included in creditMinor) */
  settledPayments?: Array<{ amountMinor: number; toUid: string; paidAt: number }>;
}

export interface LedgerTotals {
  creditMinor: number;
  debitMinor: number;
  netMinor: number;
}

const SETTLEMENTS_GROUP_ID = '__settlements__';

export function buildIndividualLedger(
  items: EventItem[],
  expenses: ExpenseEntry[],
  settlements: SettlementEntry[] = [],
  slots?: Record<string, EventSlot>
): IndividualLedgerLine[] {
  const resolveUid = (raw?: string): string => {
    if (!raw) return '';
    const slot = slots?.[raw];
    if (slot?.isClaimed && slot.claimedByUid) return slot.claimedByUid;
    return raw;
  };

  const lines: IndividualLedgerLine[] = [];
  const activeItems = items.filter((i) => !i.deleted);
  const itemsById = new Map(activeItems.map((i) => [i.id, i]));

  const addExpenseLines = (params: {
    group: EventItem;
    entryId: string;
    entryName: string;
    entryEmoji: string;
    isSubitem: boolean;
    costMinor: number;
    paidBy?: string;
    shares?: Record<string, number>;
    occurredAt: number;
  }) => {
    const perPerson = new Map<string, { credit: number; debit: number }>();
    const bump = (uid: string, credit: number, debit: number) => {
      if (!uid) return;
      const cur = perPerson.get(uid) || { credit: 0, debit: 0 };
      cur.credit += credit;
      cur.debit += debit;
      perPerson.set(uid, cur);
    };

    const payer = resolveUid(params.paidBy);
    bump(payer, params.costMinor, 0);
    for (const [rawUid, share] of Object.entries(params.shares || {})) {
      if (share) bump(resolveUid(rawUid), 0, share);
    }

    for (const [uid, { credit, debit }] of perPerson) {
      if (credit === 0 && debit === 0) continue;
      lines.push({
        key: `${params.entryId}:${uid}`,
        personUid: uid,
        kind: 'expense',
        groupId: params.group.id,
        groupName: params.group.name,
        groupEmoji: params.group.emoji || '📌',
        entryId: params.entryId,
        entryName: params.entryName,
        entryEmoji: params.entryEmoji,
        isSubitem: params.isSubitem,
        costMinor: params.costMinor,
        paidByUid: payer || undefined,
        creditMinor: credit,
        debitMinor: debit,
        occurredAt: params.occurredAt,
      });
    }
  };

  // Standalone expense items
  for (const it of activeItems) {
    if (it.isCategory || it.isSettlementsItem || !it.costMinor || it.costMinor <= 0) continue;
    addExpenseLines({
      group: it,
      entryId: it.id,
      entryName: it.name,
      entryEmoji: it.emoji || '📌',
      isSubitem: false,
      costMinor: it.costMinor,
      paidBy: it.paidBy,
      shares: it.shares,
      occurredAt: it.occurredAt || it.createdAt || 0,
    });
  }

  // Subitems under active categories
  for (const exp of expenses) {
    if (exp.deleted) continue;
    const parent = itemsById.get(exp.itemId);
    if (!parent || !parent.isCategory) continue;
    if (!exp.costMinor || exp.costMinor <= 0) continue;
    addExpenseLines({
      group: parent,
      entryId: exp.id,
      entryName: exp.name,
      entryEmoji: exp.emoji || parent.emoji || '📌',
      isSubitem: true,
      costMinor: exp.costMinor,
      paidBy: exp.paidBy,
      shares: exp.shares,
      occurredAt: exp.occurredAt || exp.createdAt || 0,
    });
  }

  // Completed settlements
  for (const s of settlements) {
    if (s.status !== 'completed' || !(s.amountMinor > 0)) continue;
    const payer = resolveUid(s.payerUid);
    const receiver = resolveUid(s.receiverUid);
    const occurredAt = s.occurredAt || s.createdAt || 0;

    // Amounts the payer linked to specific items are shown as Paid on those items
    let linkedMinor = 0;
    for (const a of s.allocations || []) {
      const line = payer ? lines.find((l) => l.kind === 'expense' && l.entryId === a.entryId && l.personUid === payer) : undefined;
      const amt = Math.min(a.amountMinor || 0, s.amountMinor - linkedMinor);
      if (!line || amt <= 0) continue;
      line.creditMinor += amt;
      (line.settledPayments ||= []).push({ amountMinor: amt, toUid: receiver, paidAt: occurredAt });
      linkedMinor += amt;
    }
    const unlinkedMinor = s.amountMinor - linkedMinor;
    const base = {
      kind: 'settlement' as const,
      groupId: SETTLEMENTS_GROUP_ID,
      groupName: 'Settlements',
      groupEmoji: '💸',
      entryId: s.id,
      entryEmoji: '💸',
      isSubitem: false,
      costMinor: s.amountMinor,
      paidByUid: payer,
      occurredAt,
    };
    if (payer && unlinkedMinor > 0) {
      lines.push({
        ...base,
        key: `${s.id}:${payer}:paid`,
        personUid: payer,
        entryName: 'Settlement paid',
        counterpartyUid: receiver,
        creditMinor: unlinkedMinor,
        debitMinor: 0,
      });
    }
    if (receiver) {
      lines.push({
        ...base,
        key: `${s.id}:${receiver}:received`,
        personUid: receiver,
        entryName: 'Settlement received',
        counterpartyUid: payer,
        creditMinor: 0,
        debitMinor: s.amountMinor,
      });
    }
  }

  lines.sort((a, b) => b.occurredAt - a.occurredAt || a.key.localeCompare(b.key));
  return lines;
}

export function sumLedger(lines: IndividualLedgerLine[]): LedgerTotals {
  let creditMinor = 0;
  let debitMinor = 0;
  for (const l of lines) {
    creditMinor += l.creditMinor;
    debitMinor += l.debitMinor;
  }
  return { creditMinor, debitMinor, netMinor: creditMinor - debitMinor };
}

export function groupLedgerBy<K extends 'personUid' | 'groupId'>(
  lines: IndividualLedgerLine[],
  key: K
): Map<string, IndividualLedgerLine[]> {
  const map = new Map<string, IndividualLedgerLine[]>();
  for (const l of lines) {
    const k = l[key];
    const arr = map.get(k);
    if (arr) arr.push(l);
    else map.set(k, [l]);
  }
  return map;
}
