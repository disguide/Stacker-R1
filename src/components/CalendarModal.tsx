import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { FlatList, ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_WIDTH = Math.min(SCREEN_WIDTH * 0.9, 360);
const CONTENT_WIDTH = MODAL_WIDTH - 24; // paddingHorizontal 12 * 2
const COL_WIDTH = CONTENT_WIDTH / 7;
const ROW_HEIGHT = 38; // Compact height (was square ~48)
const HEADER_HEIGHT = 40; // Title + Padding

// Theme Constants
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    accent: '#333',
    border: '#E2E8F0',
    surface: '#FFFFFF',
    shadowColor: '#000000',
    activeBlue: '#E3F2FD',
    activeBlueText: '#333',
};

interface CalendarModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectDate: (date: Date, hasTime?: boolean) => void;
    selectedDate?: string | null; // YYYY-MM-DD or ISO
    initialPage?: number;
}

// Optimized Day Cell
const DayCell = React.memo(({ date, isSelected, isToday, onSelect }: { date: Date | null, isSelected: boolean, isToday: boolean, onSelect: (d: Date) => void }) => {
    if (!date) return <View style={styles.dayCell} />;

    return (
        <View style={styles.dayCell}>
            <TouchableOpacity
                style={[
                    styles.dayButton,
                    isSelected && styles.selectedDay,
                    !isSelected && isToday && styles.currentDayHighlight
                ]}
                onPress={() => onSelect(date)}
            >
                <Text style={[
                    styles.dayText,
                    isSelected && styles.selectedDayText,
                    !isSelected && isToday && styles.currentDayText
                ]}>
                    {date.getDate()}
                </Text>
            </TouchableOpacity>
        </View>
    );
}, (prev, next) => {
    // Custom comparison for performance
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isToday !== next.isToday) return false;
    // date and onSelect are stable
    return true;
});

// Optimized Month Section
const MonthSection = React.memo(({ data, selectedDate, onSelect }: { data: { date: Date }, selectedDate: Date, onSelect: (d: Date) => void }) => {
    const monthDate = data.date;

    const days = useMemo(() => {
        const result = [];
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        const firstDay = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7;

        for (let i = 0; i < firstDay; i++) result.push(null);
        for (let i = 1; i <= daysInMonth; i++) result.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i));
        return result;
    }, [monthDate]);

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const isToday = (d: Date) => {
        const today = new Date();
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return (
        <View style={styles.monthContainer}>
            <Text style={styles.monthTitle}>
                {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
            </Text>
            <View style={styles.daysGrid}>
                {days.map((date, index) => (
                    <DayCell
                        key={index}
                        date={date}
                        isSelected={date ? isSameDay(date, selectedDate) : false}
                        isToday={date ? isToday(date) : false}
                        onSelect={onSelect}
                    />
                ))}
            </View>
        </View>
    );
});

const ITEM_HEIGHT = 50;
const WHEEL_HEIGHT = ITEM_HEIGHT * 5; // Show ~5 items

const WheelPicker = React.memo(({ items, selectedValue, onChange, formatLabel, loop = true }: { items: (string | number)[], selectedValue: string | number, onChange: (val: any) => void, formatLabel?: (val: any) => string, loop?: boolean }) => {
    const flatListRef = useRef<FlatList>(null);
    const isScrolling = useRef(false);
    const snapToInterval = ITEM_HEIGHT;
    // Reduce repetitions to improve initial render performance while keeping "loop" feel
    const REPETITIONS = loop ? 40 : 1;
    const CENTER_OFFSET = loop ? Math.floor(REPETITIONS / 2) : 0;

    const displayItems = useMemo(() => {
        if (!loop) return items;
        const arr = [];
        for (let i = 0; i < REPETITIONS; i++) {
            arr.push(...items);
        }
        return arr;
    }, [items, loop]);

    const getItemLayout = (_: any, index: number) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
    });

    const handleScrollEnd = (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        const actualIndex = loop ? index % items.length : index;
        const newValue = items[actualIndex];

        if (newValue !== selectedValue) {
            onChange(newValue);
        }
    };

    // Initial scroll
    useEffect(() => {
        const itemIndex = items.indexOf(selectedValue);
        if (itemIndex !== -1) {
            const targetIndex = loop
                ? (items.length * CENTER_OFFSET) + itemIndex
                : itemIndex;

            setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
            }, 50);
        }
    }, []);

    // Effect to update scroll when value changes externally
    useEffect(() => {
        if (isScrolling.current) return; // Prevent fighting with user scroll

        const index = items.indexOf(selectedValue);
        if (index !== -1) {
            const targetIndex = loop
                ? (items.length * CENTER_OFFSET) + index
                : index;
            flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
        }
    }, [selectedValue, items, loop]);

    const renderItem = useCallback(({ item, index }: { item: string | number, index: number }) => {
        const isSelected = item === selectedValue;
        return (
            <TouchableOpacity
                style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => {
                    isScrolling.current = false;
                    flatListRef.current?.scrollToIndex({ index, animated: true });
                    onChange(item);
                }}
            >
                <Text style={{
                    fontSize: isSelected ? 24 : 18,
                    fontWeight: isSelected ? 'bold' : '400',
                    color: isSelected ? THEME.textPrimary : THEME.textSecondary,
                    opacity: isSelected ? 1 : 0.6
                }}>
                    {formatLabel ? formatLabel(item) : item.toString().padStart(2, '0')}
                </Text>
            </TouchableOpacity>
        );
    }, [selectedValue, onChange, formatLabel]);

    return (
        <View style={{ height: WHEEL_HEIGHT, width: 70 }}>
            {/* Selection Indicator Overlay */}
            <View style={{
                position: 'absolute',
                top: ITEM_HEIGHT * 2,
                height: ITEM_HEIGHT,
                width: '100%',
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: THEME.border,
                backgroundColor: 'rgba(0,0,0,0.02)',
                pointerEvents: 'none'
            }} />

            <FlatList
                ref={flatListRef}
                data={displayItems}
                renderItem={renderItem}
                keyExtractor={(_, index) => index.toString()}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingVertical: ITEM_HEIGHT * 2
                }}
                getItemLayout={getItemLayout}
                onScrollBeginDrag={() => { isScrolling.current = true; }}
                onMomentumScrollEnd={(e) => {
                    isScrolling.current = false;
                    handleScrollEnd(e);
                }}
                onScrollEndDrag={(e) => {
                    // If no momentum (slow drag release), treat as end
                    // But usually for wheel pickers we handle momentum
                    // Adding this just in case logic:
                    setTimeout(() => {
                        if (!isScrolling.current) handleScrollEnd(e);
                    }, 100);
                }}
                // Initial Scroll Index is tricky with large lists in some RN versions, but usually fine
                // We rely on useEffect for initial positioning to be safe
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={5}
                onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                    });
                }}
            />
        </View>
    );
});

export default function CalendarModal({ visible, onClose, onSelectDate, selectedDate, initialPage = 0 }: CalendarModalProps) {
    const listRef = useRef<FlatList>(null);
    const scrollRef = useRef<ScrollView>(null);

    const [tempDate, setTempDate] = useState<Date>(new Date());
    const [tempHour, setTempHour] = useState(new Date().getHours());
    const [tempMinute, setTempMinute] = useState(new Date().getMinutes());
    const [hasTime, setHasTime] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [is24h, setIs24h] = useState(true); // Default to 24h format

    // Layout Data with offsets
    const months = useMemo(() => {
        const result = [];
        const start = new Date();
        start.setDate(1);

        let currentOffset = 0;

        for (let i = 0; i < 24; i++) {
            const d = new Date(start.getFullYear(), start.getMonth() + i, 1);

            // Calculate Height
            const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const firstDay = (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7;
            const weeks = Math.ceil((daysInMonth + firstDay) / 7);
            const height = HEADER_HEIGHT + (weeks * ROW_HEIGHT);

            result.push({ date: d, height, offset: currentOffset });
            currentOffset += height;
        }
        return result;
    }, []);

    useEffect(() => {
        if (visible) {
            // Respect initialPage logic
            if (initialPage === 1) {
                // If opening directly to Time Picker, force scroll immediately or slightly delayed
                setTimeout(() => {
                    scrollRef.current?.scrollTo({ x: MODAL_WIDTH, animated: false });
                    setCurrentPage(1);
                }, 0);
            } else {
                scrollRef.current?.scrollTo({ x: 0, animated: false });
                setCurrentPage(0);
            }

            let initialDate = new Date();
            let hasTimeInfo = false;

            if (selectedDate) {
                if (selectedDate.includes('T')) {
                    hasTimeInfo = true;
                    initialDate = new Date(selectedDate);
                } else {
                    const parts = selectedDate.split('-');
                    initialDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
            }
            setTempDate(initialDate);
            if (hasTimeInfo) {
                setTempHour(initialDate.getHours());
                setTempMinute(initialDate.getMinutes());
                setHasTime(true);
            } else {
                const now = new Date();
                setTempHour(now.getHours());
                setTempMinute(now.getMinutes());
                // If it's Date-Only but we opened the Time Picker directly, enable time
                setHasTime(initialPage === 1);
            }

            // Scroll to month
            setTimeout(() => {
                const targetCode = `${initialDate.getFullYear()}-${initialDate.getMonth()}`;
                const index = months.findIndex(m =>
                    `${m.date.getFullYear()}-${m.date.getMonth()}` === targetCode
                );
                if (index !== -1) {
                    listRef.current?.scrollToIndex({ index, animated: false });
                }
            }, 100);
        } else {
            // If we want every open to be fresh if no date selected:
            if (!selectedDate) {
                const now = new Date();
                setTempDate(now);
                setTempHour(now.getHours());
                setTempMinute(now.getMinutes());
                // Default to time enabled if opening time picker directly
                setHasTime(initialPage === 1);
            }
        }
    }, [visible, selectedDate, months]);

    const handleSave = () => {
        const finalDate = new Date(tempDate);
        if (hasTime) {
            if (tempHour === 24) {
                // 24:00 -> End of day (23:59:59)
                finalDate.setHours(23, 59, 59, 999);
            } else {
                finalDate.setHours(tempHour, tempMinute, 0, 0);
            }
        } else {
            finalDate.setHours(0, 0, 0, 0);
        }
        onSelectDate(finalDate, hasTime);
        onClose();
    };

    const adjustTime = (type: 'hour' | 'minute', delta: number) => {
        setHasTime(true);
        if (type === 'hour') {
            setTempHour(prev => (prev + delta + 24) % 24);
        } else {
            setTempMinute(prev => (prev + delta + 60) % 60);
        }
    };

    // Data for Wheels
    const hours24 = useMemo(() => Array.from({ length: 25 }, (_, i) => i), []); // 0-24
    // User requested "00 option for set time ampm". Changing to 1-12 range (standard).
    // Actually standard is 12, 1, 2, 3 ... 11.
    const hours12 = useMemo(() => [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], []);
    const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
    const amPm = ['AM', 'PM'];

    // Data helpers
    const current12hHour = useMemo(() => {
        const h = tempHour % 12;
        return h === 0 ? 12 : h; // Map 0 to 12
    }, [tempHour]);

    const isPm = tempHour >= 12;

    const handleHourChange = (val: number) => {
        if (is24h) {
            let newMinute = tempMinute;
            if (val === 24) {
                newMinute = 0; // Lock to 00 if 24 selected
                setTempMinute(0);
            }
            if (val === 0 && newMinute === 0) {
                setHasTime(false);
            } else {
                setHasTime(true);
            }
            setTempHour(val);
        } else {
            // val is 12, 1 ... 11
            let newHour;
            if (isPm) {
                // If PM: 12 -> 12, 1 -> 13 ... 11 -> 23
                if (val === 12) newHour = 12;
                else newHour = val + 12;
            } else {
                // If AM: 12 -> 0, 1 -> 1 ... 11 -> 11
                if (val === 12) newHour = 0;
                else newHour = val;
            }
            // Check for 00:00 in 12h mode (0 hour, 0 minute)
            if (newHour === 0 && tempMinute === 0) {
                setHasTime(false);
            } else {
                setHasTime(true);
            }
            setTempHour(newHour);
        }
    };

    const handleAmPmChange = (val: string) => {
        const newIsPm = val === 'PM';
        if (newIsPm !== isPm) {
            setTempHour(prev => (prev + 12) % 24);
        }
    };

    const renderItem = useCallback(({ item }: { item: typeof months[0] }) => (
        <MonthSection
            data={item}
            selectedDate={tempDate}
            onSelect={setTempDate}
        />
    ), [tempDate]);

    const handleScroll = (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        const page = Math.round(x / MODAL_WIDTH);
        if (page !== currentPage) {
            setCurrentPage(page);
        }
    };

    const scrollToPage = (page: number) => {
        scrollRef.current?.scrollTo({ x: page * MODAL_WIDTH, animated: true });
        setCurrentPage(page);
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={[styles.calendarCard, { width: MODAL_WIDTH }]} onStartShouldSetResponder={() => true}>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                        <View style={styles.tabIndicatorRow}>
                            <TouchableOpacity onPress={() => scrollToPage(0)} hitSlop={10}>
                                <View style={[styles.tabDot, currentPage === 0 && styles.tabDotActive]} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => scrollToPage(1)} hitSlop={10}>
                                <View style={[styles.tabDot, currentPage === 1 && styles.tabDotActive]} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            ref={scrollRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ width: MODAL_WIDTH * 2 }}
                            keyboardShouldPersistTaps="handled"
                            onMomentumScrollEnd={handleScroll}
                            scrollEventThrottle={16}
                            bounces={false}
                        >
                            {/* Calendar Page */}
                            <View style={{ width: MODAL_WIDTH, height: '100%' }}>
                                <View style={styles.headerContainer}>
                                    <View style={styles.weekRow}>
                                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                                            <Text key={i} style={styles.weekdayLabel}>{day}</Text>
                                        ))}
                                    </View>
                                    <View style={styles.divider} />
                                </View>

                                <FlatList
                                    ref={listRef}
                                    data={months}
                                    renderItem={renderItem}
                                    keyExtractor={item => item.date.toISOString()}
                                    initialNumToRender={3}
                                    maxToRenderPerBatch={5}
                                    windowSize={7}
                                    removeClippedSubviews={true}
                                    decelerationRate={0}
                                    getItemLayout={(data, index) => ({
                                        length: data?.[index].height || 0,
                                        offset: data?.[index].offset || 0,
                                        index,
                                    })}
                                    showsVerticalScrollIndicator={false}
                                    nestedScrollEnabled={true}
                                    bounces={false}
                                />
                            </View>

                            {/* Time Picker Page */}
                            <View style={{ width: MODAL_WIDTH, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 32, marginBottom: 16 }}>
                                    <Text style={styles.pageTitle}>Set Due Time</Text>
                                    <TouchableOpacity onPress={() => setIs24h(!is24h)} style={{ padding: 8, backgroundColor: THEME.surface, borderRadius: 8, borderWidth: 1, borderColor: THEME.border }}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: THEME.textPrimary }}>{is24h ? '24H' : '12H'}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.timePickerContainer}>
                                    {is24h ? (
                                        // 24H Layout
                                        <>
                                            <WheelPicker
                                                items={hours24}
                                                selectedValue={tempHour}
                                                onChange={handleHourChange}
                                            />
                                            <Text style={[styles.timeSeparator, { paddingBottom: 10 }]}>:</Text>
                                            <WheelPicker
                                                items={minutes}
                                                selectedValue={tempMinute}
                                                onChange={(val) => {
                                                    if (tempHour === 24) {
                                                        // If 24h is selected, force minute to 00
                                                        setTempMinute(0);
                                                        return;
                                                    }
                                                    setTempMinute(val);
                                                    if (tempHour === 0 && val === 0) {
                                                        setHasTime(false);
                                                    } else {
                                                        setHasTime(true);
                                                    }
                                                }}
                                            />
                                        </>
                                    ) : (
                                        // 12H Layout
                                        <>
                                            <WheelPicker
                                                items={hours12}
                                                selectedValue={current12hHour}
                                                onChange={handleHourChange}
                                            />
                                            <Text style={[styles.timeSeparator, { paddingBottom: 10 }]}>:</Text>
                                            <WheelPicker
                                                items={minutes}
                                                selectedValue={tempMinute}
                                                onChange={(val) => {
                                                    setTempMinute(val);
                                                    // Check 12h No Time Logic
                                                    if (tempHour === 0 && val === 0) {
                                                        setHasTime(false);
                                                    } else {
                                                        setHasTime(true);
                                                    }
                                                }}
                                            />
                                            <View style={{ width: 16 }} />
                                            <WheelPicker
                                                items={amPm}
                                                selectedValue={isPm ? 'PM' : 'AM'}
                                                onChange={handleAmPmChange}
                                                formatLabel={(s) => s as string}
                                                loop={false}
                                            />
                                        </>
                                    )}
                                </View>

                                <TouchableOpacity
                                    style={[styles.enableTimeToggle, !hasTime && { opacity: 0.8 }]}
                                    onPress={() => {
                                        setHasTime(false);
                                        setTempHour(0);
                                        setTempMinute(0);
                                    }}
                                >
                                    <Ionicons name="close-circle" size={20} color={hasTime ? "#EF4444" : "#EF4444"} />
                                    <Text style={[styles.enableTimeText, { color: "#EF4444" }]}>
                                        No Time
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* No Time Option - Explicit Button for clarity if needed, or just relying on toggle above */}
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>Confirm {tempDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {hasTime ? `${tempHour.toString().padStart(2, '0')}:${tempMinute.toString().padStart(2, '0')}` : ''}</Text>
                            </TouchableOpacity>
                        </View>
                    </GestureHandlerRootView>
                </View>
            </TouchableOpacity>
        </Modal >
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarCard: {
        height: Math.min(SCREEN_HEIGHT * 0.7, 500),
        backgroundColor: THEME.bg,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    tabIndicatorRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12, // Increased gap for touch targets
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: THEME.surface,
    },
    tabDot: {
        width: 8, // Larger
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E2E8F0',
    },
    tabDotActive: {
        backgroundColor: '#38A169',
    },
    headerContainer: {
        backgroundColor: THEME.surface,
        paddingTop: 8,
        paddingBottom: 8,
        zIndex: 10,
    },
    weekRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
    },
    weekdayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '600',
        color: THEME.textSecondary,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    divider: {
        height: 1,
        backgroundColor: THEME.border,
        marginTop: 8,
    },
    monthContainer: {
        paddingHorizontal: 12,
        paddingVertical: 4, // Ultra compact
    },
    monthTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        marginBottom: 4, // Compact
        marginLeft: 4,
        marginTop: 4,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: COL_WIDTH,
        height: ROW_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedDay: {
        backgroundColor: '#38A169',
        borderRadius: 8,
    },
    currentDayHighlight: {
        backgroundColor: '#E6FFFA',
        borderWidth: 1,
        borderColor: '#38A169',
        borderRadius: 8,
    },
    dayText: {
        fontSize: 14,
        color: THEME.textPrimary,
        fontWeight: '500',
    },
    selectedDayText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    currentDayText: {
        fontWeight: 'bold',
        color: '#38A169',
    },

    // Time Picker Styles
    pageTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.textPrimary, marginBottom: 24 },
    timePickerContainer: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
    timeColumn: { alignItems: 'center' },
    timeBtn: { padding: 12 },
    timeDigit: { fontSize: 32, fontWeight: 'bold', color: THEME.textPrimary, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
    timeSeparator: { fontSize: 32, fontWeight: 'bold', color: THEME.textSecondary, marginBottom: 4 },
    enableTimeToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: THEME.surface, borderRadius: 8, borderWidth: 1, borderColor: THEME.border },
    enableTimeText: { fontSize: 14, color: THEME.textSecondary, fontWeight: '600' },

    footer: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: THEME.border,
        backgroundColor: THEME.surface,
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: { paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    cancelButtonText: { color: THEME.textSecondary, fontWeight: '600' },
    saveButton: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#38A169', borderRadius: 8 },
    saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});
