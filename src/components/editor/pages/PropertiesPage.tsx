import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';
import { ActionBar } from '../common/ActionBar';
import { ColorDefinition } from '../../../services/storage';
import { useTranslation } from 'react-i18next';

const parseDuration = (durationStr?: string | null): number => {
    if (!durationStr) return 0;
    let totalMinutes = 0;
    const hoursMatch = durationStr.match(/(\d+)h/);
    const minutesMatch = durationStr.match(/(\d+)m/);
    if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
    if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);
    return totalMinutes > 0 ? totalMinutes : 0;
};

export const PropertiesPage = React.memo(function PropertiesPage({ width, color, taskType, importance, estimatedTime, onColorChange, onTypeChange, onImportanceChange, onEstimateChange,
    userColors,
    onRequestColorSettings,
    onClose
}: {
    width: number;
    color: string | undefined;
    taskType: 'task' | 'event' | 'work' | 'chore' | 'habit' | undefined;
    importance: number;
    estimatedTime: string | null;
    onColorChange: (c: string | undefined) => void;
    onTypeChange: (t: 'task' | 'event' | 'work' | 'chore' | 'habit') => void;
    onImportanceChange: (i: number) => void;
    onEstimateChange: (duration: string | null) => void;
    userColors?: ColorDefinition[];
    onRequestColorSettings?: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    // Auto-Save Mode: No local state needed.
    // We use the props directly to drive value, and callbacks update parent immediately.

    // Except for Estimate, which uses accumulator state
    const [currentMinutes, setCurrentMinutes] = useState(0);

    useEffect(() => {
        setCurrentMinutes(parseDuration(estimatedTime));
    }, [estimatedTime]);

    const formatDuration = (minutes: number): string => {
        if (minutes === 0) return '';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    const formatDurationLocalized = (minutes: number): string => {
        if (minutes === 0) return '0m';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const hUnit = t('editor.unit_h', { defaultValue: 'h' });
        const mUnit = t('editor.unit_m', { defaultValue: 'm' });
        if (h > 0 && m > 0) return `${h}${hUnit} ${m}${mUnit}`;
        if (h > 0) return `${h}${hUnit}`;
        return `${m}${mUnit}`;
    };

    const addMinutes = (amount: number) => {
        const newVal = currentMinutes + amount;
        setCurrentMinutes(newVal);
        onEstimateChange(formatDuration(newVal) || null);
    };

    // Ensure safe access to colors array with strict filtering
    const safeUserColors = React.useMemo(() => {
        if (!userColors || !Array.isArray(userColors)) return [];
        return userColors.filter(c => !!c && typeof c === 'object' && typeof c.color === 'string');
    }, [userColors]);

    const handleReset = () => {
        onTypeChange('task');
        onImportanceChange(0);
        onColorChange(undefined);
        setCurrentMinutes(0);
        onEstimateChange(null);
    };

    const handleConfirm = () => {
        onClose();
    };

    const hasValue = (taskType && taskType !== 'task') || importance > 0 || !!color || currentMinutes > 0;

    return (
        <View style={{ width, flex: 1 }}>
            <ScrollView
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
            >
                {/* Type Selection Removed per user request */}

                {/* Importance Selection */}
                <Text style={p.sectionLabel}>{t('editor.importance')}</Text>
                <View style={p.importanceRow}>
                    {[0, 1, 2, 3].map(lvl => (
                        <TouchableOpacity
                            key={lvl}
                            activeOpacity={0.7}
                            delayPressIn={0}
                            style={[
                                p.importanceButton,
                                importance === lvl && p.importanceButtonActive,
                            ]}
                            onPress={() => onImportanceChange(lvl)}
                        >
                            {lvl === 0 ? (
                                <Text style={[
                                    p.importanceText,
                                    importance === lvl && p.importanceTextActive,
                                ]}>
                                    {t('editor.importanceNone')}
                                </Text>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {Array.from({ length: lvl }).map((_, i) => (
                                        <MaterialCommunityIcons
                                            key={i}
                                            name="star"
                                            size={16}
                                            color={importance === lvl ? "#F59E0B" : "#cbd5e1"}
                                            style={{ marginHorizontal: -2 }}
                                        />
                                    ))}
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Color Selection */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 }}>
                    <Text style={[p.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>{t('editor.color')}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {color && safeUserColors.find(c => c.color === color)?.label && (
                            <Text style={{ fontSize: 14, color: color, fontWeight: 'bold' }}>
                                {safeUserColors.find(c => c.color === color)?.label}
                            </Text>
                        )}
                        {onRequestColorSettings && (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                delayPressIn={0}
                                onPress={() => {
                                    if (__DEV__) console.log('[TaskFeatureCarousel] Requesting Color Settings');
                                    onRequestColorSettings();
                                }}
                                style={{
                                    padding: 8,
                                    backgroundColor: '#F1F5F9',
                                    borderRadius: 8,
                                    marginLeft: 8
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <MaterialCommunityIcons name="cog" size={18} color={THEME.textPrimary} />
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: THEME.textPrimary }}>{t('common.edit')}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                <View style={p.colorRowWrapper}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        style={[
                            p.colorCircle,
                            { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD' },
                            !color && p.colorSelected,
                        ]}
                        onPress={() => onColorChange(undefined)}
                    >
                        {!color && <Ionicons name="checkmark" size={16} color="#333" />}
                    </TouchableOpacity>
                    {safeUserColors.map(c => (
                        <TouchableOpacity
                            key={c.id}
                            activeOpacity={0.7}
                            delayPressIn={0}
                            style={[
                                p.colorCircle,
                                { backgroundColor: c.color },
                                color === c.color && p.colorSelected,
                            ]}
                            onPress={() => onColorChange(c.color)}
                        >
                            {color === c.color && <Ionicons name="checkmark" size={16} color="#FFF" />}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Estimated Time Selection */}
                <Text style={[p.sectionLabel, { marginTop: 24 }]}>{t('editor.estimatedTime')}</Text>

                {/* Display */}
                <View style={[p.durationDisplay, { marginBottom: 16 }]}>
                    <Text style={p.durationText}>
                        {formatDurationLocalized(currentMinutes)}
                    </Text>

                    {currentMinutes > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            delayPressIn={0}
                            style={p.durationResetBtn}
                            onPress={() => {
                                setCurrentMinutes(0);
                                onEstimateChange(null);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="refresh" size={20} color={THEME.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Accumulator Buttons */}
                <View style={p.durationGrid}>
                    {[
                        { label: `+1${t('editor.unit_m', { defaultValue: 'm' })}`, amount: 1 },
                        { label: `+5${t('editor.unit_m', { defaultValue: 'm' })}`, amount: 5 },
                        { label: `+15${t('editor.unit_m', { defaultValue: 'm' })}`, amount: 15 },
                        { label: `+30${t('editor.unit_m', { defaultValue: 'm' })}`, amount: 30 },
                        { label: `+1${t('editor.unit_h', { defaultValue: 'h' })}`, amount: 60 },
                    ].map(btn => (
                        <TouchableOpacity
                            key={btn.label}
                            activeOpacity={0.7}
                            delayPressIn={0}
                            style={p.durationBtn}
                            onPress={() => addMinutes(btn.amount)}
                        >
                            <Text style={p.durationBtnText}>{btn.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

            </ScrollView>

            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={!!hasValue} />
        </View>
    );
});

export default PropertiesPage;

const p = StyleSheet.create({
    sectionLabel: {
        fontSize: 14,
        color: THEME.textSecondary,
        fontWeight: '600',
        marginBottom: 10,
        marginTop: 8,
    },
    typeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: THEME.border,
        backgroundColor: '#F8FAFC',
    },
    typeButtonActive: {
        borderColor: THEME.textPrimary,
        backgroundColor: '#F0F0F0',
    },
    typeButtonText: {
        fontSize: 13,
        color: THEME.textSecondary,
    },
    importanceRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    importanceButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: THEME.border,
        backgroundColor: '#F8FAFC',
    },
    importanceButtonActive: {
        borderColor: THEME.textPrimary,
        backgroundColor: '#F0F0F0',
    },
    importanceText: {
        fontSize: 14,
        fontWeight: '600',
        color: THEME.textSecondary,
    },
    importanceTextActive: {
        color: THEME.textPrimary,
        fontWeight: 'bold',
    },
    colorRowWrapper: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        paddingVertical: 8,
    },
    colorCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorSelected: {
        borderWidth: 2,
        borderColor: '#333',
    },
    durationDisplay: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        flexDirection: 'row',
        position: 'relative',
    },
    durationResetBtn: {
        position: 'absolute',
        left: 16,
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
    },
    durationText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: THEME.textPrimary,
    },
    durationGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    durationBtn: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 10,
        alignItems: 'center',
        minWidth: '30%',
    },
    durationBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textPrimary,
    },
});
