import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ScrollView,
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
}: TaskFeatureCarouselProps) {
    // Debug Log
    // console.log('[DEBUG_RENDER] TaskFeatureCarousel', { visible, hasUserColors: !!userColors, colorsCount: userColors?.length });
    const scrollViewRef = useRef<ScrollView>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageWidth, setPageWidth] = useState(SCREEN_WIDTH * 0.92); // default estimate

    // Measure actual container width
    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setPageWidth(w);
    }, []);

    // Scroll to initial feature on open
    useEffect(() => {
        if (visible) {
            const idx = FEATURE_ORDER.indexOf(initialFeature);
            const page = idx >= 0 ? idx : 0;
            setCurrentPage(page);
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ x: page * pageWidth, animated: false });
            }, 50);
        }
    }, [visible, initialFeature, pageWidth]);

    const handleScroll = (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        const page = Math.round(x / pageWidth);
        if (page !== currentPage && page >= 0 && page < FEATURE_ORDER.length) {
            setCurrentPage(page);
        }
    };

    const scrollToPage = (page: number) => {
        scrollViewRef.current?.scrollTo({ x: page * pageWidth, animated: true });
        setCurrentPage(page);
    };

    if (!visible) return null;

    return (
        <View style={s.container} onLayout={handleLayout}>
            {/* Tab Bar */}
            <View style={s.tabBar}>
                {FEATURE_ORDER.map((key, i) => {
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
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                scrollEventThrottle={16}
                bounces={false}
                style={{ flex: 1 }}
            >
                <DeadlinePage
                    width={pageWidth}
                    deadline={deadline}
                    onDeadlineChange={onDeadlineChange}
                    onClose={onClose}
                />
                <EstimatePage
                    width={pageWidth}
                    estimatedTime={estimatedTime}
                    onEstimateChange={onEstimateChange}
                    onClose={onClose}
                />
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
                <RecurrencePage
                    width={pageWidth}
                    recurrence={recurrence}
                    onRecurrenceChange={onRecurrenceChange}
                    onClose={onClose}
                />
                <ReminderPage
                    width={pageWidth}
                    reminderOffset={reminderOffset}
                    reminderTime={reminderTime}
                    reminderEnabled={reminderEnabled}
                    onReminderChange={onReminderChange}
                    onClose={onClose}
                />
            </ScrollView>
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
