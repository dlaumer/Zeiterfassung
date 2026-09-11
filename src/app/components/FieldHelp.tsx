import { useState } from 'react';
import { CircleHelp, Star, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '../i18n/i18n';

function renderEmphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
      : part.startsWith('*') && part.endsWith('*') && part.length > 2
      ? <em key={index} className="italic">{part.slice(1, -1)}</em>
      : part,
  );
}

export function FieldHelp({ title, text, triggerLabel }: { title: string; text: string; triggerLabel?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const trigger = (
    <button type="button" aria-label={t('fieldHelp.label', { title })} className={triggerLabel ? 'rounded-sm [font-size:inherit] underline underline-offset-2 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500' : 'inline-flex shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'}>
      {triggerLabel ?? <CircleHelp className="h-4 w-4" />}
    </button>
  );
  const paragraphs = text.split('\n\n').map((paragraph, index) => {
    const example = paragraph.match(/^\[(battery|stars):([135])\]\s*/);
    if (!example) return <p key={index}>{renderEmphasis(paragraph)}</p>;
    const level = Number(example[2]);
    const isBattery = example[1] === 'battery';
    return (
      <div key={index} className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
        {isBattery ? (
          <svg role="img" aria-label={t(`socialBattery.level${level}`)} viewBox="0 0 66 28" className="h-7 w-[66px]">
            <rect x="1.5" y="1.5" width="58" height="25" rx="5" fill="white" stroke="#374151" strokeWidth="2.5" />
            <rect x="61" y="9" width="5" height="10" rx="1.5" fill="#374151" />
            {['#d94f5c', '#e78086', '#a1b7aa', '#6abf8c', '#2ca468'].map((color, segment) => (
              <rect key={color} x={6 + segment * 10} y="6" width="8" height="16" rx="2" fill={color} opacity={segment < level ? 1 : 0.15} />
            ))}
          </svg>
        ) : (
          <div role="img" aria-label={`${t('dailyEntry.reliability')}: ${level}/5`} className="flex gap-1">
            {Array.from({ length: level }, (_, star) => <Star key={star} aria-hidden="true" className="h-5 w-5 fill-amber-400 text-amber-400" />)}
          </div>
        )}
        <p>{renderEmphasis(paragraph.slice(example[0].length))}</p>
      </div>
    );
  });

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
