import { describe, it, expect, beforeEach } from 'vitest';
import {
  getExpenseSuggestions,
  recordExpenseNames,
  readExpenseHistory,
} from '../src/utils/expenseSuggestions';

describe('Expense name suggestions', () => {
  beforeEach(() => localStorage.clear());

  const eventEntries = [
    { name: 'Chicken', costMinor: 13000, usedAt: 300 },
    { name: 'Water', costMinor: 1500, usedAt: 200 },
    { name: 'Hot Water Bottle', costMinor: 9000, usedAt: 100 },
    { name: 'water', costMinor: 2000, usedAt: 400 },
  ];

  it('ranks prefix matches first and merges case-insensitive duplicates', () => {
    const res = getExpenseSuggestions('wat', eventEntries, []);
    expect(res.map((r) => r.name)).toEqual(['water', 'Hot Water Bottle']);
    expect(res[0].count).toBe(2);
    expect(res[0].lastCostMinor).toBe(2000); // most recent amount wins
  });

  it('never suggests the exact text already typed', () => {
    expect(getExpenseSuggestions('Chicken', eventEntries, []).map((r) => r.name)).not.toContain('Chicken');
  });

  it('shows recent names when the query is empty', () => {
    const res = getExpenseSuggestions('', eventEntries, [], 2);
    expect(res).toHaveLength(2);
  });

  it('remembers saved names across events', () => {
    recordExpenseNames([{ name: 'Petrol', costMinor: 50000 }], 1000);
    recordExpenseNames([{ name: 'petrol ', costMinor: 60000 }], 2000);
    const hist = readExpenseHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ count: 2, lastCostMinor: 60000, lastUsed: 2000 });
    expect(getExpenseSuggestions('pe', []).map((r) => r.name)).toEqual(['petrol']);
  });
});
