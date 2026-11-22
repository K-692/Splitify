/**
 * Expense-name suggestions built from what the user entered before:
 * names already used in the current event plus a small per-device history
 * of names the user has saved in any event.
 */
export interface SuggestionSource {
  name: string;
  costMinor?: number;
  usedAt?: number;
}

export interface ExpenseSuggestion {
  name: string;
  lastCostMinor?: number;
  count: number;
  lastUsed: number;
}

const HISTORY_KEY = 'splitify_expense_name_history';
const HISTORY_LIMIT = 150;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function readExpenseHistory(): ExpenseSuggestion[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((h) => h && typeof h.name === 'string') : [];
  } catch {
    return [];
  }
}

/** Remember names (and their last amount) the user just saved. */
export function recordExpenseNames(entries: SuggestionSource[], now: number = Date.now()): void {
  const history = readExpenseHistory();
  for (const e of entries) {
    const name = e.name.trim();
    if (!name) continue;
    const existing = history.find((h) => norm(h.name) === norm(name));
    if (existing) {
      existing.name = name;
      existing.count += 1;
      existing.lastUsed = now;
      if (e.costMinor && e.costMinor > 0) existing.lastCostMinor = e.costMinor;
    } else {
      history.push({
        name,
        count: 1,
        lastUsed: now,
        lastCostMinor: e.costMinor && e.costMinor > 0 ? e.costMinor : undefined,
      });
    }
  }
  history.sort((a, b) => b.lastUsed - a.lastUsed);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  } catch {
    /* storage unavailable — suggestions just won't persist */
  }
}

/**
 * Ranked suggestions for the current input. Prefix matches rank above
 * substring matches, then by how often and how recently a name was used.
 * The exact text already typed is never suggested.
 */
export function getExpenseSuggestions(
  query: string,
  eventEntries: SuggestionSource[],
  history: ExpenseSuggestion[] = readExpenseHistory(),
  limit = 6
): ExpenseSuggestion[] {
  const merged = new Map<string, ExpenseSuggestion>();
  const add = (name: string, costMinor: number | undefined, count: number, usedAt: number) => {
    const key = norm(name);
    if (!key) return;
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, { name: name.trim(), lastCostMinor: costMinor, count, lastUsed: usedAt });
      return;
    }
    cur.count += count;
    if (usedAt >= cur.lastUsed) {
      cur.name = name.trim(); // most recent spelling wins
      cur.lastUsed = usedAt;
      if (costMinor) cur.lastCostMinor = costMinor;
    }
  };
  for (const e of eventEntries) add(e.name, e.costMinor, 1, e.usedAt || 0);
  for (const h of history) add(h.name, h.lastCostMinor, h.count, h.lastUsed);

  const q = norm(query);
  const scored: Array<{ s: ExpenseSuggestion; rank: number }> = [];
  for (const [key, s] of merged) {
    if (q && key === q) continue;
    let rank: number;
    if (!q) rank = 2;
    else if (key.startsWith(q)) rank = 0;
    else if (key.split(' ').some((w) => w.startsWith(q))) rank = 1;
    else if (key.includes(q)) rank = 2;
    else continue;
    scored.push({ s, rank });
  }
  scored.sort(
    (a, b) => a.rank - b.rank || b.s.count - a.s.count || b.s.lastUsed - a.s.lastUsed || a.s.name.localeCompare(b.s.name)
  );
  return scored.slice(0, limit).map((x) => x.s);
}
