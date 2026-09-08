import { useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '../i18n/i18n';

export function FieldHelp({ title, text }: { title: string; text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const trigger = (
    <button type="button" aria-label={t('fieldHelp.label', { title })} className="inline-flex shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <CircleHelp className="h-4 w-4" />
    </button>
  );
  const paragraphs = text.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[70] flex max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-2xl outline-none sm:w-[min(36rem,calc(100%-4rem))] lg:w-[40vw] lg:max-h-[80dvh]">
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-3 sm:px-6 sm:py-4">
            <CircleHelp aria-hidden="true" className="h-5 w-5 shrink-0 text-indigo-500" />
            <Dialog.Title className="min-w-0 flex-1 text-base font-semibold leading-snug text-gray-900">{title}</Dialog.Title>
            <Dialog.Close aria-label={t('common.close')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6 text-base font-normal leading-relaxed">
            {paragraphs}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
