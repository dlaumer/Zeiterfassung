import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useI18n } from './i18n';

const LANGUAGE_OPTIONS = [
  {
    value: 'en' as const,
    abbreviation: 'EN',
    flagSrc: 'https://flagcdn.com/gb.svg',
    flagAlt: 'United Kingdom flag',
  },
  {
    value: 'de' as const,
    abbreviation: 'DE',
    flagSrc: 'https://flagcdn.com/de.svg',
    flagAlt: 'German flag',
  },
];

interface LanguageSelectorProps {
  menuAlign?: 'left' | 'right';
}

export function LanguageSelector({ menuAlign = 'right' }: LanguageSelectorProps) {
  const { t, language, setLanguage } = useI18n();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const selectedLanguageOption = LANGUAGE_OPTIONS.find((option) => option.value === language) ?? LANGUAGE_OPTIONS[0];

  return (
    <div className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setShowLanguageMenu((isOpen) => !isOpen)}
        aria-haspopup="listbox"
        aria-expanded={showLanguageMenu}
        className="inline-flex h-9 min-w-[4.5rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:text-sm"
      >
        <img
          src={selectedLanguageOption.flagSrc}
          alt={selectedLanguageOption.flagAlt}
          className="h-3.5 w-5 rounded-sm object-cover"
        />
        <span>{selectedLanguageOption.abbreviation}</span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {showLanguageMenu && (
        <div
          role="listbox"
          aria-label={t('language.label')}
          className={`absolute top-full z-20 mt-1 w-24 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={language === option.value}
              onClick={() => {
                setLanguage(option.value);
                setShowLanguageMenu(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors md:text-sm ${
                language === option.value
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <img
                src={option.flagSrc}
                alt={option.flagAlt}
                className="h-3.5 w-5 rounded-sm object-cover"
              />
              {option.abbreviation}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
