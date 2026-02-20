import { useRef, useMemo, useCallback, useState } from 'react';
import { View, Modal, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Components
import { TaskListHeader } from '../src/components/TaskListHeader';
import { TaskListSection } from '../src/features/home/components/TaskListSection';
import TaskEditDrawer from '../src/components/TaskEditDrawer';
import TaskMenu from '../src/components/TaskMenu';
import CalendarModal from '../src/components/CalendarModal';
import DurationPickerModal from '../src/components/DurationPickerModal';
import RecurrencePickerModal from '../src/components/RecurrencePickerModal';
import TimePickerModal from '../src/components/TimePickerModal';
import ColorSettingsModal from '../src/components/ColorSettingsModal';
import { OrganizeMenu } from '../src/components/OrganizeMenu';
import RemindersManagerModal from '../src/components/RemindersManagerModal';
import { TaskQuickAdd } from '../src/components/TaskQuickAdd';

// Hooks
import { useTaskController } from '../src/features/tasks/hooks/useTaskController';
import { useTaskForm } from '../src/features/tasks/hooks/useTaskForm';
import { useTaskUI } from '../src/features/tasks/hooks/useTaskUI';
import { useSprintMode } from '../src/features/tasks/hooks/useSprintMode';
import { useHomeState } from '../src/features/home/hooks/useHomeState';
import { useTaskOperations } from '../src/features/home/hooks/useTaskOperations';
import { useTaskCreation } from '../src/features/home/hooks/useTaskCreation';

// Services & Utils
import { StorageService } from '../src/services/storage';
import { RecurrenceEngine } from '../src/features/tasks/logic/recurrenceEngine';
import { toISODateString } from '../src/utils/dateHelpers';
import { VIEW_CONFIG } from '../src/constants/theme';
import { styles } from '../src/styles/taskListStyles';

export default function TaskListScreen() {
    const flashListRef = useRef<any>(null);

    // 1. Core Data & Logic Hooks
    const taskController = useTaskController();
    const { tasks, refresh } = taskController;

    // 2. UI State Hooks
    const form = useTaskForm();
    const ui = useTaskUI();
    const homeState = useHomeState();
    const sprintMode = useSprintMode(tasks);
    const [userColors, setUserColors] = useState<any[]>([]); // Add userColors state
    const [userProfile, setUserProfile] = useState<any>(null); // Add userProfile state

    // 3. Derived Logic Hooks
    const ops = useTaskOperations(tasks, {
        toggleTask: taskController.toggleTask,
        deleteTask: taskController.deleteTask,
        addTask: taskController.addTask,
        updateTask: taskController.updateTask,
        updateSubtask: taskController.updateSubtask,
        toggleSubtask: taskController.toggleSubtask
    });

    const creation = useTaskCreation({
        tasks,
        form: form,
        addTask: taskController.addTask,
        updateTask: taskController.updateTask,
        setEditingTask: ui.setEditingTask,
        setIsDrawerVisible: ui.setIsDrawerVisible,
        setAddingSubtaskToParentId: form.setAddingSubtaskToParentId,
        setEditingSubtask: ui.setEditingSubtask
    });

    // 4. Effects
    useFocusEffect(
        useCallback(() => {
            refresh();
            StorageService.loadUserColors().then(colors => setUserColors(colors));
            StorageService.loadProfile().then(profile => setUserProfile(profile));
        }, [refresh])
    );

    // 5. Computations
    const viewStartDate = homeState.dates.length > 0 ? toISODateString(homeState.dates[0]) : toISODateString(new Date());
    const calendarItems = useMemo(() => {
        return RecurrenceEngine.generateCalendarItems(tasks, viewStartDate, VIEW_CONFIG[homeState.viewMode].days);
    }, [tasks, viewStartDate, homeState.viewMode]);

    // 6. Local Handlers (Bridging)
    const handleOpenAddDrawer = (feature?: any) => {
        // Logic to setup temp task and open drawer
        // This was previously in openAddDrawer
        // We can create a temp task here or inside the drawer component?
        // The drawer expects 'task' prop.
        const tempTask: any = {
            id: `new_temp_${Date.now()}`,
            title: form.newTaskTitle,
            date: form.addingTaskForDate || toISODateString(new Date()),
            completed: false,
            deadline: form.newTaskDeadline || undefined,
            estimatedTime: form.newTaskEstimatedTime || undefined,
            recurrence: form.newTaskRecurrence || undefined,
            subtasks: [],
            progress: 0
        };
        ui.setEditingTask(tempTask);
        ui.setIsDrawerVisible(true);
        form.setAddingTaskForDate(null);
        form.setAddingSubtaskToParentId(null);
    };

    const handleSaveUserColors = (colors: any) => {
        StorageService.saveUserColors(colors);
        // Trigger re-render or context update if needed
    };

    return (
        <SafeAreaView style={[styles.container, sprintMode.isSprintSelectionMode && styles.sprintContainer]}>
            <TaskListHeader
                userAvatar={userProfile?.avatar}
                offset={homeState.offset}
                onOffsetChange={(val) => {
                    homeState.setOffset(val);
                    if (val === 0) flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
                viewMode={homeState.viewMode}
                isSprintSelectionMode={sprintMode.isSprintSelectionMode}
                onToggleSprint={sprintMode.toggleSprintSelectionMode}
                showViewPicker={homeState.showViewPicker}
                setShowViewPicker={homeState.setShowViewPicker}
                onOpenReminders={() => ui.setIsRemindersManagerVisible(true)}
                onOrganize={() => homeState.setIsOrganizeMenuVisible(true)}
            />

            {/* View Picker Modal */}
            <Modal
                visible={homeState.showViewPicker}
                transparent
                animationType="fade"
                onRequestClose={() => homeState.setShowViewPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => homeState.setShowViewPicker(false)}
                >
                    <View style={styles.viewPickerContainer}>
                        {(Object.keys(VIEW_CONFIG) as any[]).map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    styles.viewPickerOption,
                                    homeState.viewMode === mode && styles.viewPickerOptionActive
                                ]}
                                onPress={() => homeState.switchViewMode(mode)}
                            >
                                <Text style={[
                                    styles.viewPickerText,
                                    homeState.viewMode === mode && styles.viewPickerTextActive
                                ]}>
                                    {VIEW_CONFIG[mode as keyof typeof VIEW_CONFIG].label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Main List Section */}
            <TaskListSection
                dates={homeState.dates}
                calendarItems={calendarItems}
                sortOption={homeState.sortOption}
                isReorderMode={homeState.isReorderMode}
                setIsReorderMode={homeState.setIsReorderMode}
                form={{
                    ...form,
                    handleAddTask: creation.handleAddTask,
                    setCalendarMode: ui.setCalendarMode,
                    setIsCalendarVisible: ui.setIsCalendarVisible,
                    setDurationMode: ui.setDurationMode,
                    setIsDurationPickerVisible: ui.setIsDurationPickerVisible,
                    setIsTimePickerVisible: ui.setIsTimePickerVisible
                }}
                ops={{
                    ...ops,
                    openEditDrawer: creation.openEditDrawer,
                    openMenu: (task) => { ui.setActiveMenuTask(task); homeState.setIsMenuVisible(true); },
                    openEditSubtask: (parentId, subtask) => { ui.setEditingSubtask({ parentId, subtask }); ui.setIsDrawerVisible(true); },
                    openSubtaskMenu: (parentId, subtaskId) => { ui.setActiveMenuSubtask({ parentId, subtaskId }); homeState.setIsMenuVisible(true); },
                    isSprintSelectionMode: sprintMode.isSprintSelectionMode,
                    selectedSprintTaskIds: sprintMode.selectedSprintTaskIds,
                    toggleSprintTaskSelection: sprintMode.toggleSprintTaskSelection,
                    onToggleReminder: (task) => {
                        const newEnabled = !(task.reminderEnabled ?? true);
                        taskController.updateTask(task.id, { reminderEnabled: newEnabled });
                    },
                    handleListTaskToggle: ops.handleListTaskToggle // Pass explicitly if spread isn't enough
                }}
            />

            {/* Fixed Quick Add Bar */}
            <TaskQuickAdd
                visible={!!form.addingTaskForDate || !!form.addingSubtaskToParentId}
                isSubtask={!!form.addingSubtaskToParentId}
                title={form.newTaskTitle}
                onChangeTitle={form.setNewTaskTitle}
                onSave={() => creation.handleAddTask(form.addingTaskForDate, form.addingSubtaskToParentId)}
                onCancel={form.cancelAddingTask}
                onOpenCalendar={() => handleOpenAddDrawer('deadline')}
                onOpenDuration={() => handleOpenAddDrawer('estimate')}
                onOpenRecurrence={() => handleOpenAddDrawer('recurrence')}
                onOpenReminder={() => handleOpenAddDrawer('reminder')}
                onOpenProperties={() => handleOpenAddDrawer('properties')}
                deadline={form.newTaskDeadline}
                onClearDeadline={() => handleOpenAddDrawer('deadline')} // Or clear logic
                estimatedTime={form.newTaskEstimatedTime}
                onClearEstimatedTime={() => handleOpenAddDrawer('estimate')}
                recurrence={form.newTaskRecurrence}
                onClearRecurrence={() => handleOpenAddDrawer('recurrence')}
            />

            {/* Modals & Drawers */}
            <TaskEditDrawer
                visible={ui.isDrawerVisible}
                task={ui.editingSubtask ? (ui.editingSubtask.subtask as any) : ui.editingTask}
                onSave={ui.editingSubtask || form.addingSubtaskToParentId
                    ? (data: any) => creation.saveSubtask(data, ui.editingSubtask, form.addingSubtaskToParentId)
                    : (data: any) => creation.saveEditedTask(data, true, ui.editingTask)}
                onClose={() => {
                    ui.setIsDrawerVisible(false);
                    ui.setEditingTask(null);
                }}
                onRequestCalendar={(currentDeadline) => {
                    ui.setCalendarInitialPage(0);
                    ui.setCalendarMode('edit');
                    ui.setCalendarTempDate(currentDeadline);
                    ui.setIsCalendarVisible(true);
                }}
                onRequestDuration={() => {
                    ui.setDurationMode('edit');
                    ui.setIsDurationPickerVisible(true);
                }}
                onRequestTime={(currentDeadline) => {
                    ui.setCalendarInitialPage(1);
                    ui.setCalendarMode('edit');
                    ui.setCalendarTempDate(currentDeadline);
                    ui.setIsCalendarVisible(true);
                }}
                onRequestColorSettings={() => ui.setIsColorSettingsVisible(true)}
                userColors={userColors}
            />

            <TaskMenu
                visible={homeState.isMenuVisible}
                onClose={() => homeState.setIsMenuVisible(false)}
                onAddSubtask={() => {
                    if (ui.activeMenuTask) {
                        form.setAddingSubtaskToParentId(ui.activeMenuTask.id);
                        form.setNewTaskTitle('');
                        ui.setActiveMenuTask(null);
                        homeState.setIsMenuVisible(false);
                    }
                }}
                onDelete={() => {
                    if (ui.activeMenuTask) {
                        ops.handleConfirmDelete(ui.activeMenuTask.id, toISODateString(new Date()), () => {
                            homeState.setIsMenuVisible(false);
                            ui.setActiveMenuTask(null);
                        });
                    } else if (ui.activeMenuSubtask) {
                        creation.deleteSubtask(ui.activeMenuSubtask.parentId, ui.activeMenuSubtask.subtaskId);
                        homeState.setIsMenuVisible(false);
                        ui.setActiveMenuSubtask(null);
                    }
                }}
                isSubtask={!!ui.activeMenuSubtask}
                onEdit={() => {
                    homeState.setIsMenuVisible(false);
                    if (ui.activeMenuSubtask && ui.activeMenuTask) {
                        // Need activeMenuTask context to know parent? 
                        // ui.activeMenuSubtask stores { parentId, subtaskId }
                        // But openEditSubtask needs the subtask object. 
                        // We might need to find it.
                        // ops.openEditSubtask(...)
                        // Use creation.openEditDrawer for tasks
                        // For subtasks, we need to find the subtask object
                        const parent = tasks.find(t => t.id === ui.activeMenuSubtask?.parentId);
                        const sub = parent?.subtasks?.find(s => s.id === ui.activeMenuSubtask?.subtaskId);
                        if (sub) creation.openEditDrawer(sub); // Wait, openEditDrawer is for TASKS?
                        // useTaskCreation defines openEditDrawer for tasks.
                        // It doesn't export openEditSubtask logic equivalent suitable for menu click?
                        // Actually TaskListSection calls `ops.openEditSubtask` which calls `ui.setEditingSubtask`.
                        if (sub) {
                            ui.setEditingSubtask({ parentId: ui.activeMenuSubtask.parentId, subtask: sub });
                            ui.setIsDrawerVisible(true);
                        }
                    } else if (ui.activeMenuTask) {
                        creation.openEditDrawer(ui.activeMenuTask);
                    }
                }}
            />

            <CalendarModal
                visible={ui.isCalendarVisible}
                onClose={() => ui.setIsCalendarVisible(false)}
                onSelectDate={(date: any) => {
                    // Need to bridge this back to form or editing state
                    // This logic was in handleSelectDate in index.tsx
                    // We might need to duplicate it or move it to a helper, 
                    // or just inline it here as it switches on 'calendarMode'
                    const dateStr = date ? toISODateString(date) : null;
                    if (ui.calendarMode === 'new') {
                        form.setNewTaskDeadline(dateStr);
                    } else if (ui.editingSubtask) {
                        // ... complex update logic to editingSubtask state
                        // ui.setEditingSubtask({...})
                        ui.setEditingSubtask(prev => prev ? ({ ...prev, subtask: { ...prev.subtask, deadline: dateStr } }) : null);
                    } else if (ui.editingTask) {
                        ui.setEditingTask(prev => prev ? ({ ...prev, deadline: dateStr }) : null);
                    }
                }}
                selectedDate={
                    ui.calendarMode === 'new'
                        ? form.newTaskDeadline
                        : (ui.calendarTempDate !== null ? ui.calendarTempDate : ui.editingTask?.deadline)
                }
                initialPage={ui.calendarInitialPage}
            />

            <OrganizeMenu
                visible={homeState.isOrganizeMenuVisible}
                onClose={() => homeState.setIsOrganizeMenuVisible(false)}
                onSelectFilter={(filter) => {
                    if (filter === 'reorder') {
                        homeState.setIsReorderMode(!homeState.isReorderMode);
                        homeState.setIsOrganizeMenuVisible(false);
                        return;
                    }
                    homeState.setSortOption(filter === homeState.sortOption ? null : filter);
                    homeState.setIsOrganizeMenuVisible(false);
                }}
            />

            <RemindersManagerModal
                visible={ui.isRemindersManagerVisible}
                onClose={() => ui.setIsRemindersManagerVisible(false)}
                tasks={tasks}
                onToggleReminder={(taskId, enabled, time, date, offset) => {
                    taskController.updateTask(taskId, {
                        reminderEnabled: enabled,
                        reminderTime: time,
                        reminderDate: date,
                        reminderOffset: offset
                    });
                }}
            />

            {/* Other Modals... Duration, Recurrence, Time, Color */}
            <DurationPickerModal
                visible={ui.isDurationPickerVisible}
                onClose={() => ui.setIsDurationPickerVisible(false)}
                onSelectDuration={(d) => {
                    if (ui.durationMode === 'new') form.setNewTaskEstimatedTime(d);
                    else if (ui.editingTask) ui.setEditingTask({ ...ui.editingTask, estimatedTime: d });
                }}
                initialDuration={ui.durationMode === 'new' ? form.newTaskEstimatedTime : ui.editingTask?.estimatedTime}
            />

            <RecurrencePickerModal
                visible={ui.isRecurrencePickerVisible}
                onClose={() => ui.setIsRecurrencePickerVisible(false)}
                onSave={form.setNewTaskRecurrence}
                initialRule={form.newTaskRecurrence}
            />

            <TimePickerModal
                visible={ui.isTimePickerVisible}
                onClose={() => ui.setIsTimePickerVisible(false)}
                onSelectTime={(time) => form.setNewTaskReminderTime(time || null)}
                initialTime={form.newTaskReminderTime || undefined}
            />

            <ColorSettingsModal
                visible={ui.isColorSettingsVisible}
                onClose={() => ui.setIsColorSettingsVisible(false)}
                userColors={userColors}
                onSave={(newColors) => {
                    handleSaveUserColors(newColors);
                    setUserColors(newColors);
                }}
            />

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => {
                    const today = new Date();
                    form.startAddingTask(toISODateString(today));
                }}
            >
                <Ionicons name="add" size={30} color="#FFF" />
            </TouchableOpacity>

        </SafeAreaView>
    );
}
