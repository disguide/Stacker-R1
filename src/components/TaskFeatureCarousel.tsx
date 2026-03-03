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
import EstimatePage from './editor/pages/DurationPage';
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
    const [pageWidth, setPageWidth] = useState(SCREEN_WIDTH * 0.92); // default estimate

    const activeFeatures = isSubtask
        ? FEATURE_ORDER.filter(f => f !== 'recurrence' && f !== 'reminder')
        : FEATURE_ORDER;

    // Measure actual container width
    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setPageWidth(w);
    }, []);

    const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

    // Set initial page state and derived offset without delay
    useEffect(() => {
        if (visible) {
            const idx = activeFeatures.indexOf(initialFeature);
            const page = idx >= 0 ? idx : 0;
            setCurrentPage(page);
            setRenderedPages(new Set([page]));
        } else {
            // Clear rendered memory when closed so next time it opens fast
            setRenderedPages(new Set());
        }
    }, [visible, initialFeature]);

    // Automatically load remaining pages slightly after the initial render
    // This gives the "instant open" feel of lazy loading, but ensures they are 
    // ready in the background before the user swipes.
    useEffect(() => {
        if (!visible) return;
        if (renderedPages.size > 0 && renderedPages.size < activeFeatures.length) {
            const timer = setTimeout(() => {
                setRenderedPages(prev => {
                    const next = new Set(prev);
                    // Find first unrendered page and add it
                    for (let i = 0; i < activeFeatures.length; i++) {
                        if (!next.has(i)) {
                            next.add(i);
                            break;
                        }
                    }
                    return next;
                });
            }, 100); // 100ms stagger between background page renders
            return () => clearTimeout(timer);
        }
    }, [visible, renderedPages]);

    const handleScroll = (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        const page = Math.round(x / pageWidth);
        if (page !== currentPage && page >= 0 && page < activeFeatures.length) {
            setCurrentPage(page);
            setRenderedPages(prev => new Set(prev).add(page));
        }
    };

    const scrollToPage = (page: number) => {
        setRenderedPages(prev => new Set(prev).add(page));
        flatListRef.current?.scrollToIndex({ index: page, animated: true });
        setCurrentPage(page);
    };

    if (!visible) return null;

    return (
        <View style={s.container} onLayout={handleLayout}>
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
                data={activeFeatures}
                keyExtractor={(item) => item}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                bounces={false}
                style={{ flex: 1 }}
                initialScrollIndex={activeFeatures.indexOf(initialFeature) >= 0 ? activeFeatures.indexOf(initialFeature) : 0}
                getItemLayout={(_, index) => ({
                    length: pageWidth,
                    offset: pageWidth * index,
                    index,
                })}
                renderItem={({ item, index }) => {
                    const isRendered = renderedPages.has(index);
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
                            {item === 'estimate' && (
                                <EstimatePage
                                    width={pageWidth}
                                    estimatedTime={estimatedTime}
                                    onEstimateChange={onEstimateChange}
                                    onClose={onClose}
                                />
                            )}
                            {item === 'properties' && (
                                <PropertiesPage
                                    width={pageWidth}
                                    color={color}
                                    taskType={taskType}
                                    importance={importance}
                                    onColorChange={onColorChange}
                                    onTypeChange={onTypeChange}
                                    onImportanceChange={onImportanceChange}
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
