import { useEffect, useState } from 'react';
import { Share } from 'lucide-react';
import { useI18n } from '../i18n/i18n';

export function ShareUrlButton() {
  const { t } = useI18n();
  const [message, setMessage] = useState<'copied' | 'failed'>();
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const copy = async () => {
    setCopying(true);
    setMessage(undefined);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage('copied');
    } catch {
      setMessage('failed');
    } finally {
      setCopying(false);
    }
  };

  return <div className="relative shrink-0">
    <button type="button" onClick={copy} disabled={copying}
      aria-label={t('share.copyUrl')} title={t('share.copyUrl')}
      className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50">
      <Share className="h-4 w-4" aria-hidden="true" />
    </button>
    <span role="status" aria-live="polite" aria-atomic="true"
      className={message ? `absolute right-0 top-full z-50 mt-2 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border bg-white px-3 py-2 text-sm shadow-lg ${message === 'failed' ? 'border-red-200 text-red-700' : 'border-gray-200 text-gray-700'}` : 'sr-only'}>
      {message ? t(message === 'copied' ? 'share.urlCopied' : 'share.copyFailed') : ''}
    </span>
  </div>;
}
