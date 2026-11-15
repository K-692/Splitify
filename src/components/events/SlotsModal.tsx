import React, { useState } from 'react';
import { SplitifyEvent, EventSlot } from '@/types';
import { useAuth } from '@/app/providers/AuthContext';
import { dataService } from '@/services/dataService';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { getFirstName } from '@/utils/name';
import {
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

interface SlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SplitifyEvent;
}

export const SlotsModal: React.FC<SlotsModalProps> = ({ isOpen, onClose, event }) => {
  const { user } = useAuth();
  const [personName, setPersonName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const isHost = event.hostUid === user.uid;
  const slotsList: EventSlot[] = Object.values(event.slots || {});
  const userMember = event.members[user.uid];
  const userHasClaimedSlot = Boolean(
    userMember?.slotId || slotsList.some((s) => s.claimedByUid === user.uid)
  );

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await dataService.createPersonSlot(event.id, personName.trim());
      setPersonName('');
    } catch (err: any) {
      setError(err.message || 'Failed to add person');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slotId: string, slotName: string) => {
    if (!confirm(`Remove placeholder for "${slotName}"?`)) return;
    try {
      await dataService.deletePersonSlot(event.id, slotId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete slot');
    }
  };

  const handleClaimSlot = async (slotId: string) => {
    try {
      await dataService.claimPersonSlot(event.id, slotId, user);
    } catch (err: any) {
      alert(err.message || 'Failed to claim slot');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="People"
      emoji="👥"
      maxWidth="md"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Expected participants who haven't registered or joined yet can be added here. When they
          join through an invite link, they can claim their spot!
        </p>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Inline Add Person Form */}
        <form onSubmit={handleAddPerson} className="flex gap-2">
          <input
            type="text"
            placeholder="Type person's name (e.g. Rahul, Priya)..."
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={submitting}
            className="text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Person
          </Button>
        </form>

        {/* People / Slots List */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Expected & Joined ({slotsList.length})
          </span>

          {slotsList.length === 0 ? (
            <div className="text-center py-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                No individual slots added yet.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Add people above to save placeholder spots for them.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {slotsList.map((slot) => {
                const claimedMember = slot.claimedByUid ? event.members[slot.claimedByUid] : null;
                const displayName = slot.isClaimed
                  ? claimedMember
                    ? getFirstName(claimedMember.displayName)
                    : slot.claimedByName || slot.placeholderName
                  : slot.placeholderName;

                return (
                  <div
                    key={slot.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      slot.isClaimed
                        ? 'border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={claimedMember?.photoURL}
                        name={displayName}
                        size="sm"
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {displayName}
                          </span>
                          {slot.isClaimed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Joined
                            </span>
                          )}
                          {!slot.isClaimed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {slot.isClaimed
                            ? `Claimed spot for "${slot.placeholderName}"`
                            : `Expected placeholder`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* If unclaimed and current user hasn't claimed yet, offer to claim */}
                      {!slot.isClaimed && !userHasClaimedSlot && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleClaimSlot(slot.id)}
                          className="text-[11px] font-bold text-teal-600 dark:text-teal-400"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1" />
                          Claim Spot
                        </Button>
                      )}

                      {/* Unclaimed slots can be deleted by host; claimed slots CANNOT be deleted */}
                      {!slot.isClaimed && isHost && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.id, slot.placeholderName)}
                          title="Delete Unclaimed Placeholder"
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
