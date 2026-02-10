import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EditorCardProps } from '../types';

export interface DueTimeCardProps extends EditorCardProps {
    time?: string; // "HH:mm" 24h format
    onChange: (time: string | undefined) => void;
}

export function DueTimeCard({ isActive, onActivate, time, onChange }: DueTimeCardProps) {

    // --- PARSE TIME ---
    const { hours, minutes, period } = useMemo(() => {
        if (!time || typeof time !== 'string') return { hours: 12, minutes: 0, period: 'PM' };
        const [h, m] = time.split(':').map(Number);
        const p = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return { hours: displayH, minutes: m, period: p };
    }, [time]);

    // --- RENDER INACTIVE (Summary) ---
    if (!isActive) {
        return (
            <TouchableOpacity style={styles.cardInactive} onPress={onActivate} activeOpacity={0.9}>
                <View style={styles.inactiveIconContainer}>
                    <Feather name="clock" size={32} color={time ? "#007AFF" : "#CCC"} />
                </View>
                <View style={styles.inactiveTextContainer}>
                    <Text style={[styles.inactiveTitle, !time && { color: "#999" }]}>
                        {time ? `${hours}:${minutes.toString().padStart(2, '0')} ${period}` : "--:--"}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    // --- RENDER ACTIVE (Input) ---
    // Simple Wheel Picker Implementation using ScrollViews
    // We will render columns for Hour (1-12), Minute (00-55 step 5), Period (AM/PM)

    const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const PERIODS = ['AM', 'PM'];

    const updateTime = (h: number, m: number, p: string) => {
        let hour24 = h;
        if (p === 'PM' && h !== 12) hour24 += 12;
        if (p === 'AM' && h === 12) hour24 = 0;
        const timeStr = `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onChange(timeStr);
    };

    return (
        <View style={styles.cardActive}>
            <Text style={styles.activeHeader}>Due Time</Text>

            <View style={styles.pickerContainer}>
                {/* HOURS */}
                <View style={styles.column}>
                    <Text style={styles.columnLabel}>Hour</Text>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 80 }}>
                        {HOURS.map(h => (
                            <TouchableOpacity
                                key={h}
                                style={[styles.pickerItem, hours === h && styles.pickerItemSelected]}
                                onPress={() => updateTime(h, minutes, period)}
                            >
                                <Text style={[styles.pickerText, hours === h && styles.pickerTextSelected]}>{h}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.separator}><Text style={styles.separatorText}>:</Text></View>

                {/* MINUTES */}
                <View style={styles.column}>
                    <Text style={styles.columnLabel}>Min</Text>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 80 }}>
                        {MINUTES.map(m => (
                            <TouchableOpacity
                                key={m}
                                style={[styles.pickerItem, minutes === m && styles.pickerItemSelected]}
                                onPress={() => updateTime(hours, m, period)}
                            >
                                <Text style={[styles.pickerText, minutes === m && styles.pickerTextSelected]}>
                                    {m.toString().padStart(2, '0')}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* PERIOD */}
                <View style={styles.column}>
                    <Text style={styles.columnLabel}> </Text>
                    <View>
                        {PERIODS.map(p => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.pickerItem, period === p && styles.pickerItemSelected]}
                                onPress={() => updateTime(hours, minutes, p)}
                            >
                                <Text style={[styles.pickerText, period === p && styles.pickerTextSelected]}>{p}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.clearButton} onPress={() => onChange(undefined)}>
                <Text style={styles.clearText}>Clear Time</Text>
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
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        marginHorizontal: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
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
        fontSize: 32,
        fontWeight: '300', // Thin font for clock
        color: '#333',
        fontVariant: ['tabular-nums'],
    },

    // ACTIVE
    cardActive: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginHorizontal: 10,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    activeHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 10,
    },
    pickerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        height: 200, // Limit height for scroll
        alignItems: 'center',
    },
    column: {
        marginHorizontal: 10,
        alignItems: 'center',
        height: '100%',
    },
    columnLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 8,
        height: 20,
    },
    pickerItem: {
        height: 40,
        width: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    pickerItemSelected: {
        backgroundColor: '#EBF8FF', // Light Blue
    },
    pickerText: {
        fontSize: 18,
        color: '#666',
    },
    pickerTextSelected: {
        color: '#007AFF',
        fontWeight: 'bold',
        fontSize: 20,
    },
    separator: {
        height: '100%',
        justifyContent: 'center',
        paddingTop: 20,
    },
    separatorText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    clearButton: {
        marginTop: 10,
        alignSelf: 'center',
        padding: 10,
    },
    clearText: {
        color: '#EF4444',
        fontSize: 14,
        fontWeight: '600'
    }
});
