import {
  EventMember,
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
 * Computes the full financial overview for an event:
 * - Total expense (sum of active ordinary expenses)
 * - Individual spending, fair share, settlements, and net balances
 * - Zero-sum balance verification
 * - Debt simplification settlement suggestions
 */
export function calculateEventFinancialOverview(
  members: Record<string, EventMember>,
  expenses: ExpenseEntry[],
  settlements: SettlementEntry[] = [],
  currentUserId?: string
): EventFinancialOverview {
  // 1. Filter active (non-deleted) expenses
  const activeExpenses = expenses.filter((e) => !e.deleted);
  const completedSettlements = settlements.filter((s) => s.status === 'completed');

  // Total ordinary expense
  const totalExpenseMinor = activeExpenses.reduce((sum, e) => sum + (e.costMinor || 0), 0);

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
  for (const exp of activeExpenses) {
    ensureMember(exp.paidBy, exp.createdByName);
    memberSummaries[exp.paidBy].spentMinor += exp.costMinor || 0;

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
