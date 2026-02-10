import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EditorCardProps } from '../types';

export interface EstimatedTimeCardProps extends EditorCardProps {
    estimatedTime?: string; // "XXm", "Xh", "Xh XXm"
    onChange: (duration: string | undefined) => void;
}

const QUICK_DURATIONS = ['15m', '30m', '45m', '1h', '1h 30m', '2h'];

export function EstimatedTimeCard({ isActive, onActivate, estimatedTime, onChange }: EstimatedTimeCardProps) {

    // --- PARSE DURATION ---
    // Simple parser to get total minutes for slider/wheel if needed
    // For now, MVP can just select strings or increment minutes?
    // Let's stick to string chips + +/- buttons for custom?
    // Or just simple parsing to display "Total Minutes".

    // --- RENDER INACTIVE (Summary) ---
    if (!isActive) {
        return (
            <TouchableOpacity style={styles.cardInactive} onPress={onActivate} activeOpacity={0.9}>
                <View style={styles.inactiveIconContainer}>
                    <Feather name="clock" size={32} color={estimatedTime ? "#F6E05E" : "#CCC"} />
                </View>
                <View style={styles.inactiveTextContainer}>
                    <Text style={[styles.inactiveTitle, !estimatedTime && { color: "#999" }]}>
                        {estimatedTime || "Duration"}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    // --- RENDER ACTIVE (Input) ---
    return (
        <View style={styles.cardActive}>
            <Text style={styles.activeHeader}>Duration</Text>

            <View style={styles.durationDisplay}>
                <Text style={styles.bigDurationText}>{estimatedTime || "0m"}</Text>
            </View>

            <Text style={styles.sectionLabel}>Quick Select</Text>
            <View style={styles.chipGrid}>
                {QUICK_DURATIONS.map(d => (
                    <TouchableOpacity
                        key={d}
                        style={[styles.chip, estimatedTime === d && styles.chipSelected]}
                        onPress={() => onChange(d)}
                    >
                        <Text style={[styles.chipText, estimatedTime === d && styles.chipTextSelected]}>{d}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Custom Manual Adjustment (Simple +/- 5 mins) */}
            {/* This would require parsing logic '1h 30m' -> 90 -> 95 -> '1h 35m' */}
            {/* Keeping it simple for MVP Phase 1: Just Chips + Clear */}

            <TouchableOpacity style={styles.clearButton} onPress={() => onChange(undefined)}>
                <Text style={styles.clearText}>Clear Duration</Text>
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
        fontSize: 24,
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
    durationDisplay: {
        alignItems: 'center',
        marginBottom: 30,
    },
    bigDurationText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#333',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#94A3B8',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipSelected: {
        backgroundColor: '#333',
        borderColor: '#333',
    },
    chipText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    chipTextSelected: {
        color: '#FFF',
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
