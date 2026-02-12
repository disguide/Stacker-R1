import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Switch } from 'react-native';
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

const ReminderRow = ({ task, onEdit, onDelete }: { task: Task, onEdit: () => void, onDelete: () => void }) => {
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

            <TouchableOpacity
                onPress={onDelete}
                style={styles.deleteButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

export default function RemindersManagerModal({ visible, onClose, tasks, onToggleReminder }: RemindersManagerModalProps) {
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);

    // Filter for Active Reminders for TODAY
    const activeTasks = useMemo(() => {
        const today = toISODateString(new Date());
        return tasks
            .filter(t => {
                const isEnabled = t.reminderEnabled && !t.completed;
                if (!isEnabled) return false;

                // Rings Today if:
                // 1. Explicitly set to Today
                // 2. Not set explicitly, but Task Date is Today
                const ringsToday = (t.reminderDate === today) || (!t.reminderDate && t.date === today);
                return ringsToday;
            })
            .sort((a, b) => {
                // Sort by time
                return (a.reminderTime || '').localeCompare(b.reminderTime || '');
            });
    }, [tasks]);

    const handleEdit = (task: Task) => {
        setSelectedTask(task);
        setIsReminderModalVisible(true);
    };

    const handleDelete = (task: Task) => {
        // Turn off immediately (effectively delete from this list)
        onToggleReminder(task.id, false);
    };

    const handleSaveReminder = (offset: number, time: string) => {
        if (selectedTask) {
            // Update Logic
            // If offset is -1? No, we handle removal differently?
            // Actually, for now, let's assume valid offset + time = update.
            // Removal should be a separate button/action in this modal?
            // "Remove" button in ReminderModal calls onClose?
            // Let's assume onSelectReminder is only for setting valid reminders.

            // To Remove: Use the explicit remove button in the list.

            // Update
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

                    <FlatList
                        data={activeTasks}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <ReminderRow
                                task={item}
                                onDelete={() => onToggleReminder(item.id, false)}
                                onEdit={() => handleEdit(item)}
                            />
                        )}
                        contentContainerStyle={{ padding: 16 }}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 40 }}>
                                <Text style={{ color: THEME.textSecondary }}>No active reminders for today</Text>
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
    }
});
