import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { THEME } from '../constants';

// Wheel Picker Constants
const WP_ITEM_HEIGHT = 50;
const WP_WHEEL_HEIGHT = WP_ITEM_HEIGHT * 5;
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

export const WheelPicker = ({ items, selectedValue, onChange, formatLabel }: {
    items: number[]; selectedValue: number; onChange: (val: number) => void; formatLabel?: (val: number) => string;
}) => {
    const scrollRef = useRef<ScrollView>(null);
    const momentumStarted = useRef(false);
    const isUserScrolling = useRef(false);
    const lastSyncedValue = useRef<number | null>(null);
    const needsInitialScroll = useRef(true);

    useEffect(() => {
        if (needsInitialScroll.current) return;
        const index = items.indexOf(selectedValue);
        if (index >= 0 && selectedValue !== lastSyncedValue.current && !isUserScrolling.current) {
            lastSyncedValue.current = selectedValue;
            setTimeout(() => {
                scrollRef.current?.scrollTo({ y: index * WP_ITEM_HEIGHT, animated: true });
            }, 50);
        }
    }, [selectedValue, items]);

    const handleScrollEnd = (e: any) => {
        isUserScrolling.current = false;
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / WP_ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        const newValue = items[clampedIndex];
        if (newValue !== undefined && newValue !== selectedValue) {
            lastSyncedValue.current = newValue;
            onChange(newValue);
        }
        momentumStarted.current = false;
    };

    return (
        <View style={{ height: WP_WHEEL_HEIGHT, width: 70 }}>
            <View style={{
                position: 'absolute', top: WP_ITEM_HEIGHT * 2, height: WP_ITEM_HEIGHT, width: '100%',
                borderTopWidth: 1, borderBottomWidth: 1, borderColor: THEME.border,
                backgroundColor: 'rgba(0,0,0,0.02)', pointerEvents: 'none', zIndex: 10,
            }} />
            <ScrollView
                ref={scrollRef}
                nestedScrollEnabled={true}
                snapToInterval={WP_ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: WP_ITEM_HEIGHT * 2 }}
                onContentSizeChange={() => {
                    if (needsInitialScroll.current) {
                        needsInitialScroll.current = false;
                        const index = items.indexOf(selectedValue);
                        if (index >= 0) {
                            lastSyncedValue.current = selectedValue;
                            scrollRef.current?.scrollTo({ y: index * WP_ITEM_HEIGHT, animated: false });
                        }
                    }
                }}
                onScrollBeginDrag={() => { isUserScrolling.current = true; momentumStarted.current = false; }}
                onMomentumScrollBegin={() => { momentumStarted.current = true; }}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={(e) => {
                    e.persist();
                    setTimeout(() => { if (!momentumStarted.current) handleScrollEnd(e); }, 50);
                }}
            >
                {items.map((item, index) => {
                    const isSelected = item === selectedValue;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={{ height: WP_ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => {
                                isUserScrolling.current = true;
                                lastSyncedValue.current = item;
                                scrollRef.current?.scrollTo({ y: index * WP_ITEM_HEIGHT, animated: true });
                                onChange(item);
                                setTimeout(() => { isUserScrolling.current = false; }, 300);
                            }}
                        >
                            <Text style={{
                                fontSize: isSelected ? 24 : 18,
                                fontWeight: isSelected ? 'bold' : '400',
                                color: isSelected ? THEME.textPrimary : THEME.textSecondary,
                                opacity: isSelected ? 1 : 0.6,
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

export function TimeWheelPanel({ hour, minute, onHourChange, onMinuteChange }: {
    hour: number; minute: number;
    onHourChange: (h: number) => void; onMinuteChange: (m: number) => void;
}) {
    const isPm = hour >= 12;
    const display12h = hour % 12 || 12;

    const handleHourWheel = (h12: number) => {
        const h24 = isPm ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
        onHourChange(h24);
    };

    const toggleAmPm = () => {
        onHourChange(isPm ? hour - 12 : hour + 12);
    };

    const h12 = hour % 12 || 12;
    const period = hour >= 12 ? 'PM' : 'AM';
    const timeStr = `${h12}:${String(minute).padStart(2, '0')} ${period}`;

    return (
        <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60, alignItems: 'center', backgroundColor: '#FFF' }}>
            <Text style={{ fontSize: 14, color: THEME.textSecondary, fontWeight: '600', marginBottom: 8 }}>Set Time</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: THEME.green, marginBottom: 16 }}>{timeStr}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <WheelPicker
                    items={HOURS_12}
                    selectedValue={display12h}
                    onChange={handleHourWheel}
                    formatLabel={(v) => v.toString()}
                />
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: THEME.textPrimary, paddingBottom: 6 }}>:</Text>
                <WheelPicker
                    items={MINUTES_60}
                    selectedValue={minute}
                    onChange={onMinuteChange}
                    formatLabel={(v) => v.toString().padStart(2, '0')}
                />
                {/* AM/PM toggle */}
                <View style={{ marginLeft: 8, gap: 6 }}>
                    <TouchableOpacity
                        style={[{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', backgroundColor: '#F8FAFC' }, !isPm && { backgroundColor: THEME.green, borderColor: THEME.green }]}
                        onPress={() => { if (isPm) toggleAmPm(); }}
                    >
                        <Text style={[{ fontSize: 16, fontWeight: 'bold', color: THEME.textSecondary }, !isPm && { color: '#FFF' }]}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', backgroundColor: '#F8FAFC' }, isPm && { backgroundColor: THEME.green, borderColor: THEME.green }]}
                        onPress={() => { if (!isPm) toggleAmPm(); }}
                    >
                        <Text style={[{ fontSize: 16, fontWeight: 'bold', color: THEME.textSecondary }, isPm && { color: '#FFF' }]}>PM</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
