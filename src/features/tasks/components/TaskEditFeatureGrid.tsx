import React from 'react';
import { View, Text, TouchableOpacity, Switch, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, styles } from '../styles/taskEditDrawerStyles';
import { FeatureKey } from '../../../components/TaskFeatureCarousel';
import { RecurrenceRule } from '../../../services/storage';

interface TaskEditFeatureGridProps {
    deadline: string | null;
    estimatedTime: string | null;
    color: string | undefined;
    taskType: 'task' | 'event' | 'work' | 'chore' | 'habit' | undefined;
    importance: number;
    recurrence: RecurrenceRule | null;
    reminderOffset: number | null;
    reminderEnabled: boolean;
    reminderTime: string | null;
    isSubtask?: boolean;
    formatTime: (time: string) => string;
    formatDateShort: (dateStr: string) => string;
    setActiveFeature: (feature: FeatureKey) => void;
    setDeadline: (deadline: string | null) => void;
    setEstimatedTime: (time: string | null) => void;
    setRecurrence: (rule: RecurrenceRule | null) => void;
    clearReminder: () => void;
    toggleReminder: (enabled: boolean) => void;
}

export default function TaskEditFeatureGrid({
    deadline,
    estimatedTime,
    color,
    taskType,
    importance,
    recurrence,
    reminderOffset,
    reminderEnabled,
    reminderTime,
    isSubtask,
    formatTime,
    formatDateShort,
    setActiveFeature,
    setDeadline,
    setEstimatedTime,
    setRecurrence,
    clearReminder,
    toggleReminder
}: TaskEditFeatureGridProps) {
    const { t } = useTranslation();
    return (
        <View style={styles.featureGrid}>
            {/* Deadline Card */}
            <TouchableOpacity
                style={styles.featureCardGrid}
                activeOpacity={0.7}
                delayPressIn={0}
                onPress={() => setActiveFeature('deadline')}
            >
                <View style={styles.featureIconContainer}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color={deadline ? THEME.textPrimary : THEME.textSecondary} />
                </View>
                <Text style={styles.featureLabel}>{t('common.deadline')}</Text>
                <Text style={[styles.featureValue, deadline && styles.featureValueActive]} numberOfLines={1}>
                    {deadline
                        ? deadline.match(/^\d{2}:\d{2}$/)
                            ? formatTime(deadline)
                            : formatDateShort(deadline)
                        : t('common.none')}
                </Text>
                {deadline && (
                    <TouchableOpacity
                        style={styles.featureClearHtml}
                        onPress={() => setDeadline(null)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close-circle" size={16} color={THEME.textSecondary} />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>



            {/* Tags / Properties Card */}
            <TouchableOpacity
                style={[styles.featureCardGrid, color ? { borderColor: color, backgroundColor: color + '10' } : {}]}
                activeOpacity={0.7}
                delayPressIn={0}
                onPress={() => setActiveFeature('properties')}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                    <View style={styles.featureIconContainer}>
                        <MaterialCommunityIcons
                            name={
                                taskType === 'event' ? 'calendar' :
                                    taskType === 'habit' ? 'refresh' :
                                        taskType === 'chore' ? 'broom' :
                                            taskType === 'work' ? 'briefcase' :
                                                'checkbox-marked-outline'
                            }
                            size={20}
                            color={color || THEME.textPrimary}
                        />
                    </View>
                    {(importance || 0) > 0 && (
                        <View style={{
                            backgroundColor: importance === 3 ? '#FECACA' : importance === 2 ? '#FDE68A' : '#E9D5FF',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            alignSelf: 'flex-start'
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {Array.from({ length: importance }).map((_, i) => (
                                    <MaterialCommunityIcons
                                        key={i}
                                        name="star"
                                        size={12}
                                        color={importance === 3 ? '#991B1B' : importance === 2 ? '#92400E' : '#6B21A8'}
                                        style={{ marginHorizontal: -1 }}
                                    />
                                ))}
                            </View>
                        </View>
                    )}
                    {estimatedTime && (
                        <View style={{
                            backgroundColor: '#E2E8F0',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            alignSelf: 'flex-start'
                        }}>
                             <Text style={{ fontSize: 10, fontWeight: '700', color: THEME.textSecondary }}>{estimatedTime}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.featureLabel}>{t('common.tags')}</Text>
                <Text style={[styles.featureValue, { textTransform: 'capitalize' }]} numberOfLines={1}>
                    {taskType || t('common.none')}
                </Text>
                {color && <View style={{ position: 'absolute', bottom: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
            </TouchableOpacity>

            {/* Recurrence Card */}
            {!isSubtask && (
                <TouchableOpacity
                    style={styles.featureCardGrid}
                    activeOpacity={0.7}
                    delayPressIn={0}
                    onPress={() => setActiveFeature('recurrence')}
                >
                    <View style={styles.featureIconContainer}>
                        <MaterialCommunityIcons name="repeat" size={20} color={recurrence ? THEME.textPrimary : THEME.textSecondary} />
                    </View>
                    <Text style={styles.featureLabel}>{t('common.repeat')}</Text>
                    <Text style={[styles.featureValue, recurrence && styles.featureValueActive]} numberOfLines={1}>
                        {recurrence ? recurrence.frequency : t('common.never')}
                    </Text>
                    {recurrence && (
                        <TouchableOpacity
                            style={styles.featureClearHtml}
                            onPress={() => setRecurrence(null)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close-circle" size={16} color={THEME.textSecondary} />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
            )}

            {/* Reminder Card */}
            {!isSubtask && (
                <TouchableOpacity
                    style={styles.featureCardGrid}
                    onPress={() => setActiveFeature('reminder')}
                >
                    <View style={styles.featureIconContainer}>
                        <MaterialCommunityIcons name="bell-outline" size={20} color={reminderOffset !== null && reminderEnabled ? THEME.textPrimary : THEME.textSecondary} />
                    </View>
                    <Text style={styles.featureLabel}>{t('common.remind')}</Text>
                    <Text style={[
                        styles.featureValue,
                        reminderOffset !== null && reminderEnabled && styles.featureValueActive,
                        !reminderEnabled && { color: THEME.textSecondary, fontWeight: 'normal' }
                    ]} numberOfLines={1}>
                        {reminderOffset !== null
                            ? (
                                <>
                                    {formatTime(reminderTime || '09:00')}
                                </>
                            )
                            : t('common.none')}
                    </Text>
                    {reminderOffset !== null && (
                        <View style={{ position: 'absolute', top: 8, right: 8, padding: 4 }}>
                            <Pressable
                                onPress={(e) => {
                                    e.stopPropagation();
                                    clearReminder();
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={16} color={THEME.textSecondary} />
                            </Pressable>
                        </View>
                    )}

                    <View style={{ position: 'absolute', bottom: 10, right: 10 }}>
                        <Switch
                            value={reminderEnabled}
                            onValueChange={toggleReminder}
                            trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                            thumbColor={reminderEnabled ? "#2563EB" : "#F1F5F9"}
                            style={{ transform: [{ scale: 0.7 }] }}
                        />
                    </View>
                </TouchableOpacity>
            )}
        </View>
    );
}
