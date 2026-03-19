import { useState, useCallback } from 'react';
import { ViewMode } from '../../../constants/theme';
import { useTaskNavigation } from '../../tasks/hooks/useTaskNavigation';

export function useHomeState() {
    const {
        viewMode, setViewMode,
        offset, setOffset,
        showViewPicker, setShowViewPicker,
        dates
    } = useTaskNavigation();

    const [isReorderMode, setIsReorderMode] = useState(false);
    const [isClumped, setIsClumped] = useState(false);
    const [isSprintSelectionMode, setIsSprintSelectionMode] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isOrganizeMenuVisible, setIsOrganizeMenuVisible] = useState(false);
    const [organizeMenuAnchor, setOrganizeMenuAnchor] = useState<{ pageX: number; pageY: number; width: number; height: number } | null>(null);

    // Sort option state
    const [sortOption, setSortOption] = useState<string | null>(null);

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
        setIsClumped,
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
        sortOption,
        setSortOption
    };
}
