import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
    FlatList,
    Animated,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 40, 360);
const ROW_HEIGHT = 42;
const HEADER_HEIGHT = 54;

const THEME = {
    bg: '#FFFFFF',
    textPrimary: '#1E293B', // Slate 800
    textSecondary: '#64748B', // Slate 500
    accent: '#475569', // Slate 600
    border: '#F1F5F9', // Slate 100
    surface: '#FFFFFF',
    activeMint: '#ECFDF5', // Mint 50
    activeMintText: '#059669', // Mint 600
};

interface CalendarModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectDate: (date: Date | null, hasTime?: boolean) => void;
    selectedDate?: string | null;
    title?: string; // Added to allow customizing the modal title
}

// Snappy Animated Day Cell
const DayCell = React.memo(({ date, isSelected, isToday, onSelect }: { date: Date | null, isSelected: boolean, isToday: boolean, onSelect: (d: Date) => void }) => {
    const scaleAnim = useRef(new Animated.Value(isSelected ? 1 : 0.8)).current;

    useEffect(() => {
        if (isSelected) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                stiffness: 1000,
                damping: 40,
            }).start();
        } else {
            scaleAnim.setValue(0.8);
        }
    }, [isSelected]);

    if (!date) return <View style={styles.dayCell} />;

    return (
        <View style={styles.dayCell}>
            <TouchableOpacity
                activeOpacity={0.7}
                style={[
                    styles.dayButton,
                    !isSelected && isToday && styles.currentDayHighlight
                ]}
                onPress={() => onSelect(date)}
            >
                {isSelected && (
                    <Animated.View style={[
                        styles.selectedDayMarker,
                        { transform: [{ scale: scaleAnim }] }
                    ]} />
                )}
                <Text style={[
                    styles.dayText,
                    isSelected && styles.selectedDayText,
                    !isSelected && isToday && styles.currentDayText
                ]}>
                    {date.getDate()}
                </Text>
            </TouchableOpacity>
        </View>
    );
});

// Month Grid Component
const MonthSection = React.memo(({ data, selectedDate, onSelect }: { data: { date: Date }, selectedDate: Date | null, onSelect: (d: Date) => void }) => {
    const { t } = useTranslation();
    const monthDate = data.date;
    const days = useMemo(() => {
        const result = [];
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        const firstDay = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7;
        for (let i = 0; i < firstDay; i++) result.push(null);
        for (let i = 1; i <= daysInMonth; i++) result.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i));
        return result;
    }, [monthDate]);

    const isSameDay = (d1: Date, d2: Date | null) => {
        if (!d2) return false;
        return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    };

    const isToday = (d: Date) => {
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    };

    const monthNames = [
        t('calendar.months.january'),
        t('calendar.months.february'),
        t('calendar.months.march'),
        t('calendar.months.april'),
        t('calendar.months.may'),
        t('calendar.months.june'),
        t('calendar.months.july'),
        t('calendar.months.august'),
        t('calendar.months.september'),
        t('calendar.months.october'),
        t('calendar.months.november'),
        t('calendar.months.december'),
    ];

    return (
        <View style={styles.monthContainer}>
            <Text style={styles.monthTitle}>{monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}</Text>
            <View style={styles.daysGrid}>
                {days.map((date, index) => (
                    <DayCell
                        key={index}
                        date={date}
                        isSelected={date ? isSameDay(date, selectedDate) : false}
                        isToday={date ? isToday(date) : false}
                        onSelect={onSelect}
                    />
                ))}
            </View>
        </View>
    );
});

// Premium Header
const ModalHeader = ({ title, onClose }: { title: string, onClose: () => void }) => (
    <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{title}</Text>
        <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={22} color={THEME.textSecondary} />
        </TouchableOpacity>
    </View>
);

export default function CalendarModal({ visible, onClose, onSelectDate, selectedDate, title }: CalendarModalProps) {
    const { t } = useTranslation();
    const listRef = useRef<FlatList>(null);
    const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);

    const weekdays = useMemo(() => [
        t('calendar.daysShort.MO'),
        t('calendar.daysShort.TU'),
        t('calendar.daysShort.WE'),
        t('calendar.daysShort.TH'),
        t('calendar.daysShort.FR'),
        t('calendar.daysShort.SA'),
        t('calendar.daysShort.SU'),
    ], [t]);

    // Generate 24 months of data
    const months = useMemo(() => {
        const result = [];
        const start = new Date();
        start.setDate(1);
        let currentOffset = 0;
        for (let i = 0; i < 24; i++) {
            const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
            const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const firstDay = (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7;
            const weeks = Math.ceil((daysInMonth + firstDay) / 7);
            const height = HEADER_HEIGHT + (weeks * ROW_HEIGHT) + 20; // + padding
            result.push({ date: d, height, offset: currentOffset });
            currentOffset += height;
        }
        return result;
    }, []);

    // Sync external selectedDate to internal state
    useEffect(() => {
        if (visible) {
            let initialDateObj: Date | null = null;
            if (selectedDate) {
                const cleanDate = selectedDate.includes('T') ? selectedDate : selectedDate;
                initialDateObj = new Date(cleanDate);
                if (isNaN(initialDateObj.getTime())) initialDateObj = null;
            }
            setTempSelectedDate(initialDateObj);

            // Scroll to selection
            setTimeout(() => {
                const targetDate = initialDateObj || new Date();
                const targetCode = `${targetDate.getFullYear()}-${targetDate.getMonth()}`;
                const index = months.findIndex(m => `${m.date.getFullYear()}-${m.date.getMonth()}` === targetCode);
                if (index !== -1 && listRef.current) {
                    listRef.current.scrollToIndex({ index, animated: false });
                }
            }, 150);
        }
    }, [visible, selectedDate, months]);

    const renderItem = useCallback(({ item }: { item: any }) => (
        <MonthSection
            data={item}
            selectedDate={tempSelectedDate}
            onSelect={(d) => {
                setTempSelectedDate(d);
                const finalDate = new Date(d);
                finalDate.setHours(0, 0, 0, 0);
                onSelectDate(finalDate, false);
                onClose();
            }}
        />
    ), [tempSelectedDate, onSelectDate, onClose]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.calendarCard}>
                    <ModalHeader title={title || t('editor.moveTaskToDate')} onClose={onClose} />
                    
                    <View style={styles.calendarContainer}>
                        <View style={styles.weekHeader}>
                            {weekdays.map((day, i) => (
                                <Text key={i} style={styles.weekdayLabel}>{day}</Text>
                            ))}
                        </View>
                        
                        <FlatList
                            ref={listRef}
                            data={months}
                            renderItem={renderItem}
                            keyExtractor={item => item.date.toISOString()}
                            initialNumToRender={4}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            showsVerticalScrollIndicator={false}
                            decelerationRate="fast"
                            getItemLayout={(data, index) => ({
                                length: data![index].height,
                                offset: data![index].offset,
                                index,
                            })}
                            contentContainerStyle={{ paddingBottom: 30 }}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate 900 with alpha
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarCard: {
        width: MODAL_WIDTH,
        height: 520,
        backgroundColor: THEME.bg,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: THEME.textPrimary,
        letterSpacing: -0.5,
    },
    closeIcon: {
        padding: 4,
        backgroundColor: THEME.border,
        borderRadius: 12,
    },
    calendarContainer: {
        flex: 1,
    },
    weekHeader: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderColor: THEME.border,
    },
    weekdayLabel: {
        width: '14.28%',
        textAlign: 'center',
        fontSize: 12,
        color: THEME.textSecondary,
        fontWeight: '700',
    },
    monthContainer: {
        paddingHorizontal: 12,
        paddingTop: 16,
    },
    monthTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: THEME.textPrimary,
        marginBottom: 12,
        marginLeft: 10,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        height: ROW_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayButton: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 18,
    },
    dayText: {
        fontSize: 15,
        color: THEME.textPrimary,
        fontWeight: '600',
        zIndex: 2,
    },
    currentDayHighlight: {
        backgroundColor: '#F1F5F9', // Slate 100
    },
    currentDayText: {
        color: '#334155', // Slate 700
    },
    selectedDayMarker: {
        position: 'absolute',
        width: 36,
        height: 36,
        borderRadius: 12, // Slightly squared circle for modern feel
        backgroundColor: '#334155', // Slate 700
        zIndex: 1,
    },
    selectedDayText: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
});
