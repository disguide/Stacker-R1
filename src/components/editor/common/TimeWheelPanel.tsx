import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { THEME } from '../constants';

const WP_ITEM_HEIGHT = 50;
const WP_VISIBLE = 5;
const WP_WHEEL_HEIGHT = WP_ITEM_HEIGHT * WP_VISIBLE;
const WP_LOOP_COUNT = 3;

export const WheelPicker = ({ items, selectedValue, onChange, formatLabel }: {
    items: number[]; selectedValue: number; onChange: (val: number) => void; formatLabel?: (val: number) => string;
}) => {
    const scrollRef = useRef<ScrollView>(null);
    const momentumStarted = useRef(false);
    const isSilentJump = useRef(false);

    const loopedItems = useMemo(() => {
        const result: number[] = [];
        for (let i = 0; i < WP_LOOP_COUNT; i++) result.push(...items);
        return result;
    }, [items]);

    const getHomeIndex = useCallback((val: number) => {
        const baseIndex = items.indexOf(val);
        const safe = baseIndex < 0 ? 0 : baseIndex;
        return Math.floor(WP_LOOP_COUNT / 2) * items.length + safe;
    }, [items]);

    const recenter = useCallback((val: number) => {
        const homeY = getHomeIndex(val) * WP_ITEM_HEIGHT;
        isSilentJump.current = true;
        scrollRef.current?.scrollTo({ y: homeY, animated: false });
        setTimeout(() => { isSilentJump.current = false; }, 50);
    }, [getHomeIndex]);

    // Initial scroll to center
    useEffect(() => {
        const homeY = getHomeIndex(selectedValue) * WP_ITEM_HEIGHT;
        setTimeout(() => {
            scrollRef.current?.scrollTo({ y: homeY, animated: false });
        }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleScrollEnd = (e: any) => {
        if (isSilentJump.current) return;
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / WP_ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, loopedItems.length - 1));
        const newValue = loopedItems[clampedIndex];
        if (newValue !== undefined) {
            if (newValue !== selectedValue) onChange(newValue);
            setTimeout(() => recenter(newValue), 20);
        }
        momentumStarted.current = false;
    };

    return (
        <View style={{ height: WP_WHEEL_HEIGHT, width: 70, overflow: 'hidden' }}>
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
                onScrollBeginDrag={() => { momentumStarted.current = false; }}
                onMomentumScrollBegin={() => { momentumStarted.current = true; }}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={(e) => {
                    e.persist();
                    setTimeout(() => { if (!momentumStarted.current) handleScrollEnd(e); }, 50);
                }}
            >
                {loopedItems.map((item, index) => {
                    const isSelected = item === selectedValue;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={{ height: WP_ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => { onChange(item); recenter(item); }}
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

// Looping wheel for string items (used by AM/PM)
const WP_PERIODS = [0, 1]; // 0 = AM, 1 = PM
const PERIOD_LABELS = ['AM', 'PM'];

const PeriodWheelPicker = ({ isPm, onToggle }: { isPm: boolean; onToggle: () => void }) => {
    const scrollRef = useRef<ScrollView>(null);
    const isUserScrolling = useRef(false);
    const items = WP_PERIODS;

    const currentVal = isPm ? 1 : 0;

    useEffect(() => {
        // Initial scroll
        setTimeout(() => {
            scrollRef.current?.scrollTo({ y: currentVal * WP_ITEM_HEIGHT, animated: false });
        }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep scroll in sync when isPm changes externally
    useEffect(() => {
        if (!isUserScrolling.current) {
            scrollRef.current?.scrollTo({ y: currentVal * WP_ITEM_HEIGHT, animated: true });
        }
    }, [isPm, currentVal]);

    const handleScrollEnd = (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / WP_ITEM_HEIGHT);
        const val = items[Math.max(0, Math.min(index, items.length - 1))];
        const newIsPm = val === 1;
        if (newIsPm !== isPm) onToggle();
        isUserScrolling.current = false;
    };

    return (
        <View style={{ height: WP_WHEEL_HEIGHT, width: 60, overflow: 'hidden' }}>
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
                onScrollBeginDrag={() => { isUserScrolling.current = true; }}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={(e) => {
                    e.persist();
                    setTimeout(() => handleScrollEnd(e), 50);
                }}
            >
                {items.map((item, index) => {
                    const isSelected = item === currentVal;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={{ height: WP_ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => { 
                                if (item !== currentVal) onToggle(); 
                            }}
                        >
                            <Text style={{
                                fontSize: isSelected ? 22 : 17,
                                fontWeight: isSelected ? 'bold' : '400',
                                color: isSelected ? THEME.textPrimary : THEME.textSecondary,
                                opacity: isSelected ? 1 : 0.5,
                            }}>
                                {PERIOD_LABELS[item]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

export function TimeWheelPanel({ hour, minute, onHourChange, onMinuteChange, is24h }: {
    hour: number; minute: number;
    onHourChange: (h: number) => void; onMinuteChange: (m: number) => void;
    is24h?: boolean;
}) {
    const isPm = hour >= 12;
    const display12h = hour % 12 || 12;

    const handleHourWheel12 = (h12: number) => {
        const h24 = isPm ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
        onHourChange(h24);
    };

    const toggleAmPm = () => {
        onHourChange(isPm ? hour - 12 : hour + 12);
    };

    return (
        <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60, alignItems: 'center', backgroundColor: '#FFF' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {is24h ? (
                    <WheelPicker
                        items={HOURS_24}
                        selectedValue={hour}
                        onChange={onHourChange}
                        formatLabel={(v) => v.toString().padStart(2, '0')}
                    />
                ) : (
                    <WheelPicker
                        items={HOURS_12}
                        selectedValue={display12h}
                        onChange={handleHourWheel12}
                        formatLabel={(v) => v.toString()}
                    />
                )}
                
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: THEME.textPrimary, paddingBottom: 6 }}>:</Text>
                
                <WheelPicker
                    items={MINUTES_60}
                    selectedValue={minute}
                    onChange={onMinuteChange}
                    formatLabel={(v) => v.toString().padStart(2, '0')}
                />

                {!is24h && (
                    <PeriodWheelPicker isPm={isPm} onToggle={toggleAmPm} />
                )}
            </View>
        </View>
    );
}




