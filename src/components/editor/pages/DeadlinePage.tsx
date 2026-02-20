import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';
import { ActionBar } from '../common/ActionBar';
import { TimeWheelPanel } from '../common/TimeWheelPanel';

const ROW_HEIGHT = 38;
const HEADER_HEIGHT = 40;

interface CalendarMonthData {
    date: Date;
    height: number;
    offset: number;
}

export function DeadlinePage({ width, deadline, onDeadlineChange, onClose }: {
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

export default React.memo(DeadlinePage);

const p = StyleSheet.create({
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
});
