import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    border: '#333333',
    surface: '#FFFDF5',
};

interface TimePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectTime: (time: string) => void; // HH:mm format
    initialTime?: string;
}

// Generate hours 0-23
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// Generate minutes 00, 15, 30, 45
const MINUTES = [0, 15, 30, 45];

export default function TimePickerModal({
    visible,
    onClose,
    onSelectTime,
    initialTime,
}: TimePickerModalProps) {
    const { t } = useTranslation();
    const [selectedHour, setSelectedHour] = useState(() => {
        if (initialTime) {
            const [h] = initialTime.split(':').map(Number);
            return h;
        }
        return 9; // Default 9 AM
    });

    const [selectedMinute, setSelectedMinute] = useState(() => {
        if (initialTime) {
            const [, m] = initialTime.split(':').map(Number);
            // Round to nearest 15
            return Math.round(m / 15) * 15;
        }
        return 0;
    });

    const formatHour = (hour: number) => {
        const period = hour >= 12 ? t('common.pm') : t('common.am');
        const displayHour = hour % 12 || 12;
        return `${displayHour} ${period}`;
    };

    const handleConfirm = () => {
        const timeString = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
        onSelectTime(timeString);
        onClose();
    };

    const handleClear = () => {
        onSelectTime('');
        onClose();
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('editor.setReminder')}</Text>
                    <TouchableOpacity onPress={handleConfirm} style={styles.closeButton}>
                        <Text style={styles.doneText}>{t('common.done')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Time Display */}
                <View style={styles.timeDisplay}>
                    <Ionicons name="notifications-outline" size={32} color="#333" />
                    <Text style={styles.selectedTimeText}>
                        {formatHour(selectedHour)}:{selectedMinute.toString().padStart(2, '0')}
                    </Text>
                </View>

                {/* Hour Picker */}
                <Text style={styles.sectionLabel}>{t('common.hour')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                    {HOURS.map(hour => (
                        <TouchableOpacity
                            key={hour}
                            style={[styles.pickerItem, selectedHour === hour && styles.pickerItemSelected]}
                            onPress={() => setSelectedHour(hour)}
                        >
                            <Text style={[styles.pickerText, selectedHour === hour && styles.pickerTextSelected]}>
                                {formatHour(hour)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Minute Picker */}
                <Text style={styles.sectionLabel}>{t('common.minute')}</Text>
                <View style={styles.minuteRow}>
                    {MINUTES.map(minute => (
                        <TouchableOpacity
                            key={minute}
                            style={[styles.minuteItem, selectedMinute === minute && styles.pickerItemSelected]}
                            onPress={() => setSelectedMinute(minute)}
                        >
                            <Text style={[styles.pickerText, selectedMinute === minute && styles.pickerTextSelected]}>
                                :{minute.toString().padStart(2, '0')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Clear Button */}
                <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                    <Ionicons name="close-circle-outline" size={20} color="#C53030" />
                    <Text style={styles.clearText}>{t('editor.removeReminder')}</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 2,
        borderBottomColor: THEME.border,
        backgroundColor: THEME.surface,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        // fontFamily removed for system default
    },
    closeButton: {
        padding: 8,
    },
    cancelText: {
        fontSize: 16,
        color: THEME.textSecondary,
    },
    doneText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    timeDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    selectedTimeText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        // fontFamily removed for system default
    },
    sectionLabel: {
        fontSize: 14,
        color: THEME.textSecondary,
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 8,
    },
    pickerRow: {
        paddingHorizontal: 16,
    },
    pickerItem: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 4,
        borderRadius: 8,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pickerItemSelected: {
        backgroundColor: '#333',
        borderColor: '#333',
    },
    pickerText: {
        fontSize: 14,
        color: THEME.textPrimary,
    },
    pickerTextSelected: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    minuteRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: 20,
        gap: 12,
    },
    minuteItem: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 8,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 40,
        padding: 16,
    },
    clearText: {
        fontSize: 14,
        color: '#C53030',
    },
});
