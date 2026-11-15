import { describe, it, expect } from 'vitest';
import { distributeRemainingShares } from '@/domain/calculations/finance';

describe('distributeRemainingShares (Exact Amount Splitting)', () => {
  it('distributes remaining amount equally when one participant is assigned manually (prompt example)', () => {
    // Total expense ₹1,000 (100,000 paise), 4 participants: Rahul, Priya, Aman, Krishnendu
    // User enters Rahul: ₹400 (40,000 paise)
    // Expected remaining: ₹600 (60,000 paise) divided among Priya, Aman, Krishnendu = ₹200 each
    const costMinor = 100000;
    const participants = ['rahul', 'priya', 'aman', 'krishnendu'];
    const manualShares = { rahul: 40000 };

    const result = distributeRemainingShares(costMinor, participants, manualShares);

    expect(result.isValid).toBe(true);
    expect(result.isFullyAllocated).toBe(true);
    expect(result.remainingMinor).toBe(0);
    expect(result.assignedTotalMinor).toBe(100000);
    expect(result.shares['rahul']).toBe(40000); // ₹400
    expect(result.shares['priya']).toBe(20000); // ₹200
    expect(result.shares['aman']).toBe(20000); // ₹200
    expect(result.shares['krishnendu']).toBe(20000); // ₹200
    expect(result.manualUids).toEqual(['rahul']);
    expect(result.autoUids.sort()).toEqual(['aman', 'krishnendu', 'priya'].sort());
  });

  it('divides evenly by default when no manual shares are provided', () => {
    const costMinor = 100000;
    const participants = ['p1', 'p2', 'p3', 'p4'];

    const result = distributeRemainingShares(costMinor, participants, {});

    expect(result.isValid).toBe(true);
    expect(result.assignedTotalMinor).toBe(100000);
    expect(result.shares['p1']).toBe(25000);
    expect(result.shares['p2']).toBe(25000);
    expect(result.shares['p3']).toBe(25000);
    expect(result.shares['p4']).toBe(25000);
    expect(result.manualUids).toEqual([]);
    expect(result.autoUids.length).toBe(4);
  });

  it('handles uneven paise distribution deterministically to ensure sum equals total', () => {
    // ₹100 / 3 = ₹33.34, ₹33.33, ₹33.33
    const costMinor = 10000;
    const participants = ['a', 'b', 'c'];

    const result = distributeRemainingShares(costMinor, participants, {});

    expect(result.isValid).toBe(true);
    expect(result.assignedTotalMinor).toBe(10000);
    expect(result.remainingMinor).toBe(0);

    const values = [result.shares['a'], result.shares['b'], result.shares['c']].sort((x, y) => y - x);
    expect(values).toEqual([3334, 3333, 3333]);
    expect(values[0] + values[1] + values[2]).toBe(10000);
  });

  it('recalculates unassigned participants when total expense changes', () => {
    const participants = ['rahul', 'priya', 'aman'];
    const manualShares = { rahul: 40000 };

    // Total was 1000, now changed to 1200 (120,000 paise)
    const result = distributeRemainingShares(120000, participants, manualShares);

    expect(result.isValid).toBe(true);
    expect(result.shares['rahul']).toBe(40000); // Rahul preserved!
    expect(result.shares['priya']).toBe(40000); // 80000 / 2 = 40000
    expect(result.shares['aman']).toBe(40000);
    expect(result.assignedTotalMinor).toBe(120000);
  });

  it('redistributes when a participant is added', () => {
    const manualShares = { rahul: 40000 };
    // Previously 3 participants, now 4
    const participants = ['rahul', 'priya', 'aman', 'krish'];

    const result = distributeRemainingShares(100000, participants, manualShares);

    expect(result.shares['rahul']).toBe(40000);
    expect(result.shares['priya']).toBe(20000);
    expect(result.shares['aman']).toBe(20000);
    expect(result.shares['krish']).toBe(20000);
  });

  it('redistributes when a participant is removed', () => {
    const manualShares = { rahul: 40000, aman: 20000 };
    // aman is removed from active participants
    const activeParticipants = ['rahul', 'priya', 'krish'];

    const result = distributeRemainingShares(100000, activeParticipants, manualShares);

    expect(result.shares['rahul']).toBe(40000);
    expect(result.shares['aman']).toBeUndefined();
    // remaining is 60000 divided by 2 (priya and krish)
    expect(result.shares['priya']).toBe(30000);
    expect(result.shares['krish']).toBe(30000);
    expect(result.assignedTotalMinor).toBe(100000);
  });

  it('preserves multiple manually edited shares and calculates the remaining ones', () => {
    const participants = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const manualShares = { p1: 30000, p2: 20000 }; // 50000 assigned

    const result = distributeRemainingShares(100000, participants, manualShares);

    expect(result.shares['p1']).toBe(30000);
    expect(result.shares['p2']).toBe(20000);
    // Remaining 50000 across 3 people: 16667, 16667, 16666
    expect(result.shares['p3'] + result.shares['p4'] + result.shares['p5']).toBe(50000);
    expect(result.assignedTotalMinor).toBe(100000);
    expect(result.isValid).toBe(true);
  });

  it('reports invalid allocation when manual shares exceed total cost', () => {
    const participants = ['p1', 'p2'];
    const manualShares = { p1: 120000 }; // Total is 100,000

    const result = distributeRemainingShares(100000, participants, manualShares);

    expect(result.isValid).toBe(false);
    expect(result.isFullyAllocated).toBe(false);
    expect(result.remainingMinor).toBe(-20000);
    expect(result.shares['p1']).toBe(120000);
    expect(result.shares['p2']).toBe(0);
  });

  it('reports invalid allocation when all participants are manual and sum does not match', () => {
    const participants = ['p1', 'p2'];
    const manualShares = { p1: 40000, p2: 40000 }; // Total is 100,000, sum is 80,000

    const result = distributeRemainingShares(100000, participants, manualShares);

    expect(result.isValid).toBe(false);
    expect(result.isFullyAllocated).toBe(false);
    expect(result.remainingMinor).toBe(20000);
  });

  it('handles empty participants or 0 cost gracefully', () => {
    expect(distributeRemainingShares(1000, []).isValid).toBe(false);
    expect(distributeRemainingShares(0, ['p1']).isValid).toBe(false);
  });
});
