import { de, enUS } from 'date-fns/locale';
import type { Language } from './i18n';

export function getDateLocale(language: Language) {
  return language === 'de' ? de : enUS;
}
