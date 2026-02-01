import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, TextInput, Switch, Platform } from 'react-native';
import { RecurrenceRule, RecurrenceFrequency, WeekDay } from '../services/storage';
import { Ionicons } from '@expo/vector-icons';

interface RecurrencePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (rule: RecurrenceRule | null) => void;
    initialRule?: RecurrenceRule | null; // For editing
}

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

export default function RecurrencePickerModal({ visible, onClose, onSave, initialRule }: RecurrencePickerModalProps) {
    const [viewMode, setViewMode] = useState<'presets' | 'custom'>('presets');

    // Custom State
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
    const [interval, setInterval] = useState<string>('1');
    const [selectedDays, setSelectedDays] = useState<Set<WeekDay>>(new Set());
    const [hasEndDate, setHasEndDate] = useState(false);
    // Ideally use a DatePicker here, but for MVP keep it simple or strictly "Never" vs "On Date" logic later
    // For now, let's stick to "Never" or "After X occurrences" if requested, else simple endless.

    useEffect(() => {
        if (initialRule) {
            setViewMode('custom'); // Or detect if it matches a preset
            setFrequency(initialRule.frequency);
            setInterval(initialRule.interval.toString());
            if (initialRule.daysOfWeek) {
                setSelectedDays(new Set(initialRule.daysOfWeek));
            }
        } else {
            // Default reset
            setViewMode('presets');
            setFrequency('weekly');
            setInterval('1');
            setSelectedDays(new Set());
        }
    }, [visible, initialRule]);

    const handleSaveCustom = () => {
        const repeatInterval = parseInt(interval, 10) || 1;
        const rule: RecurrenceRule = {
            frequency,
            interval: repeatInterval,
            daysOfWeek: frequency === 'weekly' && selectedDays.size > 0 ? Array.from(selectedDays) : undefined,
            // endDate: ... logic
        };
        onSave(rule);
        onClose();
    };

    const handlePreset = (type: string) => {
        let rule: RecurrenceRule | null = null;

        switch (type) {
            case 'daily':
                rule = { frequency: 'daily', interval: 1 };
                break;
            case 'weekly':
                rule = { frequency: 'weekly', interval: 1 };
                break;
            case 'monthly':
                rule = { frequency: 'monthly', interval: 1 };
                break;
            case 'yearly':
                rule = { frequency: 'yearly', interval: 1 };
                break;
            case 'weekdays':
                rule = { frequency: 'weekly', interval: 1, daysOfWeek: ['MO', 'TU', 'WE', 'TH', 'FR'] };
                break;
            case 'none':
                rule = null;
                break;
        }
        onSave(rule);
        onClose();
    };

    const toggleDay = (day: WeekDay) => {
        const newSet = new Set(selectedDays);
        if (newSet.has(day)) newSet.delete(day);
        else newSet.add(day);
        setSelectedDays(newSet);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Recurrence</Text>
                        {viewMode === 'custom' ? (
                            <TouchableOpacity onPress={handleSaveCustom}>
                                <Text style={styles.saveText}>Done</Text>
                            </TouchableOpacity>
                        ) : <View style={{ width: 40 }} />}
                    </View>

                    <ScrollView style={styles.content}>
                        {viewMode === 'presets' ? (
                            <View style={styles.presetList}>
                                <TouchableOpacity style={styles.presetItem} onPress={() => handlePreset('none')}>
                                    <Text style={styles.presetText}>Does not repeat</Text>
                                    {initialRule === null && <Ionicons name="checkmark" size={20} color="blue" />}
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.presetItem} onPress={() => handlePreset('daily')}>
                                    <Text style={styles.presetText}>Every day</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.presetItem} onPress={() => handlePreset('weekly')}>
                                    <Text style={styles.presetText}>Every week</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.presetItem} onPress={() => handlePreset('monthly')}>
                                    <Text style={styles.presetText}>Every month</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.presetItem} onPress={() => handlePreset('yearly')}>
                                    <Text style={styles.presetText}>Every year</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.presetItem} onPress={() => handlePreset('weekdays')}>
                                    <Text style={styles.presetText}>Every weekday (Mon-Fri)</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.customBtn} onPress={() => setViewMode('custom')}>
                                    <Text style={styles.customBtnText}>Custom...</Text>
                                    <Ionicons name="chevron-forward" size={20} color="#666" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.customForm}>
                                {/* Frequency & Interval */}
                                <View style={styles.formRow}>
                                    <Text style={styles.label}>Repeat every</Text>
                                    <View style={styles.intervalRow}>
                                        <TextInput
                                            style={styles.intervalInput}
                                            keyboardType="number-pad"
                                            value={interval}
                                            onChangeText={setInterval}
                                            textAlign="center"
                                        />
                                        <View style={styles.freqTabs}>
                                            {// Simple dropdown logic replaced by tabs for UX
                                            }
                                        </View>
                                    </View>
                                </View>

                                {/* Frequency Selector */}
                                <View style={styles.freqSelector}>
                                    {FREQUENCIES.map(f => (
                                        <TouchableOpacity
                                            key={f.value}
                                            style={[styles.freqOption, frequency === f.value && styles.freqOptionSelected]}
                                            onPress={() => setFrequency(f.value)}
                                        >
                                            <Text style={[styles.freqText, frequency === f.value && { color: '#FFF' }]}>
                                                {f.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Weekday Selector (Only if Weekly) */}
                                {frequency === 'weekly' && (
                                    <View style={styles.weekdaysContainer}>
                                        <Text style={styles.label}>Repeats on</Text>
                                        <View style={styles.weekdaysRow}>
                                            {WEEKDAYS.map(day => (
                                                <TouchableOpacity
                                                    key={day.value}
                                                    style={[styles.dayCircle, selectedDays.has(day.value) && styles.dayCircleSelected]}
                                                    onPress={() => toggleDay(day.value)}
                                                >
                                                    <Text style={[styles.dayText, selectedDays.has(day.value) && { color: '#FFF' }]}>
                                                        {day.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {/* Back Button */}
                                <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('presets')}>
                                    <Text style={styles.backBtnText}>{'< Back to Presets'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
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
    container: {
        width: '85%',
        backgroundColor: '#FFF',
        borderRadius: 12,
        maxHeight: '70%',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    closeBtn: { padding: 4 },
    title: { fontSize: 18, fontWeight: '600' },
    saveText: { color: 'blue', fontWeight: '600', fontSize: 16 },
    content: { padding: 0 },
    presetList: { paddingVertical: 8 },
    presetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#EEE',
    },
    presetText: { fontSize: 16 },
    customBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginTop: 8,
    },
    customBtnText: { fontSize: 16, fontWeight: '500' },

    // Custom Form Styles
    customForm: { padding: 16 },
    formRow: { marginBottom: 16 },
    label: { fontSize: 14, color: '#666', marginBottom: 8 },
    intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    intervalInput: {
        width: 60,
        height: 40,
        borderWidth: 1,
        borderColor: '#CCC',
        borderRadius: 8,
        fontSize: 18,
        padding: 4,
    },
    freqTabs: {
        flexDirection: 'row',
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
    freqOptionSelected: { backgroundColor: '#000' },
    freqText: { fontSize: 13, color: '#333', fontWeight: '500' },
    weekdaysContainer: { marginBottom: 20 },
    weekdaysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayCircleSelected: { backgroundColor: '#000' },
    dayText: { fontSize: 12, fontWeight: '600', color: '#333' },
    backBtn: { marginTop: 10, padding: 10, alignItems: 'center' },
    backBtnText: { color: 'blue' },
});
