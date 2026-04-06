
// Simplified Reminder Modal based on CalendarModal
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    ScrollView,
} from 'react-native';
import { StorageService } from '../services/storage';

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
const LOOP_COUNT = 3; // 3 repetitions is enough — recenter keeps us in the middle

const WheelPicker = ({ items, selectedValue, onChange, formatLabel, loop = true }: { items: (string | number)[], selectedValue: string | number, onChange: (val: any) => void, formatLabel?: (val: any) => string, loop?: boolean }) => {
    const scrollRef = useRef<ScrollView>(null);
    const momentumStarted = useRef(false);
    const isSilentJump = useRef(false); // True when we're programmatically re-centering

    // Build a looped list: repeat items LOOP_COUNT times if loop = true, otherwise just items
    const loopedItems = useMemo(() => {
        if (!loop) return items;
        const result: (string | number)[] = [];
        for (let i = 0; i < LOOP_COUNT; i++) result.push(...items);
        return result;
    }, [items, loop]);

    // The "home" index: the selected value in the middle repetition (or base index if loop = false)
    const getHomeIndex = useCallback((val: string | number) => {
        const baseIndex = items.indexOf(val);
        if (!loop) return baseIndex >= 0 ? baseIndex : 0;
        if (baseIndex < 0) return Math.floor(LOOP_COUNT / 2) * items.length;
        return Math.floor(LOOP_COUNT / 2) * items.length + baseIndex;
    }, [items, loop]);

    // Silently jump to re-center after each scroll (only if loop = true)
    const recenter = useCallback((val: string | number) => {
        if (!loop) return;
        const homeY = getHomeIndex(val) * ITEM_HEIGHT;
        isSilentJump.current = true;
        scrollRef.current?.scrollTo({ y: homeY, animated: false });
        setTimeout(() => { isSilentJump.current = false; }, 50);
    }, [getHomeIndex, loop]);

    // Initial scroll to center on mount
    useEffect(() => {
        const homeY = getHomeIndex(selectedValue) * ITEM_HEIGHT;
        setTimeout(() => {
            scrollRef.current?.scrollTo({ y: homeY, animated: false });
        }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleScrollEnd = (e: any) => {
        if (isSilentJump.current) return;
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, loopedItems.length - 1));
        const newValue = loopedItems[clampedIndex];
        if (newValue !== undefined) {
            if (newValue !== selectedValue) onChange(newValue);
            // Always re-center after scroll to keep the "infinite" feel (only if loop = true)
            if (loop) setTimeout(() => recenter(newValue), 20);
        }
        momentumStarted.current = false;
    };

    return (
        <View style={{ height: WHEEL_HEIGHT, width: loop ? 90 : 60, overflow: 'hidden' }}>
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
                onScrollBeginDrag={() => { momentumStarted.current = false; }}
                onMomentumScrollBegin={() => { momentumStarted.current = true; }}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={(e) => {
                    e.persist();
                    setTimeout(() => {
                        if (!momentumStarted.current) handleScrollEnd(e);
                    }, 50);
                }}
            >
                {loopedItems.map((item, index) => {
                    const isSelected = item === selectedValue;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => {
                                onChange(item);
                                if (loop) recenter(item);
                                else scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
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


const hours24 = Array.from({ length: 24 }, (_, i) => i);
const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const minutes = Array.from({ length: 60 }, (_, i) => i);
const periods = ['AM', 'PM'];

export default function ReminderModal({ visible, onClose, onSelectReminder, initialOffset = 0, initialTime }: ReminderModalProps) {
    // Offset is now hardcoded to 0 (Same day)
    const [offset] = useState(0);

    // Time State
    const [is24h, setIs24h] = useState(true);
    const [hour, setHour] = useState(9);
    const [minute, setMinute] = useState(0);

    const [prevVisible, setPrevVisible] = useState(visible);

    useEffect(() => {
        const loadPref = async () => {
            const settings = await StorageService.loadSprintSettings();
            setIs24h(!!settings.use24HourFormat);
        };
        loadPref();
    }, []);

    const toggle24h = async () => {
        const newMode = !is24h;
        setIs24h(newMode);
        const settings = await StorageService.loadSprintSettings();
        await StorageService.saveSprintSettings({ ...settings, use24HourFormat: newMode });
    };

    if (visible !== prevVisible) {
        setPrevVisible(visible);
        if (visible) {
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
    }

    const handleSave = () => {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        onSelectReminder(0, timeStr); // Always 0 offset
        onClose();
    };

    // Time Helpers
    const isPm = hour >= 12;
    const current12hHour = hour % 12 || 12;
    const currentPeriod = isPm ? 'PM' : 'AM';

    const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
        if (newPeriod === 'PM' && hour < 12) {
            setHour(h => h + 12);
        } else if (newPeriod === 'AM' && hour >= 12) {
            setHour(h => h - 12);
        }
    };

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

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.card} onStartShouldSetResponder={() => true}>
                    <Text style={styles.title}>Set Reminder Time</Text>

                    <View style={styles.pickersRow}>
                        {/* Time Picker - Now centered and full width */}
                        <View style={[styles.column, { width: '100%' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                <Text style={[styles.label, { marginBottom: 0 }]}>Select Time</Text>
                                <TouchableOpacity onPress={toggle24h} style={{ marginLeft: 10, paddingVertical: 3, paddingHorizontal: 6, borderWidth: 1.5, borderColor: '#DDD', borderRadius: 6, backgroundColor: '#F8F9FA' }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#666' }}>{is24h ? '24H' : '12H'}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
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
                                        <View style={{ marginLeft: 8 }}>
                                            <WheelPicker items={periods} selectedValue={currentPeriod} onChange={handlePeriodChange} loop={false} />
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
