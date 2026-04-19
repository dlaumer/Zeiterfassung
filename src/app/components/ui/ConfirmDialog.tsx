import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  variant?: 'warning' | 'danger';
}

const variantStyles = {
  warning: {
    iconContainer: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmButton: 'bg-amber-500 hover:bg-amber-600',
  },
  danger: {
    iconContainer: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmButton: 'bg-red-500 hover:bg-red-600',
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'warning',
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-100 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${styles.iconContainer}`}>
            <AlertTriangle className={`w-5 h-5 ${styles.iconColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 leading-tight">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-2.5 rounded-lg text-white transition-colors text-sm font-medium ${styles.confirmButton}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
