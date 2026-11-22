import React from 'react';
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { AllocatableShare, formatEntryDateTime, fitSelection } from '@/domain/calculations/paymentAllocation';
import { formatCurrency } from '@/utils/currency';

interface Props {
  candidates: AllocatableShare[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  amountMinor: number;
  currency: string;
  receiverUid: string;
  getPersonName: (uid: string) => string;
}

/** Optional: link a payment to the items (with the payer's share) that it covers. */
export const PaymentItemPicker: React.FC<Props> = ({
  candidates,
  selected,
  onChange,
  amountMinor,
  currency,
  receiverUid,
  getPersonName,
}) => {
  const [open, setOpen] = React.useState(false);
  const selectedTotal = candidates.filter((c) => selected.has(c.entryId)).reduce((a, c) => a + c.remainingMinor, 0);
  const remaining = Math.max(0, amountMinor - selectedTotal);
  const selectable = candidates.filter((c) => selected.has(c.entryId) || c.remainingMinor <= remaining);
  const allFittingSelected = candidates.length > 0 && fitSelection(candidates, amountMinor).size === selected.size && selected.size > 0;
  const nameCounts = candidates.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.name.toLowerCase()]: (acc[c.name.toLowerCase()] || 0) + 1 }), {});

  const toggle = (c: AllocatableShare) => {
    const next = new Set(selected);
    if (next.has(c.entryId)) next.delete(c.entryId);
    else if (c.remainingMinor <= remaining) next.add(c.entryId);
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-3 text-left bg-slate-50 dark:bg-slate-800/60"
      >
        <Link2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-slate-800 dark:text-white">Link to items (optional)</span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {selected.size > 0
              ? `${selected.size} item${selected.size === 1 ? '' : 's'} · ${formatCurrency(selectedTotal, currency)} linked`
              : 'Choose which of your shares this payment covers'}
          </span>
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {candidates.length === 0 ? (
            <p className="p-3 text-xs text-slate-400 text-center">No unsettled shares to link.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-900/40 text-xs">
                <label className="inline-flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-teal-600"
                    checked={allFittingSelected}
                    onChange={(e) => onChange(e.target.checked ? fitSelection(candidates, amountMinor) : new Set())}
                  />
                  Select all
                </label>
                <span className="font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Remaining{' '}
                  <span className={remaining === 0 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-900 dark:text-white'}>
                    {formatCurrency(remaining, currency)}
                  </span>{' '}
                  of {formatCurrency(amountMinor, currency)}
                </span>
              </div>
              <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {candidates.map((c) => {
                  const isSelected = selected.has(c.entryId);
                  const disabled = !isSelected && !selectable.includes(c);
                  const duplicateName = nameCounts[c.name.toLowerCase()] > 1;
                  return (
                    <li key={c.entryId}>
                      <label
                        className={`flex items-start gap-2.5 px-3 py-2.5 text-xs ${
                          disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 w-4 h-4 accent-teal-600 flex-shrink-0"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => toggle(c)}
                        />
                        <span className="text-base leading-4 flex-shrink-0">{c.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-slate-800 dark:text-slate-100 truncate">
                            {c.name}
                            {c.categoryName && <span className="font-semibold text-slate-400"> · {c.categoryName}</span>}
                          </span>
                          <span className={`block text-[11px] truncate ${duplicateName ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-400'}`}>
                            {formatEntryDateTime(c.occurredAt)}
                          </span>
                          <span className="block text-[11px] text-slate-400 truncate">
                            Paid by {getPersonName(c.paidByUid || '')}{c.paidByUid === receiverUid ? ' (receiver)' : ''}
                            {c.alreadyLinkedMinor > 0 ? ` · ${formatCurrency(c.alreadyLinkedMinor, currency)} already paid` : ''}
                            {disabled ? ' · more than remaining' : ''}
                          </span>
                        </span>
                        <span className="text-right flex-shrink-0">
                          <span className="block font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(c.remainingMinor, currency)}
                          </span>
                          <span className="block text-[10px] text-slate-400 uppercase tracking-wide">Your share</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};
