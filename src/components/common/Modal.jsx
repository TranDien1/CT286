import React, { useEffect } from 'react';

// Hộp thoại: đóng bằng nút ở chân hộp thoại, phím Esc hoặc bấm ra ngoài.
export default function Modal({ isOpen, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="o-modal-overlay" onClick={onClose}>
      <div className={`o-modal o-modal-${size}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="o-modal-header"><h3>{title}</h3></div>
        <div className="o-modal-body">{children}</div>
        {footer && <div className="o-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ isOpen, title, message, confirmLabel, danger, onConfirm, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <button type="button" className="o-btn o-btn-secondary" onClick={onClose}>Không</button>
          <button type="button" className={`o-btn ${danger ? 'o-btn-danger' : 'o-btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      )}
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}
