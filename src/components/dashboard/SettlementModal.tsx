import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { SettlementSuggestion, UserProfile } from '@/types';
import { formatCurrency, toMinorUnits } from '@/utils/currency';
import { Avatar } from '@/components/common/Avatar';
import confetti from 'canvas-confetti';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: SettlementSuggestion | null;
  currency: string;
  currentUser: UserProfile;
  onConfirm: (data: {
    payerUid: string;
    payerName: string;
    receiverUid: string;
    receiverName: string;
    amountMinor: number;
    note?: string;
  }) => Promise<void>;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  onClose,
  suggestion,
  currency,
  onConfirm,
}) => {
  if (!suggestion) return null;

  const [settlementType, setSettlementType] = useState<'full' | 'partial'>('full');
  const [customAmountInput, setCustomAmountInput] = useState(
    (suggestion.amountMinor / 100).toString()
  );
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountMinorToSettle =
    settlementType === 'full'
      ? suggestion.amountMinor
      : toMinorUnits(customAmountInput);

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amountMinorToSettle <= 0) {
      setError('Please enter a settlement amount greater than 0.');
      return;
    }

    if (amountMinorToSettle > suggestion.amountMinor) {
      setError(
        `Amount cannot exceed outstanding debt of ${formatCurrency(
          suggestion.amountMinor,
          currency
        )}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        payerUid: suggestion.fromUid,
        payerName: suggestion.fromName,
        receiverUid: suggestion.toUid,
        receiverName: suggestion.toName,
        amountMinor: amountMinorToSettle,
        note: note.trim(),
      });

      // Celebratory Confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#16AA88', '#203D62', '#F36B2C', '#F5A623', '#60BCE8'],
        });
      } catch {
        // Ignored
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Settlement" emoji="💸" maxWidth="md">
      <form onSubmit={handleSettle} className="space-y-4">
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Transfer Visual Card */}
        <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex flex-col items-center text-center flex-1">
            <Avatar name={suggestion.fromName} size="md" className="mb-1" />
            <span className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[100px]">
              {suggestion.fromName}
            </span>
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
              Payer
            </span>
          </div>

          <div className="flex flex-col items-center justify-center px-2">
            <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-1">Paying</span>
          </div>

          <div className="flex flex-col items-center text-center flex-1">
            <Avatar name={suggestion.toName} size="md" className="mb-1" />
            <span className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[100px]">
              {suggestion.toName}
            </span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
              Receiver
            </span>
          </div>
        </div>

        {/* Total Outstanding Amount */}
        <div className="text-center py-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Total Outstanding Debt
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(suggestion.amountMinor, currency)}
          </p>
        </div>

        {/* Full or Partial Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Settlement Option
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setSettlementType('full')}
              className={`py-2 rounded-xl font-bold text-xs transition-all ${
                settlementType === 'full'
                  ? 'bg-white dark:bg-[#15263C] text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Full Settlement ({formatCurrency(suggestion.amountMinor, currency)})
            </button>
            <button
              type="button"
              onClick={() => setSettlementType('partial')}
              className={`py-2 rounded-xl font-bold text-xs transition-all ${
                settlementType === 'partial'
                  ? 'bg-white dark:bg-[#15263C] text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Partial Settlement
            </button>
          </div>
        </div>

        {/* Partial Amount Input */}
        {settlementType === 'partial' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Amount to Settle ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={(suggestion.amountMinor / 100).toString()}
              value={customAmountInput}
              onChange={(e) => setCustomAmountInput(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-base focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        )}

        {/* Note / Payment method */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Optional Note (e.g. UPI, GPay, Cash)
          </label>
          <input
            type="text"
            placeholder="e.g. Paid via GPay / UPI"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        {/* Notice */}
        <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 text-[11px] text-teal-800 dark:text-teal-300 font-semibold flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
          <span>
            Recording this payment will immediately update member balances and add an entry under the
            event&apos;s <strong>💸 Settlements</strong> item without altering Total Expense.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="!bg-teal-500 hover:!bg-teal-600 shadow-md shadow-teal-500/25"
          >
            Mark as Settled! 💸
          </Button>
        </div>
      </form>
    </Modal>
  );
};
