import { Clock3, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

export function ReviewExpiredModal({ days, onClose, onDelete }: { days: number; onClose: () => void; onDelete: () => Promise<void> }) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const deleteEntry = async () => {
    if (deleting) return;
    setDeleting(true);
    setFailed(false);
    try { await onDelete(); } catch { setFailed(true); }
    finally { setDeleting(false); }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !deleting) onClose(); }}>
      <DialogContent className="rounded-2xl bg-white sm:max-w-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Clock3 aria-hidden="true" className="h-5 w-5" />
        </div>
        <DialogTitle>{t('dailyEntry.reviewExpiredTitle')}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-gray-600">
          {t('dailyEntry.reviewUnavailable', { days })}
        </DialogDescription>
        {failed && <p role="alert" className="text-sm text-red-600">{t('dailyEntry.deleteFailed')}</p>}
        <div className="flex flex-col gap-2">
          <button disabled={deleting} onClick={deleteEntry} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50">
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {t('dailyEntry.delete')}
          </button>
          <button disabled={deleting} onClick={onClose} className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-500 px-4 font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50">
            {t('common.close')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
