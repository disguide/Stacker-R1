import React, { useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ScrollView } from 'react-native';
// import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist'; // Keep commented if it was commented
import SwipeableTaskRow from '../../../components/SwipeableTaskRow';
import { Ionicons, Feather } from '@expo/vector-icons';
import { styles } from '../../../styles/taskListStyles';
import { toISODateString, isToday, getDayName, getDaysDifference, parseEstimatedTime, formatMinutesAsTime, formatDeadline } from '../../../utils/dateHelpers';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

// Define Props
interface TaskListSectionProps {
    dates: Date[];
    calendarItems: any[];
    sortOption: string | null;
    isReorderMode: boolean;
    setIsReorderMode: (val: boolean) => void;
    // Form State
    form: {
        addingTaskForDate: string | null;
        newTaskTitle: string;
        setNewTaskTitle: (val: string) => void;
        newTaskDeadline: string | null;
        newTaskEstimatedTime: string | null;
        newTaskReminderTime: string | null;
        startAddingTask: (date: string) => void;
        cancelAddingTask: () => void;
        handleAddTask: (date: string) => void; // Wrapped handler
        setCalendarMode: (mode: 'new' | 'edit') => void;
        setIsCalendarVisible: (val: boolean) => void;
        setDurationMode: (mode: 'new' | 'edit') => void;
        setIsDurationPickerVisible: (val: boolean) => void;
        setIsTimePickerVisible: (val: boolean) => void;
    };
    // Operations
    ops: {
        completingTaskIds: Set<string>;
        handleListTaskToggle: (item: any) => void;
        updateTaskProgress: (id: string, val: number) => void;
        handleSwipeStart: () => void;
        handleSwipeEnd: () => void;
        openEditDrawer: (task: any) => void;
        openMenu: (task: any) => void;
        sortTasks: (tasks: any[], criteria: string | null) => any[];
        isSprintSelectionMode: boolean;
        selectedSprintTaskIds: Set<string>;
        toggleSprintTaskSelection: (id: string) => void;
        onToggleReminder: (task: any) => void;
        handleSubtaskProgress: (taskId: string, subtaskId: string, val: number, dateContext: string) => void;
        handleSubtaskToggle: (parentId: string, subtaskId: string, dateContext: string) => void;
        openEditSubtask: (parentId: string, subtask: any) => void;
        openSubtaskMenu: (parentId: string, subtaskId: string) => void;
    };
}

export function TaskListSection({
    dates,
    calendarItems,
    sortOption,
    isReorderMode,
    setIsReorderMode,
    form,
    ops
}: TaskListSectionProps) {
    const inputRef = useRef<TextInput>(null);

    const getItemsForDate = (dateString: string) => {
        return calendarItems.filter(item => item.date === dateString);
    };

    const listData = useMemo(() => {
        const items: any[] = [];
        dates.forEach(date => {
            const dateStr = toISODateString(date);
            items.push({ type: 'header', date: date, dateString: dateStr, key: `header-${dateStr}` });
            let dailyItems = getItemsForDate(dateStr);
            if (sortOption) dailyItems = ops.sortTasks(dailyItems, sortOption);
            dailyItems.forEach(task => {
                items.push({ type: 'task', data: task, key: task.id, dateString: dateStr });
            });
            items.push({ type: 'footer', dateString: dateStr, key: `footer-${dateStr}` });
        });
        return items;
    }, [dates, calendarItems, sortOption, form.addingTaskForDate, form.newTaskTitle, form.newTaskDeadline, form.newTaskEstimatedTime, form.newTaskReminderTime]);

    const renderItem = ({ item }: { item: any }) => {
        if (item.type === 'header') {
            const date = item.date;
            const dateString = item.dateString;
            const isTodayDate = isToday(date);
            let dailyItems = getItemsForDate(dateString);
            let totalMinutes = 0;
            let tasksWithoutTimeCount = 0;
            dailyItems.forEach((t: any) => {
                if (t.isCompleted) return;
                let taskHasTime = false;
                if (t.estimatedTime) {
                    const mins = parseEstimatedTime(t.estimatedTime);
                    if (mins > 0) { totalMinutes += mins; taskHasTime = true; }
                }
                if (t.subtasks) {
                    t.subtasks.forEach((sub: any) => {
                        if (!sub.completed && sub.estimatedTime) {
                            const mins = parseEstimatedTime(sub.estimatedTime);
                            if (mins > 0) { totalMinutes += mins; taskHasTime = true; }
                        }
                    });
                }
                if (!taskHasTime) tasksWithoutTimeCount++;
            });
            const timePart = totalMinutes > 0 ? formatMinutesAsTime(totalMinutes) : '';
            let summaryString = '';
            if (timePart && tasksWithoutTimeCount > 0) summaryString = `${timePart} + ${tasksWithoutTimeCount} tasks`;
            else if (timePart) summaryString = timePart;
            else summaryString = `${tasksWithoutTimeCount} tasks`;
            return (
                <View style={[styles.dateHeader, isTodayDate && styles.todayHeader]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.dayName, isTodayDate && styles.todayDayName]}>
                            {date.getDate()} {date.toLocaleDateString('en-US', { month: 'long' })}
                        </Text>
                        <Text style={[styles.dateSubtext, { marginLeft: 8 }]}>
                            • {getDaysDifference(date)} - {getDayName(date)}
                        </Text>
                    </View>
                    <View style={styles.dailyTimeContainer}>
                        <Text style={styles.dailyTimeSum}>{summaryString}</Text>
                    </View>
                </View>
            );
        } else if (item.type === 'task') {
            const task = item.data;
            return (
                <View style={styles.taskCard}>
                    <SwipeableTaskRow
                        id={task.id}
                        recurrence={task.rrule}
                        title={task.title}
                        completed={task.isCompleted}
                        deadline={task.deadline}
                        estimatedTime={task.estimatedTime}
                        progress={task.progress}
                        daysRolled={task.daysRolled || 0}
                        menuIcon="dots-horizontal"
                        menuColor="#94A3B8"
                        onProgressUpdate={ops.updateTaskProgress}
                        onComplete={() => ops.handleListTaskToggle(task)}
                        isCompleting={ops.completingTaskIds.has(task.id)}
                        onEdit={() => ops.openEditDrawer(task)}
                        onMenu={() => ops.openMenu(task)}
                        formatDeadline={formatDeadline}
                        onSwipeStart={ops.handleSwipeStart}
                        onSwipeEnd={ops.handleSwipeEnd}
                        isSelectionMode={ops.isSprintSelectionMode}
                        isSelected={ops.selectedSprintTaskIds.has(task.id)}
                        onSelect={() => ops.toggleSprintTaskSelection(task.id)}
                        color={task.color}
                        taskType={task.taskType}
                        importance={task.importance}
                        reminderEnabled={task.reminderEnabled}
                        reminderTime={task.reminderTime}
                        reminderDate={task.reminderDate}
                        onToggleReminder={() => ops.onToggleReminder(task)}
                    />
                    {task.subtasks && task.subtasks.map((subtask: any) => (
                        <SwipeableTaskRow
                            key={subtask.id}
                            id={subtask.id}
                            title={subtask.title}
                            completed={subtask.completed}
                            estimatedTime={subtask.estimatedTime}
                            deadline={subtask.deadline}
                            menuIcon="dots-horizontal"
                            isSubtask={true}
                            onProgressUpdate={(id, val) => ops.handleSubtaskProgress(task.originalTaskId, subtask.id, val, task.originalDate || task.date)}
                            onComplete={() => ops.handleSubtaskToggle(task.originalTaskId, subtask.id, task.originalDate || task.date)}
                            onEdit={() => ops.openEditSubtask(task.originalTaskId, subtask)}
                            onMenu={() => ops.openSubtaskMenu(task.originalTaskId, subtask.id)}
                            formatDeadline={formatDeadline}
                            onSwipeStart={ops.handleSwipeStart}
                            onSwipeEnd={ops.handleSwipeEnd}
                            isSelectionMode={ops.isSprintSelectionMode}
                        />
                    ))}
                </View>
            );
        } else if (item.type === 'footer') {
            const dateString = item.dateString;
            const isAddingHere = form.addingTaskForDate === dateString;
            return (
                <View style={{ marginBottom: 20 }}>
                    {!isAddingHere && (
                        <TouchableOpacity
                            style={styles.addTaskSpace}
                            onPress={() => form.startAddingTask(dateString)}
                        >
                            <Ionicons name="add" style={styles.addTaskIcon} />
                            <View style={styles.addTaskTextContainer}>
                                <Text style={styles.addTaskText}>Add Task</Text>
                                <View style={styles.addTaskUnderline} />
                            </View>
                        </TouchableOpacity>
                    )}
                    {isAddingHere && (
                        <View style={styles.addTaskContainer}>
                            <View style={styles.addTaskRow}>
                                <View style={styles.checkboxPlaceholder} />
                                <TextInput
                                    ref={inputRef}
                                    style={styles.addTaskInput}
                                    placeholder="What needs to be done?"
                                    placeholderTextColor="#999"
                                    value={form.newTaskTitle}
                                    onChangeText={form.setNewTaskTitle}
                                    onSubmitEditing={() => form.handleAddTask(dateString)}
                                    blurOnSubmit={false}
                                />
                                <TouchableOpacity onPress={form.cancelAddingTask}>
                                    <Ionicons name="close-circle" size={24} color="#CCC" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.addTaskActions}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                    <TouchableOpacity
                                        style={[styles.addOptionChip, form.newTaskDeadline && styles.addOptionChipActive]}
                                        onPress={() => {
                                            form.setCalendarMode('new');
                                            form.setIsCalendarVisible(true);
                                        }}
                                    >
                                        <Ionicons name="calendar-outline" size={16} color={form.newTaskDeadline ? "#FFF" : "#666"} />
                                        <Text style={[styles.addOptionText, form.newTaskDeadline && { color: "#FFF" }]}>
                                            {form.newTaskDeadline ? formatDeadline(form.newTaskDeadline) : "Date"}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.addOptionChip, form.newTaskEstimatedTime && styles.addOptionChipActive]}
                                        onPress={() => {
                                            form.setDurationMode('new');
                                            form.setIsDurationPickerVisible(true);
                                        }}
                                    >
                                        <Feather name="clock" size={16} color={form.newTaskEstimatedTime ? "#FFF" : "#666"} />
                                        <Text style={[styles.addOptionText, form.newTaskEstimatedTime && { color: "#FFF" }]}>
                                            {form.newTaskEstimatedTime || "Duration"}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.addOptionChip, form.newTaskReminderTime && styles.addOptionChipActive]}
                                        onPress={() => form.setIsTimePickerVisible(true)}
                                    >
                                        <Ionicons name="notifications-outline" size={16} color={form.newTaskReminderTime ? "#FFF" : "#666"} />
                                        <Text style={[styles.addOptionText, form.newTaskReminderTime && { color: "#FFF" }]}>
                                            {form.newTaskReminderTime ? "Times" : "Remind"}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.addSaveButton}
                                        onPress={() => form.handleAddTask(dateString)}
                                    >
                                        <Text style={styles.addSaveText}>Add</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        </View>
                    )}
                </View>
            );
        }
        return null;
    };

    if (isReorderMode) {
        return (
            <ErrorBoundary fallback={
                <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: 'red', marginBottom: 10 }}>Drag mode encountered an error.</Text>
                    <TouchableOpacity onPress={() => setIsReorderMode(false)} style={{ backgroundColor: '#ddd', padding: 10, borderRadius: 5 }}>
                        <Text>Exit Reorder Mode</Text>
                    </TouchableOpacity>
                </View>
            }>
                {/* DraggableFlatList placeholder - disabled as per original code comment state */}
                <View style={{ padding: 20 }}>
                    <Text>Draggable Sort is currently disabled due to library issues.</Text>
                    <TouchableOpacity onPress={() => setIsReorderMode(false)} style={{ marginTop: 10, padding: 10, backgroundColor: '#DDD' }}>
                        <Text>Close</Text>
                    </TouchableOpacity>
                </View>
            </ErrorBoundary>
        );
    }

    return (
        <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.scrollContent}
            renderItem={renderItem}
            removeClippedSubviews={false} // Prevent issues with input losing focus?
        />
    );
}

// Styles logic assumes 'styles' is imported from taskListStyles
