import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { UserProfile } from '@/types';
import { formatCurrency, toMinorUnits } from '@/utils/currency';
import { getTodayLocalDateString } from '@/utils/date';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtorUser: UserProfile;
  creditor: { uid: string; displayName: string } | null;
  maxAmountMinor: number;
  currency: string;
  onSubmit: (data: {
    debtorUid: string;
    debtorName: string;
    creditorUid: string;
    creditorName: string;
    amountMinor: number;
    paymentMethod: string;
    paymentReference: string;
    paymentNote: string;
    paidDate: string;
    paidTime: string;
    occurredAt: number;
  }) => Promise<void>;
}

export const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = ({
  isOpen,
  onClose,
  debtorUser,
  creditor,
  maxAmountMinor,
  currency,
  onSubmit,
}) => {
  if (!creditor) return null;

  const getCurrentTimeString = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [settlementType, setSettlementType] = useState<'full' | 'partial'>('full');
  const [customAmountInput, setCustomAmountInput] = useState((maxAmountMinor / 100).toString());
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paidDate, setPaidDate] = useState(getTodayLocalDateString());
  const [paidTime, setPaidTime] = useState(getCurrentTimeString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettlementType('full');
      setCustomAmountInput((maxAmountMinor / 100).toString());
      setPaymentMethod('UPI');
      setPaymentReference('');
      setPaymentNote('');
      setPaidDate(getTodayLocalDateString());
      setPaidTime(getCurrentTimeString());
      setError(null);
    }
  }, [isOpen, maxAmountMinor]);

  const amountMinorToPay =
    settlementType === 'full' ? maxAmountMinor : toMinorUnits(customAmountInput);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amountMinorToPay <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (amountMinorToPay > maxAmountMinor) {
      setError(
        `Amount cannot exceed outstanding debt of ${formatCurrency(maxAmountMinor, currency)}.`
      );
      return;
    }

    const occurredAt = new Date(`${paidDate}T${paidTime}`).getTime() || Date.now();

    setIsSubmitting(true);
    try {
      await onSubmit({
        debtorUid: debtorUser.uid,
        debtorName: debtorUser.displayName,
        creditorUid: creditor.uid,
        creditorName: creditor.displayName,
        amountMinor: amountMinorToPay,
        paymentMethod: paymentMethod.trim() || 'UPI',
        paymentReference: paymentReference.trim(),
        paymentNote: paymentNote.trim(),
        paidDate,
        paidTime,
        occurredAt,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mark Payment as Paid" emoji="💳" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Parties Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Paying</span>
            <span className="text-slate-800 dark:text-white font-black">{debtorUser.displayName} (You)</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Receiving</span>
            <span className="text-teal-600 dark:text-teal-400 font-black">{creditor.displayName}</span>
          </div>
        </div>

        {/* Full vs Partial Toggle */}
        <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setSettlementType('full')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              settlementType === 'full'
                ? 'bg-white dark:bg-[#15263C] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Full Debt ({formatCurrency(maxAmountMinor, currency)})
          </button>
          <button
            type="button"
            onClick={() => setSettlementType('partial')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              settlementType === 'partial'
                ? 'bg-white dark:bg-[#15263C] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Partial Payment
          </button>
        </div>

        {/* Amount Input */}
        {settlementType === 'partial' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Payment Amount ({currency === 'INR' ? '₹' : currency})
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              max={maxAmountMinor / 100}
              value={customAmountInput}
              onChange={(e) => setCustomAmountInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              required
            />
          </div>
        )}

        {/* Payment Method */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          >
            <option value="UPI">UPI (GPay / PhonePe / Paytm / BHIM)</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer (IMPS / NEFT)</option>
            <option value="Debit/Credit Card">Debit / Credit Card</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Paid Date
            </label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Paid Time
            </label>
            <input
              type="time"
              value={paidTime}
              onChange={(e) => setPaidTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              required
            />
          </div>
        </div>

        {/* Reference and Note */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Payment Reference / Transaction ID (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. UPI Ref / UTR / Receipt No."
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Note (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Sent through Google Pay"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Informational notice */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-amber-50/70 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/50 dark:border-amber-800/40">
          ℹ️ Marking this paid sends a confirmation request to <strong>{creditor.displayName}</strong>. The settlement balance will update once they confirm receipt.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Confirm Paid ({formatCurrency(amountMinorToPay, currency)})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
