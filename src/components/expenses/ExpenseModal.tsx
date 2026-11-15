import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { SplitifyEvent, ExpenseEntry, SplitMode, UserProfile } from '@/types';
import { getEmojiForName } from '@/utils/emoji';
import { toMinorUnits, formatCurrency } from '@/utils/currency';
import { calculateEqualShares, validateAmountShares } from '@/domain/calculations/finance';
import { Avatar } from '@/components/common/Avatar';
import { Check, AlertCircle } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SplitifyEvent;
  itemId?: string;
  currentUser: UserProfile;
  initialExpense?: ExpenseEntry | null;
  onSave: (data: {
    name: string;
    costMinor: number;
    paidBy: string;
    splitBy: SplitMode;
    participants: string[];
    customShares?: Record<string, number>;
    comment?: string;
  }) => Promise<void>;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  event,
  itemId: _itemId,
  currentUser,
  initialExpense,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [costInput, setCostInput] = useState('');
  const [paidBy, setPaidBy] = useState(currentUser.uid);
  const [splitBy, setSplitBy] = useState<SplitMode>('equal');
  const [participants, setParticipants] = useState<string[]>([]);
  const [customSharesInput, setCustomSharesInput] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [emoji, setEmoji] = useState('📌');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberList = Object.values(event.members);

  useEffect(() => {
    if (initialExpense) {
      setName(initialExpense.name);
      setEmoji(initialExpense.emoji);
      setCostInput((initialExpense.costMinor / 100).toString());
      setPaidBy(initialExpense.paidBy);
      setSplitBy(initialExpense.splitBy);
      setParticipants(initialExpense.participants);
      setComment(initialExpense.comment || '');

      const initialShares: Record<string, string> = {};
      for (const [uid, minor] of Object.entries(initialExpense.shares)) {
        initialShares[uid] = (minor / 100).toString();
      }
      setCustomSharesInput(initialShares);
    } else {
      // Defaults for new expense
      setName('');
      setEmoji('📌');
      setCostInput('');
      setPaidBy(currentUser.uid);
      setSplitBy('equal');
      const allUids = memberList.map((m) => m.uid);
      setParticipants(allUids);
      setCustomSharesInput({});
      setComment('');
    }
    setError(null);
  }, [isOpen, initialExpense, currentUser.uid]);

  // Update emoji on name change
  const handleNameChange = (val: string) => {
    setName(val);
    setEmoji(getEmojiForName(val));
  };

  const toggleParticipant = (uid: string) => {
    if (participants.includes(uid)) {
      if (participants.length === 1) {
        setError('At least one participant must be selected.');
        return;
      }
      setParticipants(participants.filter((id) => id !== uid));
    } else {
      setParticipants([...participants, uid]);
    }
  };

  // Compute validation for custom amount shares
  const costMinor = toMinorUnits(costInput);
  const customSharesMinor: Record<string, number> = {};
  for (const uid of participants) {
    customSharesMinor[uid] = toMinorUnits(customSharesInput[uid] || '0');
  }

  const amountValidation = validateAmountShares(costMinor, customSharesMinor, participants);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter an expense name.');
      return;
    }

    if (costMinor <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (participants.length === 0) {
      setError('Please select at least one participant.');
      return;
    }

    if (splitBy === 'amount' && !amountValidation.isValid) {
      const diffFormatted = formatCurrency(Math.abs(amountValidation.differenceMinor), event.currency);
      if (amountValidation.differenceMinor > 0) {
        setError(`Individual shares are short by ${diffFormatted}. Sum must equal total expense.`);
      } else {
        setError(`Individual shares exceed total by ${diffFormatted}. Sum must equal total expense.`);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        costMinor,
        paidBy,
        splitBy,
        participants,
        customShares: splitBy === 'amount' ? customSharesMinor : undefined,
        comment: comment.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialExpense ? 'Edit Expense' : 'Add Expense'}
      emoji={emoji}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Expense Name & Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Expense Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-lg select-none">{emoji}</span>
              <input
                type="text"
                placeholder="e.g. Flight Tickets, Dinner, Hotel"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Amount ({event.currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Paid By */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Paid by
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {memberList.map((member) => (
              <button
                key={member.uid}
                type="button"
                onClick={() => setPaidBy(member.uid)}
                className={`flex items-center gap-2 p-2 rounded-2xl border text-left transition-all ${
                  paidBy === member.uid
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
              >
                <Avatar src={member.photoURL} name={member.displayName} size="xs" />
                <span className="text-xs font-bold truncate">
                  {member.displayName} {member.uid === currentUser.uid ? '(You)' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Split By Tabs: Equal or Amount */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Split Mode
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setSplitBy('equal')}
              className={`py-2 rounded-xl font-bold text-xs transition-all ${
                splitBy === 'equal'
                  ? 'bg-white dark:bg-[#15263C] text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Split Equally (Default)
            </button>
            <button
              type="button"
              onClick={() => setSplitBy('amount')}
              className={`py-2 rounded-xl font-bold text-xs transition-all ${
                splitBy === 'amount'
                  ? 'bg-white dark:bg-[#15263C] text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Exact Amounts
            </button>
          </div>
        </div>

        {/* Participants Selection & Amount Allocation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Participants ({participants.length}/{memberList.length})
            </label>
            <button
              type="button"
              onClick={() => {
                if (participants.length === memberList.length) {
                  setParticipants([currentUser.uid]);
                } else {
                  setParticipants(memberList.map((m) => m.uid));
                }
              }}
              className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
            >
              {participants.length === memberList.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {memberList.map((member) => {
              const isSelected = participants.includes(member.uid);
              const equalShareMinor = isSelected && costMinor > 0
                ? calculateEqualShares(costMinor, participants)[member.uid] || 0
                : 0;

              return (
                <div
                  key={member.uid}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      : 'border-slate-100 dark:border-slate-800/60 opacity-60 bg-slate-50 dark:bg-slate-850'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleParticipant(member.uid)}
                    className="flex items-center gap-2.5 flex-1 text-left"
                  >
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-teal-500 border-teal-500 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <Avatar src={member.photoURL} name={member.displayName} size="xs" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {member.displayName}
                    </span>
                  </button>

                  {/* Share indicator or editable input */}
                  {isSelected && (
                    <div className="flex-shrink-0 ml-2">
                      {splitBy === 'equal' ? (
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-xl">
                          {formatCurrency(equalShareMinor, event.currency)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-400">
                            {event.currency === 'INR' ? '₹' : '$'}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={customSharesInput[member.uid] || ''}
                            onChange={(e) =>
                              setCustomSharesInput({
                                ...customSharesInput,
                                [member.uid]: e.target.value,
                              })
                            }
                            className="w-20 px-2 py-1 text-right text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Amount Split Validation status */}
          {splitBy === 'amount' && (
            <div
              className={`p-2 rounded-xl text-xs font-bold flex items-center justify-between ${
                amountValidation.isValid
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
              }`}
            >
              <span>Total allocated:</span>
              <span>
                {formatCurrency(
                  Object.values(customSharesMinor).reduce((a, b) => a + b, 0),
                  event.currency
                )}{' '}
                / {formatCurrency(costMinor, event.currency)}
                {!amountValidation.isValid && (
                  <span className="ml-1.5 underline">
                    ({amountValidation.differenceMinor > 0 ? 'Remaining: ' : 'Over: '}
                    {formatCurrency(Math.abs(amountValidation.differenceMinor), event.currency)})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Optional Comment */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Optional Note / Comment
          </label>
          <input
            type="text"
            placeholder="Add details, booking reference, receipt note..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={splitBy === 'amount' && !amountValidation.isValid}
          >
            {initialExpense ? 'Save Changes' : 'Add Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
