import {
  EventMember,
  EventItem,
  ExpenseEntry,
  SettlementEntry,
  MemberFinancialSummary,
  SettlementSuggestion,
  EventFinancialOverview,
} from '@/types';

/**
 * Calculates equal shares for a given cost across participants.
 * Any remainder is deterministically allocated to ensure sum(shares) === costMinor.
 */
export function calculateEqualShares(
  costMinor: number,
  participantUids: string[]
): Record<string, number> {
  if (!participantUids || participantUids.length === 0 || costMinor <= 0) {
    return {};
  }

  // Sort UIDs deterministically
  const sortedUids = [...participantUids].sort();
  const count = sortedUids.length;
  const baseShare = Math.floor(costMinor / count);
  const remainder = costMinor % count;

  const shares: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const uid = sortedUids[i];
    // First 'remainder' participants get 1 extra minor unit
    shares[uid] = baseShare + (i < remainder ? 1 : 0);
  }

  return shares;
}

/**
 * Validates whether the sum of custom amount shares matches the total cost.
 */
export function validateAmountShares(
  costMinor: number,
  shares: Record<string, number>,
  participantUids: string[]
): { isValid: boolean; differenceMinor: number } {
  let totalShares = 0;
  for (const uid of participantUids) {
    totalShares += shares[uid] || 0;
  }

  const differenceMinor = costMinor - totalShares;
  return {
    isValid: differenceMinor === 0,
    differenceMinor,
  };
}

/**
 * Unified representation of an active financial expense
 * (either a standalone EventItem or a category subitem ExpenseEntry)
 */
interface UnifiedExpense {
  id: string;
  itemId?: string;
  costMinor: number;
  paidBy: string;
  payerName?: string;
  shares: Record<string, number>;
}

/**
 * Computes the full financial overview for an event:
 * - Aggregates standalone active items AND active category subitems
 * - Never double-counts categories
 * - Computes individual spending, fair share, settlements, and net balances
 * - Verifies zero-sum balance invariant
 * - Calculates minimal debt settlement suggestions
 */
export function calculateEventFinancialOverview(
  members: Record<string, EventMember>,
  expenses: ExpenseEntry[],
  settlements: SettlementEntry[] = [],
  currentUserId?: string,
  items: EventItem[] = []
): EventFinancialOverview {
  // 1. Collect all active ordinary expenses from items and subitems
  const unifiedExpenses: UnifiedExpense[] = [];

  // Build a map of category items
  const categoryItemIds = new Set<string>();
  const activeItemIds = new Set<string>();
  for (const it of items) {
    if (!it.deleted) {
      activeItemIds.add(it.id);
      if (it.isCategory) {
        categoryItemIds.add(it.id);
      } else if (!it.isSettlementsItem && it.costMinor && it.costMinor > 0) {
        // Standalone Item is an expense directly
        unifiedExpenses.push({
          id: it.id,
          itemId: it.id,
          costMinor: it.costMinor,
          paidBy: it.paidBy || '',
          payerName: it.createdByName,
          shares: it.shares || {},
        });
      }
    }
  }

  // Active subitems under categories
  for (const exp of expenses) {
    if (!exp.deleted) {
      // If items list was provided, ensure it belongs to an active category item
      if (items.length === 0 || categoryItemIds.has(exp.itemId)) {
        unifiedExpenses.push({
          id: exp.id,
          itemId: exp.itemId,
          costMinor: exp.costMinor || 0,
          paidBy: exp.paidBy,
          payerName: exp.createdByName,
          shares: exp.shares || {},
        });
      }
    }
  }

  const completedSettlements = settlements.filter((s) => s.status === 'completed');

  // Total ordinary expense
  const totalExpenseMinor = unifiedExpenses.reduce((sum, e) => sum + (e.costMinor || 0), 0);

  // Initialize summary for every member
  const memberSummaries: Record<string, MemberFinancialSummary> = {};
  for (const [uid, member] of Object.entries(members)) {
    memberSummaries[uid] = {
      uid,
      displayName: member.displayName || 'Unknown Member',
      photoURL: member.photoURL,
      username: member.username,
      spentMinor: 0,
      shareMinor: 0,
      settledPaidMinor: 0,
      settledReceivedMinor: 0,
      netBalanceMinor: 0,
    };
  }

  // Also account for any participant/payer not currently in members map
  const ensureMember = (uid: string, fallbackName?: string) => {
    if (!uid) return;
    if (!memberSummaries[uid]) {
      memberSummaries[uid] = {
        uid,
        displayName: fallbackName || 'Former Member',
        spentMinor: 0,
        shareMinor: 0,
        settledPaidMinor: 0,
        settledReceivedMinor: 0,
        netBalanceMinor: 0,
      };
    }
  };

  // 2. Accumulate ordinary expenses
  for (const exp of unifiedExpenses) {
    if (exp.paidBy) {
      ensureMember(exp.paidBy, exp.payerName);
      memberSummaries[exp.paidBy].spentMinor += exp.costMinor || 0;
    }

    if (exp.shares) {
      for (const [uid, share] of Object.entries(exp.shares)) {
        ensureMember(uid);
        memberSummaries[uid].shareMinor += share || 0;
      }
    }
  }

  // 3. Accumulate settlements
  for (const set of completedSettlements) {
    ensureMember(set.payerUid, set.payerName);
    ensureMember(set.receiverUid, set.receiverName);

    memberSummaries[set.payerUid].settledPaidMinor += set.amountMinor || 0;
    memberSummaries[set.receiverUid].settledReceivedMinor += set.amountMinor || 0;
  }

  // 4. Calculate Net Balances:
  // Net Balance = (Spent - Share) + (Settled Paid - Settled Received)
  // Positive = should receive money
  // Negative = owes money
  let netBalanceSum = 0;
  for (const summary of Object.values(memberSummaries)) {
    summary.netBalanceMinor =
      summary.spentMinor -
      summary.shareMinor +
      summary.settledPaidMinor -
      summary.settledReceivedMinor;
    netBalanceSum += summary.netBalanceMinor;
  }

  // Zero-sum check
  const isBalanced = netBalanceSum === 0;

  // 5. Debt Simplification (Minimum Cash Flow)
  const settlementSuggestions = calculateSimplifiedDebts(memberSummaries);

  // 6. Current user stats
  const currentSummary = currentUserId ? memberSummaries[currentUserId] : undefined;
  const currentUserSpentMinor = currentSummary?.spentMinor || 0;
  const currentUserShareMinor = currentSummary?.shareMinor || 0;
  const currentUserNetBalanceMinor = currentSummary?.netBalanceMinor || 0;

  return {
    totalExpenseMinor,
    currentUserSpentMinor,
    currentUserShareMinor,
    currentUserNetBalanceMinor,
    memberSummaries,
    settlementSuggestions,
    isBalanced,
  };
}

/**
 * Deterministic greedy debt simplification algorithm.
 * Reduces the web of debts to minimum direct payment suggestions.
 */
export function calculateSimplifiedDebts(
  memberSummaries: Record<string, MemberFinancialSummary>
): SettlementSuggestion[] {
  interface BalanceNode {
    uid: string;
    name: string;
    amount: number; // positive for creditors, negative for debtors
  }

  const debtors: BalanceNode[] = [];
  const creditors: BalanceNode[] = [];

  for (const s of Object.values(memberSummaries)) {
    if (s.netBalanceMinor < 0) {
      debtors.push({
        uid: s.uid,
        name: s.displayName,
        amount: Math.abs(s.netBalanceMinor),
      });
    } else if (s.netBalanceMinor > 0) {
      creditors.push({
        uid: s.uid,
        name: s.displayName,
        amount: s.netBalanceMinor,
      });
    }
  }

  // Sort descending by amount for greedy matching, with deterministic tie-breaking by uid
  debtors.sort((a, b) => b.amount - a.amount || a.uid.localeCompare(b.uid));
  creditors.sort((a, b) => b.amount - a.amount || a.uid.localeCompare(b.uid));

  const suggestions: SettlementSuggestion[] = [];

  let dIndex = 0;
  let cIndex = 0;

  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0) {
      suggestions.push({
        fromUid: debtor.uid,
        fromName: debtor.name,
        toUid: creditor.uid,
        toName: creditor.name,
        amountMinor: settledAmount,
      });

      debtor.amount -= settledAmount;
      creditor.amount -= settledAmount;
    }

    if (debtor.amount === 0) {
      dIndex++;
    }
    if (creditor.amount === 0) {
      cIndex++;
    }
  }

  return suggestions;
}
