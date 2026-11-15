import { SplitifyEvent, EventItem, ExpenseEntry, SettlementEntry } from '@/types';
import { formatCurrency } from './currency';
import { calculateEventFinancialOverview } from '@/domain/calculations/finance';
import { getFirstName } from './name';

/**
 * Generates a clean, comprehensive plain-text expenses report.
 * As required:
 * - Event Invitation Link / Website URL is placed FIRST at the very top.
 * - Followed by Date, Time, Event Name & Emoji.
 * - Categorized and standalone items with subitems, payers, and splits.
 * - Full first-name resolution for joined members and expected slot placeholders.
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

  // Helper to resolve first name from member or slot
  const resolvePersonName = (id?: string): string => {
    if (!id) return 'Unknown';
    if (event.members && event.members[id]) {
      return getFirstName(event.members[id].displayName);
    }
    if (event.slots && event.slots[id]) {
      const slot = event.slots[id];
      const slotName = getFirstName(slot.placeholderName || 'Guest');
      return slot.isClaimed ? slotName : `${slotName} (Pending)`;
    }
    return id;
  };

  // 1. EVENT LINK FIRST AT THE VERY TOP
  const origin = window?.location?.origin || 'https://k-692.github.io';
  const cleanBase = `${origin}/Splitify`;
  const eventLink = invitationUrl || `${cleanBase}/events/${event.id}`;

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

  // 3. Financial calculations (with slots integrated)
  const overview = calculateEventFinancialOverview(
    event.members,
    expenses,
    settlements,
    undefined,
    items,
    event.slots
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
            const payerName = resolvePersonName(sub.paidBy) || sub.createdByName || 'Unknown';
            const participantNames = (sub.participants || [])
              .map((uid) => resolvePersonName(uid))
              .join(', ');
            lines.push(
              `    • ${sub.emoji} ${sub.name}: ${formatCurrency(sub.costMinor, event.currency)} | Paid by: ${payerName} | Split with: [${participantNames}]`
            );
          }
        }
      } else {
        // Standalone Item (Item-first direct expense)
        const cost = item.costMinor || 0;
        const payerName = resolvePersonName(item.paidBy) || item.createdByName || 'Unknown';
        const participantNames = (item.participants || [])
          .map((uid) => resolvePersonName(uid))
          .join(', ');

        lines.push(
          `🏷️ [Item] ${item.emoji} ${item.name}: ${formatCurrency(cost, event.currency)} | Paid by: ${payerName} | Split with: [${participantNames}]`
        );
      }
      lines.push('');
    }
  }

  // 5. Individual Member Totals (including slots)
  lines.push('--------------------------------------------------');
  lines.push('👥 MEMBER TOTALS:');
  const allParticipantIds = Object.keys(overview.memberSummaries);
  for (const uid of allParticipantIds) {
    const summary = overview.memberSummaries[uid];
    if (summary) {
      const memberName = resolvePersonName(uid);
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
      const fromName = set.payerName || resolvePersonName(set.payerUid) || 'Unknown';
      const toName = set.receiverName || resolvePersonName(set.receiverUid) || 'Unknown';
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
      const fromName = resolvePersonName(debt.fromUid);
      const toName = resolvePersonName(debt.toUid);
      lines.push(`  👉 ${fromName} pays ${toName} ${formatCurrency(debt.amountMinor, event.currency)}`);
    }
  }

  lines.push('--------------------------------------------------');
  lines.push('Splitify — Easy, Collaborative Expense Splitting');

  return lines.join('\n');
}
