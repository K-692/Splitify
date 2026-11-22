import React, { useEffect, useRef, useState } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  emoji?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  emoji,
  children,
  maxWidth = 'md',
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const contentRef = useRef<HTMLDivElement>(null);
  // Tracks the *visible* viewport so the modal stays above the iOS/Android keyboard
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);

    const vv = window.visualViewport;
    const syncViewport = () => {
      if (vv) setViewport({ height: vv.height, top: vv.offsetTop });
    };
    syncViewport();
    vv?.addEventListener('resize', syncViewport);
    vv?.addEventListener('scroll', syncViewport);

    // When a field gets focus, keep it visible inside the modal's own scroll area
    const content = contentRef.current;
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !content?.contains(target)) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      window.setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    };
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      unlockBodyScroll();
      window.removeEventListener('keydown', handleKeyDown);
      vv?.removeEventListener('resize', syncViewport);
      vv?.removeEventListener('scroll', syncViewport);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center p-3 sm:p-6 overscroll-none"
      style={{
        height: viewport ? `${viewport.height}px` : '100dvh',
        transform: viewport ? `translateY(${viewport.top}px)` : undefined,
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full ${maxWidths[maxWidth]} bg-white dark:bg-[#15263C] rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-6 z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-full flex flex-col`}
      >
        {/* Header */}
        {(title || emoji) && (
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              {emoji && (
                <span className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-2xl shadow-inner">
                  {emoji}
                </span>
              )}
              {title && (
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {title}
                </h3>
              )}
            </div>
            <button
              onClick={onClose}
              data-modal-close="true"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="modal-scroll overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 pr-1"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
