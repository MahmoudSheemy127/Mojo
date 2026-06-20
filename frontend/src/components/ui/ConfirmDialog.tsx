// src/components/ui/ConfirmDialog.tsx
import { Modal } from './Modal';
import { ModalHeader } from './ModalHeader';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  /** Use the danger variant for destructive confirmations. */
  destructive?: boolean | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

/** Modal wrapper for confirming a (typically destructive) action. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} aria-label={title} className="max-w-sm">
      <ModalHeader title={title} onClose={onClose} />
      <div className="px-4 py-4">
        <p className="text-sm text-text-muted">{message}</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-bg-deepest px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
