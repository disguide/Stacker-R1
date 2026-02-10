import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EditorCardProps } from '../types';
import { RecurrenceRule } from '../../../features/tasks/types';

export interface RecurrenceCardProps extends EditorCardProps {
    recurrence?: RecurrenceRule;
    date?: string;
    onChange: (recurrence: RecurrenceRule | undefined) => void;
}

const FREQUENCIES = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
];

export function RecurrenceCard({ isActive, onActivate, recurrence, date, onChange }: RecurrenceCardProps) {

    // --- HELPERS ---
    const summary = useMemo(() => {
        if (!recurrence) return "No Repeat";
        const freq = recurrence.frequency.charAt(0).toUpperCase() + recurrence.frequency.slice(1);
        if (recurrence.interval > 1) return `Every ${recurrence.interval} ${recurrence.frequency}s`;
        return freq;
    }, [recurrence]);

    const handleSelectFreq = (freq: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
        let daysOfWeek: any[] | undefined = undefined;

        if (freq === 'weekly') {
            // Default to the task's date day, or Today
            let targetDate = new Date();
            if (date) {
                const parsed = new Date(date);
                if (!isNaN(parsed.getTime())) {
                    targetDate = parsed;
                }
            }
            // Get 2-letter MO/TU/etc.
            const dayCode = targetDate.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2).toUpperCase();
            daysOfWeek = [dayCode];
        }

        onChange({
            frequency: freq,
            interval: 1,
            daysOfWeek: daysOfWeek,
        });
    };

    // --- RENDER INACTIVE (Summary) ---
    if (!isActive) {
        return (
            <TouchableOpacity style={styles.cardInactive} onPress={onActivate} activeOpacity={0.9}>
                <View style={styles.inactiveIconContainer}>
                    <MaterialCommunityIcons name="repeat" size={32} color={recurrence ? "#805AD5" : "#CCC"} />
                </View>
                <View style={styles.inactiveTextContainer}>
                    <Text style={[styles.inactiveTitle, !recurrence && { color: "#999" }]}>
                        {summary}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    // --- RENDER ACTIVE (Input) ---
    return (
        <View style={styles.cardActive}>
            <Text style={styles.activeHeader}>Recurrence</Text>

            <View style={styles.optionsList}>
                {FREQUENCIES.map((f) => {
                    const isSelected = recurrence?.frequency === f.id;
                    return (
                        <TouchableOpacity
                            key={f.id}
                            style={[
                                styles.optionRow,
                                isSelected && styles.optionRowSelected
                            ]}
                            onPress={() => handleSelectFreq(f.id as any)}
                        >
                            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                                {f.label}
                            </Text>
                            {isSelected && <MaterialCommunityIcons name="check" size={20} color="#FFF" />}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Custom recurrence button for future expansion */}
            {/* <TouchableOpacity style={styles.customButton}>
                <Text style={styles.customButtonText}>Custom...</Text>
            </TouchableOpacity> */}

            <TouchableOpacity style={styles.clearButton} onPress={() => onChange(undefined)}>
                <Text style={styles.clearText}>Stop Repeating</Text>
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
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
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
        marginBottom: 20,
    },
    optionsList: {
        gap: 10,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
    },
    optionRowSelected: {
        backgroundColor: '#333',
        transform: [{ scale: 1.02 }] // Subtle pop
    },
    optionText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    optionTextSelected: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    clearButton: {
        marginTop: 'auto',
        alignSelf: 'center',
        padding: 10,
    },
    clearText: {
        color: '#EF4444',
        fontSize: 14,
        fontWeight: '600'
    }
});
