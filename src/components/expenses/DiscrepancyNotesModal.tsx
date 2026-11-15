import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { DiscrepancyNote, UserProfile } from '@/types';
import { formatTimeAgo } from '@/utils/date';
import { Send, Trash2, MessageSquare, AlertCircle } from 'lucide-react';

interface DiscrepancyNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryName: string;
  notes: DiscrepancyNote[];
  currentUser: UserProfile;
  onAddNote: (text: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export const DiscrepancyNotesModal: React.FC<DiscrepancyNotesModalProps> = ({
  isOpen,
  onClose,
  entryName,
  notes,
  currentUser,
  onAddNote,
  onDeleteNote,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onAddNote(trimmed);
      setText('');
    } catch (err: any) {
      setError(err?.message || 'Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      setDeletingId(noteId);
      setError(null);
      await onDeleteNote(noteId);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete note');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Discrepancy Notes" emoji="📝" maxWidth="md">
      <div className="space-y-4">
        {/* Entry indicator */}
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Entry:</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{entryName}</span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Notes list */}
        <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
          {notes.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
              <MessageSquare className="w-8 h-8 opacity-40 text-slate-400" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">No discrepancy notes yet</p>
              <p className="max-w-xs text-[11px] text-slate-400">
                Notice an issue with the amount, split shares, or paid status? Leave a note for other members to review.
              </p>
            </div>
          ) : (
            notes.map((note) => {
              const isAuthor = note.authorUid === currentUser.uid;
              const isDeleting = deletingId === note.id;

              return (
                <div
                  key={note.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar src={note.authorPhotoURL} name={note.authorName} size="xs" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {note.authorName}
                        {isAuthor && (
                          <span className="ml-1 text-[10px] font-semibold text-teal-600 dark:text-teal-400">(You)</span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        • {formatTimeAgo(note.createdAt)}
                      </span>
                    </div>

                    {isAuthor && (
                      <button
                        onClick={() => handleDelete(note.id)}
                        disabled={isDeleting}
                        title="Delete note"
                        className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap pl-8">
                    {note.text}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Leave a note if you found any discrepancy..."
              maxLength={500}
              rows={3}
              className="w-full text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none font-medium"
            />
            <span className="absolute bottom-2 right-2 text-[10px] text-slate-400 pointer-events-none">
              {text.length}/500
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Visible to all event members
            </span>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!text.trim() || isSubmitting}
              className="flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Posting...' : 'Post Note'}</span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
