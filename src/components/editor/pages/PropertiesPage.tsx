import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';
import { ActionBar } from '../common/ActionBar';
import { ColorDefinition } from '../../../services/storage';

export default function PropertiesPage({ width, color, taskType, importance, onColorChange, onTypeChange, onImportanceChange,
    userColors,
    onRequestColorSettings,
    onClose
}: {
    width: number;
    color: string | undefined;
    taskType: 'task' | 'event' | 'work' | 'chore' | 'habit' | undefined;
    importance: number;
    onColorChange: (c: string | undefined) => void;
    onTypeChange: (t: 'task' | 'event' | 'work' | 'chore' | 'habit') => void;
    onImportanceChange: (i: number) => void;
    userColors?: ColorDefinition[];
    onRequestColorSettings?: () => void;
    onClose: () => void;
}) {
    // Store local state so changes only apply on confirm
    const [localType, setLocalType] = useState(taskType);
    const [localImportance, setLocalImportance] = useState(importance);
    const [localColor, setLocalColor] = useState(color);

    useEffect(() => {
        setLocalType(taskType);
        setLocalImportance(importance);
        setLocalColor(color);
    }, [taskType, importance, color]);

    const handleReset = () => {
        setLocalType('task');
        setLocalImportance(0);
        setLocalColor(undefined);
        onTypeChange('task');
        onImportanceChange(0);
        onColorChange(undefined);
    };

    const handleConfirm = () => {
        if (localType) onTypeChange(localType);
        onImportanceChange(localImportance);
        onColorChange(localColor);
        onClose();
    };

    const hasValue = (localType && localType !== 'task') || localImportance > 0 || !!localColor;

    return (
        <View style={{ width, flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {/* Type Selection */}
                <Text style={p.sectionLabel}>Type</Text>
                <View style={p.typeRow}>
                    {(['task', 'event', 'habit', 'chore', 'work'] as const).map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[
                                p.typeButton,
                                localType === t && p.typeButtonActive,
                                localType === t && localColor ? { backgroundColor: localColor + '20', borderColor: localColor } : {},
                            ]}
                            onPress={() => setLocalType(t)}
                        >
                            <MaterialCommunityIcons
                                name={
                                    t === 'event' ? 'calendar' :
                                        t === 'habit' ? 'refresh' :
                                            t === 'chore' ? 'broom' :
                                                t === 'work' ? 'briefcase' :
                                                    'checkbox-marked-outline'
                                }
                                size={20}
                                color={localType === t ? (localColor || THEME.textPrimary) : THEME.textSecondary}
                            />
                            <Text style={[
                                p.typeButtonText,
                                localType === t && { color: localColor || THEME.textPrimary, fontWeight: 'bold' }
                            ]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Importance Selection */}
                <Text style={p.sectionLabel}>Importance</Text>
                <View style={p.importanceRow}>
                    {[0, 1, 2, 3].map(lvl => (
                        <TouchableOpacity
                            key={lvl}
                            style={[
                                p.importanceButton,
                                localImportance === lvl && p.importanceButtonActive,
                            ]}
                            onPress={() => setLocalImportance(lvl)}
                        >
                            <Text style={[
                                p.importanceText,
                                localImportance === lvl && p.importanceTextActive,
                            ]}>
                                {lvl === 0 ? 'None' : lvl === 1 ? '!' : lvl === 2 ? '!!' : '!!!'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Color Selection */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 }}>
                    <Text style={[p.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>Color</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {localColor && userColors?.find(c => c.color === localColor)?.label && (
                            <Text style={{ fontSize: 14, color: localColor, fontWeight: 'bold' }}>
                                {userColors.find(c => c.color === localColor)?.label}
                            </Text>
                        )}
                        {onRequestColorSettings && (
                            <TouchableOpacity
                                onPress={() => {
                                    console.log('[TaskFeatureCarousel] Requesting Color Settings');
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
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: THEME.textPrimary }}>Edit</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={p.colorRow} nestedScrollEnabled={true}>
                    <TouchableOpacity
                        style={[
                            p.colorCircle,
                            { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD' },
                            !localColor && p.colorSelected,
                        ]}
                        onPress={() => setLocalColor(undefined)}
                    >
                        {!localColor && <Ionicons name="checkmark" size={16} color="#333" />}
                    </TouchableOpacity>
                    {userColors && userColors.map(c => (
                        <TouchableOpacity
                            key={c.id}
                            style={[
                                p.colorCircle,
                                { backgroundColor: c.color },
                                localColor === c.color && p.colorSelected,
                            ]}
                            onPress={() => setLocalColor(c.color)}
                        >
                            {localColor === c.color && <Ionicons name="checkmark" size={16} color="#FFF" />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </ScrollView>

            <ActionBar onReset={handleReset} onConfirm={handleConfirm} hasValue={!!hasValue} />
        </View>
    );
}

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
    colorRow: {
        flexDirection: 'row',
        gap: 10,
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
});
