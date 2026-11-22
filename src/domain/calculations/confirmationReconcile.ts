import { PaymentConfirmation, SettlementEntry, SettlementSuggestion, EventSlot } from '@/types';

/**
 * Finds payment requests still marked "awaiting confirmation" that are in fact
 * already settled, so they can be hidden and closed.
 *
 * A request from D to C is treated as settled when BOTH hold:
 *  - a completed settlement from D to C was recorded at or after the request
 *    (e.g. C used the instant "Paid" button, or confirmed a duplicate request), and
 *  - D no longer owes C anything in the current balances.
 */
export function findSettledConfirmations(
  confirmations: PaymentConfirmation[],
  settlements: SettlementEntry[],
  suggestions: SettlementSuggestion[],
  slots?: Record<string, EventSlot>
): Set<string> {
  const resolve = (raw?: string) => {
    if (!raw) return '';
    const s = slots?.[raw];
    return s?.isClaimed && s.claimedByUid ? s.claimedByUid : raw;
  };
  const settled = new Set<string>();
  for (const pc of confirmations) {
    if (pc.status !== 'awaiting_confirmation') continue;
    const debtor = resolve(pc.debtorUid);
    const creditor = resolve(pc.creditorUid);
    const stillOwes = suggestions.some((s) => resolve(s.fromUid) === debtor && resolve(s.toUid) === creditor && s.amountMinor > 0);
    if (stillOwes) continue;
    const laterPayment = settlements.some(
      (s) =>
        s.status === 'completed' &&
        resolve(s.payerUid) === debtor &&
        resolve(s.receiverUid) === creditor &&
        (s.createdAt || 0) >= (pc.createdAt || 0)
    );
    if (laterPayment) settled.add(pc.id);
  }
  return settled;
}
