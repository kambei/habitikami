import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { it } from './it';

export type Language = 'en' | 'it';

const translations = { en, it } as const;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  tArray: (key: TranslationKey) => string[];
  locale: string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('habitikami_language');
  if (stored === 'en' || stored === 'it') return stored;
  // Auto-detect from browser
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('it')) return 'it';
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('habitikami_language', lang);
    // Update the HTML lang attribute
    document.documentElement.lang = lang;
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    const value = translations[language][key];
    if (Array.isArray(value)) return value.join(', ');
    return value as string;
  }, [language]);

  const tArray = useCallback((key: TranslationKey): string[] => {
    const value = translations[language][key];
    if (Array.isArray(value)) return value as string[];
    return [value as string];
  }, [language]);

  const locale = language === 'it' ? 'it-IT' : 'en-US';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tArray, locale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
