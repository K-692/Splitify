import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { SplitifyEvent, ExpenseEntry, EventItem, SplitMode, UserProfile } from '@/types';
import { getEmojiForName } from '@/utils/emoji';
import { toMinorUnits, formatCurrency } from '@/utils/currency';
import {
  calculateEqualShares,
  distributeRemainingShares,
} from '@/domain/calculations/finance';
import { Avatar } from '@/components/common/Avatar';
import { getFirstName } from '@/utils/name';
import { getTodayLocalDateString } from '@/utils/date';
import { Check, AlertCircle, Calendar, Clock, Plus, Trash2, ArrowRight } from 'lucide-react';

export interface StagedSubitem {
  id: string;
  name: string;
  emoji: string;
  costMinor: number;
  paidBy: string;
  splitBy: SplitMode;
  participants: string[];
  customShares?: Record<string, number>;
  comment?: string;
  expenseDate: string;
  expenseTime?: string;
  occurredAt?: number;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SplitifyEvent;
  itemId?: string | null;
  currentUser: UserProfile;
  initialExpense?: ExpenseEntry | null;
  initialItem?: EventItem | null;
  title?: string;
  onSave: (data: {
    name: string;
    costMinor: number;
    paidBy: string;
    splitBy: SplitMode;
    participants: string[];
    customShares?: Record<string, number>;
    comment?: string;
    expenseDate?: string;
    expenseTime?: string;
    occurredAt?: number;
  }) => Promise<void>;
  onSaveCategoryWithSubitems?: (
    categoryName: string,
    subitems: Array<{
      name: string;
      costMinor: number;
      paidBy: string;
      splitBy: SplitMode;
      participants: string[];
      customShares?: Record<string, number>;
      comment?: string;
      expenseDate?: string;
      expenseTime?: string;
      occurredAt?: number;
    }>
  ) => Promise<void>;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  event,
  itemId,
  currentUser,
  initialExpense,
  initialItem,
  title,
  onSave,
  onSaveCategoryWithSubitems,
}) => {
  const isEditing = Boolean(initialExpense || initialItem);

  // List of assignable people: all joined members + all unclaimed expected person slots
  const assignablePeople = React.useMemo(() => {
    const list: Array<{
      id: string;
      displayName: string;
      photoURL?: string;
      isSlot: boolean;
      placeholderName?: string;
    }> = [];

    // Joined members
    for (const m of Object.values(event.members || {})) {
      list.push({
        id: m.uid,
        displayName: getFirstName(m.displayName),
        photoURL: m.photoURL,
        isSlot: false,
      });
    }

    // Unclaimed expected person slots
    for (const s of Object.values(event.slots || {})) {
      if (!s.isClaimed) {
        list.push({
          id: s.id,
          displayName: `${s.placeholderName} (Pending)`,
          photoURL: undefined,
          isSlot: true,
          placeholderName: s.placeholderName,
        });
      }
    }

    return list;
  }, [event.members, event.slots]);

  // Top checkbox: "Do you have subitems? ☑"
  const [hasSubitems, setHasSubitems] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [categoryName, setCategoryName] = useState('');
  const [categoryEmoji, setCategoryEmoji] = useState('📁');
  const [stagedSubitems, setStagedSubitems] = useState<StagedSubitem[]>([]);

  const getCurrentTimeString = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Subitem / Standalone expense fields
  const [name, setName] = useState('');
  const [costInput, setCostInput] = useState('');
  const [expenseDate, setExpenseDate] = useState(getTodayLocalDateString());
  const [expenseTime, setExpenseTime] = useState(getCurrentTimeString());
  const [paidBy, setPaidBy] = useState(currentUser.uid);
  const [splitBy, setSplitBy] = useState<SplitMode>('equal');
  const [participants, setParticipants] = useState<string[]>([]);
  const [customSharesInput, setCustomSharesInput] = useState<Record<string, string>>({});
  const [manualEditedUids, setManualEditedUids] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');
  const [emoji, setEmoji] = useState('📌');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setWizardStep(1);
    setStagedSubitems([]);

    const source = initialExpense || initialItem;
    if (source) {
      setHasSubitems(false);
      setName(source.name);
      setEmoji(source.emoji);
      setCostInput(((source.costMinor || 0) / 100).toString());
      setExpenseDate(source.expenseDate || getTodayLocalDateString());
      setExpenseTime(source.expenseTime || getCurrentTimeString());
      setPaidBy(source.paidBy || currentUser.uid);
      setSplitBy(source.splitBy || 'equal');
      setParticipants(source.participants && source.participants.length > 0
        ? source.participants
        : assignablePeople.map((p) => p.id));
      setComment(source.comment || '');

      const initialShares: Record<string, string> = {};
      const initialManual: Record<string, boolean> = {};
      if (source.shares) {
        for (const [uid, minor] of Object.entries(source.shares)) {
          initialShares[uid] = (minor / 100).toString();
          initialManual[uid] = true;
        }
      }
      setCustomSharesInput(initialShares);
      setManualEditedUids(initialManual);
    } else {
      setHasSubitems(false);
      setName('');
      setCategoryName('');
      setCategoryEmoji('📁');
      setEmoji('📌');
      setCostInput('');
      setExpenseDate(getTodayLocalDateString());
      setExpenseTime(getCurrentTimeString());
      setPaidBy(currentUser.uid);
      setSplitBy('equal');
      const allIds = assignablePeople.map((p) => p.id);
      setParticipants(allIds);
      setCustomSharesInput({});
      setManualEditedUids({});
      setComment('');
    }
  }, [isOpen, initialExpense, initialItem, currentUser.uid, assignablePeople]);

  // Update emoji on name change
  const handleNameChange = (val: string) => {
    setName(val);
    setEmoji(getEmojiForName(val));
  };

  const handleCategoryNameChange = (val: string) => {
    setCategoryName(val);
    setCategoryEmoji(getEmojiForName(val));
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

  // Compute validation and remaining amount distribution for custom shares
  const costMinor = toMinorUnits(costInput);

  const manualSharesMinor: Record<string, number> = {};
  for (const uid of participants) {
    if (manualEditedUids[uid]) {
      manualSharesMinor[uid] = toMinorUnits(customSharesInput[uid] || '0');
    }
  }

  const amountDistribution = distributeRemainingShares(costMinor, participants, manualSharesMinor);
  const customSharesMinor = amountDistribution.shares;
  const amountValidation = {
    isValid: amountDistribution.isValid,
    differenceMinor: amountDistribution.remainingMinor,
  };

  const handleShareInputChange = (uid: string, rawVal: string) => {
    if (rawVal.trim() === '') {
      const nextManual = { ...manualEditedUids };
      delete nextManual[uid];
      setManualEditedUids(nextManual);

      const nextInput = { ...customSharesInput };
      delete nextInput[uid];
      setCustomSharesInput(nextInput);
    } else {
      setManualEditedUids((prev) => ({ ...prev, [uid]: true }));
      setCustomSharesInput((prev) => ({ ...prev, [uid]: rawVal }));
    }
  };

  const handleResetShareToAuto = (uid: string) => {
    const nextManual = { ...manualEditedUids };
    delete nextManual[uid];
    setManualEditedUids(nextManual);

    const nextInput = { ...customSharesInput };
    delete nextInput[uid];
    setCustomSharesInput(nextInput);
  };

  // Stage a subitem into the category wizard
  const handleStageSubitem = () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a subitem name.');
      return false;
    }
    if (costMinor <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return false;
    }
    if (participants.length === 0) {
      setError('Please select at least one participant.');
      return false;
    }
    if (splitBy === 'amount' && !amountValidation.isValid) {
      setError('Custom shares sum must equal total subitem cost.');
      return false;
    }

    const occurredAt = new Date(`${expenseDate}T${expenseTime}`).getTime() || Date.now();
    const newSub: StagedSubitem = {
      id: 'staged_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      emoji,
      costMinor,
      paidBy,
      splitBy,
      participants,
      customShares: splitBy === 'amount' ? customSharesMinor : undefined,
      comment: comment.trim(),
      expenseDate,
      expenseTime,
      occurredAt,
    };

    setStagedSubitems((prev) => [...prev, newSub]);

    // Reset fields for the next subitem
    setName('');
    setCostInput('');
    setEmoji('📌');
    setComment('');
    setSplitBy('equal');
    setCustomSharesInput({});
    setManualEditedUids({});
    return true;
  };

  const handleRemoveStagedSubitem = (id: string) => {
    setStagedSubitems((prev) => prev.filter((s) => s.id !== id));
  };

  // Compute category total from staged items + current input if filled
  const totalCategoryCostMinor = stagedSubitems.reduce((sum, s) => sum + s.costMinor, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If Category flow
    if (hasSubitems && !isEditing) {
      if (wizardStep === 1) {
        if (!categoryName.trim()) {
          setError('Please enter a category name.');
          return;
        }
        setWizardStep(2);
        return;
      }

      // In step 2: if current input fields have a subitem, try staging it
      let finalSubs = [...stagedSubitems];
      if (name.trim() && costMinor > 0) {
        if (splitBy === 'amount' && !amountValidation.isValid) {
          setError('Custom shares sum must equal total subitem cost.');
          return;
        }
        const occurredAt = new Date(`${expenseDate}T${expenseTime}`).getTime() || Date.now();
        finalSubs.push({
          id: 'staged_' + Date.now(),
          name: name.trim(),
          emoji,
          costMinor,
          paidBy,
          splitBy,
          participants,
          customShares: splitBy === 'amount' ? customSharesMinor : undefined,
          comment: comment.trim(),
          expenseDate,
          expenseTime,
          occurredAt,
        });
      }

      if (finalSubs.length === 0) {
        setError('Please add at least one subitem to this category.');
        return;
      }

      setIsSubmitting(true);
      try {
        if (onSaveCategoryWithSubitems) {
          await onSaveCategoryWithSubitems(categoryName.trim(), finalSubs);
        } else {
          // Fallback if not supplied
          for (const sub of finalSubs) {
            await onSave({ ...sub });
          }
        }
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to save category');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Standalone expense flow
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

    const occurredAt = new Date(`${expenseDate}T${expenseTime}`).getTime() || Date.now();
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
        expenseDate,
        expenseTime,
        occurredAt,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = isEditing
    ? initialExpense
      ? 'Edit Subitem'
      : 'Edit Expense'
    : hasSubitems
    ? wizardStep === 1
      ? 'New Category'
      : `Add Subitems to "${categoryName}"`
    : itemId
    ? 'Add Subitem'
    : 'Add Expense';

  const modalEmoji = hasSubitems
    ? wizardStep === 1
      ? categoryEmoji
      : '📂'
    : emoji;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || modalTitle}
      emoji={modalEmoji}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Top Checkbox: Do you have subitems? (Shown only on fresh Add Expense) */}
        {!isEditing && !itemId && wizardStep === 1 && (
          <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="hasSubitemsCheckbox"
                checked={hasSubitems}
                onChange={(e) => setHasSubitems(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
              />
              <label
                htmlFor="hasSubitemsCheckbox"
                className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer select-none"
              >
                Do you have subitems?
              </label>
            </div>
            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
              {hasSubitems ? 'Category Mode' : 'Standalone Mode'}
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1 OF CATEGORY WIZARD: Enter Category Name */}
        {hasSubitems && !isEditing && wizardStep === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Category Name
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-lg select-none">{categoryEmoji}</span>
                <input
                  type="text"
                  placeholder="e.g. Food, Drinks, Hotel Stay, Flight, Transit"
                  value={categoryName}
                  onChange={(e) => handleCategoryNameChange(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Total category cost will calculate dynamically as you add individual subitems.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md">
                Continue to Subitems
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        ) : (
          /* STANDALONE EXPENSE OR STEP 2 OF CATEGORY WIZARD */
          <>
            {/* If in Category Step 2, show header banner with Category Total */}
            {hasSubitems && !isEditing && wizardStep === 2 && (
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{categoryEmoji}</span>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {categoryName}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {stagedSubitems.length} subitem(s) staged
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Category Total:</span>
                  <span className="text-sm font-black text-teal-600 dark:text-teal-400">
                    {formatCurrency(totalCategoryCostMinor + costMinor, event.currency)}
                  </span>
                </div>
              </div>
            )}

            {/* List of staged subitems in Category Mode */}
            {hasSubitems && stagedSubitems.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {stagedSubitems.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{sub.emoji}</span>
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {sub.name}
                      </span>
                      <span className="text-[10px] text-slate-400">({sub.expenseDate})</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-black text-slate-800 dark:text-slate-200">
                        {formatCurrency(sub.costMinor, event.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStagedSubitem(sub.id)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Subitem / Expense Name, Cost, and Calendar Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {hasSubitems ? 'Subitem Name' : 'Expense Name'}
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-lg select-none">{emoji}</span>
                  <input
                    type="text"
                    placeholder={hasSubitems ? 'e.g. Pizza, Drinks, Hotel Night 1' : 'e.g. Flight Tickets, Dinner, Hotel'}
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-500" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-500" />
                    Time
                  </label>
                  <input
                    type="time"
                    value={expenseTime}
                    onChange={(e) => setExpenseTime(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Paid By (Members + Expected People) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Paid by
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {assignablePeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setPaidBy(person.id)}
                    className={`flex items-center gap-2 p-2 rounded-2xl border text-left transition-all ${
                      paidBy === person.id
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <Avatar src={person.photoURL} name={person.displayName} size="xs" />
                    <div className="truncate">
                      <span className="text-xs font-bold truncate block">
                        {person.displayName} {person.id === currentUser.uid ? '(You)' : ''}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Split Mode */}
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

            {/* Participants Selection (Members + Expected People) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Participants ({participants.length}/{assignablePeople.length})
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (participants.length === assignablePeople.length) {
                      setParticipants([currentUser.uid]);
                    } else {
                      setParticipants(assignablePeople.map((p) => p.id));
                    }
                  }}
                  className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {participants.length === assignablePeople.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {assignablePeople.map((person) => {
                  const isSelected = participants.includes(person.id);
                  const equalShareMinor = isSelected && costMinor > 0
                    ? calculateEqualShares(costMinor, participants)[person.id] || 0
                    : 0;

                  return (
                    <div
                      key={person.id}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          : 'border-slate-100 dark:border-slate-800/60 opacity-60 bg-slate-50 dark:bg-slate-800/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleParticipant(person.id)}
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
                        <Avatar src={person.photoURL} name={person.displayName} size="xs" />
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {person.displayName}
                          </span>
                          {person.isSlot && (
                            <span className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold block">
                              Unclaimed spot
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Share indicator or editable input */}
                      {isSelected && (
                        <div className="flex-shrink-0 ml-2">
                          {splitBy === 'equal' ? (
                            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-xl">
                              {formatCurrency(equalShareMinor, event.currency)}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {manualEditedUids[person.id] ? (
                                <button
                                  type="button"
                                  onClick={() => handleResetShareToAuto(person.id)}
                                  className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 px-1.5 py-0.5 rounded-md transition-colors"
                                  title="Manually edited. Click to auto-split"
                                >
                                  Fixed ✕
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/15 px-1.5 py-0.5 rounded-md">
                                  Auto
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-400">
                                {event.currency === 'INR' ? '₹' : '$'}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={
                                  manualEditedUids[person.id]
                                    ? customSharesInput[person.id] ?? ''
                                    : costMinor > 0
                                    ? ((amountDistribution.shares[person.id] || 0) / 100).toFixed(2)
                                    : ''
                                }
                                onChange={(e) => handleShareInputChange(person.id, e.target.value)}
                                className={`w-24 px-2 py-1 text-right text-xs font-bold rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500 ${
                                  manualEditedUids[person.id]
                                    ? 'border-amber-400 dark:border-amber-600'
                                    : 'border-slate-200 dark:border-slate-700'
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Amount Split Summary (Section 7.4) */}
              {splitBy === 'amount' && (
                <div
                  className={`p-3.5 rounded-2xl text-xs space-y-1.5 border transition-all ${
                    amountDistribution.isValid
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-amber-50/80 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">Total:</span>
                    <span className="font-extrabold">{formatCurrency(costMinor, event.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">Assigned:</span>
                    <span className="font-extrabold">
                      {formatCurrency(amountDistribution.assignedTotalMinor, event.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-1.5">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">Remaining:</span>
                    <span
                      className={`font-black ${
                        amountDistribution.remainingMinor === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {formatCurrency(amountDistribution.remainingMinor, event.currency)}
                      {amountDistribution.remainingMinor !== 0 && (
                        <span className="ml-1 text-[11px] font-semibold">
                          ({amountDistribution.remainingMinor > 0 ? 'Short' : 'Exceeds by ' + formatCurrency(Math.abs(amountDistribution.remainingMinor), event.currency)})
                        </span>
                      )}
                    </span>
                  </div>
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
                placeholder="Add details, receipt note..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              {hasSubitems && !isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStageSubitem}
                    className="text-teal-600 dark:text-teal-400 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Another Subitem
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="md" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
                      Save Category
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-end gap-2 w-full">
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
                    {isEditing ? 'Save Changes' : 'Add Expense'}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
