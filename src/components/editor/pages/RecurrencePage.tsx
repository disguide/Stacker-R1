import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';
import { ActionBar } from '../common/ActionBar';
import { RecurrenceRule, RecurrenceFrequency, WeekDay } from '../../../services/storage';

const FREQUENCIES: { label: string; value: RecurrenceFrequency }[] = [
    { label: 'Day', value: 'daily' },
    { label: 'Week', value: 'weekly' },
    { label: 'Month', value: 'monthly' },
    { label: 'Year', value: 'yearly' },
];

const WEEKDAYS: { label: string; value: WeekDay }[] = [
    { label: 'M', value: 'MO' },
    { label: 'T', value: 'TU' },
    { label: 'W', value: 'WE' },
    { label: 'T', value: 'TH' },
    { label: 'F', value: 'FR' },
    { label: 'S', value: 'SA' },
    { label: 'S', value: 'SU' },
];

export default function RecurrencePage({ width, recurrence, onRecurrenceChange, onClose }: {
    width: number;
    recurrence: RecurrenceRule | null;
    onRecurrenceChange: (rule: RecurrenceRule | null) => void;
    onClose: () => void;
}) {
    const [viewMode, setViewMode] = useState<'presets' | 'custom'>('presets');
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
    const [interval, setIntervalVal] = useState('1');
    const [selectedDays, setSelectedDays] = useState<Set<WeekDay>>(new Set());
    const [localRecurrence, setLocalRecurrence] = useState<RecurrenceRule | null>(recurrence);

    useEffect(() => {
        setLocalRecurrence(recurrence);
        if (recurrence) {
            setViewMode('custom');
            setFrequency(recurrence.frequency);
            setIntervalVal(recurrence.interval.toString());
            if (recurrence.daysOfWeek) setSelectedDays(new Set(recurrence.daysOfWeek));
        } else {
            setViewMode('presets');
            setFrequency('weekly');
            setIntervalVal('1');
            setSelectedDays(new Set());
        }
    }, [recurrence]); // Added dependency

    const handlePreset = (type: string) => {
        let rule: RecurrenceRule | null = null;
        switch (type) {
            case 'daily': rule = { frequency: 'daily', interval: 1 }; break;
            case 'weekly': rule = { frequency: 'weekly', interval: 1 }; break;
            case 'monthly': rule = { frequency: 'monthly', interval: 1 }; break;
            case 'yearly': rule = { frequency: 'yearly', interval: 1 }; break;
            case 'weekdays': rule = { frequency: 'weekly', interval: 1, daysOfWeek: ['MO', 'TU', 'WE', 'TH', 'FR'] }; break;
            case 'none': rule = null; break;
        }
        setLocalRecurrence(rule);
    };

    const handleSaveCustom = () => {
        const repeatInterval = parseInt(interval, 10) || 1;
        const rule: RecurrenceRule = {
            frequency,
            interval: repeatInterval,
            daysOfWeek: frequency === 'weekly' && selectedDays.size > 0 ? Array.from(selectedDays) : undefined,
        };
        setLocalRecurrence(rule);
    };

    const toggleDay = (day: WeekDay) => {
        const newSet = new Set(selectedDays);
        if (newSet.has(day)) newSet.delete(day);
        else newSet.add(day);
        setSelectedDays(newSet);
    };

    const handleReset = () => {
        setLocalRecurrence(null);
        onRecurrenceChange(null);
        setViewMode('presets');
        setFrequency('weekly');
        setIntervalVal('1');
        setSelectedDays(new Set());
    };

    const handleConfirm = () => {
        onRecurrenceChange(localRecurrence);
        onClose();
    };

    return (
        <View style={{ width, flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {viewMode === 'presets' ? (
                    <View>
                        {[
                            { label: 'Does not repeat', type: 'none' },
                            { label: 'Every day', type: 'daily' },
                            { label: 'Every week', type: 'weekly' },
                            { label: 'Every month', type: 'monthly' },
                            { label: 'Every year', type: 'yearly' },
                            { label: 'Every weekday (Mon-Fri)', type: 'weekdays' },
                        ].map(preset => (
                            <TouchableOpacity
                                key={preset.type}
                                style={p.presetItem}
                                onPress={() => handlePreset(preset.type)}
                            >
                                <Text style={p.presetText}>{preset.label}</Text>
                                {(preset.type === 'none' && !localRecurrence) && (
                                    <Ionicons name="checkmark" size={20} color={THEME.green} />
                                )}
                                {localRecurrence && preset.type === localRecurrence.frequency && localRecurrence.interval === 1 && !localRecurrence.daysOfWeek && (
                                    <Ionicons name="checkmark" size={20} color={THEME.green} />
                                )}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={p.customBtn} onPress={() => setViewMode('custom')}>
                            <Text style={p.customBtnText}>Custom...</Text>
                            <Ionicons name="chevron-forward" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
                        {/* Frequency Selector */}
                        <Text style={p.sectionLabel}>Repeat every</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <TextInput
                                style={p.intervalInput}
                                keyboardType="number-pad"
                                value={interval}
                                onChangeText={setIntervalVal}
                                textAlign="center"
                            />
                        </View>

                        <View style={p.freqSelector}>
                            {FREQUENCIES.map(f => (
                                <TouchableOpacity
                                    key={f.value}
                                    style={[p.freqOption, frequency === f.value && p.freqOptionSelected]}
                                    onPress={() => setFrequency(f.value)}
                                >
                                    <Text style={[p.freqText, frequency === f.value && { color: '#FFF' }]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Weekday Selector */}
                        {frequency === 'weekly' && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={p.sectionLabel}>Repeats on</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    {WEEKDAYS.map(day => (
                                        <TouchableOpacity
                                            key={day.value}
                                            style={[
                                                p.dayCircle,
                                                selectedDays.has(day.value) && p.dayCircleSelected,
                                            ]}
                                            onPress={() => toggleDay(day.value)}
                                        >
                                            <Text style={[
                                                { fontSize: 12, fontWeight: '600', color: '#333' },
                                                selectedDays.has(day.value) && { color: '#FFF' },
                                            ]}>
                                                {day.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Apply custom button */}
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                            <TouchableOpacity onPress={() => setViewMode('presets')} style={p.backBtn}>
                                <Text style={{ color: THEME.textSecondary, fontWeight: '600' }}>Back</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleSaveCustom} style={p.applyCustomBtn}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Apply</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>

            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={!!localRecurrence} />
        </View>
    );
}

const p = StyleSheet.create({
    presetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: THEME.border,
    },
    presetText: {
        fontSize: 16,
        color: THEME.textPrimary,
    },
    customBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        marginTop: 8,
    },
    customBtnText: {
        fontSize: 16,
        fontWeight: '500',
        color: THEME.textPrimary,
    },
    intervalInput: {
        width: 60,
        height: 40,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 8,
        fontSize: 18,
        padding: 4,
        backgroundColor: '#FFF',
    },
    freqSelector: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 2,
        marginBottom: 20,
    },
    freqOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 6,
    },
    freqOptionSelected: {
        backgroundColor: '#333',
    },
    freqText: {
        fontSize: 13,
        color: '#333',
        fontWeight: '500',
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayCircleSelected: {
        backgroundColor: '#333',
    },
    sectionLabel: {
        fontSize: 14,
        color: THEME.textSecondary,
        fontWeight: '600',
        marginBottom: 10,
        marginTop: 8,
    },
    backBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    applyCustomBtn: {
        flex: 2,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: THEME.accent,
        borderRadius: 8,
    },
});
