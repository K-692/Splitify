import React, { useState } from 'react';
import { EyeOff, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { SplitifyEvent } from '@/types';
import { formatCurrency } from '@/utils/currency';

interface Props {
  events: SplitifyEvent[];
  totals: Record<string, number | undefined>;
  busyIds: Record<string, boolean>;
  onUnhide: (event: SplitifyEvent) => void;
  onOpen: (event: SplitifyEvent) => void;
}

export const HiddenEventsSection: React.FC<Props> = ({ events, totals, busyIds, onUnhide, onOpen }) => {
  const [open, setOpen] = useState(false);
  if (events.length === 0) return null;

  return (
    <section className="bg-white dark:bg-[#15263C] rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
          <EyeOff className="w-5 h-5 text-slate-500" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-slate-900 dark:text-white">Hidden events ({events.length})</span>
          <span className="block text-[11px] text-slate-400">Only hidden for you. Open one or unhide it to bring it back.</span>
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 px-4 py-3 min-w-0">
              <button type="button" onClick={() => onOpen(ev)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">
                  {ev.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{ev.name}</span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {Object.keys(ev.members || {}).length} member{Object.keys(ev.members || {}).length === 1 ? '' : 's'}
                    {totals[ev.id] !== undefined ? ` · ${formatCurrency(totals[ev.id] || 0, ev.currency)}` : ''}
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={busyIds[ev.id]}
                onClick={() => onUnhide(ev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-teal-500/40 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 disabled:opacity-50 flex-shrink-0"
              >
                <Eye className="w-3.5 h-3.5" /> Unhide
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
