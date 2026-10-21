import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { TranslationKey } from './en';
import { translations, getInitialLanguage, type Language } from './core';

export type { Language } from './core';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  tArray: (key: TranslationKey) => string[];
  locale: string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('habitikami_language', lang);
  }, []);

  // Keep <html lang> in sync (index.html ships lang="en"): screen readers,
  // hyphenation and translation prompts follow the app language.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

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
