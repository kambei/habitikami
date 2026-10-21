import { en, type TranslationKey } from './en';
import { it } from './it';

export type Language = 'en' | 'it';

export const translations = { en, it } as const;

export function getInitialLanguage(): Language {
  const stored = localStorage.getItem('habitikami_language');
  if (stored === 'en' || stored === 'it') return stored;
  // Auto-detect from browser
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('it')) return 'it';
  return 'en';
}

/**
 * Translation outside React (mutation hooks' toasts). Reads the language the
 * provider would pick, so it matches the UI; `{name}` placeholders are
 * replaced from `params`.
 */
export function translate(key: TranslationKey, params: Record<string, string | number> = {}): string {
  const value = translations[getInitialLanguage()][key];
  const text = Array.isArray(value) ? value.join(', ') : (value as string);
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}
