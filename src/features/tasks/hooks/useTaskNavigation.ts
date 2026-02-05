import { useState, useMemo } from 'react';
import { ViewMode } from '../../../constants/theme';
import { generateDates } from '../../../utils/dateHelpers';

export const useTaskNavigation = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('3days');
    const [offset, setOffset] = useState(0);
    const [showViewPicker, setShowViewPicker] = useState(false);

    const dates = useMemo(() => generateDates(viewMode, offset), [viewMode, offset]);

    return {
        viewMode,
        setViewMode,
        offset,
        setOffset,
        showViewPicker,
        setShowViewPicker,
        dates
    };
};
