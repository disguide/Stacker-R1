
// Simplified Reminder Modal based on CalendarModal
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    ScrollView,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Theme Constants
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    accent: '#007AFF', // Blue for Reminders
    border: '#E2E8F0',
    surface: '#FFFFFF',
    shadowColor: '#000000',
    activeBlue: '#E3F2FD',
    activeBlueText: '#333',
};

interface ReminderModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectReminder: (offset: number, time: string) => void;
    initialOffset?: number;
    initialTime?: string;
}

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 3; // Show 3 items (1 selected + 1 above + 1 below)
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// ScrollView-based Wheel Picker (same pattern as CalendarModal)
const WheelPicker = ({ items, selectedValue, onChange, formatLabel }: { items: (string | number)[], selectedValue: string | number, onChange: (val: any) => void, formatLabel?: (val: any) => string }) => {
    const scrollRef = useRef<ScrollView>(null);
    const momentumStarted = useRef(false);
    const hasMounted = useRef(false);

    // Only scroll on MOUNT — not on every selectedValue change
    // This is the critical fix: re-scrolling on selectedValue change causes a feedback loop
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true;
            const index = items.indexOf(selectedValue);
            if (index >= 0) {
                setTimeout(() => {
                    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
                }, 50);
            }
        }
    }, []);

    const handleScrollEnd = (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        const newValue = items[clampedIndex];

        if (newValue !== undefined && newValue !== selectedValue) {
            onChange(newValue);
        }
        momentumStarted.current = false;
    };

    return (
        <View style={{ height: WHEEL_HEIGHT, width: 90, overflow: 'hidden' }}>
            {/* Selection Overlay (Center Highlight) */}
            <View style={{
                position: 'absolute',
                top: ITEM_HEIGHT, // 1 item from top = center of 3
                height: ITEM_HEIGHT,
                width: '100%',
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: THEME.accent,
                backgroundColor: 'rgba(0,122,255,0.05)',
                pointerEvents: 'none',
                zIndex: 10
            }} />

            <ScrollView
                ref={scrollRef}
                nestedScrollEnabled={true}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                onScrollBeginDrag={() => {
                    momentumStarted.current = false;
                }}
                onMomentumScrollBegin={() => {
                    momentumStarted.current = true;
                }}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={(e) => {
                    // Fallback if no momentum (short/slow drag)
                    e.persist();
                    setTimeout(() => {
                        if (!momentumStarted.current) {
                            handleScrollEnd(e);
                        }
                    }, 50);
                }}
            >
                {items.map((item, index) => {
                    const isSelected = item === selectedValue;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => {
                                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                                onChange(item);
                            }}
                        >
                            <Text style={{
                                fontSize: isSelected ? 20 : 16,
                                fontWeight: isSelected ? '600' : '400',
                                color: isSelected ? THEME.textPrimary : THEME.textSecondary,
                                opacity: isSelected ? 1 : 0.4,
                            }}>
                                {formatLabel ? formatLabel(item) : item.toString().padStart(2, '0')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const OFFSETS = [0, 1, 2, 3, 5, 7, 14, 30]; // Expanded options

export default function ReminderModal({ visible, onClose, onSelectReminder, initialOffset = 0, initialTime }: ReminderModalProps) {
    const [offset, setOffset] = useState(initialOffset);

    // Time State
    const [is24h, setIs24h] = useState(true);
    const [hour, setHour] = useState(9);
    const [minute, setMinute] = useState(0);

    useEffect(() => {
        if (visible) {
            setOffset(initialOffset || 0);
            if (initialTime) {
                const [h, m] = initialTime.split(':').map(Number);
                setHour(h);
                setMinute(m);
            } else {
                const now = new Date();
                setHour(now.getHours());
                setMinute(now.getMinutes());
            }
        }
    }, [visible, initialOffset, initialTime]);

    const handleSave = () => {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        onSelectReminder(offset, timeStr);
        onClose();
    };

    // Time Helpers
    const hours24 = Array.from({ length: 24 }, (_, i) => i);
    const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const isPm = hour >= 12;
    const current12hHour = hour % 12 || 12;

    const handleHourChange = (val: number) => {
        if (is24h) {
            setHour(val);
        } else {
            if (isPm) {
                setHour(val === 12 ? 12 : val + 12);
            } else {
                setHour(val === 12 ? 0 : val);
            }
        }
    };

    const formatOffset = (val: number) => {
        if (val === 0) return "On Day";
        if (val === 1) return "1 Day Before";
        return `${val} Days Before`;
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.card} onStartShouldSetResponder={() => true}>
                    <Text style={styles.title}>Set Reminder</Text>

                    <View style={styles.pickersRow}>
                        {/* Offset Picker */}
                        <View style={styles.column}>
                            <Text style={styles.label}>When</Text>
                            <WheelPicker
                                items={OFFSETS}
                                selectedValue={offset}
                                onChange={setOffset}
                                formatLabel={formatOffset}
                            />
                        </View>

                        <View style={styles.divider} />

                        {/* Time Picker */}
                        <View style={styles.column}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={styles.label}>Time</Text>
                                <TouchableOpacity onPress={() => setIs24h(!is24h)} style={{ marginLeft: 8, padding: 2, borderWidth: 1, borderColor: '#CCC', borderRadius: 4 }}>
                                    <Text style={{ fontSize: 10 }}>{is24h ? '24H' : '12H'}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {is24h ? (
                                    <>
                                        <WheelPicker items={hours24} selectedValue={hour} onChange={setHour} />
                                        <Text style={{ fontSize: 20, fontWeight: 'bold', marginHorizontal: 4 }}>:</Text>
                                        <WheelPicker items={minutes} selectedValue={minute} onChange={setMinute} />
                                    </>
                                ) : (
                                    <>
                                        <WheelPicker items={hours12} selectedValue={current12hHour} onChange={handleHourChange} />
                                        <Text style={{ fontSize: 20, fontWeight: 'bold', marginHorizontal: 4 }}>:</Text>
                                        <WheelPicker items={minutes} selectedValue={minute} onChange={setMinute} />
                                        <View style={{ marginLeft: 4 }}>
                                            <TouchableOpacity onPress={() => setHour(h => (h + 12) % 24)} style={{ padding: 4, opacity: !isPm ? 1 : 0.3 }}>
                                                <Text style={{ fontWeight: 'bold' }}>AM</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setHour(h => (h + 12) % 24)} style={{ padding: 4, opacity: isPm ? 1 : 0.3 }}>
                                                <Text style={{ fontWeight: 'bold' }}>PM</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Footer — Unified pattern */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    card: { width: 340, backgroundColor: THEME.bg, borderRadius: 16, padding: 20, alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: THEME.textPrimary, marginBottom: 20 },
    pickersRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', height: 250 },
    column: { alignItems: 'center' },
    label: { fontSize: 14, color: THEME.textSecondary, marginBottom: 10, fontWeight: '600' },
    divider: { width: 1, backgroundColor: THEME.border, height: '80%', alignSelf: 'center' },
    footer: { flexDirection: 'row', marginTop: 20, width: '100%', alignItems: 'center', borderTopWidth: 1, borderColor: THEME.border, paddingTop: 16 },
    cancelButton: { paddingVertical: 10, paddingRight: 15 },
    cancelButtonText: { color: '#EF4444', fontWeight: '600' },
    saveButton: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#38A169', borderRadius: 8 },
    saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});
