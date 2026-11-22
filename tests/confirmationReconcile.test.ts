import { describe, it, expect } from 'vitest';
import { findSettledConfirmations } from '../src/domain/calculations/confirmationReconcile';
import { PaymentConfirmation, SettlementEntry, SettlementSuggestion } from '../src/types';

const pc = (id: string, createdAt: number, amountMinor = 250000, status: PaymentConfirmation['status'] = 'awaiting_confirmation'): PaymentConfirmation => ({
  id, eventId: 'e', debtorUid: 'krish', debtorName: 'Krish', creditorUid: 'arpan', creditorName: 'Arpan',
  amountMinor, paidDate: '', paidTime: '', occurredAt: createdAt, status, createdAt,
});
const st = (createdAt: number, amountMinor = 250000, extra: Partial<SettlementEntry> = {}): SettlementEntry => ({
  id: 's' + createdAt, eventId: 'e', payerUid: 'krish', payerName: 'Krish', receiverUid: 'arpan', receiverName: 'Arpan',
  amountMinor, createdAt, status: 'completed', ...extra,
});
const owes: SettlementSuggestion[] = [{ fromUid: 'krish', fromName: 'Krish', toUid: 'arpan', toName: 'Arpan', amountMinor: 250000 }];

describe('Stale payment confirmations', () => {
  it('closes a request covered by a later instant "Paid" from the receiver', () => {
    expect([...findSettledConfirmations([pc('a', 100)], [st(200)], [])]).toEqual(['a']);
  });

  it('closes a duplicate request once the other one was confirmed', () => {
    const r = findSettledConfirmations([pc('a', 100, 250000, 'completed'), pc('dup', 101)], [st(150, 250000, { paymentConfirmationId: 'a' })], []);
    expect([...r]).toEqual(['dup']);
  });

  it('keeps a request open while the debt is still outstanding', () => {
    expect(findSettledConfirmations([pc('a', 100)], [st(200, 100000)], owes).size).toBe(0);
  });

  it('keeps a genuine new request made after an earlier partial payment', () => {
    // Earlier ₹1,000 settled at t=50; new request at t=100 still awaiting and debt remains
    expect(findSettledConfirmations([pc('b', 100, 150000)], [st(50, 100000)], owes).size).toBe(0);
  });

  it('keeps a request when nothing has been recorded yet, even if balances show no debt', () => {
    expect(findSettledConfirmations([pc('a', 100)], [], []).size).toBe(0);
  });
});
