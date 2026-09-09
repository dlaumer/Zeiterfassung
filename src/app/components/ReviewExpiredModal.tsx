import { Clock3 } from 'lucide-react';
import { useI18n } from '../i18n/i18n';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

export function ReviewExpiredModal({ days, onClose }: { days: number; onClose: () => void }) {
  const { t } = useI18n();

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="rounded-2xl bg-white sm:max-w-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Clock3 aria-hidden="true" className="h-5 w-5" />
        </div>
        <DialogTitle>{t('dailyEntry.reviewExpiredTitle')}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-gray-600">
          {t('dailyEntry.reviewUnavailable', { days })}
        </DialogDescription>
        <button onClick={onClose} className="rounded-xl bg-indigo-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-600">
          {t('common.close')}
        </button>
      </DialogContent>
    </Dialog>
  );
}
