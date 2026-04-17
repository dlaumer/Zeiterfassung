import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import translations from './translations.json';

export type Language = 'en' | 'de';

type TranslationDictionary = Record<string, Record<Language, string>>;

const LANGUAGE_COOKIE = 'workload-lang';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const dictionary = translations as TranslationDictionary;

const getCookieLanguage = (): Language => {
  if (typeof document === 'undefined') {
    return 'en';
  }

  const cookieValue = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${LANGUAGE_COOKIE}=`))
    ?.split('=')[1];

  return cookieValue === 'de' ? 'de' : 'en';
};

const saveCookieLanguage = (language: Language) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
};

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (id: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getCookieLanguage());

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    saveCookieLanguage(nextLanguage);
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
