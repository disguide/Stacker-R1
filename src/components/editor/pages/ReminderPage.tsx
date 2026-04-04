import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { ActionBar } from '../common/ActionBar';
import { TimeWheelPanel } from '../common/TimeWheelPanel';
import { StorageService } from '../../../services/storage';

export function ReminderPage({ width, reminderOffset, reminderTime, reminderEnabled, onReminderChange, onClose }: {
    width: number;
    reminderOffset: number | null;
    reminderTime: string | null;
    reminderEnabled: boolean;
    onReminderChange: (offset: number | null, time: string | null) => void;
    onClose: () => void;
}) {
    const parseTime = (t: string | null) => {
        if (!t) return { h: 9, m: 0 };
        const [h, m] = t.split(':').map(Number);
        return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
    };

    const parsed = parseTime(reminderTime);
    const [tempHour, setTempHour] = useState(parsed.h);
    const [tempMinute, setTempMinute] = useState(parsed.m);
    const [is24h, setIs24h] = useState(true);

    // Sync local state when the reminder prop changes externally (e.g. switching tasks)
    const prevReminderTimeRef = useRef(reminderTime);
    useEffect(() => {
        if (reminderTime !== prevReminderTimeRef.current) {
            prevReminderTimeRef.current = reminderTime;
            const { h, m } = parseTime(reminderTime);
            setTempHour(h);
            setTempMinute(m);
        }
    }, [reminderTime]);

    // Real-time sync: push hour/minute changes up to parent as user scrolls
    // isMounted skips the initial render to avoid overwriting a null reminderOffset
    const isMounted = useRef(false);
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        const hh = String(tempHour).padStart(2, '0');
        const mm = String(tempMinute).padStart(2, '0');
        onReminderChange(0, `${hh}:${mm}`);
    }, [tempHour, tempMinute]);

    useEffect(() => {
        StorageService.loadSprintSettings().then(s => setIs24h(!!s.use24HourFormat));
    }, []);

    const toggle24h = async () => {
        const newMode = !is24h;
        setIs24h(newMode);
        const settings = await StorageService.loadSprintSettings();
        await StorageService.saveSprintSettings({ ...settings, use24HourFormat: newMode });
    };

    const hasReminder = reminderOffset !== null;

    const handleReset = () => {
        setTempHour(9);
        setTempMinute(0);
        onReminderChange(null, null);
        // Reset isMounted so the cleared state doesn't trigger a re-enable
        isMounted.current = false;
    };

    const formatTime = () => {
        if (is24h) {
            return `${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`;
        }
        const h12 = tempHour % 12 || 12;
        const period = tempHour >= 12 ? 'PM' : 'AM';
        return `${h12}:${String(tempMinute).padStart(2, '0')} ${period}`;
    };

    return (
        <View style={{ width, flex: 1 }}>
            <View style={{ flex: 1, paddingTop: 60 }}>
                <View style={{ flex: 1 }}>
                    <TouchableOpacity
                        onPress={toggle24h}
                        style={{
                            alignSelf: 'center',
                            paddingHorizontal: 12,
                            paddingVertical: 4,
                            borderWidth: 1,
                            borderColor: '#CCC',
                            borderRadius: 6,
                            marginBottom: 20
                        }}
                    >
                        <Text style={{ fontSize: 12, fontWeight: '600' }}>{is24h ? '24H Mode' : '12H Mode'}</Text>
                    </TouchableOpacity>

                    <TimeWheelPanel
                        hour={tempHour}
                        minute={tempMinute}
                        onHourChange={setTempHour}
                        onMinuteChange={setTempMinute}
                        is24h={is24h}
                    />
                </View>
            </View>

            {/* Visual Confirmation Banner */}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#FAFBFC', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                {hasReminder ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981' }}>
                        <MaterialCommunityIcons name="bell-ring" size={16} color="#10B981" />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#10B981' }}>{formatTime()}</Text>
                        <TouchableOpacity onPress={handleReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <MaterialCommunityIcons name="bell-off-outline" size={16} color="#64748B" />
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748B' }}>No Reminder</Text>
                    </View>
                )}
            </View>

            <ActionBar onReset={handleReset} onConfirm={onClose} hasValue={hasReminder} />
        </View>
    );
}

export default React.memo(ReminderPage);
