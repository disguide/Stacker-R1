import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';
import { ActionBar } from '../common/ActionBar';
import { TimeWheelPanel } from '../common/TimeWheelPanel';

const ROW_HEIGHT = 36;

interface CalendarMonthData { date: Date; }

export function DeadlinePage({ width, deadline, onDeadlineChange, onClose }: {
    width: number;
    deadline: string | null;
    onDeadlineChange: (dl: string | null) => void;
    onClose: () => void;
}) {
    const scrollRef = useRef<ScrollView>(null);
    const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
    const [hasTime, setHasTime] = useState(false);
    const [showTimeWheel, setShowTimeWheel] = useState(false);
    const [tempHour, setTempHour] = useState(9);
    const [tempMinute, setTempMinute] = useState(0);
    const [is24h, setIs24h] = useState(false);

    // ─── Initialize from prop ONCE on mount ─────────────────────────
    const hasInitialized = useRef(false);
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;
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
                } else {
                    const parts = deadline.split('-');
                    if (parts.length >= 3) {
                        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        if (!isNaN(d.getTime())) setTempSelectedDate(d);
                    }
                }
            } catch { /* ignore */ }
        }
    }, [deadline]);

    const months = useMemo(() => {
        const result: CalendarMonthData[] = [];
        const start = new Date();
        start.setDate(1);
        for (let i = 0; i < 24; i++) {
            result.push({ date: new Date(start.getFullYear(), start.getMonth() + i, 1) });
        }
        return result;
    }, []);

    const handleDateSelect = (d: Date) => { setTempSelectedDate(d); };

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
            // Auto-apply the time and go back to calendar
            setHasTime(true);
            setShowTimeWheel(false);
            return;
        }
        // Build final deadline string and send to parent
        if (tempSelectedDate) {
            const yyyy = tempSelectedDate.getFullYear();
            const mm = String(tempSelectedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(tempSelectedDate.getDate()).padStart(2, '0');
            if (hasTime) {
                onDeadlineChange(`${yyyy}-${mm}-${dd}T${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`);
            } else {
                onDeadlineChange(`${yyyy}-${mm}-${dd}`);
            }
        } else if (hasTime) {
            onDeadlineChange(`${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`);
        }
        onClose();
    };

    const formatTime = () => {
        if (is24h) {
            return `${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`;
        }
        const h12 = tempHour % 12 || 12;
        const period = tempHour >= 12 ? 'PM' : 'AM';
        return `${h12}:${String(tempMinute).padStart(2, '0')} ${period}`;
    };

    const formatDateShort = () => {
        if (!tempSelectedDate) return null;
        const today = new Date();
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        if (isSameDay(tempSelectedDate, today)) return 'Today';
        if (isSameDay(tempSelectedDate, tomorrow)) return 'Tomorrow';
        return tempSelectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    // ─── Shared chips row (used in both views) ──────────────────────
    const renderChips = () => (
        <View style={st.chipRow}>
            {/* Date chip */}
            {tempSelectedDate ? (
                <View style={st.chipActive}>
                    <Ionicons name="calendar" size={14} color={THEME.green} />
                    <Text style={st.chipActiveText}>{formatDateShort()}</Text>
                    <TouchableOpacity onPress={() => setTempSelectedDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={15} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={st.chipEmpty}>
                    <Ionicons name="calendar-outline" size={14} color={THEME.textSecondary} />
                    <Text style={st.chipEmptyText}>No date</Text>
                </View>
            )}
            {/* Time chip */}
            {hasTime ? (
                <TouchableOpacity style={[st.chipActive, { backgroundColor: '#EEF2FF', borderColor: '#818CF8' }]} onPress={() => setShowTimeWheel(true)}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#6366F1" />
                    <Text style={[st.chipActiveText, { color: '#6366F1' }]}>{formatTime()}</Text>
                    <TouchableOpacity onPress={() => { setHasTime(false); setTempHour(9); setTempMinute(0); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={15} color="#94A3B8" />
                    </TouchableOpacity>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={st.chipEmpty} onPress={() => setShowTimeWheel(true)}>
                    <MaterialCommunityIcons name="clock-plus-outline" size={14} color={THEME.textSecondary} />
                    <Text style={st.chipEmptyText}>Add time</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    // ─── TIME PICKER VIEW ───────────────────────────────────────────
    if (showTimeWheel) {
        return (
            <View style={{ width, flex: 1 }}>
                {/* Header */}
                <View style={st.timeHeader}>
                    <TouchableOpacity onPress={() => { setHasTime(true); setShowTimeWheel(false); }} style={st.backBtn}>
                        <Ionicons name="chevron-back" size={22} color={THEME.accent} />
                        <Text style={st.backText}>Date</Text>
                    </TouchableOpacity>
                    <Text style={st.timeHeaderTitle}>Due Time</Text>
                    {/* 24h toggle */}
                    <TouchableOpacity onPress={() => setIs24h(!is24h)} style={st.formatToggle}>
                        <Text style={[st.formatToggleText, is24h && { color: THEME.accent, fontWeight: '700' }]}>
                            {is24h ? '24h' : '12h'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Time wheel */}
                <TimeWheelPanel
                    hour={tempHour}
                    minute={tempMinute}
                    onHourChange={setTempHour}
                    onMinuteChange={setTempMinute}
                    is24h={is24h}
                />

                {/* Chips at bottom */}
                {renderChips()}

                {/* Action bar */}
                <ActionBar
                    onReset={() => { setHasTime(false); setShowTimeWheel(false); setTempHour(9); setTempMinute(0); }}
                    onConfirm={handleConfirm}
                    hasValue={true}
                />
            </View>
        );
    }

    // ─── CALENDAR VIEW ──────────────────────────────────────────────
    return (
        <View style={{ width, flex: 1 }}>
            {/* Weekday columns */}
            <View style={st.weekdayRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <Text key={i} style={st.weekdayText}>{day}</Text>
                ))}
            </View>
            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 20 }} />

            {/* Scrollable Calendar */}
            <ScrollView
                ref={scrollRef as any}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="always"
                bounces={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
            >
                {months.map((item) => (
                    <MemoizedMonth
                        key={item.date.toISOString()}
                        item={item}
                        tempSelectedDate={tempSelectedDate}
                        onDateSelect={handleDateSelect}
                    />
                ))}
            </ScrollView>

            {/* Chips at bottom (above action bar) */}
            {renderChips()}

            {/* Action bar */}
            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={!!tempSelectedDate || hasTime} />
        </View>
    );
}

export default React.memo(DeadlinePage);

// ─── Helpers ────────────────────────────────────────────────────────
const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

const isToday = (d: Date) => {
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const isSameDay = (d1: Date, d2: Date | null) => {
    if (!d2) return false;
    return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
};

// ─── Memoized Month ─────────────────────────────────────────────────
const MemoizedMonth = React.memo(({ item, tempSelectedDate, onDateSelect }: {
    item: CalendarMonthData; tempSelectedDate: Date | null; onDateSelect: (d: Date) => void;
}) => {
    const monthDate = item.date;
    const days = useMemo(() => {
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        const firstDay = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7;
        const arr: (Date | null)[] = [];
        for (let i = 0; i < firstDay; i++) arr.push(null);
        for (let i = 1; i <= daysInMonth; i++) arr.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i));
        return arr;
    }, [monthDate]);

    return (
        <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
            <Text style={st.monthTitle}>{monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {days.map((date, index) => {
                    if (!date) return <View key={index} style={{ width: '14.28%', height: ROW_HEIGHT }} />;
                    const selected = isSameDay(date, tempSelectedDate);
                    const today = isToday(date);
                    return (
                        <View key={index} style={{ width: '14.28%', height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                            <TouchableOpacity
                                style={[st.dayCell, selected && { backgroundColor: THEME.green }, !selected && today && { backgroundColor: '#333' }]}
                                onPress={() => onDateSelect(date)}
                            >
                                <Text style={[st.dayText, selected && { color: '#FFF', fontWeight: 'bold' }, !selected && today && { color: '#FFF', fontWeight: '700' }]}>
                                    {date.getDate()}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}, (prev, next) => {
    const wasIn = prev.tempSelectedDate && prev.tempSelectedDate.getMonth() === prev.item.date.getMonth() && prev.tempSelectedDate.getFullYear() === prev.item.date.getFullYear();
    const isIn = next.tempSelectedDate && next.tempSelectedDate.getMonth() === next.item.date.getMonth() && next.tempSelectedDate.getFullYear() === next.item.date.getFullYear();
    if (!wasIn && !isIn) return true;
    return prev.tempSelectedDate?.getTime() === next.tempSelectedDate?.getTime();
});

// ─── Styles ─────────────────────────────────────────────────────────
const st = StyleSheet.create({
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FAFBFC',
    },
    chipActive: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: THEME.green,
    },
    chipActiveText: { fontSize: 13, fontWeight: '600', color: THEME.green },
    chipEmpty: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipEmptyText: { fontSize: 13, fontWeight: '500', color: THEME.textSecondary },
    weekdayRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
    weekdayText: { width: '14.28%', textAlign: 'center', fontSize: 12, color: THEME.textSecondary, fontWeight: '600' },
    monthTitle: { fontSize: 15, fontWeight: '700', color: THEME.textPrimary, marginBottom: 8, marginLeft: 4, paddingTop: 12 },
    dayCell: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
    dayText: { fontSize: 14, fontWeight: '500', color: THEME.textPrimary },
    timeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    timeHeaderTitle: { fontSize: 16, fontWeight: '700', color: THEME.textPrimary },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 60 },
    backText: { fontSize: 15, fontWeight: '600', color: THEME.accent },
    formatToggle: {
        width: 42,
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    formatToggleText: { fontSize: 13, fontWeight: '600', color: THEME.textSecondary },
});
