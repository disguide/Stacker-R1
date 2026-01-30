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

const SCREEN_WIDTH = Dimensions.get('window').width;

// Theme Constants
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    border: '#333333',
    surface: '#FFFDF5',
    shadowColor: '#333333',
    accent: '#007AFF',
};

interface DurationPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectDuration: (duration: string) => void;
    initialDuration?: string | null;
}

const parseDuration = (durationStr?: string | null): number => {
    if (!durationStr) return 0;
    // Simple parsing logic: "1h 30m" -> 90, "45m" -> 45
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
            onSelectDuration(''); // Clear if 0
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
                <View style={styles.pickerContainer}>
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

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                            <Text style={styles.resetText}>Reset</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
                            <Text style={styles.confirmText}>Done</Text>
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
        backgroundColor: 'rgba(51, 51, 51, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        width: SCREEN_WIDTH * 0.8,
        backgroundColor: THEME.bg,
        borderRadius: 4,
        padding: 20,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: THEME.border,
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        color: THEME.textPrimary,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    displayContainer: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        backgroundColor: THEME.surface,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 4,
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
        backgroundColor: '#FFF',
        borderWidth: 1.5,
        borderColor: THEME.border,
        borderRadius: 4,
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    timeBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textPrimary,
    },
    actionsRow: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
    },
    resetBtn: {
        padding: 10,
    },
    resetText: {
        color: '#C53030',
        fontWeight: 'bold',
        fontSize: 16,
    },
    confirmBtn: {
        backgroundColor: THEME.textPrimary,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 4,
    },
    confirmText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
