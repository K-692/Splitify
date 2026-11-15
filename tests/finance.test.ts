import { describe, it, expect } from 'vitest';
import {
  calculateEqualShares,
  validateAmountShares,
  calculateEventFinancialOverview,
} from '../src/domain/calculations/finance';
import { EventMember, ExpenseEntry, SettlementEntry } from '../src/types';

describe('Financial Calculations Engine', () => {
  it('should split equally and distribute remainder deterministically', () => {
    // ₹100 split among 3 people (A, B, C)
    // 10000 paise / 3 = 3333 paise each, with 1 paise remainder
    // Sorted UIDs: userA, userB, userC -> userA gets 3334, userB 3333, userC 3333
    const uids = ['userC', 'userA', 'userB'];
    const costMinor = 10000;

    const shares = calculateEqualShares(costMinor, uids);
    expect(shares['userA']).toBe(3334);
    expect(shares['userB']).toBe(3333);
    expect(shares['userC']).toBe(3333);

    // Verify sum of shares equals original cost
    const total = Object.values(shares).reduce((a, b) => a + b, 0);
    expect(total).toBe(costMinor);
  });

  it('should validate custom amount shares correctly', () => {
    const uids = ['userA', 'userB', 'userC'];
    const costMinor = 300000; // ₹3,000

    const validShares = {
      userA: 150000, // ₹1,500
      userB: 100000, // ₹1,000
      userC: 50000,  // ₹500
    };

    const validResult = validateAmountShares(costMinor, validShares, uids);
    expect(validResult.isValid).toBe(true);
    expect(validResult.differenceMinor).toBe(0);

    const invalidShares = {
      userA: 100000,
      userB: 100000,
      userC: 50000,
    };
    const invalidResult = validateAmountShares(costMinor, invalidShares, uids);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.differenceMinor).toBe(50000); // 500.00 shortfall
  });

  it('should accurately calculate the mandatory 3-person scenario from requirements', () => {
    /**
     * Requirement scenario:
     * A pays ₹3,000 for accommodation shared equally by A, B, and C.
     * B pays ₹1,500 for food shared equally by A, B, and C.
     * 
     * Expected:
     * - Total expense = ₹4,500 (450000 minor)
     * - A: spent ₹3,000, share ₹1,500 (1000 + 500) -> Net: +₹1,500
     * - B: spent ₹1,500, share ₹1,500 (1000 + 500) -> Net: 0
     * - C: spent ₹0, share ₹1,500 (1000 + 500) -> Net: -₹1,500
     * - Settlement: C pays A ₹1,500
     */
    const members: Record<string, EventMember> = {
      uidA: { uid: 'uidA', displayName: 'A', joinedAt: 1, role: 'host' },
      uidB: { uid: 'uidB', displayName: 'B', joinedAt: 2, role: 'member' },
      uidC: { uid: 'uidC', displayName: 'C', joinedAt: 3, role: 'member' },
    };

    const expense1: ExpenseEntry = {
      id: 'exp1',
      eventId: 'event1',
      itemId: 'item1',
      name: 'Accommodation',
      emoji: '🏨',
      costMinor: 300000, // ₹3,000
      paidBy: 'uidA',
      splitBy: 'equal',
      participants: ['uidA', 'uidB', 'uidC'],
      shares: calculateEqualShares(300000, ['uidA', 'uidB', 'uidC']),
      createdBy: 'uidA',
      createdByName: 'A',
      createdAt: 100,
      lastModifiedBy: 'uidA',
      lastModifiedByName: 'A',
      lastModifiedAt: 100,
      auditLogs: [],
    };

    const expense2: ExpenseEntry = {
      id: 'exp2',
      eventId: 'event1',
      itemId: 'item2',
      name: 'Food',
      emoji: '🍽️',
      costMinor: 150000, // ₹1,500
      paidBy: 'uidB',
      splitBy: 'equal',
      participants: ['uidA', 'uidB', 'uidC'],
      shares: calculateEqualShares(150000, ['uidA', 'uidB', 'uidC']),
      createdBy: 'uidB',
      createdByName: 'B',
      createdAt: 200,
      lastModifiedBy: 'uidB',
      lastModifiedByName: 'B',
      lastModifiedAt: 200,
      auditLogs: [],
    };

    const overview = calculateEventFinancialOverview(members, [expense1, expense2], [], 'uidA');

    // Total expense check
    expect(overview.totalExpenseMinor).toBe(450000); // ₹4,500

    // Member A
    const summaryA = overview.memberSummaries['uidA'];
    expect(summaryA.spentMinor).toBe(300000); // ₹3,000
    expect(summaryA.shareMinor).toBe(150000); // ₹1,500
    expect(summaryA.netBalanceMinor).toBe(150000); // +₹1,500 (owed)

    // Member B
    const summaryB = overview.memberSummaries['uidB'];
    expect(summaryB.spentMinor).toBe(150000); // ₹1,500
    expect(summaryB.shareMinor).toBe(150000); // ₹1,500
    expect(summaryB.netBalanceMinor).toBe(0); // Settled

    // Member C
    const summaryC = overview.memberSummaries['uidC'];
    expect(summaryC.spentMinor).toBe(0); // ₹0
    expect(summaryC.shareMinor).toBe(150000); // ₹1,500
    expect(summaryC.netBalanceMinor).toBe(-150000); // -₹1,500 (owes)

    // Zero-sum invariant
    expect(overview.isBalanced).toBe(true);

    // Settlement suggestion check
    expect(overview.settlementSuggestions).toHaveLength(1);
    expect(overview.settlementSuggestions[0]).toEqual({
      fromUid: 'uidC',
      fromName: 'C',
      toUid: 'uidA',
      toName: 'A',
      amountMinor: 150000, // ₹1,500
    });
  });

  it('should update net balances and suggestions when settlement is recorded without altering total expense', () => {
    const members: Record<string, EventMember> = {
      uidA: { uid: 'uidA', displayName: 'A', joinedAt: 1, role: 'host' },
      uidB: { uid: 'uidB', displayName: 'B', joinedAt: 2, role: 'member' },
    };

    // A paid ₹2,000 for dinner shared with B (₹1,000 each)
    const expense: ExpenseEntry = {
      id: 'exp1',
      eventId: 'event1',
      itemId: 'item1',
      name: 'Dinner',
      emoji: '🍽️',
      costMinor: 200000,
      paidBy: 'uidA',
      splitBy: 'equal',
      participants: ['uidA', 'uidB'],
      shares: { uidA: 100000, uidB: 100000 },
      createdBy: 'uidA',
      createdByName: 'A',
      createdAt: 100,
      lastModifiedBy: 'uidA',
      lastModifiedByName: 'A',
      lastModifiedAt: 100,
      auditLogs: [],
    };

    // Before settlement
    const beforeOverview = calculateEventFinancialOverview(members, [expense], []);
    expect(beforeOverview.totalExpenseMinor).toBe(200000);
    expect(beforeOverview.memberSummaries['uidB'].netBalanceMinor).toBe(-100000);
    expect(beforeOverview.settlementSuggestions).toHaveLength(1);

    // Record partial settlement: B pays A ₹600
    const partialSettlement: SettlementEntry = {
      id: 'set1',
      eventId: 'event1',
      itemId: 'settlementsItem',
      payerUid: 'uidB',
      payerName: 'B',
      receiverUid: 'uidA',
      receiverName: 'A',
      amountMinor: 60000,
      recordedBy: 'uidB',
      recordedByName: 'B',
      createdAt: 200,
      formattedTimestamp: '10:00 PM 15:11:2026',
      status: 'completed',
    };

    const partialOverview = calculateEventFinancialOverview(members, [expense], [partialSettlement]);
    // MUST NOT increase total expense
    expect(partialOverview.totalExpenseMinor).toBe(200000);
    // B now owes only ₹400
    expect(partialOverview.memberSummaries['uidB'].netBalanceMinor).toBe(-40000);
    expect(partialOverview.memberSummaries['uidA'].netBalanceMinor).toBe(40000);
    expect(partialOverview.settlementSuggestions[0].amountMinor).toBe(40000);

    // Complete settlement: B pays remaining ₹400
    const finalSettlement: SettlementEntry = {
      id: 'set2',
      eventId: 'event1',
      itemId: 'settlementsItem',
      payerUid: 'uidB',
      payerName: 'B',
      receiverUid: 'uidA',
      receiverName: 'A',
      amountMinor: 40000,
      recordedBy: 'uidA',
      recordedByName: 'A',
      createdAt: 300,
      formattedTimestamp: '10:15 PM 15:11:2026',
      status: 'completed',
    };

    const finalOverview = calculateEventFinancialOverview(members, [expense], [partialSettlement, finalSettlement]);
    expect(finalOverview.totalExpenseMinor).toBe(200000);
    expect(finalOverview.memberSummaries['uidA'].netBalanceMinor).toBe(0);
    expect(finalOverview.memberSummaries['uidB'].netBalanceMinor).toBe(0);
    expect(finalOverview.settlementSuggestions).toHaveLength(0);
    expect(finalOverview.isBalanced).toBe(true);
  });
});
