import { SplitifyEvent, EventItem, ExpenseEntry, SettlementEntry } from '@/types';
import { formatCurrency } from './currency';
import { calculateEventFinancialOverview } from '@/domain/calculations/finance';

/**
 * Generates a clean, comprehensive plain-text expenses report.
 * As required:
 * - Event Invitation Link / Website URL is placed FIRST at the very top.
 * - Followed by Date, Time, Event Name & Emoji.
 * - Categorized and standalone items with subitems, payers, and splits.
 * - Completed settlements.
 * - Outstanding net balances / who owes whom.
 * - Total Event Expense.
 */
export function generatePlainTextExpenseReport(
  event: SplitifyEvent,
  items: EventItem[],
  expenses: ExpenseEntry[],
  settlements: SettlementEntry[] = [],
  invitationUrl?: string,
  now: Date = new Date()
): string {
  const lines: string[] = [];

  // 1. EVENT LINK FIRST AT THE VERY TOP
  const appBaseUrl = window?.location?.origin
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://k-692.github.io/Splitify/';
  const eventLink = invitationUrl || `${appBaseUrl}#/events/${event.id}`;

  lines.push(`🔗 Event Link: ${eventLink}`);
  lines.push('');

  // 2. Header & Timestamp
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  lines.push(`📊 ${event.emoji} ${event.name} — Expense Summary`);
  lines.push(`📅 Generated on: ${dateStr} at ${timeStr}`);
  lines.push('--------------------------------------------------');

  // 3. Financial calculations
  const overview = calculateEventFinancialOverview(
    event.members,
    expenses,
    settlements,
    undefined,
    items
  );

  lines.push(`💰 Total Event Expense: ${formatCurrency(overview.totalExpenseMinor, event.currency)}`);
  lines.push('');

  // 4. Breakdown of Items & Categories
  lines.push('📋 EXPENSE BREAKDOWN:');
  lines.push('');

  const activeItems = items.filter((i) => !i.deleted && !i.isSettlementsItem);

  if (activeItems.length === 0) {
    lines.push('  (No expenses recorded yet)');
  } else {
    for (const item of activeItems) {
      if (item.isCategory) {
        // Category with subitems
        const subitems = expenses.filter((e) => e.itemId === item.id && !e.deleted);
        const catTotalMinor = subitems.reduce((s, e) => s + (e.costMinor || 0), 0);

        lines.push(`📁 [Category] ${item.emoji} ${item.name} — Total: ${formatCurrency(catTotalMinor, event.currency)}`);
        if (subitems.length === 0) {
          lines.push('    (No subitems)');
        } else {
          for (const sub of subitems) {
            const payerName = event.members[sub.paidBy]?.displayName || sub.createdByName || 'Unknown';
            const participantNames = (sub.participants || [])
              .map((uid) => event.members[uid]?.displayName || uid)
              .join(', ');
            lines.push(
              `    • ${sub.emoji} ${sub.name}: ${formatCurrency(sub.costMinor, event.currency)} | Paid by: ${payerName} | Split with: [${participantNames}]`
            );
          }
        }
      } else {
        // Standalone Item (Item-first direct expense)
        const cost = item.costMinor || 0;
        const payerName = (item.paidBy && event.members[item.paidBy]?.displayName) || item.createdByName || 'Unknown';
        const participantNames = (item.participants || [])
          .map((uid) => event.members[uid]?.displayName || uid)
          .join(', ');

        lines.push(
          `🏷️ [Item] ${item.emoji} ${item.name}: ${formatCurrency(cost, event.currency)} | Paid by: ${payerName} | Split with: [${participantNames}]`
        );
      }
      lines.push('');
    }
  }

  // 5. Individual Member Totals
  lines.push('--------------------------------------------------');
  lines.push('👥 MEMBER TOTALS:');
  for (const uid of Object.keys(event.members)) {
    const summary = overview.memberSummaries[uid];
    const memberName = event.members[uid].displayName;
    if (summary) {
      const balanceStr =
        summary.netBalanceMinor > 0
          ? `+${formatCurrency(summary.netBalanceMinor, event.currency)} (gets back)`
          : summary.netBalanceMinor < 0
          ? `-${formatCurrency(Math.abs(summary.netBalanceMinor), event.currency)} (owes)`
          : `₹0 (settled)`;
      lines.push(
        `  • ${memberName}: Paid ${formatCurrency(summary.spentMinor, event.currency)} | Share: ${formatCurrency(summary.shareMinor, event.currency)} | Balance: ${balanceStr}`
      );
    }
  }
  lines.push('');

  // 6. Settlements
  const completedSettlements = settlements.filter((s) => s.status === 'completed');
  if (completedSettlements.length > 0) {
    lines.push('💸 RECORDED SETTLEMENTS:');
    for (const set of completedSettlements) {
      const fromName = set.payerName || event.members[set.payerUid]?.displayName || 'Unknown';
      const toName = set.receiverName || event.members[set.receiverUid]?.displayName || 'Unknown';
      const noteStr = set.note ? ` (${set.note})` : '';
      lines.push(`  ✓ ${fromName} paid ${toName} ${formatCurrency(set.amountMinor, event.currency)}${noteStr}`);
    }
    lines.push('');
  }

  // 7. Suggested Settlements (Who Owes Whom)
  lines.push('🤝 FINAL SETTLEMENT SUGGESTIONS:');
  const suggestions = overview.settlementSuggestions || [];
  if (suggestions.length === 0) {
    lines.push('  🎉 All expenses are fully settled! No pending debts.');
  } else {
    for (const debt of suggestions) {
      const fromName = event.members[debt.fromUid]?.displayName || debt.fromUid;
      const toName = event.members[debt.toUid]?.displayName || debt.toUid;
      lines.push(`  👉 ${fromName} pays ${toName} ${formatCurrency(debt.amountMinor, event.currency)}`);
    }
  }

  lines.push('--------------------------------------------------');
  lines.push('Splitify — Easy, Collaborative Expense Splitting');

  return lines.join('\n');
}
