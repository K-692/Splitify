import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { PaymentConfirmation } from '@/types';
import { formatCurrency } from '@/utils/currency';
import confetti from 'canvas-confetti';
import { Check, X, AlertCircle, Calendar, CreditCard, FileText } from 'lucide-react';

interface ConfirmPaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  confirmation: PaymentConfirmation | null;
  currency: string;
  onConfirmReceipt: (confirmation: PaymentConfirmation) => Promise<void>;
  onReportNotReceived: (confirmation: PaymentConfirmation, reason?: string) => Promise<void>;
}

export const ConfirmPaymentReceiptModal: React.FC<ConfirmPaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  confirmation,
  currency,
  onConfirmReceipt,
  onReportNotReceived,
}) => {
  if (!confirmation) return null;

  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setIsConfirming(true);
    try {
      await onConfirmReceipt(confirmation);
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
      setError(err.message || 'Failed to confirm receipt');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReject = async () => {
    setError(null);
    setIsRejecting(true);
    try {
      await onReportNotReceived(confirmation, rejectionReason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reject confirmation');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Payment Received"
      emoji="🤝"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Payment Summary Header */}
        <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/60 text-center">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            <strong>{confirmation.debtorName}</strong> marked as paid to <strong>You</strong>
          </p>
          <div className="text-3xl font-black text-teal-600 dark:text-teal-400 my-1">
            {formatCurrency(confirmation.amountMinor, currency)}
          </div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/10 text-teal-600 dark:text-teal-400">
            Awaiting Your Confirmation
          </span>
        </div>

        {/* Payment Details List */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Method:
            </span>
            <span className="font-bold text-slate-800 dark:text-white">
              {confirmation.paymentMethod || 'UPI'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Paid On:
            </span>
            <span className="font-bold text-slate-800 dark:text-white">
              {confirmation.paidDate}, {confirmation.paidTime}
            </span>
          </div>

          {confirmation.paymentReference && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Reference:
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-white">
                {confirmation.paymentReference}
              </span>
            </div>
          )}

          {confirmation.paymentNote && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 font-medium block mb-0.5">Note:</span>
              <p className="font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800">
                &quot;{confirmation.paymentNote}&quot;
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Question Prompt */}
        <p className="text-xs text-center font-bold text-slate-700 dark:text-slate-300">
          Do you confirm that you have received this payment?
        </p>

        {showRejectReason ? (
          <div className="space-y-2 p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200/60 dark:border-rose-800/40">
            <label className="block text-xs font-bold text-rose-700 dark:text-rose-300">
              Reason for reporting not received (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Did not receive in account, check UTR"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRejectReason(false)}
                disabled={isRejecting}
              >
                Back
              </Button>
              <Button
                size="sm"
                variant="danger"
                isLoading={isRejecting}
                onClick={handleReject}
                leftIcon={<X className="w-3.5 h-3.5" />}
              >
                Confirm Not Received
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRejectReason(true)}
              disabled={isConfirming || isRejecting}
              className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              leftIcon={<X className="w-4 h-4" />}
            >
              Not Received
            </Button>

            <Button
              type="button"
              variant="primary"
              isLoading={isConfirming}
              disabled={isRejecting}
              onClick={handleConfirm}
              leftIcon={<Check className="w-4 h-4" />}
            >
              Confirm Receipt
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
