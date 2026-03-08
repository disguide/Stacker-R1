import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { NotificationService } from '../src/services/notifications';
import { TaskListHeader } from '../src/components/TaskListHeader';
import { TaskListSection } from '../src/features/home/components/TaskListSection';
import TaskEditDrawer from '../src/components/TaskEditDrawer';
import TaskMenu from '../src/components/TaskMenu';
import CalendarModal from '../src/components/CalendarModal';
import DurationPickerModal from '../src/components/DurationPickerModal';
import RecurrencePickerModal from '../src/components/RecurrencePickerModal';
import TimePickerModal from '../src/components/TimePickerModal';
import ColorSettingsModal from '../src/components/ColorSettingsModal';
import { FeatureKey } from '../src/components/editor/constants';
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

const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
};

export default function TaskListScreen() {
    const flashListRef = useRef<any>(null);

    // 1. Core Data & Logic Hooks
    const taskController = useTaskController();
    const { tasks, refresh } = taskController;

    // 2. UI State Hooks
    const form = useTaskForm();
    const ui = useTaskUI();
    const homeState = useHomeState();

    // 5. Computations (Moved up for dependency)
    const viewStartDate = homeState.dates.length > 0 ? toISODateString(homeState.dates[0]) : toISODateString(new Date());
    const calendarItems = useMemo(() => {
        return RecurrenceEngine.generateCalendarItems(tasks, viewStartDate, VIEW_CONFIG[homeState.viewMode].days);
    }, [tasks, viewStartDate, homeState.viewMode]);

    // 5b. Permanent "Today" Computation for Notifications
    // We must calculate the real-world "Today" regardless of what day the 
    // user is currently looking at in the UI, to keep the OS sync accurate.
    const realWorldToday = toISODateString(new Date());
    const todayItems = useMemo(() => {
        return RecurrenceEngine.generateCalendarItems(tasks, realWorldToday, 1);
    }, [tasks, realWorldToday]);

    // Use calendarItems (which include ghost/recurring instances) for Sprint Mode
    // This ensures that if a user selects a recurring instance, useSprintMode finds it.
    const sprintMode = useSprintMode(calendarItems as any[]);
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
        setEditingSubtask: ui.setEditingSubtask,
        setInitialActiveFeature: ui.setInitialActiveFeature
    });

    useFocusEffect(
        useCallback(() => {
            refresh();
            StorageService.loadUserColors().then(colors => setUserColors(colors));
            StorageService.loadProfile().then(profile => setUserProfile(profile));
        }, [refresh])
    );

    // 4b. Global UI Notification Sync
    // Simply observe the true "Today" array and sync the OS notifications perfectly.
    useEffect(() => {
        // Debounce by 500ms so rapid typing/swiping doesn't spam the OS register
        const timer = setTimeout(() => {
            const taskOnlyItems = todayItems.filter(item => item.type !== 'header');
            NotificationService.syncTodayNotifications(taskOnlyItems as any[]);
        }, 500);
        return () => clearTimeout(timer);
    }, [todayItems]);

    // 6. Local Handlers (Bridging)
    const handleOpenAddDrawer = (feature?: FeatureKey) => {
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
        if (feature) {
            ui.setInitialActiveFeature(feature);
        } else {
            ui.setInitialActiveFeature(null);
        }
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
                setSortOption={homeState.setSortOption}
                isReorderMode={homeState.isReorderMode}
                setIsReorderMode={homeState.setIsReorderMode}
                isClumped={homeState.isClumped}
                setIsClumped={homeState.setIsClumped}
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
                    handleListTaskToggle: ops.handleListTaskToggle, // Pass explicitly if spread isn't enough
                    reorderTasks: taskController.reorderTasks,
                    moveTaskToDate: taskController.moveTaskToDate,
                    onStartMoveToDate: (task: any) => {
                        ui.setActiveMenuTask(task);
                        ui.setCalendarInitialPage(0);
                        ui.setCalendarMode('move');
                        ui.setCalendarTempDate(task.date || toISODateString(new Date()));
                        ui.setIsCalendarVisible(true);
                    }
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
                deadline={form.newTaskDeadline ? formatDateShort(form.newTaskDeadline) : null}
                onClearDeadline={() => form.setNewTaskDeadline(null)}
                estimatedTime={form.newTaskEstimatedTime}
                onClearEstimatedTime={() => form.setNewTaskEstimatedTime(null)}
                recurrence={form.newTaskRecurrence}
                onClearRecurrence={() => form.setNewTaskRecurrence(null)}
            />

            {/* Modals & Drawers */}
            <TaskEditDrawer
                visible={ui.isDrawerVisible}
                initialActiveFeature={ui.initialActiveFeature}
                isSubtask={!!ui.editingSubtask}
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
                    if (ui.activeMenuSubtask) {
                        const parent = tasks.find(t => t.id === ui.activeMenuSubtask?.parentId);
                        const sub = parent?.subtasks?.find(s => s.id === ui.activeMenuSubtask?.subtaskId);
                        if (sub) {
                            ui.setEditingSubtask({ parentId: ui.activeMenuSubtask.parentId, subtask: sub });
                            ui.setIsDrawerVisible(true);
                        }
                    } else if (ui.activeMenuTask) {
                        creation.openEditDrawer(ui.activeMenuTask);
                    }
                }}
                onMoveToDate={() => {
                    homeState.setIsMenuVisible(false);
                    if (ui.activeMenuTask) {
                        // Open calendar in 'move' mode - date-only, auto-confirm
                        ui.setCalendarInitialPage(0);
                        ui.setCalendarMode('move');
                        ui.setCalendarTempDate(ui.activeMenuTask.date || toISODateString(new Date()));
                        ui.setIsCalendarVisible(true);
                    }
                }}
            />

            <CalendarModal
                visible={ui.isCalendarVisible}
                onClose={() => ui.setIsCalendarVisible(false)}
                showTimePicker={ui.calendarMode !== 'pre-add' && ui.calendarMode !== 'move'}
                autoConfirm={ui.calendarMode === 'pre-add' || ui.calendarMode === 'move'}
                onSelectDate={(date: any, hasTime?: boolean) => {
                    let dateStr: string | null = null;
                    if (date) {
                        const d = date instanceof Date ? date : new Date(date);
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        if (hasTime || (d.getHours() !== 0 || d.getMinutes() !== 0)) {
                            const hh = String(d.getHours()).padStart(2, '0');
                            const min = String(d.getMinutes()).padStart(2, '0');
                            dateStr = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
                        } else {
                            dateStr = `${yyyy}-${mm}-${dd}`;
                        }
                    }
                    if (ui.calendarMode === 'new') {
                        form.setNewTaskDeadline(dateStr);
                    } else if (ui.calendarMode === 'pre-add') {
                        form.startAddingTask(dateStr);
                    } else if (ui.calendarMode === 'move') {
                        // Phase 4: Move task to new date
                        if (ui.activeMenuTask && dateStr) {
                            taskController.moveTaskToDate(ui.activeMenuTask, dateStr);
                            ui.setActiveMenuTask(null);
                        }
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
                isClumped={homeState.isClumped}
                onSelectFilter={(filter) => {
                    if (filter === 'manual_reorder') {
                        homeState.setIsReorderMode(true);
                        homeState.setSortOption(null);
                        homeState.setIsOrganizeMenuVisible(false);
                    } else if (filter === 'auto_organise') {
                        homeState.setSortOption('auto_organise');
                        homeState.setIsClumped(true); // Auto-clump for Auto-Organise
                        homeState.setIsOrganizeMenuVisible(false);
                    } else if (filter === 'clump_on') {
                        homeState.setIsClumped(true);
                        homeState.setIsOrganizeMenuVisible(false);
                    } else if (filter === 'clump_off') {
                        homeState.setIsClumped(false);
                        homeState.setIsOrganizeMenuVisible(false);
                    } else {
                        // All other specific sorts (color, importance, date, recurrence)
                        homeState.setSortOption(filter);
                        homeState.setIsClumped(true); // Always clump when a specific sort is applied
                        homeState.setIsOrganizeMenuVisible(false);
                    }
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

            {/* FAB or Sprint Start Button */}
            {sprintMode.isSprintSelectionMode ? (
                <View style={styles.startSprintContainer}>
                    <TouchableOpacity
                        style={[
                            styles.startSprintButton,
                            sprintMode.selectedSprintTaskIds.size === 0 && styles.startSprintButtonDisabled
                        ]}
                        onPress={sprintMode.startSprint}
                        disabled={sprintMode.selectedSprintTaskIds.size === 0}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="lightning-bolt" size={24} color={sprintMode.selectedSprintTaskIds.size === 0 ? "#94A3B8" : "#000"} />
                        <Text style={[
                            styles.startSprintText,
                            sprintMode.selectedSprintTaskIds.size === 0 && { color: "#94A3B8" }
                        ]}>
                            START SPRINT ({sprintMode.selectedSprintTaskIds.size})
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => {
                        ui.setCalendarInitialPage(0);
                        ui.setCalendarMode('pre-add');
                        ui.setCalendarTempDate(toISODateString(new Date()));
                        ui.setIsCalendarVisible(true);
                    }}
                >
                    <Ionicons name="add" size={30} color="#FFF" />
                </TouchableOpacity>
            )}

        </SafeAreaView>
    );
}
