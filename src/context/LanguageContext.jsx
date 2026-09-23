import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('kb-language') || 'en');

  useEffect(() => {
    localStorage.setItem('kb-language', language);
    document.documentElement.lang = language === 'kn' ? 'kn' : 'en';
  }, [language]);

  const value = useMemo(() => {
    function t(key) {
      return translations[language]?.[key] || translations.en[key] || key;
    }

    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguage((current) => (current === 'en' ? 'kn' : 'en')),
      t
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}
