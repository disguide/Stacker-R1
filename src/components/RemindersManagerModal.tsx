import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, Alert, SectionList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '../features/tasks/types';
import { THEME } from '../constants/theme';
import { formatDeadline, toISODateString } from '../utils/dateHelpers';
import ReminderModal from './ReminderModal';
import { useTranslation } from 'react-i18next';

interface RemindersManagerModalProps {
    visible: boolean;
    onClose: () => void;
    tasks: Task[];
    onToggleReminder: (taskId: string, enabled: boolean, time?: string, date?: string, offset?: number) => void;
}

const ReminderRow = ({ task, onEdit, onDelete, onToggle, t }: { task: Task, onEdit: () => void, onDelete: () => void, onToggle: (val: boolean) => void, t: any }) => {
    return (
        <TouchableOpacity style={styles.row} onPress={onEdit}>
            <View style={styles.textContainer}>
                <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                <View style={styles.metaContainer}>
                    <Text style={styles.dateTag}>
                        {task.reminderDate === toISODateString(new Date()) ? t('common.today') : formatDeadline(task.reminderDate || '')}
                    </Text>
                    <View style={styles.reminderTag}>
                        <Ionicons name="notifications" size={16} color="#3B82F6" />
                        <Text style={styles.reminderText}>{task.reminderTime}</Text>
                    </View>
                </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Switch
                    value={task.reminderEnabled}
                    onValueChange={onToggle}
                    trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
                    thumbColor={"#FFFFFF"}
                    ios_backgroundColor="#E2E8F0"
                />
                <TouchableOpacity
                    onPress={onDelete}
                    style={styles.deleteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="trash-outline" size={24} color="#EF4444" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity >
    );
};

export default function RemindersManagerModal({ visible, onClose, tasks, onToggleReminder }: RemindersManagerModalProps) {
    const { t } = useTranslation();
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);

    // Filter for Active Reminders for TODAY
    const activeTasks = useMemo(() => {
        const today = toISODateString(new Date());

        // Step 1: Filter out completed or non-reminder tasks
        const validTasks = tasks.filter(t => {
            // Hide completed tasks — check both legacy boolean AND completedDates array
            const isCompletedToday = Array.isArray(t.completedDates) && t.completedDates.includes(t.date || today);
            const isCompletedLegacy = !!(t as any).completed;
            if (isCompletedToday || isCompletedLegacy) return false;

            // For recurring tasks, also check if completed TODAY specifically
            if (t.rrule && Array.isArray(t.completedDates) && t.completedDates.includes(today)) {
                return false;
            }

            const hasReminderConfig = t.reminderTime || (t.reminderOffset !== undefined && t.reminderOffset !== null);
            return !!hasReminderConfig;
        });

        // Step 2: Semantic Deduplication (Hide the Database Clones)
        const semanticMap = new Map<string, Task>();

        validTasks.forEach(task => {
            const masterId = task.originalTaskId || task.id;

            if (!semanticMap.has(masterId)) {
                semanticMap.set(masterId, task);
            } else {
                const existing = semanticMap.get(masterId)!;
                // Keep the one with the latest date
                const existingDate = existing.date || '';
                const newDate = task.date || '';
                if (newDate > existingDate) {
                    semanticMap.set(masterId, task);
                }
            }
        });

        // Step 3: Sort Date then Time
        return Array.from(semanticMap.values()).sort((a, b) => {
            const dateA = a.reminderDate || a.date;
            const dateB = b.reminderDate || b.date;
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return (a.reminderTime || '').localeCompare(b.reminderTime || '');
        });
    }, [tasks]);

    // Group tasks into sections
    const sections = useMemo(() => {
        const today = toISODateString(new Date());

        const todayTasks: Task[] = [];
        const upcomingTasks: Task[] = [];
        const unscheduledTasks: Task[] = []; // No date but has reminder

        activeTasks.forEach(task => {
            if (!task.date) {
                unscheduledTasks.push(task);
            } else if (task.date === today && !task.isCompleted) {
                todayTasks.push(task);
            } else if (task.date > today || (task.rrule && !task.isCompleted)) {
                if (task.date < today) {
                    todayTasks.push(task);
                } else {
                    upcomingTasks.push(task);
                }
            } else {
                upcomingTasks.push(task);
            }
        });

        const result = [];
        if (todayTasks.length > 0) result.push({ title: t('settings.reminders.sections.today'), data: todayTasks });
        if (upcomingTasks.length > 0) result.push({ title: t('settings.reminders.sections.upcoming'), data: upcomingTasks });
        if (unscheduledTasks.length > 0) result.push({ title: t('settings.reminders.sections.unscheduled'), data: unscheduledTasks });

        return result;
    }, [activeTasks, t]);


    const handleEdit = (task: Task) => {
        setSelectedTask(task);
        setIsReminderModalVisible(true);
    };

    const handleDelete = (task: Task) => {
        Alert.alert(
            t('settings.reminders.deleteTitle'),
            t('settings.reminders.deleteConfirm'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('common.remove'),
                    style: "destructive",
                    onPress: () => onToggleReminder(task.id, false)
                }
            ]
        );
    };

    const handleSaveReminder = (offset: number, time: string) => {
        if (selectedTask) {
            const timeStr = time || selectedTask.reminderTime || "09:00";
            onToggleReminder(selectedTask.id, true, timeStr, undefined, offset);
        }
        setIsReminderModalVisible(false);
        setSelectedTask(null);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{t('settings.reminders.title')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={THEME.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <SectionList
                        sections={sections}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <ReminderRow
                                task={item}
                                onEdit={() => handleEdit(item)}
                                onDelete={() => handleDelete(item)}
                                onToggle={(val) => onToggleReminder(item.id, val, item.reminderTime, item.reminderDate, item.reminderOffset)}
                                t={t}
                            />
                        )}
                        renderSectionHeader={({ section: { title } }) => (
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionHeaderText}>{title}</Text>
                            </View>
                        )}
                        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                        stickySectionHeadersEnabled={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="notifications-off-outline" size={48} color={THEME.textSecondary} />
                                <Text style={styles.emptyText}>{t('settings.reminders.empty')}</Text>
                            </View>
                        }
                    />
                </View>
            </View>

            {/* Edit Modal */}
            {selectedTask && (
                <ReminderModal
                    visible={isReminderModalVisible}
                    onClose={() => {
                        setIsReminderModalVisible(false);
                        setSelectedTask(null);
                    }}
                    onSelectReminder={handleSaveReminder}
                    initialOffset={selectedTask.reminderOffset || 0}
                    initialTime={selectedTask.reminderTime}
                />
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: 60, // visual offset
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 8,
    },
    headerTitle: {
        fontSize: 32, // Huge like the image
        fontWeight: '800',
        color: '#000',
        letterSpacing: -1,
    },
    closeButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        padding: 16,
        paddingVertical: 18,
        marginBottom: 12,
        borderRadius: 20, // highly rounded
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    textContainer: {
        flex: 1,
        marginRight: 16,
    },
    taskTitle: {
        fontSize: 32, // Huge task titles
        fontWeight: '400',
        color: '#000',
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    taskSubtext: {
        fontSize: 13,
        color: THEME.textSecondary,
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateTag: {
        display: 'none', // Removed to perfectly match the image which only shows time
    },
    reminderTag: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    reminderText: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
        marginLeft: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        opacity: 0.5,
    },
    emptyText: {
        marginTop: 16,
        color: THEME.textSecondary,
        fontSize: 16,
        fontWeight: '500',
    },
    closeText: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.accent,
    },
    deleteButton: {
        padding: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginTop: 4,
        marginBottom: 8,
        backgroundColor: THEME.bg,
    },
    sectionHeaderText: {
        fontSize: 18,
        fontWeight: '500', // Medium weight to match subtitle look
        color: '#000',
    },
});
