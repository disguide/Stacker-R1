import React, { useState } from 'react';
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
    accent: '#333',
    border: '#333333',
    surface: '#FFFDF5',
    shadowColor: '#333333',
    activeBlue: '#E3F2FD',
    activeBlueText: '#333',
};

interface CalendarModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectDate: (date: Date) => void;
    selectedDate?: string | null; // YYYY-MM-DD
}

export default function CalendarModal({ visible, onClose, onSelectDate, selectedDate }: CalendarModalProps) {
    const [viewDate, setViewDate] = useState(new Date());
    const [step, setStep] = useState<'date' | 'time'>('date');
    const [pendingDate, setPendingDate] = useState<Date | null>(null);
    const [selectedHour, setSelectedHour] = useState(9);
    const [selectedMinute, setSelectedMinute] = useState(0);
    const [timeOnlyMode, setTimeOnlyMode] = useState(false);

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setStep('date');
            setPendingDate(null);
            setSelectedHour(9);
            setSelectedMinute(0);
            setTimeOnlyMode(false);
        }
    }, [visible]);

    const daysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const firstDayOfMonth = (date: Date) => {
        const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return (day + 6) % 7;
    };

    const generateMonthDays = () => {
        const days = [];
        const totalDays = daysInMonth(viewDate);
        const firstDay = firstDayOfMonth(viewDate);

        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), i));
        }
        return days;
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
        setViewDate(newDate);
    };

    const isSameDay = (d1: Date, d2String?: string | null) => {
        if (!d2String) return false;
        const datePart = d2String.split('T')[0]; // Handle datetime strings
        const [y, m, d] = datePart.split('-').map(Number);
        const d2 = new Date(y, m - 1, d);

        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const isToday = (d: Date) => {
        const today = new Date();
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    };

    const handleDateSelect = (date: Date) => {
        // Directly select date and close (no time step)
        onSelectDate(date);
        onClose();
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
                <View style={styles.calendarContainer} onStartShouldSetResponder={() => true}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowBtn}>
                            <Text style={styles.arrowText}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>
                            {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </Text>
                        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowBtn}>
                            <Text style={styles.arrowText}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Weekday Labels */}
                    <View style={styles.weekRow}>
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                            <Text key={i} style={styles.weekdayLabel}>{day}</Text>
                        ))}
                    </View>

                    {/* Days Grid */}
                    <View style={styles.daysGrid}>
                        {generateMonthDays().map((date, index) => (
                            <View key={index} style={styles.dayCell}>
                                {date && (
                                    <TouchableOpacity
                                        style={[
                                            styles.dayButton,
                                            isSameDay(date, selectedDate) && styles.selectedDay,
                                            !isSameDay(date, selectedDate) && isToday(date) && styles.currentDayHighlight
                                        ]}
                                        onPress={() => handleDateSelect(date)}
                                    >
                                        <Text style={[
                                            styles.dayText,
                                            isSameDay(date, selectedDate) && styles.selectedDayText,
                                            !isSameDay(date, selectedDate) && isToday(date) && styles.currentDayText
                                        ]}>
                                            {date.getDate()}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </View>

                    {/* Today Button */}
                    <TouchableOpacity
                        style={styles.todayLink}
                        onPress={() => {
                            const today = new Date();
                            handleDateSelect(today);
                            setViewDate(today);
                        }}
                    >
                        <Text style={styles.todayLinkText}>Select Today</Text>
                    </TouchableOpacity>
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
    calendarContainer: {
        width: SCREEN_WIDTH * 0.85,
        backgroundColor: THEME.bg,
        borderRadius: 4,
        padding: 16,
        borderWidth: 2,
        borderColor: THEME.border,
        // Tactile Shadow
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    arrowBtn: {
        padding: 8,
    },
    arrowText: {
        fontSize: 24,
        color: THEME.textPrimary,
        lineHeight: 24,
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    weekdayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 'bold',
        color: THEME.textSecondary,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%', // 100% / 7
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    dayButton: {
        width: 32,
        height: 32,
        borderRadius: 4, // More square
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedDay: {
        backgroundColor: THEME.activeBlue,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: THEME.border,
    },
    currentDayHighlight: {
        backgroundColor: '#F0F9FF', // Very light blue fill
        borderWidth: 2, // Thicker border
        borderColor: '#007AFF', // Clear system blue
        borderRadius: 4,
    },
    dayText: {
        fontSize: 16,
        color: THEME.textPrimary,
        fontWeight: '500',
    },
    selectedDayText: {
        color: THEME.textPrimary,
        fontWeight: 'bold',
    },
    currentDayText: {
        fontWeight: 'bold',
        color: '#007AFF', // Blue text
    },
    todayLink: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: THEME.surface,
        borderWidth: 1.5,
        borderColor: THEME.border,
        borderRadius: 4,
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    todayLinkText: {
        color: THEME.textPrimary,
        fontWeight: 'bold',
        fontSize: 14,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    // Time Picker Styles
    datePreview: {
        textAlign: 'center',
        fontSize: 16,
        color: THEME.textSecondary,
        marginBottom: 20,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    timePickerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    timeColumn: {
        alignItems: 'center',
        width: 60,
    },
    timeArrow: {
        padding: 8,
    },
    timeValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        marginVertical: 8,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    timeColon: {
        fontSize: 32,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        marginHorizontal: 8,
    },
    timeActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    skipBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: THEME.border,
        borderRadius: 4,
        backgroundColor: THEME.surface,
    },
    skipBtnText: {
        color: THEME.textSecondary,
        fontWeight: '600',
        fontSize: 14,
    },
    confirmBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: THEME.activeBlue,
        borderWidth: 1.5,
        borderColor: THEME.border,
        borderRadius: 4,
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    confirmBtnText: {
        color: THEME.textPrimary,
        fontWeight: 'bold',
        fontSize: 14,
    },
});
