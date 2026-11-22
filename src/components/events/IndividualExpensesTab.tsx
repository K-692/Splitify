import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Users, Layers } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { formatCurrency } from '@/utils/currency';
import { formatEntryDateTime } from '@/domain/calculations/paymentAllocation';
import {
  IndividualLedgerLine,
  groupLedgerBy,
  sumLedger,
} from '@/domain/calculations/individualLedger';

type GroupMode = 'names' | 'items';

interface IndividualExpensesTabProps {
  lines: IndividualLedgerLine[];
  /** Every person to list in "Names" mode, even if they have no entries yet */
  personUids: string[];
  currentUserUid: string;
  currency: string;
  getName: (uid: string) => string;
  getPhotoURL: (uid: string) => string | undefined;
}

const MODE_STORAGE_KEY = 'splitify_individual_group_mode';

const readStoredMode = (): GroupMode => {
  try {
    const v = localStorage.getItem(MODE_STORAGE_KEY);
    return v === 'items' ? 'items' : 'names';
  } catch {
    return 'names';
  }
};

/** Neutral (white in dark mode) amount with a small label, e.g. "Paid ₹130" / "Share ₹65". */
const LabeledAmount: React.FC<{ label: string; value: number; currency: string }> = ({ label, value, currency }) => (
  <span className="whitespace-nowrap">
    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mr-1">{label}</span>
    <span className="font-extrabold text-slate-900 dark:text-white">{formatCurrency(value, currency)}</span>
  </span>
);

interface PersonTotals {
  paidMinor: number;
  shareMinor: number;
  receivedMinor: number;
}

/** Paid out (expenses + settlements sent), own share of items, settlements received. */
const personTotals = (lines: IndividualLedgerLine[]): PersonTotals => {
  const t = { paidMinor: 0, shareMinor: 0, receivedMinor: 0 };
  for (const l of lines) {
    t.paidMinor += l.creditMinor;
    if (l.kind === 'settlement') t.receivedMinor += l.debitMinor;
    else t.shareMinor += l.debitMinor;
  }
  return t;
};

const TotalsStrip: React.FC<{ totals: PersonTotals; currency: string }> = ({ totals, currency }) => {
  const boxes = [
    { label: 'Paid', value: totals.paidMinor },
    { label: 'Share', value: totals.shareMinor },
    ...(totals.receivedMinor > 0 ? [{ label: 'Received', value: totals.receivedMinor }] : []),
  ];
  return (
    <div className={`grid ${boxes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5 text-center`}>
      {boxes.map((b) => (
        <div key={b.label} className="rounded-xl bg-slate-100 dark:bg-slate-800/80 px-1.5 py-1.5 min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {b.label}
          </span>
          <span className="block text-sm font-black text-slate-900 dark:text-white truncate">
            {formatCurrency(b.value, currency)}
          </span>
        </div>
      ))}
    </div>
  );
};

export const IndividualExpensesTab: React.FC<IndividualExpensesTabProps> = ({
  lines,
  personUids,
  currentUserUid,
  currency,
  getName,
  getPhotoURL,
}) => {
  const [mode, setModeState] = useState<GroupMode>(readStoredMode);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [currentUserUid]: true });

  const setMode = (m: GroupMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      /* storage unavailable — keep in-memory choice */
    }
  };

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const byPerson = useMemo(() => groupLedgerBy(lines, 'personUid'), [lines]);
  const byGroup = useMemo(() => groupLedgerBy(lines, 'groupId'), [lines]);

  const orderedPeople = useMemo(() => {
    const all = new Set<string>(personUids);
    for (const uid of byPerson.keys()) all.add(uid);
    const rest = [...all].filter((u) => u !== currentUserUid);
    rest.sort((a, b) => getName(a).localeCompare(getName(b)));
    return all.has(currentUserUid) ? [currentUserUid, ...rest] : rest;
    // getName is derived from event data, which also drives personUids/lines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personUids, byPerson, currentUserUid]);

  const nameWithYou = (uid: string) => `${getName(uid)}${uid === currentUserUid ? ' (You)' : ''}`;

  const renderPersonCard = (uid: string) => {
    const personLines = byPerson.get(uid) || [];
    const totals = personTotals(personLines);
    const isOpen = Boolean(expanded[uid]);

    return (
      <div
        key={uid}
        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => toggle(uid)}
          className="w-full p-3.5 text-left space-y-3"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar src={getPhotoURL(uid)} name={getName(uid)} size="sm" />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800 dark:text-white truncate">
                {nameWithYou(uid)}
              </span>
              <span className="block text-[11px] text-slate-400">
                {personLines.length} {personLines.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
          </div>
          <TotalsStrip totals={totals} currency={currency} />
        </button>

        {isOpen && (
          <div className="border-t border-slate-200/70 dark:border-slate-700/60 divide-y divide-slate-200/60 dark:divide-slate-700/50">
            {personLines.length === 0 ? (
              <p className="px-3.5 py-4 text-xs text-center text-slate-400">No expenses yet.</p>
            ) : (
              personLines.map((l) => {
                const payerLabel = (pid?: string) =>
                  pid === currentUserUid ? 'You' : getName(pid || '') || 'someone';
                const detail =
                  l.kind === 'settlement'
                    ? l.creditMinor > 0
                      ? `To ${getName(l.counterpartyUid || '')}`
                      : `From ${getName(l.counterpartyUid || '')}`
                    : `Paid by ${payerLabel(l.paidByUid)} · total ${formatCurrency(l.costMinor, currency)}`;
                return (
                  <div key={l.key} className="flex items-start gap-2.5 px-3.5 py-2.5 min-w-0">
                    <span className="text-lg leading-6 flex-shrink-0">{l.entryEmoji}</span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {l.entryName}
                        {l.isSubitem && (
                          <span className="font-semibold text-slate-400"> · {l.groupName}</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-slate-400 truncate">{detail}</span>
                      {l.occurredAt ? (
                        <span className="block text-[11px] text-slate-400 truncate">{formatEntryDateTime(l.occurredAt)}</span>
                      ) : null}
                      {l.settledPayments?.map((sp, i) => (
                        <span key={i} className="block text-[11px] font-semibold text-teal-600 dark:text-teal-400 break-words">
                          Paid {formatCurrency(sp.amountMinor, currency)} to {getName(sp.toUid)} · {formatEntryDateTime(sp.paidAt)}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-xs flex-shrink-0">
                      {l.creditMinor > 0 && <LabeledAmount label="Paid" value={l.creditMinor} currency={currency} />}
                      {l.debitMinor > 0 && (
                        <LabeledAmount
                          label={
                            l.kind === 'settlement' ? 'Received' : l.paidByUid === uid ? 'Own share' : 'Share'
                          }
                          value={l.debitMinor}
                          currency={currency}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const renderItemCard = (groupId: string, groupLines: IndividualLedgerLine[]) => {
    const first = groupLines[0];
    const isSettlements = first.kind === 'settlement';
    const isOpen = expanded[`g:${groupId}`] ?? true;
    const entryCosts = new Map<string, number>();
    for (const l of groupLines) entryCosts.set(l.entryId, l.costMinor);
    const totalCost = [...entryCosts.values()].reduce((a, b) => a + b, 0);
    const entryNames = [...new Set(groupLines.filter((l) => l.isSubitem).map((l) => l.entryName))];
    // Who originally paid for the item(s) — independent of later linked settlements
    const paidByTotals = new Map<string, number>();
    const countedEntries = new Set<string>();
    for (const l of groupLines) {
      if (l.kind !== 'expense' || !l.paidByUid || countedEntries.has(l.entryId)) continue;
      countedEntries.add(l.entryId);
      paidByTotals.set(l.paidByUid, (paidByTotals.get(l.paidByUid) || 0) + l.costMinor);
    }
    const payersLabel = [...paidByTotals.entries()]
      .map(([uid, amt]) =>
        paidByTotals.size === 1 ? getName(uid) : `${getName(uid)} ${formatCurrency(amt, currency)}`
      )
      .join(', ');

    const perPerson = groupLedgerBy(groupLines, 'personUid');
    // In the Settlements card, a person who paid for items also "paid" their own
    // share of those items — show it under Paid so the column adds up.
    const ownShareByPerson = new Map<string, number>();
    if (isSettlements) {
      for (const l of lines) {
        if (l.kind === 'expense' && l.paidByUid === l.personUid && l.debitMinor > 0) {
          ownShareByPerson.set(l.personUid, (ownShareByPerson.get(l.personUid) || 0) + l.debitMinor);
        }
      }
      for (const uid of ownShareByPerson.keys()) if (!perPerson.has(uid)) perPerson.set(uid, []);
    }
    const people = [...perPerson.keys()].sort((a, b) =>
      a === currentUserUid ? -1 : b === currentUserUid ? 1 : getName(a).localeCompare(getName(b))
    );

    return (
      <div
        key={groupId}
        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => ({ ...prev, [`g:${groupId}`]: !isOpen }))}
          className="w-full p-3.5 flex items-center gap-2.5 text-left min-w-0"
          aria-expanded={isOpen}
        >
          <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900/60 flex items-center justify-center text-lg flex-shrink-0">
            {first.groupEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-800 dark:text-white truncate">
              {first.groupName}
            </span>
            <span className="block text-[11px] text-slate-400 truncate">
              {isSettlements
                ? `${entryCosts.size} payment${entryCosts.size === 1 ? '' : 's'}`
                : entryNames.length > 0
                ? entryNames.join(', ')
                : formatEntryDateTime(first.occurredAt)}
            </span>
            {!isSettlements && payersLabel && (
              <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                Paid by {payersLabel}
              </span>
            )}
          </div>
          <span className="text-sm font-black text-slate-800 dark:text-white whitespace-nowrap flex-shrink-0">
            {formatCurrency(totalCost, currency)}
          </span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
        </button>

        {isOpen && (
          <div className="border-t border-slate-200/70 dark:border-slate-700/60">
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-x-2 px-3.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <span>Person</span>
              <span className="text-right">Paid</span>
              <span className="text-right">{isSettlements ? 'Received' : 'Share'}</span>
            </div>
            <div className="divide-y divide-slate-200/60 dark:divide-slate-700/50">
              {people.map((uid) => {
                const t = sumLedger(perPerson.get(uid) || []);
                return (
                  <div
                    key={uid}
                    className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-x-2 px-3.5 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar src={getPhotoURL(uid)} name={getName(uid)} size="xs" />
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                        {nameWithYou(uid)}
                      </span>
                    </div>
                    <span className="text-right font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {(() => {
                        const own = ownShareByPerson.get(uid) || 0;
                        const paid = t.creditMinor + own;
                        if (paid <= 0) return <span className="text-slate-400 font-bold">—</span>;
                        return (
                          <>
                            {formatCurrency(paid, currency)}
                            {own > 0 && (
                              <span className="block text-[10px] leading-tight font-semibold text-teal-600 dark:text-teal-400 whitespace-normal">
                                {t.creditMinor > 0 ? `incl. ${formatCurrency(own, currency)} own share` : 'own share'}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </span>
                    <span className="text-right font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {t.debitMinor > 0 ? formatCurrency(t.debitMinor, currency) : <span className="text-slate-400 font-bold">—</span>}
                      {!isSettlements && t.debitMinor > 0 && (perPerson.get(uid) || []).every((l) => l.paidByUid === uid) && (
                        <span className="block text-[10px] font-semibold text-teal-600 dark:text-teal-400">covered</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#15263C] rounded-3xl p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Individual Expenses</h3>
          <p className="text-xs text-slate-400">Who paid for what, and each person's share of it.</p>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex-shrink-0">
          {(
            [
              { id: 'names', label: 'Names', icon: <Users className="w-3.5 h-3.5" /> },
              { id: 'items', label: 'Items', icon: <Layers className="w-3.5 h-3.5" /> },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              aria-pressed={mode === opt.id}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mode === opt.id
                  ? 'bg-white dark:bg-[#15263C] text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        <strong className="text-slate-800 dark:text-white">Paid</strong> = money that person paid out ·{' '}
        <strong className="text-slate-800 dark:text-white">Share</strong> = their part of each item ·{' '}
        <strong className="text-slate-800 dark:text-white">Received</strong> = money paid back to them. Whoever pays for
        an item has their own share covered by that payment, so it is never owed.
      </p>

      {mode === 'names' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {orderedPeople.map(renderPersonCard)}
        </div>
      ) : byGroup.size === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">No expenses recorded yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {[...byGroup.entries()]
            .sort(([, a], [, b]) => Number(a[0].kind === 'settlement') - Number(b[0].kind === 'settlement'))
            .map(([gid, gl]) => renderItemCard(gid, gl))}
        </div>
      )}
    </div>
  );
};
