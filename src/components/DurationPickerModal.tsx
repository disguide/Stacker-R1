import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform
} from 'react-native';

// Theme Constants — Unified with CalendarModal / ReminderModal
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    surface: '#FFFFFF',
};

interface DurationPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectDuration: (duration: string) => void;
    initialDuration?: string | null;
}

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

export default function DurationPickerModal({ visible, onClose, onSelectDuration, initialDuration }: DurationPickerModalProps) {
    const [currentMinutes, setCurrentMinutes] = useState(0);

    useEffect(() => {
        if (visible) {
            setCurrentMinutes(parseDuration(initialDuration));
        }
    }, [visible, initialDuration]);

    const addMinutes = (amount: number) => {
        setCurrentMinutes(prev => prev + amount);
    };

    const handleConfirm = () => {
        if (currentMinutes > 0) {
            onSelectDuration(formatDuration(currentMinutes));
        } else {
            onSelectDuration('');
        }
        onClose();
    };

    const handleReset = () => {
        setCurrentMinutes(0);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.card} onStartShouldSetResponder={() => true}>
                    <Text style={styles.title}>Estimate Time</Text>

                    {/* Display */}
                    <View style={styles.displayContainer}>
                        <Text style={styles.displayText}>
                            {currentMinutes > 0 ? formatDuration(currentMinutes) : '0m'}
                        </Text>
                    </View>

                    {/* Accumulator Buttons */}
                    <View style={styles.buttonsGrid}>
                        <TouchableOpacity style={styles.timeBtn} onPress={() => addMinutes(1)}>
                            <Text style={styles.timeBtnText}>+1m</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.timeBtn} onPress={() => addMinutes(5)}>
                            <Text style={styles.timeBtnText}>+5m</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.timeBtn} onPress={() => addMinutes(15)}>
                            <Text style={styles.timeBtnText}>+15m</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.timeBtn} onPress={() => addMinutes(30)}>
                            <Text style={styles.timeBtnText}>+30m</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.timeBtn} onPress={() => addMinutes(60)}>
                            <Text style={styles.timeBtnText}>+1h</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer — Unified pattern */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleReset} style={styles.cancelButton}>
                            <Text style={styles.cancelButtonText}>Reset</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={handleConfirm} style={styles.saveButton}>
                            <Text style={styles.saveButtonText}>
                                {currentMinutes > 0 ? `Confirm ${formatDuration(currentMinutes)}` : 'Confirm'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: 340,
        backgroundColor: THEME.bg,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: THEME.textPrimary,
        marginBottom: 20,
    },
    displayContainer: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 12,
        marginBottom: 20,
        minWidth: 150,
        alignItems: 'center',
    },
    displayText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: THEME.textPrimary,
    },
    buttonsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 24,
    },
    timeBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 8,
    },
    timeBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textPrimary,
    },
    footer: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: THEME.border,
        paddingTop: 16,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingRight: 15,
    },
    cancelButtonText: {
        color: '#EF4444',
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#38A169',
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
