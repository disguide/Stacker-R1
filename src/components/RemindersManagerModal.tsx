import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, Alert, SectionList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '../features/tasks/types';
import { THEME } from '../constants/theme';
import { formatDeadline, toISODateString } from '../utils/dateHelpers';
import ReminderModal from './ReminderModal';

interface RemindersManagerModalProps {
    visible: boolean;
    onClose: () => void;
    tasks: Task[];
    onToggleReminder: (taskId: string, enabled: boolean, time?: string, date?: string, offset?: number) => void;
}

const ReminderRow = ({ task, onEdit, onDelete, onToggle }: { task: Task, onEdit: () => void, onDelete: () => void, onToggle: (val: boolean) => void }) => {
    return (
        <TouchableOpacity style={styles.row} onPress={onEdit}>
            <View style={styles.textContainer}>
                <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                <View style={styles.metaContainer}>
                    <Text style={styles.dateTag}>
                        {task.reminderDate === toISODateString(new Date()) ? 'Today' : formatDeadline(task.reminderDate || '')}
                    </Text>
                    <View style={styles.reminderTag}>
                        <Ionicons name="notifications" size={10} color="#2563EB" />
                        <Text style={styles.reminderText}>{task.reminderTime}</Text>
                    </View>
                </View>
            </View>



            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Switch
                    value={task.reminderEnabled}
                    onValueChange={onToggle}
                    trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                    thumbColor={task.reminderEnabled ? "#2563EB" : "#F1F5F9"}
                />
                <TouchableOpacity
                    onPress={onDelete}
                    style={styles.deleteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity >
    );
};

export default function RemindersManagerModal({ visible, onClose, tasks, onToggleReminder }: RemindersManagerModalProps) {
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);

    // Filter for Active Reminders for TODAY
    const activeTasks = useMemo(() => {
        const today = toISODateString(new Date());

        // Step 1: Filter out completed or non-reminder tasks
        const validTasks = tasks.filter(t => {
            // Hide completed tasks — check both legacy boolean AND completedDates array
            const isCompletedToday = Array.isArray(t.completedDates) && t.completedDates.includes(t.date || today);
            const isCompletedLegacy = !!(t.isCompleted || t.completed);
            if (isCompletedToday || isCompletedLegacy) return false;

            // For recurring tasks, also check if completed TODAY specifically
            if (t.rrule && Array.isArray(t.completedDates) && t.completedDates.includes(today)) {
                return false;
            }

            const hasReminderConfig = t.reminderTime || (t.reminderOffset !== undefined && t.reminderOffset !== null);
            return !!hasReminderConfig;
        });

        // Step 2: Semantic Deduplication (Hide the Database Clones)
        // If the Rollover System previously created multiple overdue instances of the same task,
        // we only want to show the ONE most recent version in this list.
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
            } else if (task.date === today && !task.completed) {
                todayTasks.push(task);
            } else if (task.date > today || (task.rrule && !task.completed)) {
                // Future or Recurring (assuming recurring shows up here if not completed today)
                // Note: simplistic check for upcoming. 
                // If it's old/overdue? It goes to upcoming/other for now or we add "Overdue"
                if (task.date < today) {
                    // Overdue - put in Today/Overdue
                    todayTasks.push(task);
                } else {
                    upcomingTasks.push(task);
                }
            } else {
                // Completed or old
                // If it has active reminder config, meaningful to show?
                // activeTasks filter already excludes completed unless recurring logic allows
                upcomingTasks.push(task);
            }
        });

        const result = [];
        if (todayTasks.length > 0) result.push({ title: 'Today & Overdue', data: todayTasks });
        if (upcomingTasks.length > 0) result.push({ title: 'Upcoming', data: upcomingTasks });
        if (unscheduledTasks.length > 0) result.push({ title: 'Unscheduled', data: unscheduledTasks });

        return result;
    }, [activeTasks]);


    const handleEdit = (task: Task) => {
        setSelectedTask(task);
        setIsReminderModalVisible(true);
    };

    const handleDelete = (task: Task) => {
        // Ask for confirmation to prevent "Deleting all edits" surprise
        Alert.alert(
            "Remove Reminder?",
            "This will clear the reminder time and settings for this task.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => onToggleReminder(task.id, false) // Clears config
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
                        <Text style={styles.headerTitle}>Active Reminders</Text>
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
                                onDelete={() => handleDelete(item)}
                                onEdit={() => handleEdit(item)}
                                onToggle={(val) => onToggleReminder(item.id, val, item.reminderTime, item.reminderDate, item.reminderOffset)}
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
                                <Text style={styles.emptyText}>No active reminders</Text>
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
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: THEME.textPrimary,
        letterSpacing: -0.5,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.05)',
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
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    textContainer: {
        flex: 1,
        marginRight: 16,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textPrimary,
        marginBottom: 6,
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
        fontSize: 12,
        color: '#666',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        overflow: 'hidden',
        marginRight: 8,
    },
    reminderTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    reminderText: {
        fontSize: 12,
        color: '#2563EB',
        fontWeight: '600',
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
        padding: 8,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        paddingVertical: 8,
        paddingHorizontal: 4,
        marginTop: 8,
        marginBottom: 8,
        backgroundColor: THEME.bg,
    },
    sectionHeaderText: {
        fontSize: 18,
        fontWeight: '700',
        color: THEME.textPrimary,
    },
});
