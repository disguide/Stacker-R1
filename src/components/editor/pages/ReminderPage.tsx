import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { ActionBar } from '../common/ActionBar';
import { TimeWheelPanel } from '../common/TimeWheelPanel';

export function ReminderPage({ width, reminderOffset, reminderTime, reminderEnabled, onReminderChange, onClose }: {
    width: number;
    reminderOffset: number | null;
    reminderTime: string | null;
    reminderEnabled: boolean;
    onReminderChange: (offset: number | null, time: string | null) => void;
    onClose: () => void;
}) {
    // Parse incoming time into hour/minute
    const parseTime = (t: string | null) => {
        if (!t) return { h: 9, m: 0 };
        const [h, m] = t.split(':').map(Number);
        return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
    };
    const parsed = parseTime(reminderTime);
    const [tempHour, setTempHour] = useState(parsed.h);
    const [tempMinute, setTempMinute] = useState(parsed.m);
    // Default to 0 (Same day) if null
    const [tempOffset, setTempOffset] = useState(reminderOffset !== null ? reminderOffset : 0);

    // ─── Auto-save: apply changes immediately when wheels change ────
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        const hh = String(tempHour).padStart(2, '0');
        const mm = String(tempMinute).padStart(2, '0');
        onReminderChange(0, `${hh}:${mm}`); // Always 0 offset
    }, [tempHour, tempMinute]);

    const hasReminder = reminderOffset !== null;

    const handleReset = () => {
        setTempHour(9);
        setTempMinute(0);
        onReminderChange(null, null);
    };

    const handleConfirm = () => {
        // Ensure the current selection is applied when validating
        const hh = String(tempHour).padStart(2, '0');
        const mm = String(tempMinute).padStart(2, '0');
        onReminderChange(0, `${hh}:${mm}`); // Always 0 offset
        onClose();
    };

    return (
        <View style={{ width, flex: 1 }}>
            <View style={{ flex: 1, paddingTop: 60 }}>
                <View style={{ flex: 1, opacity: reminderEnabled ? 1 : 0.3 }} pointerEvents={reminderEnabled ? 'auto' : 'none'}>
                    <TimeWheelPanel
                        hour={tempHour}
                        minute={tempMinute}
                        onHourChange={setTempHour}
                        onMinuteChange={setTempMinute}
                    />
                </View>
                {!reminderEnabled && (
                    <Pressable
                        style={[StyleSheet.absoluteFill, { top: 60 }]}
                        onPress={() => {
                            // Activate on touch if disabled
                            const hh = String(tempHour).padStart(2, '0');
                            const mm = String(tempMinute).padStart(2, '0');
                            onReminderChange(0, `${hh}:${mm}`);
                        }}
                    />
                )}
            </View>
            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={hasReminder} />
        </View>
    );
}

export default React.memo(ReminderPage);
