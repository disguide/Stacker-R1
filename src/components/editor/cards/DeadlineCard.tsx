import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Using Expo vector icons
import { DeadlineCardProps } from '../types';
import { toISODateString, getDayName } from '../../../utils/dateHelpers';

// Wait, user wants "Sleek Month Calendar Grid". 
// Check if 'react-native-calendars' is in package.json? 
// If not, I should probably build a simple custom one or check what's available.
// I'll stick to a custom simple grid to ensure "Premium" feel if I can, or use the library if installed.
// The previous files referenced 'CalendarModal.tsx'. Let's check that implementation later.
// For now, I will assume a custom simple grid or reuse Calendar component logic.
// Actually, I'll build a custom simple grid for the "Active" state to maximize control.

const THEME = {
    primary: '#007AFF', // Blue
    text: '#333333',
    textSecondary: '#64748B',
    bgActive: '#FFFFFF',
    bgInactive: '#F8FAFC',
    border: '#E2E8F0',
};

export function DeadlineCard({ isActive, onActivate, deadline, onChange }: DeadlineCardProps) {

    // --- HELPERS ---
    const today = new Date();
    const todayStr = toISODateString(today);

    const displayDate = useMemo(() => {
        if (!deadline || typeof deadline !== 'string') return "No Deadline";
        // Ensure we only have the YYYY-MM-DD part before appending T00:00:00 to avoid "Invalid Date"
        const cleanDate = deadline.split('T')[0];
        const d = new Date(cleanDate + 'T00:00:00');
        const dayName = getDayName(d);
        const dateNum = d.getDate();
        const month = d.toLocaleDateString('en-US', { month: 'short' });

        let relative = "";
        const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 0) relative = "Today";
        else if (diff === 1) relative = "Tomorrow";
        else if (diff === -1) relative = "Yesterday";
        else if (diff > 0) relative = `in ${diff} days`;

        return { full: `${dayName}, ${month} ${dateNum}`, relative };
    }, [deadline]);

    // --- RENDER INACTIVE (Summary) ---
    if (!isActive) {
        return (
            <TouchableOpacity style={styles.cardInactive} onPress={onActivate} activeOpacity={0.9}>
                <View style={styles.inactiveIconContainer}>
                    <Ionicons name="calendar-outline" size={32} color={deadline ? THEME.primary : "#CCC"} />
                </View>
                <View style={styles.inactiveTextContainer}>
                    <Text style={[styles.inactiveTitle, !deadline && { color: "#999" }]}>
                        {typeof displayDate === 'string' ? displayDate : displayDate.full}
                    </Text>
                    {typeof displayDate !== 'string' && displayDate.relative && (
                        <Text style={styles.inactiveSubtitle}>{displayDate.relative}</Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    }

    // --- RENDER ACTIVE (Input) ---
    // Local state for navigation (independent of selection)
    const [viewDate, setViewDate] = React.useState(deadline ? new Date(deadline) : new Date());

    // Sync viewDate if deadline changes externally (optional, but good for "reset")
    // useEffect(() => { if(deadline) setViewDate(new Date(deadline)); }, [deadline]); 
    // Actually, don't sync automatically or it jumps user around. Keep manual control.

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
        setViewDate(newDate);
    };

    const currentMonth = viewDate;
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const startDay = startOfMonth.getDay(); // 0 = Sun

    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null); // Empty slots
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
        <View style={styles.cardActive}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}>
                    <Ionicons name="chevron-back" size={24} color={THEME.text} />
                </TouchableOpacity>
                <Text style={styles.activeHeader}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}>
                    <Ionicons name="chevron-forward" size={24} color={THEME.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <Text key={i} style={styles.dayLabel}>{d}</Text>
                ))}
                {days.map((day, index) => {
                    if (!day) return <View key={index} style={styles.dayCell} />;

                    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = dateStr === deadline;
                    const isToday = dateStr === todayStr;

                    return (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.dayCell,
                                isSelected && styles.dayCellSelected,
                                isToday && !isSelected && styles.dayCellToday
                            ]}
                            onPress={() => onChange(dateStr)}
                        >
                            <Text style={[
                                styles.dayText,
                                isSelected && styles.dayTextSelected,
                                isToday && !isSelected && { color: THEME.primary, fontWeight: 'bold' }
                            ]}>
                                {day}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <TouchableOpacity style={styles.clearButton} onPress={() => onChange(undefined)}>
                <Text style={styles.clearText}>Clear Date</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    // INACTIVE
    cardInactive: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: THEME.bgInactive,
        borderRadius: 20,
        marginHorizontal: 10,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    inactiveIconContainer: {
        marginBottom: 16,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    inactiveTextContainer: {
        alignItems: 'center',
    },
    inactiveTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: THEME.text,
        marginBottom: 4,
    },
    inactiveSubtitle: {
        fontSize: 14,
        color: THEME.textSecondary,
        fontWeight: '500',
    },

    // ACTIVE
    cardActive: {
        flex: 1,
        backgroundColor: THEME.bgActive,
        borderRadius: 20,
        marginHorizontal: 10,
        padding: 20,
        // Shadow for premium feel
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    activeHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.text,
        textAlign: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    navButton: {
        padding: 5,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    dayLabel: {
        width: '14%',
        textAlign: 'center',
        fontSize: 12,
        color: '#999',
        marginBottom: 8,
    },
    dayCell: {
        width: '14%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderRadius: 20,
    },
    dayCellSelected: {
        backgroundColor: THEME.primary,
    },
    dayCellToday: {
        borderWidth: 1,
        borderColor: THEME.primary,
    },
    dayText: {
        fontSize: 14,
        color: THEME.text,
    },
    dayTextSelected: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    clearButton: {
        marginTop: 20,
        alignSelf: 'center',
        padding: 10,
    },
    clearText: {
        color: '#EF4444', // Red
        fontSize: 14,
        fontWeight: '600'
    }
});
