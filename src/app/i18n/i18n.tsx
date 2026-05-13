import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import translations from './translations.json';

export type Language = 'en' | 'de';

type TranslationDictionary = Record<string, Record<Language, string>>;

const LANGUAGE_COOKIE = 'workload-lang';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const dictionary = translations as TranslationDictionary;

const isLanguage = (value: string | null | undefined): value is Language => {
  return value === 'en' || value === 'de';
};

const getUrlLanguage = (): Language | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const urlLanguage = new URLSearchParams(window.location.search).get('lang');
  return isLanguage(urlLanguage) ? urlLanguage : null;
};

const getCookieLanguage = (): Language | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieValue = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${LANGUAGE_COOKIE}=`))
    ?.split('=')[1];

  return isLanguage(cookieValue) ? cookieValue : null;
};

const getInitialLanguage = (): Language => {
  return getUrlLanguage() ?? getCookieLanguage() ?? 'de';
};

const saveCookieLanguage = (language: Language) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
};

const saveUrlLanguage = (language: Language) => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('lang', language);
  window.history.replaceState(window.history.state, '', url);
};

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (id: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getInitialLanguage());

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    saveCookieLanguage(nextLanguage);
    saveUrlLanguage(nextLanguage);
  };

  const t = (id: string, params?: Record<string, string | number>): string => {
    const baseTranslation = dictionary[id]?.[language] ?? dictionary[id]?.en ?? id;

    if (!params) {
      return baseTranslation;
    }

    return Object.entries(params).reduce((result, [key, value]) => {
      return result.replaceAll(`{{${key}}}`, String(value));
    }, baseTranslation);
  };

  const value = useMemo(() => ({ language, setLanguage, t }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
