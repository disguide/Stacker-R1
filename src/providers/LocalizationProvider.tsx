import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StorageService } from '../services/storage';
import { translations, LanguageCode, TranslationKeys } from '../localization/translations';

interface LocalizationContextType {
    language: LanguageCode;
    setLanguage: (lang: LanguageCode) => Promise<void>;
    t: (key: string) => string;
}

const LocalizationContext = createContext<LocalizationContextType>({
    language: 'en',
    setLanguage: async () => {},
    t: (key: string) => key,
});

export const useLocalization = () => useContext(LocalizationContext);

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<LanguageCode>('en');

    useEffect(() => {
        const loadLanguage = async () => {
            const settings = await StorageService.loadSprintSettings();
            if (settings.language && translations[settings.language as LanguageCode]) {
                setLanguageState(settings.language as LanguageCode);
            }
        };
        loadLanguage();
    }, []);

    const setLanguage = async (lang: LanguageCode) => {
        if (!translations[lang]) return;
        
        setLanguageState(lang);
        const settings = await StorageService.loadSprintSettings();
        await StorageService.saveSprintSettings({ ...settings, language: lang });
    };

    const t = useCallback((keyPath: string): string => {
        const keys = keyPath.split('.');
        let current: any = translations[language];

        for (const k of keys) {
            if (current[k] === undefined) {
                console.warn(`Translation missing for key: ${keyPath} in language: ${language}`);
                return keyPath; // Fallback to key if not found
            }
            current = current[k];
        }

        return current as string;
    }, [language]);

    return (
        <LocalizationContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LocalizationContext.Provider>
    );
};
