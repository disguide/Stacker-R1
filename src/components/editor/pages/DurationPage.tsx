import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { THEME } from '../constants';
import { ActionBar } from '../common/ActionBar';

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

// Export as named for testing, default as memoized
export function DurationPage({ width, estimatedTime, onEstimateChange, onClose }: {
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
        onEstimateChange(formatDuration(newVal) || null);
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
            <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
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

export default React.memo(DurationPage);

const p = StyleSheet.create({
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
});
