import { useEffect, useState, type FormEvent } from 'react';
import type PocketBase from 'pocketbase';
import { Clock3 } from 'lucide-react';
import { useI18n } from '../app/i18n/i18n';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../app/components/ui/dialog';

export function AdminSettingsDialog({ pb, open, onOpenChange }: { pb: PocketBase; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const [weeks, setWeeks] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    setWeeks('');
    setError('');
    setLoading(true);
    pb.send<{ reviewTimeWeeks: number }>('/api/admin/settings', { requestKey: null })
      .then(result => { if (active) setWeeks(String(result.reviewTimeWeeks)); })
      .catch(() => { if (active) setError('admin.settings.loadFailed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, pb]);

  const valid = weeks.trim() !== '' && Number.isInteger(Number(weeks)) && Number(weeks) >= 0 && Number(weeks) <= 5200;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || loading || saving) return;
    setSaving(true);
    setError('');
    try {
      await pb.send('/api/admin/settings', { method: 'PATCH', body: { reviewTimeWeeks: Number(weeks) } });
      onOpenChange(false);
    } catch {
      setError('admin.settings.saveFailed');
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
    <DialogContent className="bg-white sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{t('admin.settings.title')}</DialogTitle>
        <DialogDescription>{t('admin.settings.description')}</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="admin-review-period" className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <Clock3 aria-hidden="true" className="h-4 w-4 text-gray-400" />
            {t('admin.settings.reviewPeriod')}
          </label>
          <input id="admin-review-period" type="number" min="0" max="5200" step="1" required value={weeks} disabled={loading || saving} onChange={event => setWeeks(event.target.value)} aria-describedby="admin-review-period-help" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50" />
          <p id="admin-review-period-help" className="text-xs leading-relaxed text-gray-500">{t('admin.settings.reviewHelp')}</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{t(error)}</p>}
        <DialogFooter>
          <button type="button" disabled={saving} onClick={() => onOpenChange(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">{t('common.cancel')}</button>
          <button type="submit" disabled={!valid || loading || saving} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50">{t(saving ? 'admin.settings.saving' : 'admin.settings.save')}</button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
