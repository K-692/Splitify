import React, { useState } from 'react';
import { SplitifyEvent, EventSlot } from '@/types';
import { useAuth } from '@/app/providers/AuthContext';
import { dataService } from '@/services/dataService';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import {
  Layers,
  Plus,
  Trash2,
  Check,
  LogOut,
  AlertCircle,
} from 'lucide-react';

interface SlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SplitifyEvent;
}

export const SlotsModal: React.FC<SlotsModalProps> = ({ isOpen, onClose, event }) => {
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const isHost = event.hostUid === user.uid;
  const slotsList: EventSlot[] = Object.values(event.slots || {});

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await dataService.createSlot(event.id, name.trim(), capacity || 4, description.trim());
      setName('');
      setDescription('');
      setCapacity(4);
      setShowAddForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create slot');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this slot? Members will become unassigned.')) return;
    try {
      await dataService.deleteSlot(event.id, slotId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete slot');
    }
  };

  const handleClaimSlot = async (slotId: string) => {
    try {
      await dataService.assignMemberToSlot(event.id, slotId, user.uid);
    } catch (err: any) {
      alert(err.message || 'Failed to claim slot');
    }
  };

  const handleLeaveSlot = async (slotId: string) => {
    try {
      await dataService.removeMemberFromSlot(event.id, slotId, user.uid);
    } catch (err: any) {
      alert(err.message || 'Failed to leave slot');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Slots & Groups"
      emoji="🚗"
      maxWidth="md"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Slots represent travel cars, hotel rooms, or sub-teams. When adding an expense, you can
          split with an entire slot in one click!
        </p>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action to show Add Slot Form */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Slots ({slotsList.length})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs font-bold text-teal-600 dark:text-teal-400"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {showAddForm ? 'Cancel' : 'Add New Slot'}
          </Button>
        </div>

        {/* Add Slot Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateSlot}
            className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 space-y-3"
          >
            <span className="text-xs font-bold text-teal-800 dark:text-teal-200 block">
              Create New Group Slot
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Slot name (e.g. Car 1, Room 101)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="sm:col-span-2 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                required
              />
              <input
                type="number"
                min={1}
                max={50}
                placeholder="Max Capacity"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 4)}
                className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                required
              />
            </div>

            <input
              type="text"
              placeholder="Optional description (e.g. Innova with Rahul driving)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />

            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting || !name.trim()}
              >
                {submitting ? 'Creating...' : 'Save Slot'}
              </Button>
            </div>
          </form>
        )}

        {/* Slots List */}
        {slotsList.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <Layers className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              No slots created yet
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Create slots like "Car 1", "Room 201" for organizing members.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {slotsList.map((slot) => {
              const assignedUids = slot.assignedMemberUids || [];
              const isUserInSlot = assignedUids.includes(user.uid);
              const isFull = assignedUids.length >= slot.maxCapacity;

              return (
                <div
                  key={slot.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {slot.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isFull
                              ? 'bg-rose-500/10 text-rose-500'
                              : 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                          }`}
                        >
                          {assignedUids.length} / {slot.maxCapacity} {isFull ? '(Full)' : 'spots'}
                        </span>
                      </div>
                      {slot.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{slot.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isUserInSlot ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleLeaveSlot(slot.id)}
                          className="!py-1 !px-2.5 text-xs text-amber-600 dark:text-amber-400"
                        >
                          <LogOut className="w-3 h-3 mr-1" />
                          Leave
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isFull}
                          onClick={() => handleClaimSlot(slot.id)}
                          className="!py-1 !px-2.5 text-xs"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Join
                        </Button>
                      )}

                      {isHost && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Delete slot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Member avatars in slot */}
                  {assignedUids.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <span className="text-[10px] font-bold text-slate-400">Members:</span>
                      <div className="flex items-center -space-x-1.5">
                        {assignedUids.map((uid) => {
                          const member = event.members[uid];
                          return (
                            <Avatar
                              key={uid}
                              src={member?.photoURL}
                              name={member?.displayName || uid}
                              size="xs"
                              className="ring-2 ring-white dark:ring-slate-800"
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-slate-500 truncate max-w-xs">
                        {assignedUids.map((uid) => event.members[uid]?.displayName || uid).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
