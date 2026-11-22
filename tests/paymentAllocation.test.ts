import { describe, it, expect } from 'vitest';
import { getAllocatableShares, fitSelection, buildAllocations } from '../src/domain/calculations/paymentAllocation';
import { buildIndividualLedger, sumLedger, groupLedgerBy } from '../src/domain/calculations/individualLedger';
import { calculateEventFinancialOverview } from '../src/domain/calculations/finance';
import { EventItem, ExpenseEntry, SettlementEntry, PaymentConfirmation, EventMember } from '../src/types';

const item = (id: string, name: string, paidBy: string, shares: Record<string, number>, occurredAt: number): EventItem => ({
  id, eventId: 'e', name, emoji: '📌', createdAt: occurredAt, updatedAt: occurredAt,
  costMinor: Object.values(shares).reduce((a, b) => a + b, 0), paidBy, shares, participants: Object.keys(shares), occurredAt,
});
const items: EventItem[] = [
  item('water1', 'Water', 'k', { k: 5000, p: 5000 }, 1000),
  item('water2', 'Water', 'k', { k: 3000, p: 3000 }, 2000),
  item('cab', 'Cab', 'r', { p: 20000, r: 20000 }, 3000),
  item('mine', 'Snacks', 'p', { k: 1000, p: 1000 }, 4000),
  { id: 'cat', eventId: 'e', name: 'Instamart', emoji: '🛒', isCategory: true, createdAt: 1, updatedAt: 1 },
];
const expenses: ExpenseEntry[] = [
  { id: 'curd', eventId: 'e', itemId: 'cat', name: 'Curd', emoji: '🥛', costMinor: 4000, paidBy: 'k', splitBy: 'equal', participants: ['k', 'p'], shares: { k: 2000, p: 2000 }, createdBy: 'k', createdByName: 'K', createdAt: 500, occurredAt: 500 },
];

describe('Payment allocation', () => {
  it('lists the payer\'s unsettled shares, receiver-paid first, skipping items the payer paid', () => {
    const list = getAllocatableShares('p', items, expenses, {}, [], [], 'k');
    expect(list.map((x) => x.entryId)).toEqual(['water2', 'water1', 'curd', 'cab']);
    expect(list.find((x) => x.entryId === 'curd')?.categoryName).toBe('Instamart');
  });

  it('subtracts amounts already linked by completed and pending payments', () => {
    const settled: SettlementEntry[] = [{ id: 's', eventId: 'e', payerUid: 'p', payerName: 'P', receiverUid: 'k', receiverName: 'K', amountMinor: 5000, createdAt: 1, status: 'completed', allocations: [{ entryId: 'water1', itemName: 'Water', amountMinor: 5000 }] }];
    const pending: PaymentConfirmation[] = [{ id: 'pc', eventId: 'e', debtorUid: 'p', debtorName: 'P', creditorUid: 'k', creditorName: 'K', amountMinor: 1000, paidDate: '', paidTime: '', occurredAt: 1, status: 'awaiting_confirmation', createdAt: 1, allocations: [{ entryId: 'curd', itemName: 'Curd', amountMinor: 1000 }] }];
    const list = getAllocatableShares('p', items, expenses, {}, settled, pending, 'k');
    expect(list.find((x) => x.entryId === 'water1')).toBeUndefined();
    expect(list.find((x) => x.entryId === 'curd')?.remainingMinor).toBe(1000);
  });

  it('select-all never exceeds the paid amount', () => {
    const list = getAllocatableShares('p', items, expenses, {}, [], [], 'k');
    const chosen = fitSelection(list, 9000);
    const total = list.filter((c) => chosen.has(c.entryId)).reduce((a, c) => a + c.remainingMinor, 0);
    expect(total).toBeLessThanOrEqual(9000);
    expect([...chosen]).toEqual(['water2', 'water1']); // 3000 + 5000; Curd (2000) no longer fits
    expect(buildAllocations(list, chosen).map((a) => a.amountMinor)).toEqual([3000, 5000]);
  });
});

describe('Individual ledger with linked payments', () => {
  const members: Record<string, EventMember> = {
    k: { uid: 'k', displayName: 'K', joinedAt: 0, role: 'host' },
    p: { uid: 'p', displayName: 'P', joinedAt: 0, role: 'member' },
    r: { uid: 'r', displayName: 'R', joinedAt: 0, role: 'member' },
  };
  const settlement: SettlementEntry = {
    id: 's1', eventId: 'e', payerUid: 'p', payerName: 'P', receiverUid: 'k', receiverName: 'K', amountMinor: 10000,
    createdAt: 9000, occurredAt: 9000, status: 'completed',
    allocations: [{ entryId: 'water1', itemName: 'Water', amountMinor: 5000 }, { entryId: 'water2', itemName: 'Water', amountMinor: 3000 }],
  };
  const lines = buildIndividualLedger(items, expenses, [settlement], {});

  it('shows linked amounts as Paid on those items and keeps only the rest as a settlement line', () => {
    const p = lines.filter((l) => l.personUid === 'p');
    expect(p.find((l) => l.entryId === 'water1')).toMatchObject({ creditMinor: 5000, debitMinor: 5000 });
    expect(p.find((l) => l.entryId === 'water1')?.settledPayments?.[0]).toMatchObject({ amountMinor: 5000, toUid: 'k' });
    expect(p.find((l) => l.entryId === 's1')).toMatchObject({ creditMinor: 2000, entryName: 'Settlement paid' });
  });

  it('keeps every person\'s totals equal to their net balance', () => {
    const overview = calculateEventFinancialOverview(members, expenses, [settlement], 'k', items, {});
    const byPerson = groupLedgerBy(lines, 'personUid');
    for (const [uid, summary] of Object.entries(overview.memberSummaries)) {
      expect(sumLedger(byPerson.get(uid) || []).netMinor).toBe(summary.netBalanceMinor);
    }
  });
});
