import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ScrollView,
    TextInput,
    FlatList,
    Platform,
    LayoutChangeEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RecurrenceRule, RecurrenceFrequency, WeekDay, ColorDefinition } from '../services/storage';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Theme Constants
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    accent: '#007AFF',
    border: '#E2E8F0',
    surface: '#FFFFFF',
    green: '#38A169',
};

// ─── Shared Types ───────────────────────────────────────────────────────────

export type FeatureKey = 'deadline' | 'estimate' | 'properties' | 'recurrence' | 'reminder';

const FEATURE_ORDER: FeatureKey[] = ['deadline', 'estimate', 'properties', 'recurrence', 'reminder'];

const FEATURE_LABELS: Record<FeatureKey, string> = {
    deadline: 'Deadline',
    estimate: 'Estimate',
    properties: 'Properties',
    recurrence: 'Repeat',
    reminder: 'Remind',
};

const FEATURE_ICONS: Record<FeatureKey, { name: string; lib: 'mci' | 'ion' }> = {
    deadline: { name: 'calendar-clock', lib: 'mci' },
    estimate: { name: 'timer-outline', lib: 'mci' },
    properties: { name: 'tag-outline', lib: 'mci' },
    recurrence: { name: 'repeat', lib: 'mci' },
    reminder: { name: 'bell-outline', lib: 'mci' },
};

// ─── Calendar Helpers ───────────────────────────────────────────────────────

const ROW_HEIGHT = 38;
const HEADER_HEIGHT = 40;

interface CalendarMonthData {
    date: Date;
    height: number;
    offset: number;
}

// ─── Recurrence Constants ───────────────────────────────────────────────────

const FREQUENCIES: { label: string; value: RecurrenceFrequency }[] = [
    { label: 'Day', value: 'daily' },
    { label: 'Week', value: 'weekly' },
    { label: 'Month', value: 'monthly' },
    { label: 'Year', value: 'yearly' },
];

const WEEKDAYS: { label: string; value: WeekDay }[] = [
    { label: 'M', value: 'MO' },
    { label: 'T', value: 'TU' },
    { label: 'W', value: 'WE' },
    { label: 'T', value: 'TH' },
    { label: 'F', value: 'FR' },
    { label: 'S', value: 'SA' },
    { label: 'S', value: 'SU' },
];

// ─── Reminder Constants ─────────────────────────────────────────────────────

// Wheel Picker Constants
const WP_ITEM_HEIGHT = 50;
const WP_WHEEL_HEIGHT = WP_ITEM_HEIGHT * 5;
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

// ─── Props ──────────────────────────────────────────────────────────────────

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
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

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
}: TaskFeatureCarouselProps) {
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

// ═══════════════════════════════════════════════════════════════════════════
// BOTTOM ACTION BAR — shared across all pages
// ═══════════════════════════════════════════════════════════════════════════

function ActionBar({ onReset, onConfirm, hasValue }: {
    onReset: () => void;
    onConfirm: () => void;
    hasValue: boolean;
}) {
    return (
        <View style={p.actionBar}>
            <TouchableOpacity
                style={[p.actionBtn, p.resetBtn, !hasValue && { opacity: 0.4 }]}
                onPress={onReset}
                disabled={!hasValue}
            >
                <MaterialCommunityIcons name="close" size={18} color="#EF4444" />
                <Text style={p.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[p.actionBtn, p.confirmBtn]} onPress={onConfirm}>
                <Ionicons name="checkmark" size={18} color="#FFF" />
                <Text style={p.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED WHEEL PICKER
// ═══════════════════════════════════════════════════════════════════════════

const WheelPicker = ({ items, selectedValue, onChange, formatLabel }: {
    items: number[]; selectedValue: number; onChange: (val: number) => void; formatLabel?: (val: number) => string;
}) => {
    const scrollRef = useRef<ScrollView>(null);
    const momentumStarted = useRef(false);
    const isUserScrolling = useRef(false);
    const lastSyncedValue = useRef<number | null>(null);
    const needsInitialScroll = useRef(true);

    useEffect(() => {
        if (needsInitialScroll.current) return;
        const index = items.indexOf(selectedValue);
        if (index >= 0 && selectedValue !== lastSyncedValue.current && !isUserScrolling.current) {
            lastSyncedValue.current = selectedValue;
            setTimeout(() => {
                scrollRef.current?.scrollTo({ y: index * WP_ITEM_HEIGHT, animated: true });
            }, 50);
        }
    }, [selectedValue, items]);

    const handleScrollEnd = (e: any) => {
        isUserScrolling.current = false;
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / WP_ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        const newValue = items[clampedIndex];
        if (newValue !== undefined && newValue !== selectedValue) {
            lastSyncedValue.current = newValue;
            onChange(newValue);
        }
        momentumStarted.current = false;
    };

    return (
        <View style={{ height: WP_WHEEL_HEIGHT, width: 70 }}>
            <View style={{
                position: 'absolute', top: WP_ITEM_HEIGHT * 2, height: WP_ITEM_HEIGHT, width: '100%',
                borderTopWidth: 1, borderBottomWidth: 1, borderColor: THEME.border,
                backgroundColor: 'rgba(0,0,0,0.02)', pointerEvents: 'none', zIndex: 10,
            }} />
            <ScrollView
                ref={scrollRef}
                nestedScrollEnabled={true}
                snapToInterval={WP_ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: WP_ITEM_HEIGHT * 2 }}
                onContentSizeChange={() => {
                    if (needsInitialScroll.current) {
                        needsInitialScroll.current = false;
                        const index = items.indexOf(selectedValue);
                        if (index >= 0) {
                            lastSyncedValue.current = selectedValue;
                            scrollRef.current?.scrollTo({ y: index * WP_ITEM_HEIGHT, animated: false });
                        }
                    }
                }}
                onScrollBeginDrag={() => { isUserScrolling.current = true; momentumStarted.current = false; }}
                onMomentumScrollBegin={() => { momentumStarted.current = true; }}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={(e) => {
                    e.persist();
                    setTimeout(() => { if (!momentumStarted.current) handleScrollEnd(e); }, 50);
                }}
            >
                {items.map((item, index) => {
                    const isSelected = item === selectedValue;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={{ height: WP_ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => {
                                isUserScrolling.current = true;
                                lastSyncedValue.current = item;
                                scrollRef.current?.scrollTo({ y: index * WP_ITEM_HEIGHT, animated: true });
                                onChange(item);
                                setTimeout(() => { isUserScrolling.current = false; }, 300);
                            }}
                        >
                            <Text style={{
                                fontSize: isSelected ? 24 : 18,
                                fontWeight: isSelected ? 'bold' : '400',
                                color: isSelected ? THEME.textPrimary : THEME.textSecondary,
                                opacity: isSelected ? 1 : 0.6,
                            }}>
                                {formatLabel ? formatLabel(item) : item.toString().padStart(2, '0')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// TIME WHEEL PANEL — shared between Deadline and Reminder
// ═══════════════════════════════════════════════════════════════════════════

function TimeWheelPanel({ hour, minute, onHourChange, onMinuteChange }: {
    hour: number; minute: number;
    onHourChange: (h: number) => void; onMinuteChange: (m: number) => void;
}) {
    const isPm = hour >= 12;
    const display12h = hour % 12 || 12;

    const handleHourWheel = (h12: number) => {
        const h24 = isPm ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
        onHourChange(h24);
    };

    const toggleAmPm = () => {
        onHourChange(isPm ? hour - 12 : hour + 12);
    };

    const h12 = hour % 12 || 12;
    const period = hour >= 12 ? 'PM' : 'AM';
    const timeStr = `${h12}:${String(minute).padStart(2, '0')} ${period}`;

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' }}>
            <Text style={{ fontSize: 14, color: THEME.textSecondary, fontWeight: '600', marginBottom: 8 }}>Set Time</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: THEME.green, marginBottom: 16 }}>{timeStr}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <WheelPicker
                    items={HOURS_12}
                    selectedValue={display12h}
                    onChange={handleHourWheel}
                    formatLabel={(v) => v.toString()}
                />
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: THEME.textPrimary, paddingBottom: 6 }}>:</Text>
                <WheelPicker
                    items={MINUTES_60}
                    selectedValue={minute}
                    onChange={onMinuteChange}
                    formatLabel={(v) => v.toString().padStart(2, '0')}
                />
                {/* AM/PM toggle */}
                <View style={{ marginLeft: 8, gap: 6 }}>
                    <TouchableOpacity
                        style={[{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', backgroundColor: '#F8FAFC' }, !isPm && { backgroundColor: THEME.green, borderColor: THEME.green }]}
                        onPress={() => { if (isPm) toggleAmPm(); }}
                    >
                        <Text style={[{ fontSize: 16, fontWeight: 'bold', color: THEME.textSecondary }, !isPm && { color: '#FFF' }]}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', backgroundColor: '#F8FAFC' }, isPm && { backgroundColor: THEME.green, borderColor: THEME.green }]}
                        onPress={() => { if (!isPm) toggleAmPm(); }}
                    >
                        <Text style={[{ fontSize: 16, fontWeight: 'bold', color: THEME.textSecondary }, isPm && { color: '#FFF' }]}>PM</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 0: DEADLINE (Date + optional Time overlay)
// ═══════════════════════════════════════════════════════════════════════════

function DeadlinePage({ width, deadline, onDeadlineChange, onClose }: {
    width: number;
    deadline: string | null;
    onDeadlineChange: (dl: string | null) => void;
    onClose: () => void;
}) {
    const calListRef = useRef<FlatList>(null);
    const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
    const [hasTime, setHasTime] = useState(false);
    const [showTimeWheel, setShowTimeWheel] = useState(false);
    const [tempHour, setTempHour] = useState(9);
    const [tempMinute, setTempMinute] = useState(0);

    useEffect(() => {
        if (deadline) {
            try {
                if (deadline.includes('T')) {
                    const d = new Date(deadline);
                    if (!isNaN(d.getTime())) {
                        setTempSelectedDate(d);
                        setHasTime(true);
                        setTempHour(d.getHours());
                        setTempMinute(d.getMinutes());
                    }
                } else if (deadline.match(/^\d{2}:\d{2}$/)) {
                    const [h, m] = deadline.split(':').map(Number);
                    setHasTime(true);
                    setTempHour(h);
                    setTempMinute(m);
                    setTempSelectedDate(null);
                } else {
                    const parts = deadline.split('-');
                    if (parts.length >= 3) {
                        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        if (!isNaN(d.getTime())) setTempSelectedDate(d);
                    }
                    setHasTime(false);
                }
            } catch {
                setTempSelectedDate(null);
                setHasTime(false);
            }
        } else {
            setTempSelectedDate(null);
            setHasTime(false);
        }
    }, [deadline]);

    const colWidth = (width - 48) / 7;

    const months = useMemo(() => {
        const result: CalendarMonthData[] = [];
        const start = new Date();
        start.setDate(1);
        let currentOffset = 0;
        for (let i = 0; i < 24; i++) {
            const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
            const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const firstDay = (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7;
            const weeks = Math.ceil((daysInMonth + firstDay) / 7);
            const height = HEADER_HEIGHT + (weeks * ROW_HEIGHT);
            result.push({ date: d, height, offset: currentOffset });
            currentOffset += height;
        }
        return result;
    }, []);

    const handleDateSelect = (d: Date) => { setTempSelectedDate(d); };

    // ─── Auto-save: apply changes to parent immediately ─────────────
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        if (tempSelectedDate) {
            const yyyy = tempSelectedDate.getFullYear();
            const mm = String(tempSelectedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(tempSelectedDate.getDate()).padStart(2, '0');
            if (hasTime) {
                const hh = String(tempHour).padStart(2, '0');
                const min = String(tempMinute).padStart(2, '0');
                onDeadlineChange(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
            } else {
                onDeadlineChange(`${yyyy}-${mm}-${dd}`);
            }
        } else if (hasTime) {
            const hh = String(tempHour).padStart(2, '0');
            const min = String(tempMinute).padStart(2, '0');
            onDeadlineChange(`${hh}:${min}`);
        }
    }, [tempSelectedDate, hasTime, tempHour, tempMinute]);

    const handleReset = () => {
        setTempSelectedDate(null);
        setHasTime(false);
        setShowTimeWheel(false);
        setTempHour(9);
        setTempMinute(0);
        onDeadlineChange(null);
    };

    const handleConfirm = () => {
        if (showTimeWheel) {
            // Coming back from time wheel — set the time
            setHasTime(true);
            setShowTimeWheel(false);
            return;
        }
        onClose();
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    const isToday = (d: Date) => {
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    };

    const isSameDay = (d1: Date, d2: Date | null) => {
        if (!d2) return false;
        return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    };

    const formatTimeStr = () => {
        const h12 = tempHour % 12 || 12;
        const period = tempHour >= 12 ? 'PM' : 'AM';
        return `${h12}:${String(tempMinute).padStart(2, '0')} ${period}`;
    };

    const renderMonth = useCallback(({ item }: { item: CalendarMonthData }) => {
        const monthDate = item.date;
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        const firstDay = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7;
        const days: (Date | null)[] = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i));

        return (
            <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                <Text style={p.monthTitle}>
                    {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {days.map((date, index) => {
                        if (!date) return <View key={index} style={{ width: colWidth, height: ROW_HEIGHT }} />;
                        const selected = isSameDay(date, tempSelectedDate);
                        const today = isToday(date);
                        return (
                            <View key={index} style={{ width: colWidth, height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                                <TouchableOpacity
                                    style={[
                                        { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
                                        selected && { backgroundColor: THEME.green },
                                        !selected && today && { backgroundColor: '#333' },
                                    ]}
                                    onPress={() => handleDateSelect(date)}
                                >
                                    <Text style={[
                                        { fontSize: 14, fontWeight: '500', color: THEME.textPrimary },
                                        selected && { color: '#FFF', fontWeight: 'bold' },
                                        !selected && today && { color: '#FFF', fontWeight: '700' },
                                    ]}>
                                        {date.getDate()}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    }, [tempSelectedDate, colWidth]);

    // ─── TIME WHEEL OVERLAY ─────────────────────────────────────────────
    if (showTimeWheel) {
        return (
            <View style={{ width, flex: 1 }}>
                <TimeWheelPanel
                    hour={tempHour}
                    minute={tempMinute}
                    onHourChange={setTempHour}
                    onMinuteChange={setTempMinute}
                />
                <ActionBar
                    onReset={() => { setHasTime(false); setShowTimeWheel(false); setTempHour(9); setTempMinute(0); }}
                    onConfirm={handleConfirm}
                    hasValue={true}
                />
            </View>
        );
    }

    // ─── CALENDAR VIEW ──────────────────────────────────────────────────
    return (
        <View style={{ width, flex: 1 }}>
            {/* Weekday header */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 6 }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <Text key={i} style={{ width: colWidth, textAlign: 'center', fontSize: 12, color: THEME.textSecondary, fontWeight: '600' }}>
                        {day}
                    </Text>
                ))}
            </View>
            <View style={{ height: 1, backgroundColor: THEME.border, marginHorizontal: 24 }} />

            <FlatList
                ref={calListRef}
                data={months}
                renderItem={renderMonth}
                keyExtractor={item => item.date.toISOString()}
                initialNumToRender={3}
                maxToRenderPerBatch={5}
                windowSize={7}
                getItemLayout={(data, index) => ({
                    length: data?.[index]?.height || 0,
                    offset: data?.[index]?.offset || 0,
                    index,
                })}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                bounces={false}
                style={{ flex: 1, paddingHorizontal: 12 }}
            />

            {/* Due Time toggle bar */}
            <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: '#FAFBFC' }}
                onPress={() => setShowTimeWheel(true)}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color={hasTime ? THEME.green : THEME.textSecondary} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: hasTime ? THEME.textPrimary : THEME.textSecondary }}>
                        Due Time
                    </Text>
                </View>
                {hasTime ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: THEME.green }}>{formatTimeStr()}</Text>
                        <TouchableOpacity onPress={() => { setHasTime(false); setTempHour(9); setTempMinute(0); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close-circle" size={16} color={THEME.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 12, color: THEME.textSecondary }}>Tap to set</Text>
                        <Ionicons name="chevron-forward" size={14} color={THEME.textSecondary} />
                    </View>
                )}
            </TouchableOpacity>

            {/* Selection indicator */}
            {(tempSelectedDate || hasTime) && (
                <View style={p.selectionBar}>
                    <Ionicons name="checkmark-circle" size={18} color={THEME.green} />
                    <Text style={p.selectionText}>
                        {tempSelectedDate
                            ? tempSelectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : ''}
                        {tempSelectedDate && hasTime ? ', ' : ''}
                        {hasTime ? formatTimeStr() : ''}
                    </Text>
                </View>
            )}

            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={!!tempSelectedDate || hasTime} />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1: ESTIMATE
// ═══════════════════════════════════════════════════════════════════════════

const parseDuration = (durationStr?: string | null): number => {
    if (!durationStr) return 0;
    let totalMinutes = 0;
    const hoursMatch = durationStr.match(/(\d+)h/);
    const minutesMatch = durationStr.match(/(\d+)m/);
    if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
    if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);
    return totalMinutes > 0 ? totalMinutes : 0;
};

const formatDuration = (minutes: number): string => {
    if (minutes === 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

function EstimatePage({ width, estimatedTime, onEstimateChange, onClose }: {
    width: number;
    estimatedTime: string | null;
    onEstimateChange: (duration: string | null) => void;
    onClose: () => void;
}) {
    const [currentMinutes, setCurrentMinutes] = useState(0);

    useEffect(() => {
        setCurrentMinutes(parseDuration(estimatedTime));
    }, [estimatedTime]);

    const addMinutes = (amount: number) => {
        const newVal = currentMinutes + amount;
        setCurrentMinutes(newVal);
    };

    const handleReset = () => {
        setCurrentMinutes(0);
        onEstimateChange(null);
    };

    const handleConfirm = () => {
        onEstimateChange(formatDuration(currentMinutes) || null);
        onClose();
    };

    return (
        <View style={{ width, flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {/* Display */}
                <View style={p.durationDisplay}>
                    <Text style={p.durationText}>
                        {currentMinutes > 0 ? formatDuration(currentMinutes) : '0m'}
                    </Text>
                </View>

                {/* Accumulator Buttons */}
                <View style={p.durationGrid}>
                    {[
                        { label: '+1m', amount: 1 },
                        { label: '+5m', amount: 5 },
                        { label: '+15m', amount: 15 },
                        { label: '+30m', amount: 30 },
                        { label: '+1h', amount: 60 },
                    ].map(btn => (
                        <TouchableOpacity
                            key={btn.label}
                            style={p.durationBtn}
                            onPress={() => addMinutes(btn.amount)}
                        >
                            <Text style={p.durationBtnText}>{btn.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={currentMinutes > 0} />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2: PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════

function PropertiesPage({ width, color, taskType, importance, onColorChange, onTypeChange, onImportanceChange, userColors, onClose }: {
    width: number;
    color: string | undefined;
    taskType: 'task' | 'event' | 'work' | 'chore' | 'habit' | undefined;
    importance: number;
    onColorChange: (c: string | undefined) => void;
    onTypeChange: (t: 'task' | 'event' | 'work' | 'chore' | 'habit') => void;
    onImportanceChange: (i: number) => void;
    userColors?: ColorDefinition[];
    onClose: () => void;
}) {
    // Store local state so changes only apply on confirm
    const [localType, setLocalType] = useState(taskType);
    const [localImportance, setLocalImportance] = useState(importance);
    const [localColor, setLocalColor] = useState(color);

    useEffect(() => {
        setLocalType(taskType);
        setLocalImportance(importance);
        setLocalColor(color);
    }, [taskType, importance, color]);

    const handleReset = () => {
        setLocalType('task');
        setLocalImportance(0);
        setLocalColor(undefined);
        onTypeChange('task');
        onImportanceChange(0);
        onColorChange(undefined);
    };

    const handleConfirm = () => {
        if (localType) onTypeChange(localType);
        onImportanceChange(localImportance);
        onColorChange(localColor);
        onClose();
    };

    const hasValue = (localType && localType !== 'task') || localImportance > 0 || !!localColor;

    return (
        <View style={{ width, flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {/* Type Selection */}
                <Text style={p.sectionLabel}>Type</Text>
                <View style={p.typeRow}>
                    {(['task', 'event', 'habit', 'chore', 'work'] as const).map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[
                                p.typeButton,
                                localType === t && p.typeButtonActive,
                                localType === t && localColor ? { backgroundColor: localColor + '20', borderColor: localColor } : {},
                            ]}
                            onPress={() => setLocalType(t)}
                        >
                            <MaterialCommunityIcons
                                name={
                                    t === 'event' ? 'calendar' :
                                        t === 'habit' ? 'refresh' :
                                            t === 'chore' ? 'broom' :
                                                t === 'work' ? 'briefcase' :
                                                    'checkbox-marked-outline' as any
                                }
                                size={20}
                                color={localType === t ? (localColor || THEME.textPrimary) : THEME.textSecondary}
                            />
                            <Text style={[
                                p.typeButtonText,
                                localType === t && { color: localColor || THEME.textPrimary, fontWeight: 'bold' }
                            ]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Importance Selection */}
                <Text style={p.sectionLabel}>Importance</Text>
                <View style={p.importanceRow}>
                    {[0, 1, 2, 3].map(lvl => (
                        <TouchableOpacity
                            key={lvl}
                            style={[
                                p.importanceButton,
                                localImportance === lvl && p.importanceButtonActive,
                            ]}
                            onPress={() => setLocalImportance(lvl)}
                        >
                            <Text style={[
                                p.importanceText,
                                localImportance === lvl && p.importanceTextActive,
                            ]}>
                                {lvl === 0 ? 'None' : lvl === 1 ? '!' : lvl === 2 ? '!!' : '!!!'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Color Selection */}
                <Text style={p.sectionLabel}>Color</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={p.colorRow} nestedScrollEnabled={true}>
                    <TouchableOpacity
                        style={[
                            p.colorCircle,
                            { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD' },
                            !localColor && p.colorSelected,
                        ]}
                        onPress={() => setLocalColor(undefined)}
                    >
                        {!localColor && <Ionicons name="checkmark" size={16} color="#333" />}
                    </TouchableOpacity>
                    {userColors && userColors.map(c => (
                        <TouchableOpacity
                            key={c.id}
                            style={[
                                p.colorCircle,
                                { backgroundColor: c.color },
                                localColor === c.color && p.colorSelected,
                            ]}
                            onPress={() => setLocalColor(c.color)}
                        >
                            {localColor === c.color && <Ionicons name="checkmark" size={16} color="#FFF" />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </ScrollView>

            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={!!hasValue} />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 3: RECURRENCE
// ═══════════════════════════════════════════════════════════════════════════

function RecurrencePage({ width, recurrence, onRecurrenceChange, onClose }: {
    width: number;
    recurrence: RecurrenceRule | null;
    onRecurrenceChange: (rule: RecurrenceRule | null) => void;
    onClose: () => void;
}) {
    const [viewMode, setViewMode] = useState<'presets' | 'custom'>('presets');
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
    const [interval, setIntervalVal] = useState('1');
    const [selectedDays, setSelectedDays] = useState<Set<WeekDay>>(new Set());
    const [localRecurrence, setLocalRecurrence] = useState<RecurrenceRule | null>(recurrence);

    useEffect(() => {
        setLocalRecurrence(recurrence);
        if (recurrence) {
            setViewMode('custom');
            setFrequency(recurrence.frequency);
            setIntervalVal(recurrence.interval.toString());
            if (recurrence.daysOfWeek) setSelectedDays(new Set(recurrence.daysOfWeek));
        } else {
            setViewMode('presets');
            setFrequency('weekly');
            setIntervalVal('1');
            setSelectedDays(new Set());
        }
    }, []);

    const handlePreset = (type: string) => {
        let rule: RecurrenceRule | null = null;
        switch (type) {
            case 'daily': rule = { frequency: 'daily', interval: 1 }; break;
            case 'weekly': rule = { frequency: 'weekly', interval: 1 }; break;
            case 'monthly': rule = { frequency: 'monthly', interval: 1 }; break;
            case 'yearly': rule = { frequency: 'yearly', interval: 1 }; break;
            case 'weekdays': rule = { frequency: 'weekly', interval: 1, daysOfWeek: ['MO', 'TU', 'WE', 'TH', 'FR'] }; break;
            case 'none': rule = null; break;
        }
        setLocalRecurrence(rule);
    };

    const handleSaveCustom = () => {
        const repeatInterval = parseInt(interval, 10) || 1;
        const rule: RecurrenceRule = {
            frequency,
            interval: repeatInterval,
            daysOfWeek: frequency === 'weekly' && selectedDays.size > 0 ? Array.from(selectedDays) : undefined,
        };
        setLocalRecurrence(rule);
    };

    const toggleDay = (day: WeekDay) => {
        const newSet = new Set(selectedDays);
        if (newSet.has(day)) newSet.delete(day);
        else newSet.add(day);
        setSelectedDays(newSet);
    };

    const handleReset = () => {
        setLocalRecurrence(null);
        onRecurrenceChange(null);
        setViewMode('presets');
        setFrequency('weekly');
        setIntervalVal('1');
        setSelectedDays(new Set());
    };

    const handleConfirm = () => {
        onRecurrenceChange(localRecurrence);
        onClose();
    };

    return (
        <View style={{ width, flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {viewMode === 'presets' ? (
                    <View>
                        {[
                            { label: 'Does not repeat', type: 'none' },
                            { label: 'Every day', type: 'daily' },
                            { label: 'Every week', type: 'weekly' },
                            { label: 'Every month', type: 'monthly' },
                            { label: 'Every year', type: 'yearly' },
                            { label: 'Every weekday (Mon-Fri)', type: 'weekdays' },
                        ].map(preset => (
                            <TouchableOpacity
                                key={preset.type}
                                style={p.presetItem}
                                onPress={() => handlePreset(preset.type)}
                            >
                                <Text style={p.presetText}>{preset.label}</Text>
                                {(preset.type === 'none' && !localRecurrence) && (
                                    <Ionicons name="checkmark" size={20} color={THEME.green} />
                                )}
                                {localRecurrence && preset.type === localRecurrence.frequency && localRecurrence.interval === 1 && !localRecurrence.daysOfWeek && (
                                    <Ionicons name="checkmark" size={20} color={THEME.green} />
                                )}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={p.customBtn} onPress={() => setViewMode('custom')}>
                            <Text style={p.customBtnText}>Custom...</Text>
                            <Ionicons name="chevron-forward" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
                        {/* Frequency Selector */}
                        <Text style={p.sectionLabel}>Repeat every</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <TextInput
                                style={p.intervalInput}
                                keyboardType="number-pad"
                                value={interval}
                                onChangeText={setIntervalVal}
                                textAlign="center"
                            />
                        </View>

                        <View style={p.freqSelector}>
                            {FREQUENCIES.map(f => (
                                <TouchableOpacity
                                    key={f.value}
                                    style={[p.freqOption, frequency === f.value && p.freqOptionSelected]}
                                    onPress={() => setFrequency(f.value)}
                                >
                                    <Text style={[p.freqText, frequency === f.value && { color: '#FFF' }]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Weekday Selector */}
                        {frequency === 'weekly' && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={p.sectionLabel}>Repeats on</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    {WEEKDAYS.map(day => (
                                        <TouchableOpacity
                                            key={day.value}
                                            style={[
                                                p.dayCircle,
                                                selectedDays.has(day.value) && p.dayCircleSelected,
                                            ]}
                                            onPress={() => toggleDay(day.value)}
                                        >
                                            <Text style={[
                                                { fontSize: 12, fontWeight: '600', color: '#333' },
                                                selectedDays.has(day.value) && { color: '#FFF' },
                                            ]}>
                                                {day.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Apply custom button */}
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                            <TouchableOpacity onPress={() => setViewMode('presets')} style={p.backBtn}>
                                <Text style={{ color: THEME.textSecondary, fontWeight: '600' }}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveCustom} style={p.applyCustomBtn}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Apply</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>

            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={!!localRecurrence} />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 4: REMINDER — simple alarm time picker for current day
// ═══════════════════════════════════════════════════════════════════════════

import { Pressable } from 'react-native'; // Import Pressable

function ReminderPage({ width, reminderOffset, reminderTime, reminderEnabled, onReminderChange, onClose }: {
    width: number;
    reminderOffset: number | null;
    reminderTime: string | null;
    reminderEnabled: boolean;
    onReminderChange: (offset: number | null, time: string | null) => void;
    onClose: () => void;
}) {
    // Parse incoming time into hour/minute
    const parseTime = (t: string | null) => {
        if (!t) return { h: 9, m: 0 };
        const [h, m] = t.split(':').map(Number);
        return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
    };
    const parsed = parseTime(reminderTime);
    const [tempHour, setTempHour] = useState(parsed.h);
    const [tempMinute, setTempMinute] = useState(parsed.m);

    // ─── Auto-save: apply changes immediately when wheels change ────
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        const hh = String(tempHour).padStart(2, '0');
        const mm = String(tempMinute).padStart(2, '0');
        onReminderChange(0, `${hh}:${mm}`);
    }, [tempHour, tempMinute]);

    const hasReminder = reminderOffset !== null;

    const handleReset = () => {
        setTempHour(9);
        setTempMinute(0);
        onReminderChange(null, null);
    };

    const handleConfirm = () => {
        onClose();
    };

    return (
        <View style={{ width, flex: 1 }}>
            <Pressable
                style={{ flex: 1, opacity: reminderEnabled ? 1 : 0.3 }}
                onPress={() => {
                    if (!reminderEnabled) {
                        // Activate on touch if disabled
                        // Default to Same Day (0) at existing temp time or 9:00
                        const hh = String(tempHour).padStart(2, '0');
                        const mm = String(tempMinute).padStart(2, '0');
                        onReminderChange(0, `${hh}:${mm}`);
                    }
                }}
            >
                <View pointerEvents={reminderEnabled ? 'auto' : 'none'}>
                    <TimeWheelPanel
                        hour={tempHour}
                        minute={tempMinute}
                        onHourChange={setTempHour}
                        onMinuteChange={setTempMinute}
                    />
                </View>
            </Pressable>
            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={hasReminder} />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

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

const p = StyleSheet.create({
    // Bottom Action Bar
    actionBar: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: THEME.border,
        backgroundColor: '#FFF',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 10,
    },
    resetBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#FECACA',
        backgroundColor: '#FFF5F5',
    },
    resetBtnText: {
        color: '#EF4444',
        fontWeight: '600',
        fontSize: 14,
    },
    confirmBtn: {
        flex: 2,
        backgroundColor: THEME.green,
    },
    confirmBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 15,
    },

    // Calendar
    monthTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        marginBottom: 12,
        marginLeft: 8,
        paddingTop: 12,
    },
    selectionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: THEME.border,
        backgroundColor: '#F8FFF8',
    },
    selectionText: {
        fontSize: 14,
        fontWeight: '600',
        color: THEME.textPrimary,
    },

    // Duration
    durationDisplay: {
        paddingVertical: 20,
        paddingHorizontal: 32,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 12,
        marginBottom: 24,
        alignItems: 'center',
        alignSelf: 'center',
        minWidth: 150,
    },
    durationText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: THEME.textPrimary,
    },
    durationGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
    },
    durationBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 10,
    },
    durationBtnText: {
        fontSize: 17,
        fontWeight: '600',
        color: THEME.textPrimary,
    },

    // Properties
    sectionLabel: {
        fontSize: 14,
        color: THEME.textSecondary,
        fontWeight: '600',
        marginBottom: 10,
        marginTop: 8,
    },
    typeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: THEME.border,
        backgroundColor: '#F8FAFC',
    },
    typeButtonActive: {
        borderColor: THEME.textPrimary,
        backgroundColor: '#F0F0F0',
    },
    typeButtonText: {
        fontSize: 13,
        color: THEME.textSecondary,
    },
    importanceRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    importanceButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: THEME.border,
        backgroundColor: '#F8FAFC',
    },
    importanceButtonActive: {
        borderColor: THEME.textPrimary,
        backgroundColor: '#F0F0F0',
    },
    importanceText: {
        fontSize: 14,
        fontWeight: '600',
        color: THEME.textSecondary,
    },
    importanceTextActive: {
        color: THEME.textPrimary,
        fontWeight: 'bold',
    },
    colorRow: {
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 8,
    },
    colorCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorSelected: {
        borderWidth: 2,
        borderColor: '#333',
    },

    // Recurrence
    presetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: THEME.border,
    },
    presetText: {
        fontSize: 16,
        color: THEME.textPrimary,
    },
    customBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        marginTop: 8,
    },
    customBtnText: {
        fontSize: 16,
        fontWeight: '500',
        color: THEME.textPrimary,
    },
    intervalInput: {
        width: 60,
        height: 40,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 8,
        fontSize: 18,
        padding: 4,
        backgroundColor: '#FFF',
    },
    freqSelector: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 2,
        marginBottom: 20,
    },
    freqOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 6,
    },
    freqOptionSelected: {
        backgroundColor: '#333',
    },
    freqText: {
        fontSize: 13,
        color: '#333',
        fontWeight: '500',
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayCircleSelected: {
        backgroundColor: '#333',
    },
    backBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    applyCustomBtn: {
        flex: 2,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: THEME.accent,
        borderRadius: 8,
    },
});
