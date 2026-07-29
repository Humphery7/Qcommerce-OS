import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-surface-container-lowest border border-outline-variant rounded-lg shadow-elevated w-full max-w-md flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
          <h2 className="text-[14px] font-semibold text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-0.5 rounded hover:bg-surface-container text-secondary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="px-4 py-3 overflow-y-auto">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-outline-variant flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
