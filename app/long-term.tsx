import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Modal, Dimensions, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useTaskController } from '../src/features/tasks/hooks/useTaskController';
import { useTaskUI } from '../src/features/tasks/hooks/useTaskUI';
import { Task } from '../src/features/tasks/types';
import SwipeableTaskRow from '../src/components/SwipeableTaskRow';
import TaskEditDrawer from '../src/components/TaskEditDrawer';
import { FeatureKey } from '../src/components/TaskFeatureCarousel';
import { toISODateString, formatDeadline } from '../src/utils/dateHelpers';
import { RRule } from 'rrule';
import { RecurrenceRule, RecurrenceFrequency } from '../src/services/storage';
import CalendarModal from '../src/components/CalendarModal';

type ListItem = Task | string;

export default function LongTermScreen() {
    const router = useRouter();
    const { tasks, toggleTask, updateTask, deleteTask, addTask } = useTaskController();

    // UI State
    const {
        isDrawerVisible, setIsDrawerVisible,
        editingTask, setEditingTask,
    } = useTaskUI();

    const [drawerInitialFeature, setDrawerInitialFeature] = useState<FeatureKey | null>(null);
    const [isCalendarVisible, setIsCalendarVisible] = useState(false);

    // --- HORIZON GROUPING LOGIC ---
    const horizonData = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];

        // Filter out completed tasks first
        const activeTasks = tasks.filter(t => !t.completed);

        // 1. Yearly Engines (Recurring)
        const yearlyEngines = activeTasks.filter(t => {
            return (t.recurrence?.frequency === 'yearly') || (t.rrule && t.rrule.includes('FREQ=YEARLY'));
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 2. Future Single Actions (No Recurrence, Date >= Today)
        const singleActions = activeTasks.filter(t => {
            const isSingle = !t.recurrence && !t.rrule;
            const isFutureOrToday = t.date >= todayStr;
            return isSingle && isFutureOrToday;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const data: ListItem[] = [];

        if (singleActions.length > 0) {
            data.push('SECTION_SINGLE');

            // Group by Date
            let lastDate = '';
            singleActions.forEach(task => {
                if (task.date !== lastDate) {
                    data.push(`DATE_HEADER:${task.date}`);
                    lastDate = task.date;
                }
                data.push(task);
            });
        }

        if (yearlyEngines.length > 0) {
            data.push('SECTION_YEARLY');
            data.push(...yearlyEngines);
        }

        return data;
    }, [tasks]);

    const stickyHeaderIndices = useMemo(() => {
        return horizonData
            .map((item, index) => (typeof item === 'string' ? index : null))
            .filter((item) => item !== null) as number[];
    }, [horizonData]);

    // --- HANDLERS ---

    const handleBack = () => router.back();

    const handleAddPress = () => {
        setIsCalendarVisible(true);
    };

    const handleCalendarSelect = (date: Date | null, hasTime?: boolean) => {
        setIsCalendarVisible(false);
        if (date) {
            openAddDrawer('single', date);
        }
    };

    const openAddDrawer = (type: 'single' | 'yearly', preSelectedDate?: Date) => {
        let dateStr = toISODateString(preSelectedDate || new Date());
        let recurrence: RecurrenceRule | undefined = undefined;
        let initialFeature: FeatureKey | null = null;
        let rruleString: string | undefined = undefined;

        if (type === 'yearly') {
            recurrence = { frequency: 'yearly', interval: 1 };
            // Auto-generate RRULE for display consistency if needed
            try {
                const r = new RRule({ freq: RRule.YEARLY, dtstart: new Date() });
                rruleString = r.toString();
            } catch (e) { }
            initialFeature = 'recurrence';
        }

        // For Single, we don't force a feature, let it default to Title/Main
        // The date is already set by preSelectedDate

        const newTask: Task = {
            id: `new_longterm_${Date.now()}`,
            title: '',
            date: dateStr,
            originalDate: dateStr,
            completed: false,
            recurrence,
            rrule: rruleString,
            subtasks: [],
            progress: 0
        };

        setEditingTask(newTask);
        setDrawerInitialFeature(initialFeature);
        setIsDrawerVisible(true);
    };

    const handleEditTask = (task: Task) => {
        let drawerTask = { ...task };
        if (task.rrule && !task.recurrence) {
            try {
                const rule = RRule.fromString(task.rrule);
                const opts = rule.options;
                if (opts.freq === RRule.YEARLY) {
                    drawerTask.recurrence = {
                        frequency: 'yearly',
                        interval: opts.interval || 1
                    };
                }
            } catch (e) { }
        }
        setEditingTask(drawerTask);
        setDrawerInitialFeature(null);
        setIsDrawerVisible(true);
    };

    const handleSaveTask = (updatedTask: Task) => {
        if (updatedTask.id.startsWith('new_')) {
            const finalTask = { ...updatedTask, id: Date.now().toString() };
            if (finalTask.recurrence) {
                try {
                    const options: any = {
                        freq: RRule.YEARLY,
                        interval: finalTask.recurrence.interval || 1,
                        dtstart: new Date(finalTask.date + 'T00:00:00')
                    };
                    const rule = new RRule(options);
                    finalTask.rrule = rule.toString();
                } catch (e) { console.error(e); }
            }
            addTask(finalTask);
        } else {
            if (updatedTask.recurrence) {
                try {
                    const freqMap: Record<string, any> = { 'yearly': RRule.YEARLY, 'monthly': RRule.MONTHLY, 'weekly': RRule.WEEKLY, 'daily': RRule.DAILY };
                    const freq = freqMap[updatedTask.recurrence.frequency] || RRule.YEARLY;

                    const rule = new RRule({
                        freq,
                        interval: updatedTask.recurrence.interval || 1,
                        dtstart: new Date(updatedTask.date + 'T00:00:00')
                    });
                    updatedTask.rrule = rule.toString();
                } catch (e) { }
            }
            updateTask(updatedTask.id, updatedTask);
        }
        setIsDrawerVisible(false);
        setEditingTask(null);
    };

    const handleDeleteTask = (id: string, date: string, mode: 'single' | 'future' | 'all') => {
        deleteTask(id, date, mode);
        setIsDrawerVisible(false);
    };

    const handleToggleTask = (task: any) => {
        toggleTask(task.id, task.date);
    };

    return (
        <View style={s.container}>
            <SafeAreaView edges={['top']} style={s.header}>
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={handleBack} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Long Shot 🔭</Text>
                    <View style={{ width: 40 }} />
                </View>
                <Text style={s.headerSubtitle}>Horizon View</Text>
            </SafeAreaView>

            <View style={s.content}>
                {horizonData.length === 0 ? (
                    <View style={s.emptyState}>
                        <MaterialCommunityIcons name="telescope" size={64} color="#CBD5E1" />
                        <Text style={s.emptyText}>The horizon is clear.</Text>
                        <Text style={s.emptySubText}>Add a yearly engine or a future goal!</Text>
                    </View>
                ) : (
                    <FlashList<ListItem>
                        data={horizonData}
                        // @ts-ignore - types conflict with React 19
                        estimatedItemSize={70}
                        getItemType={(item) => typeof item === 'string' ? 'header' : 'row'}
                        keyExtractor={item => typeof item === 'string' ? item : item.id}
                        stickyHeaderIndices={stickyHeaderIndices}
                        renderItem={({ item }) => {
                            if (typeof item === 'string') {
                                if (item.startsWith('DATE_HEADER:')) {
                                    const dateStr = item.split(':')[1];
                                    const dateObj = new Date(dateStr);
                                    const today = new Date();
                                    const tomorrow = new Date();
                                    tomorrow.setDate(today.getDate() + 1);

                                    // Full date format for precision
                                    let label = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                                    if (dateStr === today.toISOString().split('T')[0]) label = 'Today — ' + label;
                                    if (dateStr === tomorrow.toISOString().split('T')[0]) label = 'Tomorrow — ' + label;

                                    return (
                                        <View style={s.dateHeader}>
                                            <Text style={s.dateHeaderText}>{label}</Text>
                                        </View>
                                    );
                                }

                                // Section Header
                                const title = item === 'SECTION_SINGLE' ? 'Single Action Items' : 'Yearly Engines';
                                const icon = item === 'SECTION_SINGLE' ? 'checkbox-blank-circle-outline' : 'sync';
                                return (
                                    <View style={s.sectionHeader}>
                                        <View style={s.sectionHeaderBadge}>
                                            <MaterialCommunityIcons name={icon as any} size={14} color="#FFF" />
                                        </View>
                                        <Text style={s.sectionHeaderText}>{title}</Text>
                                    </View>
                                );
                            }
                            return (
                                <SwipeableTaskRow
                                    id={(item as Task).id}
                                    title={(item as Task).title}
                                    completed={(item as Task).completed || false}
                                    deadline={(item as Task).deadline}
                                    estimatedTime={(item as Task).estimatedTime}
                                    progress={(item as Task).progress || 0}
                                    onComplete={() => handleToggleTask(item as Task)}
                                    // wrapper usually handles swipe, but here we might need explicit actions if SwipeableTaskRow doesn't self-manage everything
                                    onEdit={() => handleEditTask(item as Task)}
                                    onMenu={() => handleDeleteTask((item as Task).id, (item as Task).date, 'all')}
                                    formatDeadline={formatDeadline}
                                    onProgressUpdate={(id, p) => updateTask(id, { progress: p })}
                                />
                            );
                        }}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}
            </View>

            <TouchableOpacity style={s.fab} onPress={handleAddPress}>
                <Ionicons name="add" size={30} color="#FFF" />
            </TouchableOpacity>

            <TaskEditDrawer
                visible={isDrawerVisible}
                task={editingTask}
                onClose={() => setIsDrawerVisible(false)}
                onSave={handleSaveTask}
                onRequestCalendar={() => { }} // Placeholder
                onRequestDuration={() => { }} // Placeholder
                onRequestTime={() => { }} // Placeholder
                initialActiveFeature={drawerInitialFeature}
            />

            <CalendarModal
                visible={isCalendarVisible}
                onClose={() => setIsCalendarVisible(false)}
                onSelectDate={handleCalendarSelect}
                selectedDate={null}
                showTimePicker={false}
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        backgroundColor: '#0F172A',
        paddingBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 4,
        paddingTop: 8,
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    content: {
        flex: 1,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#64748B',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    sectionHeader: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionHeaderBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#64748B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateHeader: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        justifyContent: 'center',
    },
    dateHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
