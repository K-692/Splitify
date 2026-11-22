import React from 'react';
import { EyeOff, ChevronRight, SearchX } from 'lucide-react';
import { HomeSearchResult } from '@/domain/search/homeSearch';
import { SplitifyEvent } from '@/types';
import { formatCurrency } from '@/utils/currency';
import { Highlight } from './Highlight';

interface Props {
  query: string;
  result: HomeSearchResult;
  loadingItems: boolean;
  onOpenEvent: (event: SplitifyEvent) => void;
  onOpenItem: (event: SplitifyEvent, itemName: string) => void;
  getPersonName: (event: SplitifyEvent, uid: string) => string;
}

const formatDate = (ts: number) =>
  ts ? new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const HiddenBadge = () => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
    <EyeOff className="w-3 h-3" /> Hidden
  </span>
);

export const HomeSearchResults: React.FC<Props> = ({ query, result, loadingItems, onOpenEvent, onOpenItem, getPersonName }) => {
  const total = result.events.length + result.items.length;

  if (total === 0) {
    return (
      <div className="text-center py-12 px-6 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
        <SearchX className="w-8 h-8 mx-auto text-slate-400 mb-3" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No matches for "{query.trim()}"</p>
        <p className="text-xs text-slate-400 mt-1">
          {loadingItems ? 'Still loading expenses — results may appear shortly.' : 'Try an event name, an item, a category, a note or a person.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {result.events.length > 0 && (
        <section aria-label="Matching events">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Events · {result.events.length}
          </h2>
          <div className="bg-white dark:bg-[#15263C] rounded-3xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {result.events.map(({ event, hidden, itemMatches }) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onOpenEvent(event)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors min-w-0"
              >
                <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl flex-shrink-0">
                  {event.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      <Highlight text={event.name} query={query} />
                    </span>
                    {hidden && <HiddenBadge />}
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {Object.keys(event.members || {}).length} member{Object.keys(event.members || {}).length === 1 ? '' : 's'}
                    {itemMatches > 0 ? ` · ${itemMatches} matching item${itemMatches === 1 ? '' : 's'}` : ''}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {result.items.length > 0 && (
        <section aria-label="Matching items">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Items · {result.items.length}
          </h2>
          <div className="bg-white dark:bg-[#15263C] rounded-3xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {result.items.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onOpenItem(m.event, m.name)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors min-w-0"
              >
                <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl flex-shrink-0">
                  {m.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                    <Highlight text={m.name} query={query} />
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400 min-w-0">
                    <span className="truncate">
                      {`${m.event.emoji} `}{m.categoryName ? <><Highlight text={m.categoryName} query={query} /> · </> : null}
                      {m.event.name}
                    </span>
                    {m.hidden && <HiddenBadge />}
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {m.paidBy ? (
                      <>
                        Paid by{' '}
                        {m.matchedOn === 'payer' ? (
                          <Highlight text={getPersonName(m.event, m.paidBy)} query={query} />
                        ) : (
                          getPersonName(m.event, m.paidBy)
                        )}
                      </>
                    ) : (
                      'Category'
                    )}
                    {m.occurredAt ? ` · ${formatDate(m.occurredAt)}` : ''}
                    {m.matchedOn === 'comment' ? ' · matched in note' : ''}
                  </span>
                </span>
                {m.costMinor > 0 && (
                  <span className="text-sm font-black text-slate-900 dark:text-white whitespace-nowrap flex-shrink-0">
                    {formatCurrency(m.costMinor, m.event.currency)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
