import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
    TextInput,
    FlatList,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_WIDTH = Math.min(SCREEN_WIDTH * 0.9, 360);
const CONTENT_WIDTH = MODAL_WIDTH - 24; // paddingHorizontal 12 * 2
const COL_WIDTH = CONTENT_WIDTH / 7;
const ROW_HEIGHT = 38;
const HEADER_HEIGHT = 40;

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
    onSelectDate: (date: Date | null, hasTime?: boolean) => void;
    selectedDate?: string | null; // YYYY-MM-DD or ISO
    initialPage?: number;
}

// Simple Day Cell (No Memo)
const DayCell = ({ date, isSelected, isToday, onSelect }: { date: Date | null, isSelected: boolean, isToday: boolean, onSelect: (d: Date) => void }) => {
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
};

// Simple Month Section (No Memo)
const MonthSection = ({ data, selectedDate, onSelect }: { data: { date: Date }, selectedDate: Date | null, onSelect: (d: Date) => void }) => {
    const monthDate = data.date;

    const days = useMemo(() => {
        const result = [];
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        const firstDay = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7;

        for (let i = 0; i < firstDay; i++) result.push(null);
        for (let i = 1; i <= daysInMonth; i++) result.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i));
        return result;
    }, [monthDate]);

    const isSameDay = (d1: Date, d2: Date | null) => {
        if (!d2) return false;
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
};

const ITEM_HEIGHT = 50;
const WHEEL_HEIGHT = ITEM_HEIGHT * 5;

// Simple Wheel Picker using ScrollView (Robust)
const WheelPicker = ({ items, selectedValue, onChange, formatLabel, onScrollStart }: { items: (string | number)[], selectedValue: string | number, onChange: (val: any) => void, formatLabel?: (val: any) => string, loop?: boolean, onScrollStart?: () => void }) => {
    const scrollRef = useRef<ScrollView>(null);
    const [isScrolling, setIsScrolling] = useState(false);

    // Initial Scroll
    useEffect(() => {
        const index = items.indexOf(selectedValue);
        if (index >= 0) {
            setTimeout(() => {
                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
            }, 100);
        }
    }, []); // Run once on mount

    const handleScrollEnd = (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        const newValue = items[clampedIndex];

        if (newValue !== undefined && newValue !== selectedValue) {
            onChange(newValue);
        }
        setIsScrolling(false);
    };

    return (
        <View style={{ height: WHEEL_HEIGHT, width: 70 }}>
            {/* Selection Overlay */}
            <View style={{
                position: 'absolute',
                top: ITEM_HEIGHT * 2,
                height: ITEM_HEIGHT,
                width: '100%',
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: THEME.border,
                backgroundColor: 'rgba(0,0,0,0.02)',
                pointerEvents: 'none',
                zIndex: 10
            }} />

            <ScrollView
                ref={scrollRef}
                nestedScrollEnabled={true}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                onScrollBeginDrag={() => {
                    setIsScrolling(true);
                    if (onScrollStart) onScrollStart();
                }}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={(e) => {
                    // Fallback if no momentum
                    setTimeout(() => {
                        if (!isScrolling) handleScrollEnd(e);
                    }, 50);
                }}
            >
                {items.map((item, index) => {
                    const isSelected = item === selectedValue;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => {
                                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                                if (onScrollStart) onScrollStart();
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
                })}
            </ScrollView>
        </View>
    );
};

export default function CalendarModal({ visible, onClose, onSelectDate, selectedDate, initialPage = 0 }: CalendarModalProps) {
    const listRef = useRef<FlatList>(null);
    const scrollRef = useRef<ScrollView>(null);

    const [currentPage, setCurrentPage] = useState(0);
    const [is24h, setIs24h] = useState(true);
    const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
    const [tempDate, setTempDate] = useState<Date>(new Date());
    const [hasTime, setHasTime] = useState(false);
    const [tempHour, setTempHour] = useState(new Date().getHours());
    const [tempMinute, setTempMinute] = useState(new Date().getMinutes());

    // Relative Data removed

    // Layout Data
    const months = useMemo(() => {
        const result = [];
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

    useEffect(() => {
        if (visible) {
            // Reset Page
            if (initialPage === 1) {
                setTimeout(() => {
                    scrollRef.current?.scrollTo({ x: MODAL_WIDTH, animated: false });
                    setCurrentPage(1);
                }, 0);
            } else {
                scrollRef.current?.scrollTo({ x: 0, animated: false });
                setCurrentPage(0);
            }

            // Parse Date
            let initialDate = new Date();
            let incomingDateObj: Date | null = null;
            let incomingHasTime = false;

            if (selectedDate && typeof selectedDate === 'string') {
                try {
                    if (selectedDate.includes('T')) {
                        incomingHasTime = true;
                        incomingDateObj = new Date(selectedDate);
                    } else {
                        const parts = selectedDate.split('-');
                        if (parts.length >= 3) {
                            incomingDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        }
                    }
                    if (incomingDateObj && isNaN(incomingDateObj.getTime())) {
                        incomingDateObj = null;
                        initialDate = new Date();
                    } else if (incomingDateObj) {
                        initialDate = incomingDateObj;
                    }
                } catch (e) {
                    incomingDateObj = null;
                    initialDate = new Date();
                }
            } else {
                initialDate = new Date();
            }

            setTempSelectedDate(incomingDateObj);
            setTempDate(initialDate);

            if (incomingHasTime && incomingDateObj) {
                setTempHour(incomingDateObj.getHours());
                setTempMinute(incomingDateObj.getMinutes());
                setHasTime(true);
            } else {
                const now = new Date();
                setTempHour(now.getHours());
                setTempMinute(now.getMinutes());
                setHasTime(incomingHasTime);
            }

            setTimeout(() => {
                const targetCode = `${initialDate.getFullYear()}-${initialDate.getMonth()}`;
                const index = months.findIndex(m =>
                    `${m.date.getFullYear()}-${m.date.getMonth()}` === targetCode
                );
                if (index !== -1 && listRef.current) {
                    listRef.current.scrollToIndex({ index, animated: false });
                }
            }, 100);
        }
    }, [visible, selectedDate, months, initialPage]);

    const handleReset = () => {
        if (currentPage === 1 && hasTime) {
            setHasTime(false);
        } else {
            setTempSelectedDate(null);
            setHasTime(false);
        }
    };

    const handleSave = () => {
        if (!tempSelectedDate) {
            onSelectDate(null);
            onClose();
            return;
        }

        const finalDate = new Date(tempSelectedDate);
        if (hasTime) {
            if (tempHour === 24) {
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

    const hours24 = useMemo(() => Array.from({ length: 25 }, (_, i) => i), []);
    const hours12 = useMemo(() => [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], []);
    const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

    const current12hHour = useMemo(() => {
        const h = tempHour % 12;
        return h === 0 ? 12 : h;
    }, [tempHour]);

    const isPm = tempHour >= 12;

    const handleHourChange = (val: number) => {
        if (is24h) {
            if (val === 24) setTempMinute(0);
            if (!hasTime) setHasTime(true);
            setTempHour(val);
        } else {
            let newHour;
            if (isPm) {
                if (val === 12) newHour = 12;
                else newHour = val + 12;
            } else {
                if (val === 12) newHour = 0;
                else newHour = val;
            }
            if (!hasTime) setHasTime(true);
            setTempHour(newHour);
        }
    };

    const renderItem = useCallback(({ item }: { item: typeof months[0] }) => (
        <MonthSection
            data={item}
            selectedDate={tempSelectedDate}
            onSelect={(d) => {
                setTempSelectedDate(d);
            }}
        />
    ), [tempSelectedDate]);

    const handleScroll = (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        const page = Math.round(x / MODAL_WIDTH);
        if (page !== currentPage) setCurrentPage(page);
    };

    const scrollToPage = (page: number) => {
        scrollRef.current?.scrollTo({ x: page * MODAL_WIDTH, animated: true });
        setCurrentPage(page);
    };

    const getConfirmText = () => {
        if (!tempSelectedDate) return "Confirm";
        const dateStr = tempSelectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (hasTime) {
            const timeStr = is24h
                ? `${tempHour.toString().padStart(2, '0')}:${tempMinute.toString().padStart(2, '0')}`
                : `${current12hHour}:${tempMinute.toString().padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
            return `Confirm ${dateStr}, ${timeStr}`;
        }
        return `Confirm ${dateStr}`;
    };

    // Auto-update relative calculation removed

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={[styles.calendarCard, { width: MODAL_WIDTH }]} onStartShouldSetResponder={() => true}>
                    <View style={{ flex: 1 }}>

                        {/* HEADER TABS */}
                        <View style={styles.tabIndicatorRow}>
                            <TouchableOpacity onPress={() => scrollToPage(0)} style={styles.tabItem}>
                                <Text style={[styles.tabText, currentPage === 0 && styles.tabTextActive]}>Date</Text>
                                {currentPage === 0 && <View style={styles.tabLine} />}
                            </TouchableOpacity>
                            <View style={styles.arrowContainer}>
                                <Ionicons name="chevron-forward" size={16} color="#DDD" />
                            </View>
                            <TouchableOpacity onPress={() => scrollToPage(1)} style={styles.tabItem}>
                                <Text style={[styles.tabText, currentPage === 1 && styles.tabTextActive]}>Time</Text>
                                {/* No extra text here */}
                                {currentPage === 1 && <View style={styles.tabLine} />}
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
                            {/* PAGE 1: Calendar */}
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

                            {/* PAGE 2: Time Picker */}
                            <View style={{ width: MODAL_WIDTH, height: '100%', paddingHorizontal: 20, paddingTop: 20 }}>
                                <View style={{ flex: 1, alignItems: 'center' }}>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
                                        <Text style={styles.pageTitle}>Time</Text>
                                        <TouchableOpacity onPress={() => setIs24h(!is24h)} style={{ padding: 8, backgroundColor: THEME.surface, borderRadius: 8, borderWidth: 1, borderColor: THEME.border }}>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: THEME.textPrimary }}>{is24h ? '24H' : '12H'}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[styles.timePickerContainer, { opacity: hasTime ? 1 : 0.3, pointerEvents: 'auto' }]}>
                                        {is24h ? (
                                            <>
                                                <WheelPicker
                                                    key="24h-hours"
                                                    items={hours24}
                                                    selectedValue={tempHour}
                                                    onChange={handleHourChange}
                                                    onScrollStart={() => !hasTime && setHasTime(true)}
                                                />
                                                <Text style={[styles.timeSeparator, { paddingBottom: 10 }]}>:</Text>
                                                <WheelPicker
                                                    key="24h-minutes"
                                                    items={minutes}
                                                    selectedValue={tempMinute}
                                                    onChange={(val) => {
                                                        if (tempHour === 24) { setTempMinute(0); return; }
                                                        setTempMinute(val);
                                                    }}
                                                    onScrollStart={() => !hasTime && setHasTime(true)}
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <WheelPicker
                                                    key="12h-hours"
                                                    items={hours12}
                                                    selectedValue={current12hHour}
                                                    onChange={handleHourChange}
                                                    onScrollStart={() => !hasTime && setHasTime(true)}
                                                />
                                                <Text style={[styles.timeSeparator, { paddingBottom: 10 }]}>:</Text>
                                                <WheelPicker
                                                    key="12h-minutes"
                                                    items={minutes}
                                                    selectedValue={tempMinute}
                                                    onChange={(val) => setTempMinute(val)}
                                                    onScrollStart={() => !hasTime && setHasTime(true)}
                                                />
                                                <View style={{ width: 20 }} />
                                                <View>
                                                    <TouchableOpacity onPress={() => { setTempHour(h => (h + 12) % 24); !hasTime && setHasTime(true); }} style={{ padding: 10, opacity: !isPm ? 1 : 0.3 }}><Text style={{ fontSize: 18, fontWeight: '600' }}>AM</Text></TouchableOpacity>
                                                    <TouchableOpacity onPress={() => { setTempHour(h => (h + 12) % 24); !hasTime && setHasTime(true); }} style={{ padding: 10, opacity: isPm ? 1 : 0.3 }}><Text style={{ fontSize: 18, fontWeight: '600' }}>PM</Text></TouchableOpacity>
                                                </View>
                                            </>
                                        )}
                                    </View>

                                    {!hasTime && (
                                        <Text style={{ marginTop: 20, color: THEME.textSecondary, fontSize: 14 }}>
                                            Scroll to set time
                                        </Text>
                                    )}

                                </View>
                            </View>
                        </ScrollView>

                        {/* UNIVERSAL FOOTER */}
                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelButton} onPress={handleReset}>
                                <Text style={[styles.cancelButtonText, { color: '#EF4444' }]}>Reset</Text>
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity
                                style={[styles.saveButton, !tempSelectedDate && { backgroundColor: '#E2E8F0' }]}
                                onPress={handleSave}
                            // disabled={!tempSelectedDate} // Now enabled to allow clearing
                            >
                                <Text style={[styles.saveButtonText, !tempSelectedDate && { color: '#94A3B8' }]}>{getConfirmText()}</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </TouchableOpacity>
        </Modal >
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    calendarCard: { height: 500, backgroundColor: THEME.bg, borderRadius: 16, overflow: 'hidden' },

    // Header Tabs
    tabIndicatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFF' },
    tabItem: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
    tabText: { fontSize: 15, fontWeight: '600', color: '#94A3B8' },
    tabTextActive: { color: '#333' },
    tabSubtitle: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
    tabLine: { position: 'absolute', bottom: 0, width: '100%', height: 3, backgroundColor: '#38A169', borderRadius: 1.5 },
    arrowContainer: { paddingHorizontal: 4 },

    headerContainer: { paddingVertical: 10, borderBottomWidth: 1, borderColor: THEME.border, backgroundColor: THEME.surface },
    monthContainer: { paddingHorizontal: 12, paddingBottom: 10 },
    monthTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.textPrimary, marginBottom: 12, marginLeft: 8, paddingTop: 12 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
    weekdayLabel: { width: COL_WIDTH, textAlign: 'center', fontSize: 12, color: THEME.textSecondary, fontWeight: '600' },
    divider: { height: 1, backgroundColor: THEME.border },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },

    dayCell: { width: COL_WIDTH, height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
    dayButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
    dayText: { fontSize: 14, color: THEME.textPrimary, fontWeight: '500' },
    currentDayHighlight: { backgroundColor: '#333' },
    currentDayText: { color: '#FFF', fontWeight: '700' },
    selectedDay: { backgroundColor: '#38A169' },
    selectedDayText: { color: '#FFFFFF', fontWeight: 'bold' },

    pageTitle: { fontSize: 18, fontWeight: '700', color: THEME.textPrimary, textAlign: 'center' },
    timePickerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    timeSeparator: { fontSize: 24, fontWeight: 'bold', marginHorizontal: 10, color: THEME.textPrimary },

    footer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderColor: THEME.border, backgroundColor: THEME.surface },
    cancelButton: { paddingVertical: 10, paddingRight: 15 },
    cancelButtonText: { color: THEME.textSecondary, fontWeight: '600' },
    saveButton: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#38A169', borderRadius: 8 },
    saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

    unitTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    unitTabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
    unitTabText: { fontWeight: '600', color: '#94A3B8' },
    unitTabTextActive: { color: '#38A169' },
});
