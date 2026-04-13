import { useState, useEffect, useCallback } from 'react';
import { StorageService, ColorDefinition, ColorSettings } from '../services/storage';

/**
 * Loads and caches the user's color definitions + auto-color preferences.
 *
 * Designed to be used from the task-creation layer so keyword matching
 * has access to the latest color palette without hitting AsyncStorage on
 * every keystroke.
 */
export function useAutoColor() {
    const [userColors, setUserColors] = useState<ColorDefinition[]>([]);
    const [colorSettings, setColorSettings] = useState<ColorSettings>({});
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            StorageService.loadUserColors(),
            StorageService.loadColorSettings(),
        ]).then(([colors, settings]) => {
            if (cancelled) return;
            setUserColors(colors);
            setColorSettings(settings);
            setReady(true);
        }).catch(e => {
            if (__DEV__) console.error('[useAutoColor] Failed to load color data', e);
            setReady(true); // Still mark ready so creation isn't blocked
        });

        return () => { cancelled = true; };
    }, []);

    /** Call this after the user saves their color palette so the hook stays in sync. */
    const refreshColors = useCallback(async () => {
        try {
            // Bust the in-memory cache so we re-read from storage
            StorageService._userColorsCache = null;
            const [colors, settings] = await Promise.all([
                StorageService.loadUserColors(),
                StorageService.loadColorSettings(),
            ]);
            setUserColors(colors);
            setColorSettings(settings);
        } catch (e) {
            if (__DEV__) console.error('[useAutoColor] Failed to refresh', e);
        }
    }, []);

    return { userColors, colorSettings, ready, refreshColors };
}
