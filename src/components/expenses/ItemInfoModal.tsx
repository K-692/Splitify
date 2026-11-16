import React from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { EventItem, ExpenseEntry, EventMember, UserProfile } from '@/types';
import { formatCurrency } from '@/utils/currency';
import { isFriendRequestOnCooldown } from '@/utils/cooldown';
import { UserPlus, Check, Clock, Calendar, PieChart, Info, Trash2, Edit2 } from 'lucide-react';

interface ItemInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: EventItem | ExpenseEntry | null;
  categoryName?: string;
  categoryEmoji?: string;
  currency: string;
  currentUser: UserProfile;
  eventMembers: Record<string, EventMember>;
  friendUids: Set<string>;
  pendingSentFriendRequestUids: Set<string>;
  onSendFriendRequest: (member: EventMember) => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ItemInfoModal: React.FC<ItemInfoModalProps> = ({
  isOpen,
  onClose,
  item,
  categoryName,
  categoryEmoji,
  currency,
  currentUser,
  eventMembers,
  friendUids,
  pendingSentFriendRequestUids,
  onSendFriendRequest,
  onEdit,
  onDelete,
}) => {
  if (!item) return null;

  const isCategoryItem = 'isCategory' in item && item.isCategory;
  const costMinor = item.costMinor || 0;
  const paidByUid = item.paidBy || '';
  const paidByMember = eventMembers[paidByUid];
  const participants = item.participants || [];
  const shares = item.shares || {};

  const getMemberHandle = (member?: EventMember | null, fallbackUid?: string): string => {
    if (!member) {
      if (!fallbackUid) return '@unknown';
      return fallbackUid.startsWith('@') ? fallbackUid : `@${fallbackUid}`;
    }
    if (member.username) {
      return member.username.startsWith('@') ? member.username : `@${member.username}`;
    }
    const cleanName = member.displayName ? member.displayName.toLowerCase().replace(/\s+/g, '_') : 'user';
    return `@${cleanName}`;
  };

  const formatDate = (timestamp?: number, dateStr?: string, timeStr?: string) => {
    if (dateStr) {
      const formattedDate = new Date(`${dateStr}T${timeStr || '12:00'}`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return timeStr ? `${formattedDate} at ${timeStr}` : formattedDate;
    }
    if (timestamp) {
      return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return 'Recent';
  };

  const renderFriendAction = (targetUid: string) => {
    if (targetUid === currentUser.uid) {
      return <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">You</span>;
    }
    if (friendUids.has(targetUid)) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
          <Check className="w-3 h-3" />
          Friend
        </span>
      );
    }
    if (pendingSentFriendRequestUids.has(targetUid) || isFriendRequestOnCooldown(targetUid)) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40">
          <Clock className="w-3 h-3" />
          Request sent
        </span>
      );
    }

    const member = eventMembers[targetUid];
    if (!member) return null;

    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={(e) => {
          e.stopPropagation();
          onSendFriendRequest(member);
        }}
        className="text-[11px] h-7 px-2"
        leftIcon={<UserPlus className="w-3 h-3 text-teal-600 dark:text-teal-400" />}
      >
        Add Friend
      </Button>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Item Details">
      <div className="space-y-5 text-slate-800 dark:text-slate-100">
        {/* Header Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 dark:from-slate-800/80 dark:to-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl p-2.5 rounded-xl bg-white dark:bg-slate-700 shadow-sm border border-slate-200/60 dark:border-slate-600/60 shrink-0">
              {item.emoji || '📦'}
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {item.name}
              </h3>
              {categoryName ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <span>{categoryEmoji || '📁'}</span>
                  <span>Category: {categoryName}</span>
                </p>
              ) : isCategoryItem ? (
                <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold mt-0.5">
                  Category Folder
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Standalone Item
                </p>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block">
              Total Amount
            </span>
            <span className="text-xl font-extrabold text-teal-600 dark:text-teal-400">
              {formatCurrency(costMinor, currency)}
            </span>
          </div>
        </div>

        {/* Date and Split Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Date</div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                {formatDate(item.createdAt, item.expenseDate, item.expenseTime)}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-center gap-2.5">
            <PieChart className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Split Mode</div>
              <div className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-200 truncate">
                {item.splitBy || 'Equal'}
              </div>
            </div>
          </div>
        </div>

        {/* Paid By Section */}
        {!isCategoryItem && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block mb-2">
              Paid By
            </span>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  src={paidByMember?.photoURL}
                  name={getMemberHandle(paidByMember, paidByUid)}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {getMemberHandle(paidByMember, paidByUid)}
                  </div>
                  {paidByMember?.displayName && (
                    <div className="text-[11px] text-slate-400 truncate">
                      {paidByMember.displayName}
                    </div>
                  )}
                </div>
              </div>
              {paidByUid && renderFriendAction(paidByUid)}
            </div>
          </div>
        )}

        {/* Participants Breakdown */}
        {!isCategoryItem && participants.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                Participants ({participants.length})
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Individual Share
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {participants.map((uid) => {
                const member = eventMembers[uid];
                const shareAmountMinor = shares[uid] !== undefined
                  ? shares[uid]
                  : Math.round(costMinor / participants.length);

                return (
                  <div
                    key={uid}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        src={member?.photoURL}
                        name={getMemberHandle(member, uid)}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {getMemberHandle(member, uid)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {renderFriendAction(uid)}
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(shareAmountMinor, currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comment / Note */}
        {item.comment && item.comment.trim() && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block mb-1">
              Notes
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {item.comment}
            </p>
          </div>
        )}

        {/* Metadata Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1 pt-1">
          <div className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            <span>
              Created by{' '}
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {item.createdByName?.startsWith('@')
                  ? item.createdByName
                  : item.createdByName
                  ? `@${item.createdByName.toLowerCase().replace(/\s+/g, '_')}`
                  : '@user'}
              </span>
            </span>
          </div>
          <span>ID: {item.id}</span>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onClose();
                  onDelete();
                }}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete
              </Button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
