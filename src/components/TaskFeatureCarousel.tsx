import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    FlatList,
    LayoutChangeEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RecurrenceRule, ColorDefinition } from '../services/storage';
import {
    THEME,
    FeatureKey,
    FEATURE_ORDER,
    FEATURE_ICONS,
    FEATURE_LABELS
} from './editor/constants';

import DeadlinePage from './editor/pages/DeadlinePage';
import PropertiesPage from './editor/pages/PropertiesPage';
import RecurrencePage from './editor/pages/RecurrencePage';
import ReminderPage from './editor/pages/ReminderPage';

// Helper component for lazy rendering pages
const LazyPage = ({ children, isRendered, width }: { children: React.ReactNode, isRendered: boolean, width: number }) => {
    if (!isRendered) {
        return <View style={{ width, flex: 1 }} />;
    }
    return <>{children}</>;
};

export type { FeatureKey };

const SCREEN_WIDTH = Dimensions.get('window').width;

interface TaskFeatureCarouselProps {
    visible: boolean;
    initialFeature: FeatureKey;
    // Current values
    deadline: string | null;
    estimatedTime: string | null;
    recurrence: RecurrenceRule | null;
    color: string | undefined;
    taskType: 'task' | 'event' | 'work' | 'chore' | 'habit' | undefined;
    importance: number;
    // Callbacks
    onDeadlineChange: (deadline: string | null) => void;
    onEstimateChange: (duration: string | null) => void;
    onRecurrenceChange: (rule: RecurrenceRule | null) => void;
    onColorChange: (color: string | undefined) => void;
    onTypeChange: (type: 'task' | 'event' | 'work' | 'chore' | 'habit') => void;
    onImportanceChange: (importance: number) => void;
    onReminderChange: (offset: number | null, time: string | null) => void;
    onClose: () => void;
    // Reminder values
    reminderOffset: number | null;
    reminderTime: string | null;
    reminderEnabled: boolean;
    // Color system
    userColors?: ColorDefinition[];
    onRequestColorSettings?: () => void;
    isSubtask?: boolean;
}

export default function TaskFeatureCarousel({
    visible,
    initialFeature,
    deadline,
    estimatedTime,
    recurrence,
    color,
    taskType,
    importance,
    onDeadlineChange,
    onEstimateChange,
    onRecurrenceChange,
    onColorChange,
    onTypeChange,
    onImportanceChange,
    onReminderChange,
    onClose,
    reminderOffset,
    reminderTime,
    reminderEnabled,
    userColors,
    onRequestColorSettings,
    isSubtask,
}: TaskFeatureCarouselProps) {
    // Debug Log
    // console.log('[DEBUG_RENDER] TaskFeatureCarousel', { visible, hasUserColors: !!userColors, colorsCount: userColors?.length });
    const flatListRef = useRef<FlatList>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageWidth, setPageWidth] = useState(0); // Start at 0 to delay render until measured

    const activeFeatures = isSubtask
        ? FEATURE_ORDER.filter(f => f !== 'recurrence' && f !== 'reminder')
        : FEATURE_ORDER;

    // Measure actual container width
    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== pageWidth) setPageWidth(w);
    }, [pageWidth]);

    const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

    const extendedFeatures = [
        activeFeatures[activeFeatures.length - 1], 
        ...activeFeatures,
        activeFeatures[0] 
    ];

    useEffect(() => {
        if (visible && pageWidth > 0) {
            const idx = activeFeatures.indexOf(initialFeature);
            const page = idx >= 0 ? idx : 0;
            setCurrentPage(page);
            setRenderedPages(new Set([page]));
            
            // Only scroll once we have a width
            setTimeout(() => {
                 flatListRef.current?.scrollToIndex({ index: page + 1, animated: false });
            }, 0);
        } else if (!visible) {
            setRenderedPages(new Set());
        }
    }, [visible, initialFeature, pageWidth]); // Added pageWidth dependency so it fires when layout is ready

    // Load remaining pages in background once visible and measured
    useEffect(() => {
        if (!visible || pageWidth === 0) return;
        if (renderedPages.size > 0 && renderedPages.size < activeFeatures.length) {
            const timer = setTimeout(() => {
                setRenderedPages(prev => {
                    const next = new Set(prev);
                    for (let i = 0; i < activeFeatures.length; i++) {
                        if (!next.has(i)) {
                            next.add(i);
                        }
                    }
                    return next;
                });
            }, 300); // Increased delay slightly to avoid blocking initial animation
            return () => clearTimeout(timer);
        }
    }, [visible, renderedPages, pageWidth]);

    const handleScroll = (e: any) => {
        if (pageWidth === 0) return;
        const x = e.nativeEvent.contentOffset.x;
        
        // Ignore wild, un-initialized scroll values
        if (x < 0) return;

        const visualPage = Math.round(x / pageWidth);
        
        let realPage = visualPage - 1;
        if (realPage < 0) realPage = activeFeatures.length - 1; 
        if (realPage >= activeFeatures.length) realPage = 0; 

        if (realPage !== currentPage) {
            setCurrentPage(realPage);
            setRenderedPages(prev => new Set(prev).add(realPage));
        }
    };

    const scrollToPage = (page: number, animated: boolean = true) => {
        if (pageWidth === 0) return;
        setRenderedPages(prev => new Set(prev).add(page));
        flatListRef.current?.scrollToIndex({ index: page + 1, animated });
        setCurrentPage(page);
    };

    const handleMomentumScrollEnd = (e: any) => {
        if (pageWidth === 0) return;
        const xOffset = e.nativeEvent.contentOffset.x;
        const visualPage = Math.round(xOffset / pageWidth);
        
        let realPage = visualPage - 1;
        if (realPage < 0) realPage = activeFeatures.length - 1; 
        if (realPage >= activeFeatures.length) realPage = 0; 

        if (realPage !== currentPage) {
            setCurrentPage(realPage);
            setRenderedPages(prev => new Set(prev).add(realPage));
        }

        if (visualPage === 0) {
            flatListRef.current?.scrollToIndex({ index: activeFeatures.length, animated: false });
        }
        else if (visualPage === extendedFeatures.length - 1) {
            flatListRef.current?.scrollToIndex({ index: 1, animated: false });
        }
    };

    if (!visible) return null;

    return (
        <View style={s.container} onLayout={handleLayout}>
            {pageWidth > 0 && (
                <>
                    {/* Tab Bar */}
                    <View style={s.tabBar}>
                        {activeFeatures.map((key, i) => {
                            const isActive = currentPage === i;
                            const icon = FEATURE_ICONS[key];
                            return (
                                <TouchableOpacity
                                    key={key}
                                    style={[s.tab, isActive && s.tabActive]}
                                    onPress={() => scrollToPage(i)}
                                >
                                    <MaterialCommunityIcons
                                        name={icon.name as any}
                                        size={16}
                                        color={isActive ? THEME.textPrimary : THEME.textSecondary}
                                    />
                                    <Text style={[s.tabText, isActive && s.tabTextActive]}>
                                        {FEATURE_LABELS[key]}
                                    </Text>
                                    {isActive && <View style={s.tabIndicator} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Pages */}
                    <FlatList
                        ref={flatListRef}
                        data={extendedFeatures}
                        keyExtractor={(item, index) => `${item}-${index}`}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        onMomentumScrollEnd={handleMomentumScrollEnd}
                        onScrollEndDrag={handleMomentumScrollEnd}
                        scrollEventThrottle={16}
                        bounces={false}
                        style={{ flex: 1 }}
                        initialScrollIndex={activeFeatures.indexOf(initialFeature) >= 0 ? activeFeatures.indexOf(initialFeature) + 1 : 1}
                        getItemLayout={(_, index) => ({
                            length: pageWidth,
                            offset: pageWidth * index,
                            index,
                        })}
                        renderItem={({ item, index }) => {
                    // Determine logical page index from visual index
                    let logicalIndex = index - 1;
                    if (logicalIndex < 0) logicalIndex = activeFeatures.length - 1;
                    if (logicalIndex >= activeFeatures.length) logicalIndex = 0;
                    
                    const isRendered = renderedPages.has(logicalIndex);

                    return (
                        <LazyPage isRendered={isRendered} width={pageWidth}>
                            {item === 'deadline' && (
                                <DeadlinePage
                                    width={pageWidth}
                                    deadline={deadline}
                                    onDeadlineChange={onDeadlineChange}
                                    onClose={onClose}
                                />
                            )}
                            {item === 'properties' && (
                                <PropertiesPage
                                    width={pageWidth}
                                    color={color}
                                    taskType={taskType}
                                    importance={importance}
                                    estimatedTime={estimatedTime}
                                    onColorChange={onColorChange}
                                    onTypeChange={onTypeChange}
                                    onImportanceChange={onImportanceChange}
                                    onEstimateChange={onEstimateChange}
                                    userColors={userColors}
                                    onRequestColorSettings={onRequestColorSettings}
                                    onClose={onClose}
                                />
                            )}
                            {item === 'recurrence' && (
                                <RecurrencePage
                                    width={pageWidth}
                                    recurrence={recurrence}
                                    onRecurrenceChange={onRecurrenceChange}
                                    onClose={onClose}
                                />
                            )}
                            {item === 'reminder' && (
                                <ReminderPage
                                    width={pageWidth}
                                    reminderOffset={reminderOffset}
                                    reminderTime={reminderTime}
                                    reminderEnabled={reminderEnabled}
                                    onReminderChange={onReminderChange}
                                    onClose={onClose}
                                />
                            )}
                        </LazyPage>
                    );
                }}
            />
                </>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
        backgroundColor: '#FFF',
        paddingTop: 2,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        position: 'relative',
    },
    tabActive: {},
    tabText: {
        fontSize: 10,
        fontWeight: '600',
        color: THEME.textSecondary,
        marginTop: 2,
    },
    tabTextActive: {
        color: THEME.textPrimary,
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        width: '60%',
        height: 3,
        backgroundColor: THEME.green,
        borderRadius: 1.5,
    },
});
