import { useState, useCallback, useEffect } from 'react';
import { StorageService } from '../../../services/storage';
import { ViewMode } from '../../../constants/theme';
import { useTaskNavigation } from '../../tasks/hooks/useTaskNavigation';

// Module-level cache: survives screen unmount/remount (e.g. returning from Sprint).
// Prevents the "declump flash" caused by isClumped initializing to false on every mount.
let _cachedIsClumped = false;
let _cachedSortOption: string | null = null;
let _cacheLoaded = false;

export function useHomeState() {
    const {
        viewMode, setViewMode,
        offset, setOffset,
        showViewPicker, setShowViewPicker,
        dates
    } = useTaskNavigation();

    const [isReorderMode, setIsReorderMode] = useState(false);
    // Initialize from cache so the value is correct synchronously on remount (e.g. after Sprint)
    const [isClumped, setIsClumped] = useState(_cachedIsClumped);
    const [isSprintSelectionMode, setIsSprintSelectionMode] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isOrganizeMenuVisible, setIsOrganizeMenuVisible] = useState(false);
    const [organizeMenuAnchor, setOrganizeMenuAnchor] = useState<{ pageX: number; pageY: number; width: number; height: number } | null>(null);
    const [viewMenuAnchor, setViewMenuAnchor] = useState<{ pageX: number; pageY: number; width: number; height: number } | null>(null);

    // Sort option state — also initialized from cache
    const [sortOption, setSortOption] = useState<string | null>(_cachedSortOption);

    // 1. Load preferences on mount — only hits storage on the very first mount.
    // Subsequent mounts (e.g. returning from Sprint) read from module-level cache synchronously.
    useEffect(() => {
        if (_cacheLoaded) return; // Already warm — no async needed
        if (__DEV__) console.log('[useHomeState] First mount: Loading UI preferences from storage...');
        StorageService.loadUIState().then(state => {
            _cacheLoaded = true;
            if (state) {
                if (__DEV__) console.log('[useHomeState] Received preferences:', state);
                _cachedIsClumped = state.isClumped ?? false;
                _cachedSortOption = state.sortOption ?? null;
                if (state.isClumped !== undefined) setIsClumped(state.isClumped);
                if (state.sortOption !== undefined) setSortOption(state.sortOption);
            } else {
                if (__DEV__) console.log('[useHomeState] No preferences found in storage.');
            }
        });
    }, []);

    // 2. Sync changes back to storage AND the module-level cache
    const setIsClumpedWithSave = useCallback((val: boolean) => {
        _cachedIsClumped = val;
        _cacheLoaded = true;
        setIsClumped(val);
        StorageService.saveUIState({ isClumped: val });
    }, []);

    const setSortOptionWithSave = useCallback((val: string | null) => {
        _cachedSortOption = val;
        _cacheLoaded = true;
        setSortOption(val);
        StorageService.saveUIState({ sortOption: val });
    }, []);

    const switchViewMode = useCallback((mode: ViewMode) => {
        setViewMode(mode);
        setOffset(0);
        setShowViewPicker(false);
    }, [setViewMode, setOffset, setShowViewPicker]);

    return {
        viewMode,
        switchViewMode,
        offset,
        setOffset,
        showViewPicker,
        setShowViewPicker,
        dates,
        isClumped,
        setIsClumped: setIsClumpedWithSave,
        isReorderMode,
        setIsReorderMode,
        isSprintSelectionMode,
        setIsSprintSelectionMode,
        isMenuVisible,
        setIsMenuVisible,
        isOrganizeMenuVisible,
        setIsOrganizeMenuVisible,
        organizeMenuAnchor,
        setOrganizeMenuAnchor,
        viewMenuAnchor,
        setViewMenuAnchor,
        sortOption,
        setSortOption: setSortOptionWithSave
    };
}
