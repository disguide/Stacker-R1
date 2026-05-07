import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';
import { ActionBar } from '../common/ActionBar';
import { RecurrenceRule, RecurrenceFrequency, WeekDay } from '../../../services/storage';
import { useTranslation } from 'react-i18next';

export function RecurrencePage({ width, recurrence, onRecurrenceChange, onClose }: {
    width: number;
    recurrence: RecurrenceRule | null;
    onRecurrenceChange: (rule: RecurrenceRule | null) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();

    const FREQUENCIES: { label: string; value: RecurrenceFrequency | 'none' }[] = [
        { label: t('recurrence.none'), value: 'none' },
        { label: t('recurrence.daily'), value: 'daily' },
        { label: t('recurrence.weekly'), value: 'weekly' },
        { label: t('recurrence.monthly'), value: 'monthly' },
        { label: t('recurrence.yearly'), value: 'yearly' },
    ];

    const WEEKDAYS: { label: string; value: WeekDay }[] = [
        { label: t('calendar.daysShort.1', { defaultValue: 'M' }), value: 'MO' },
        { label: t('calendar.daysShort.2', { defaultValue: 'T' }), value: 'TU' },
        { label: t('calendar.daysShort.3', { defaultValue: 'W' }), value: 'WE' },
        { label: t('calendar.daysShort.4', { defaultValue: 'T' }), value: 'TH' },
        { label: t('calendar.daysShort.5', { defaultValue: 'F' }), value: 'FR' },
        { label: t('calendar.daysShort.6', { defaultValue: 'S' }), value: 'SA' },
        { label: t('calendar.daysShort.0', { defaultValue: 'S' }), value: 'SU' },
    ];

    const [frequency, setFrequency] = useState<RecurrenceFrequency | 'none'>('none');
    const [intervalVal, setIntervalVal] = useState(1);
    const [selectedDays, setSelectedDays] = useState<Set<WeekDay>>(new Set());
    const [localRecurrence, setLocalRecurrence] = useState<RecurrenceRule | null>(recurrence);

    const [prevRecurrence, setPrevRecurrence] = useState<RecurrenceRule | null>(recurrence);

    // Sync from props
    if (recurrence !== prevRecurrence) {
        setPrevRecurrence(recurrence);
        setLocalRecurrence(recurrence);
        if (recurrence) {
            setFrequency(recurrence.frequency);
            setIntervalVal(recurrence.interval || 1);
            if (Array.isArray(recurrence.daysOfWeek)) setSelectedDays(new Set(recurrence.daysOfWeek));
        } else {
            setFrequency('none');
            setIntervalVal(1);
            setSelectedDays(new Set());
        }
    }

    // Auto-save changes synchronously through handlers instead of useEffect
    const updateParent = (f: RecurrenceFrequency | 'none', i: number, days: Set<WeekDay>) => {
        let rule: RecurrenceRule | null = null;
        if (f !== 'none') {
            rule = {
                frequency: f,
                interval: i,
                daysOfWeek: f === 'weekly' && days.size > 0 ? Array.from(days) : undefined,
            };
        }
        
        // Skip JSON comparison and force update to ensure parent gets Latest state immediately
        setLocalRecurrence(rule);
        onRecurrenceChange(rule);
    };

    const toggleDay = (day: WeekDay) => {
        const newSet = new Set(selectedDays);
        if (newSet.has(day)) newSet.delete(day);
        else newSet.add(day);
        setSelectedDays(newSet);
        updateParent(frequency, intervalVal, newSet);
    };

    const handleReset = () => {
        setFrequency('none');
        setIntervalVal(1);
        setSelectedDays(new Set());
        updateParent('none', 1, new Set());
    };

    const handleConfirm = () => {
        onClose();
    };

    const getFrequencyPlural = () => {
        const count = intervalVal;
        switch (frequency) {
            case 'daily': return t('editor.unit_day', { count });
            case 'weekly': return t('editor.unit_week', { count });
            case 'monthly': return t('editor.unit_month', { count });
            case 'yearly': return t('editor.unit_year', { count });
            default: return '';
        }
    };

    return (
        <View style={{ width, flex: 1 }}>
            <ScrollView 
                keyboardShouldPersistTaps="always" 
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }} 
                showsVerticalScrollIndicator={false} 
                nestedScrollEnabled={true}
            >
                {/* Frequency List */}
                <View style={s.listCard}>
                    {FREQUENCIES.map((f, i) => {
                        const isSelected = frequency === f.value;
                        return (
                            <TouchableOpacity 
                                key={f.value}
                                style={[
                                    s.listItem, 
                                    i === 0 && s.listFirst, 
                                    i === FREQUENCIES.length - 1 && s.listLast,
                                    isSelected && s.listItemSelected
                                ]} 
                                onPress={() => {
                                    setFrequency(f.value);
                                    updateParent(f.value, intervalVal, selectedDays);
                                }}
                            >
                                <Text style={[s.listText, isSelected && s.listTextSelected]}>{f.label}</Text>
                                {isSelected && <Ionicons name="checkmark-circle" size={20} color={THEME.green} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Custom Options (Only show if repeating) */}
                {frequency !== 'none' && (
                    <View style={s.customContainer}>
                        
                        {/* Stepper for Interval */}
                        <View style={s.stepperCard}>
                            <Text style={s.sectionLabel}>{t('recurrence.repeatEvery')}</Text>
                            
                            <View style={s.stepperControls}>
                                <TouchableOpacity 
                                    style={s.stepperBtn} 
                                    onPress={() => {
                                        const newVal = Math.max(1, intervalVal - 1);
                                        setIntervalVal(newVal);
                                        updateParent(frequency, newVal, selectedDays);
                                    }}
                                    disabled={intervalVal <= 1}
                                >
                                    <Ionicons name="remove" size={24} color={intervalVal <= 1 ? '#D1D5DB' : THEME.textPrimary} />
                                </TouchableOpacity>
                                
                                <View style={s.stepperDisplay}>
                                    <Text style={s.stepperValue}>{intervalVal}</Text>
                                    <Text style={s.stepperUnit}>{getFrequencyPlural()}</Text>
                                </View>
                                
                                <TouchableOpacity 
                                    style={s.stepperBtn} 
                                    onPress={() => {
                                        const newVal = intervalVal + 1;
                                        setIntervalVal(newVal);
                                        updateParent(frequency, newVal, selectedDays);
                                    }}
                                >
                                    <Ionicons name="add" size={24} color={THEME.textPrimary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Weekly Day Selector */}
                        {frequency === 'weekly' && (
                            <View style={s.stepperCard}>
                                <Text style={s.sectionLabel}>{t('recurrence.onTheseDays')}</Text>
                                <View style={s.dayGrid}>
                                    {WEEKDAYS.map(day => {
                                        const isSelected = selectedDays.has(day.value);
                                        return (
                                            <TouchableOpacity
                                                key={day.value}
                                                style={[
                                                    s.dayBubble,
                                                    isSelected && s.dayBubbleSelected,
                                                ]}
                                                onPress={() => toggleDay(day.value)}
                                            >
                                                <Text style={[
                                                    s.dayBubbleText,
                                                    isSelected && s.dayBubbleTextSelected,
                                                ]}>
                                                    {day.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                {selectedDays.size === 0 && (
                                    <Text style={s.helperText}>{t('recurrence.noDaysHelper')}</Text>
                                )}
                            </View>
                        )}

                    </View>
                )}
            </ScrollView>
            
            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={frequency !== 'none'} />
        </View>
    );
}

export default React.memo(RecurrencePage);

const s = StyleSheet.create({
    listCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: THEME.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F3F4F6',
    },
    listFirst: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    listLast: {
        borderBottomWidth: 0,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    listItemSelected: {
        backgroundColor: '#F0FDF4', // very light forest green
    },
    listText: {
        fontSize: 16,
        color: THEME.textPrimary,
        fontWeight: '500',
    },
    listTextSelected: {
        color: THEME.green,
        fontWeight: '600',
    },
    customContainer: {
        marginTop: 24,
        gap: 16,
    },
    stepperCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: THEME.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 16,
    },
    stepperControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    stepperBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    stepperDisplay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperValue: {
        fontSize: 24,
        fontWeight: '700',
        color: THEME.textPrimary,
    },
    stepperUnit: {
        fontSize: 14,
        fontWeight: '500',
        color: THEME.textSecondary,
        marginTop: -2,
    },
    dayGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayBubble: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayBubbleSelected: {
        backgroundColor: THEME.green,
    },
    dayBubbleText: {
        fontSize: 14,
        fontWeight: '600',
        color: THEME.textPrimary,
    },
    dayBubbleTextSelected: {
        color: '#FFF',
    },
    helperText: {
        fontSize: 12,
        color: THEME.textSecondary,
        marginTop: 12,
        fontStyle: 'italic',
        textAlign: 'center',
    },
});
