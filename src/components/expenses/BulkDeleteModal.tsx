import React from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/utils/currency';
import { AlertTriangle } from 'lucide-react';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  totalAffectedAmountMinor: number;
  currency: string;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  totalAffectedAmountMinor,
  currency,
  onConfirm,
  isLoading,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Bulk Deletion" emoji="⚠️" maxWidth="sm">
      <div className="space-y-4">
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-sm mb-1">
              Delete {selectedCount} selected expense{selectedCount > 1 ? 's' : ''}?
            </p>
            <p>
              This will remove a total of{' '}
              <strong>{formatCurrency(totalAffectedAmountMinor, currency)}</strong> from the event.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          All member contributions, shares, and settlement suggestions will be automatically
          recalculated immediately.
        </p>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="md" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            Delete {selectedCount} Item{selectedCount > 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
