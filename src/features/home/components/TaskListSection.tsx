import React, { useMemo, useRef, useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ScrollView, UIManager, Platform, Dimensions, Alert, Animated, PanResponder, LayoutAnimation } from 'react-native';
import SwipeableTaskRow from '../../../components/SwipeableTaskRow';
import { Ionicons, Feather } from '@expo/vector-icons';
import { styles } from '../../../styles/taskListStyles';
import { toISODateString, isToday, getDayName, getDaysDifference, parseEstimatedTime, formatMinutesAsTime, formatDeadline } from '../../../utils/dateHelpers';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const hexToRgba = (hex: string, opacity: number) => {
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) { c = [c[0], c[0], c[1], c[1], c[2], c[2]]; }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + opacity + ')';
    }
    return hex;
};

interface TaskListSectionProps {
    dates: Date[];
    calendarItems: any[];
    sortOption: string | null;
    setSortOption: (val: string | null) => void;
    isReorderMode: boolean;
    setIsReorderMode: (val: boolean) => void;
    form: {
        addingTaskForDate: string | null;
        newTaskTitle: string;
        setNewTaskTitle: (val: string) => void;
        newTaskDeadline: string | null;
        newTaskEstimatedTime: string | null;
        newTaskReminderTime: string | null;
        startAddingTask: (date: string) => void;
        cancelAddingTask: () => void;
        handleAddTask: (date: string) => void;
        setCalendarMode: (mode: 'new' | 'edit') => void;
        setIsCalendarVisible: (val: boolean) => void;
        setDurationMode: (mode: 'new' | 'edit') => void;
        setIsDurationPickerVisible: (val: boolean) => void;
        setIsTimePickerVisible: (val: boolean) => void;
    };
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
        reorderTasks?: (updates: Array<{ id: string; sortOrder: number }>) => void;
        moveTaskToDate?: (calendarItem: any, newDate: string) => void;
        onStartMoveToDate?: (task: any) => void; // Long-press 3-dots shortcut
    };
}

type FlatItem = { type: 'header'; date: Date; dateString: string; key: string }
    | { type: 'task'; data: any; dateString: string; key: string };



// ============ Draggable List implementation (Pure React Native) ============
function ReorderableList({
    flatItems, ops, renderDateHeader, onDragStateChange, scrollY, scrollRef
}: {
    flatItems: FlatItem[];
    ops: TaskListSectionProps['ops'];
    renderDateHeader: (date: Date) => React.ReactNode;
    onDragStateChange?: (isDragging: boolean) => void;
    scrollY: React.MutableRefObject<number>;
    scrollRef: React.RefObject<ScrollView>;
}) {
    const [items, setItems] = useState(flatItems);

    // Layout tracking
    const itemLayouts = useRef<{ y: number; height: number }[]>([]);
    const containerY = useRef(0);

    // Drag state
    const [activeIdx, setActiveIdx] = useState(-1);
    const indicatorY = useRef(new Animated.Value(-100)).current;
    const indicatorOpacity = useRef(new Animated.Value(0)).current;
    const targetGapRef = useRef(-1);

    // Auto-scroll state
    const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);
    const scrollRefProp = useRef<ScrollView>(null); // We need the scroll ref, see param below

    // Relative Coordinate Tracking (Avoids Absolute screen bounds errors)
    const initialFingerY = useRef(0);
    const initialScrollY = useRef(0);
    const currentDy = useRef(0);

    // Prevent optimistic state from being overwritten by delayed props
    const [isCommitting, setIsCommitting] = useState(false);

    // Sync from parent
    React.useEffect(() => {
        // Only update local items from props if we aren't currently dragging
        // or actively in a delayed commit window.
        if (activeIdx === -1 && targetGapRef.current === -1 && !isCommitting) {
            setItems(flatItems);
        }
    }, [flatItems, activeIdx, isCommitting]);

    const getBarYForGap = useCallback((gap: number) => {
        const layouts = itemLayouts.current;
        if (layouts.length === 0) return 0;
        if (gap <= 0) return layouts[0]?.y || 0;
        if (gap >= layouts.length) {
            const last = layouts[layouts.length - 1];
            return (last?.y || 0) + (last?.height || 60);
        }
        return layouts[gap]?.y || 0;
    }, []);

    const findNearestGap = useCallback((fingerY: number) => {
        const layouts = itemLayouts.current;
        if (layouts.length === 0) return 0;

        for (let i = 0; i < layouts.length; i++) {
            const item = layouts[i];
            if (!item) continue;

            // The boundary for a gap is the exact center-line of the item.
            // Dragging above the center pushes it before the item (i).
            // Dragging below pushes it after the item (i+1).
            const center = item.y + (item.height / 2);
            if (fingerY < center) {
                return i;
            }
        }

        return layouts.length;
    }, []);

    const handleDragStart = useCallback((idx: number, pageY: number) => {
        setActiveIdx(idx);
        targetGapRef.current = idx;

        const layout = itemLayouts.current[idx];
        initialFingerY.current = layout ? (layout.y + layout.height / 2) : 0;
        initialScrollY.current = scrollY.current;
        currentDy.current = 0;

        const initialY = getBarYForGap(idx);
        indicatorY.setValue(initialY - 2);
        Animated.timing(indicatorOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        onDragStateChange?.(true);
    }, [getBarYForGap, onDragStateChange, indicatorY, indicatorOpacity, scrollY]);

    const handleDragMove = useCallback((dy: number, pageY: number) => {
        currentDy.current = dy;
        const scrollDelta = scrollY.current - initialScrollY.current;
        const fingerY = initialFingerY.current + dy + scrollDelta;

        const gap = findNearestGap(fingerY);

        if (gap !== targetGapRef.current) {
            targetGapRef.current = gap;
            Animated.spring(indicatorY, {
                toValue: getBarYForGap(gap) - 2,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }).start();
        }

        // Edge-based Auto-scrolling
        const windowHeight = Dimensions.get('window').height;
        const topEdge = 150; // top padding zone
        const bottomEdge = windowHeight - 150; // bottom padding zone
        const scrollSpeed = 15;

        if (autoScrollTimer.current) {
            clearInterval(autoScrollTimer.current);
            autoScrollTimer.current = null;
        }

        if (pageY < topEdge) {
            // Scroll UP
            autoScrollTimer.current = setInterval(() => {
                const nextY = Math.max(0, scrollY.current - scrollSpeed);
                scrollY.current = nextY;
                scrollRef.current?.scrollTo({ y: nextY, animated: false });

                // Re-evaluate gap as we scroll
                const newScrollDelta = nextY - initialScrollY.current;
                const newFingerY = initialFingerY.current + currentDy.current + newScrollDelta;
                const newGap = findNearestGap(newFingerY);
                if (newGap !== targetGapRef.current) {
                    targetGapRef.current = newGap;
                    indicatorY.setValue(getBarYForGap(newGap) - 2);
                }
            }, 16);
        } else if (pageY > bottomEdge) {
            // Scroll DOWN
            autoScrollTimer.current = setInterval(() => {
                const maxScroll = Math.max(0, containerY.current + (itemLayouts.current.length * 60) - windowHeight);
                const nextY = Math.min(maxScroll + 300, scrollY.current + scrollSpeed);
                scrollY.current = nextY;
                scrollRef.current?.scrollTo({ y: nextY, animated: false });

                // Re-evaluate gap as we scroll
                const newScrollDelta = nextY - initialScrollY.current;
                const newFingerY = initialFingerY.current + currentDy.current + newScrollDelta;
                const newGap = findNearestGap(newFingerY);
                if (newGap !== targetGapRef.current) {
                    targetGapRef.current = newGap;
                    indicatorY.setValue(getBarYForGap(newGap) - 2);
                }
            }, 16);
        }
    }, [findNearestGap, getBarYForGap, scrollY, indicatorY, scrollRef]);

    const handleDrop = useCallback(() => {
        if (autoScrollTimer.current) {
            clearInterval(autoScrollTimer.current);
            autoScrollTimer.current = null;
        }

        const tgtGap = targetGapRef.current;
        Animated.timing(indicatorOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
        onDragStateChange?.(false);

        // Gap calculation: moving item[activeIdx] to tgtGap.
        // If it's placed in its own gap or exactly after itself, nothing changes.
        console.log(`[handleDrop] activeIdx: ${activeIdx}, tgtGap: ${tgtGap}`);

        if (activeIdx >= 0 && tgtGap !== activeIdx && tgtGap !== activeIdx + 1) {
            setIsCommitting(true);
            const currentItems = [...items];
            const sourceItem = currentItems[activeIdx];

            if (sourceItem && sourceItem.type === 'task') {
                currentItems.splice(activeIdx, 1);
                const insertAt = tgtGap > activeIdx ? tgtGap - 1 : tgtGap;
                currentItems.splice(insertAt, 0, sourceItem);

                let currentDate = '';
                let orderCounter = 0;
                const sortUpdates: Array<{ id: string; sortOrder: number }> = [];

                currentItems.forEach(item => {
                    if (item.type === 'header') {
                        currentDate = item.dateString;
                        orderCounter = 0;
                    } else if (item.type === 'task') {
                        const task = item.data;
                        if (task.date !== currentDate && ops.moveTaskToDate) {
                            ops.moveTaskToDate(task, currentDate);
                        } else {
                            const taskId = task.originalTaskId || task.id;
                            sortUpdates.push({ id: taskId, sortOrder: orderCounter });
                        }
                        orderCounter++;
                    }
                });

                console.log(`[handleDrop] Dispatching sortUpdates:`, sortUpdates);

                if (ops.reorderTasks && sortUpdates.length > 0) {
                    ops.reorderTasks(sortUpdates);
                }

                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setItems(currentItems);

                // Release the commit lock after backend has had time to process
                setTimeout(() => {
                    setIsCommitting(false);
                }, 500);
            }
        }

        setActiveIdx(-1);
        targetGapRef.current = -1;
    }, [activeIdx, items, ops, onDragStateChange, indicatorOpacity]);

    return (
        <View onLayout={e => { containerY.current = e.nativeEvent.layout.y || 0; }} style={{ width: '100%', paddingBottom: 100 }}>
            {items.map((item, idx) => {
                if (item.type === 'header') {
                    return (
                        <View
                            key={item.key}
                            style={{ zIndex: 1 }}
                            onLayout={e => {
                                itemLayouts.current[idx] = {
                                    y: e.nativeEvent.layout.y,
                                    height: e.nativeEvent.layout.height
                                };
                            }}
                        >
                            {renderDateHeader(item.date)}
                        </View>
                    );
                }

                const task = item.data;
                const isActive = activeIdx === idx;

                return (
                    <DraggableRow
                        key={item.key}
                        index={idx}
                        task={task}
                        ops={ops}
                        isActive={isActive}
                        onLayout={e => {
                            itemLayouts.current[idx] = {
                                y: e.nativeEvent.layout.y,
                                height: e.nativeEvent.layout.height
                            };
                        }}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDrop}
                    />
                );
            })}

            {/* Pure Native Animated Drop Indicator */}
            <Animated.View
                style={{
                    position: 'absolute',
                    left: 16, right: 16, height: 4,
                    backgroundColor: '#10B981',
                    borderRadius: 2,
                    zIndex: 9999, elevation: 9999,
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 6,
                    transform: [{ translateY: indicatorY }],
                    opacity: indicatorOpacity,
                    pointerEvents: 'none'
                }}
            />
        </View>
    );
}

// Sub-component wrapper attaching the gesture responder
const DraggableRow = React.memo(function DraggableRow({
    index, task, ops, isActive, onLayout, onDragStart, onDragMove, onDragEnd
}: {
    index: number;
    task: any;
    ops: TaskListSectionProps['ops'];
    isActive: boolean;
    onLayout: (e: any) => void;
    onDragStart: (idx: number, pageY: number) => void;
    onDragMove: (dy: number, pageY: number) => void;
    onDragEnd: () => void;
}) {
    const pan = useRef(new Animated.ValueXY()).current;

    // Store latest callbacks and index so PanResponder doesn't trap old closures
    const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index });
    React.useEffect(() => {
        handlersRef.current = { onDragStart, onDragMove, onDragEnd, index };
    }, [onDragStart, onDragMove, onDragEnd, index]);

    // Note: because reorder mode covers the whole row, we trigger drag immediately
    // or upon slight movement/hold. By returning true onStartShouldSetPanResponder,
    // the whole row becomes a drag grip.
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => {
                // @ts-ignore: _value exists at runtime for Animated.Value
                const currentY = pan.y._value || 0;
                pan.setOffset({ x: 0, y: currentY });
                pan.setValue({ x: 0, y: 0 });
                handlersRef.current.onDragStart(handlersRef.current.index, e.nativeEvent.pageY);
            },
            onPanResponderMove: (e, gestureState) => {
                pan.y.setValue(gestureState.dy);
                handlersRef.current.onDragMove(gestureState.dy, e.nativeEvent.pageY);
            },
            onPanResponderRelease: () => {
                pan.flattenOffset();
                Animated.spring(pan, {
                    toValue: { x: 0, y: 0 },
                    friction: 5,
                    useNativeDriver: true
                }).start();
                handlersRef.current.onDragEnd();
            },
            onPanResponderTerminate: () => {
                pan.flattenOffset();
                Animated.spring(pan, {
                    toValue: { x: 0, y: 0 },
                    friction: 5,
                    useNativeDriver: true
                }).start();
                handlersRef.current.onDragEnd(); // e.g., if scrolled away or cancelled
            }
        })
    ).current;

    return (
        <Animated.View
            onLayout={onLayout}
            {...panResponder.panHandlers}
            style={[
                styles.taskCard,
                isActive && {
                    transform: [{ translateY: pan.y }, { scale: 1.02 }],
                    opacity: 0.9,
                    borderColor: '#10B981',
                    borderWidth: 2,
                    borderRadius: 12,
                    zIndex: 999, // Ensure picked up row is above others
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.2,
                    shadowRadius: 15
                }
            ]}
        >
            <SwipeableTaskRow
                id={task.id} recurrence={task.rrule} title={task.title}
                completed={task.isCompleted} deadline={task.deadline}
                estimatedTime={task.estimatedTime} progress={task.progress}
                daysRolled={task.daysRolled || 0} menuIcon="dots-horizontal" menuColor="#94A3B8"
                onProgressUpdate={ops.updateTaskProgress}
                onComplete={() => ops.handleListTaskToggle(task)}
                isCompleting={ops.completingTaskIds.has(task.id)}
                onEdit={() => { }} onMenu={() => { }}
                formatDeadline={formatDeadline}
                onSwipeStart={ops.handleSwipeStart} onSwipeEnd={ops.handleSwipeEnd}
                isSelectionMode={false} color={task.color} taskType={task.taskType}
                importance={task.importance} reminderEnabled={task.reminderEnabled}
                reminderTime={task.reminderTime} reminderDate={task.reminderDate}
                isReorderMode={true}
            />
            {task.subtasks && task.subtasks.length > 0 && task.subtasks.map((sub: any) => (
                <SwipeableTaskRow
                    key={sub.id} id={sub.id} title={sub.title}
                    completed={sub.completed} estimatedTime={sub.estimatedTime}
                    deadline={sub.deadline} menuIcon="dots-horizontal" isSubtask={true}
                    onProgressUpdate={(id, val) => ops.handleSubtaskProgress(task.originalTaskId || task.id, sub.id, val, task.originalDate || task.date)}
                    onComplete={() => ops.handleSubtaskToggle(task.originalTaskId || task.id, sub.id, task.originalDate || task.date)}
                    onEdit={() => { }} onMenu={() => { }}
                    formatDeadline={formatDeadline}
                    onSwipeStart={ops.handleSwipeStart} onSwipeEnd={ops.handleSwipeEnd}
                    isSelectionMode={false} isReorderMode={true}
                />
            ))}
        </Animated.View>
    );
});

// ============ Main Component ============
export function TaskListSection({ dates, calendarItems, sortOption, setSortOption, isReorderMode, setIsReorderMode, form, ops }: TaskListSectionProps) {
    const inputRef = useRef<TextInput>(null);
    const mainScrollY = useRef(0);
    const scrollRef = useRef<ScrollView>(null);
    const [isDragging, setIsDragging] = useState(false);

    const getItemsForDate = (dateString: string) => calendarItems.filter(item => item.date === dateString);

    const listData = useMemo(() => {
        const items: any[] = [];
        dates.forEach(date => {
            const dateStr = toISODateString(date);
            items.push({ type: 'header', date, dateString: dateStr, key: `header-${dateStr}` });
            let dailyItems = getItemsForDate(dateStr);
            if (sortOption) dailyItems = ops.sortTasks(dailyItems, sortOption);
            else dailyItems = [...dailyItems].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
            dailyItems.forEach(task => items.push({ type: 'task', data: task, key: task.id, dateString: dateStr }));
            items.push({ type: 'footer', dateString: dateStr, key: `footer-${dateStr}` });
        });
        return items;
    }, [dates, calendarItems, sortOption, form.addingTaskForDate, form.newTaskTitle, form.newTaskDeadline, form.newTaskEstimatedTime, form.newTaskReminderTime]);

    // Flat items for reorder mode: headers + tasks only (no footers)
    const reorderFlatItems = useMemo((): FlatItem[] => {
        if (!isReorderMode) return [];
        const items: FlatItem[] = [];
        dates.forEach(date => {
            const dateStr = toISODateString(date);
            items.push({ type: 'header', date, dateString: dateStr, key: `header-${dateStr}` });
            let dailyItems = getItemsForDate(dateStr);
            dailyItems = [...dailyItems].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
            dailyItems.forEach(task => items.push({ type: 'task', data: task, dateString: dateStr, key: task.id }));
        });
        return items;
    }, [dates, calendarItems, isReorderMode]);

    const renderDateHeader = useCallback((date: Date) => {
        const dateString = toISODateString(date);
        const isTodayDate = isToday(date);
        let dailyItems = getItemsForDate(dateString);
        let totalMinutes = 0; let tasksWithoutTimeCount = 0;
        dailyItems.forEach((t: any) => {
            if (t.isCompleted) return;
            let taskHasTime = false;
            if (t.estimatedTime) { const mins = parseEstimatedTime(t.estimatedTime); if (mins > 0) { totalMinutes += mins; taskHasTime = true; } }
            if (t.subtasks) { t.subtasks.forEach((sub: any) => { if (!sub.completed && sub.estimatedTime) { const mins = parseEstimatedTime(sub.estimatedTime); if (mins > 0) { totalMinutes += mins; taskHasTime = true; } } }); }
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
                    <Text style={[styles.dayName, isTodayDate && styles.todayDayName]}>{date.getDate()} {date.toLocaleDateString('en-US', { month: 'long' })}</Text>
                    <Text style={[styles.dateSubtext, { marginLeft: 8 }]}>• {getDaysDifference(date)} - {getDayName(date)}</Text>
                </View>
                <View style={styles.dailyTimeContainer}><Text style={styles.dailyTimeSum}>{summaryString}</Text></View>
            </View>
        );
    }, [calendarItems]);

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        const zIdx = listData.length - index;
        if (item.type === 'header') {
            return <View style={{ zIndex: zIdx, elevation: zIdx }}>{renderDateHeader(item.date)}</View>;
        } else if (item.type === 'task') {
            const task = item.data;
            return (
                <View style={[styles.taskCard, { zIndex: zIdx, elevation: zIdx }]}>
                    <SwipeableTaskRow
                        id={task.id} recurrence={task.rrule} title={task.title} completed={task.isCompleted}
                        deadline={task.deadline} estimatedTime={task.estimatedTime} progress={task.progress}
                        daysRolled={task.daysRolled || 0} menuIcon="dots-horizontal" menuColor="#94A3B8"
                        onProgressUpdate={ops.updateTaskProgress} onComplete={() => ops.handleListTaskToggle(task)}
                        isCompleting={ops.completingTaskIds.has(task.id)} onEdit={() => ops.openEditDrawer(task)}
                        onMenu={() => ops.openMenu(task)} onMenuLongPress={() => ops.onStartMoveToDate?.(task)} formatDeadline={formatDeadline}
                        onSwipeStart={ops.handleSwipeStart} onSwipeEnd={ops.handleSwipeEnd}
                        isSelectionMode={ops.isSprintSelectionMode} isSelected={ops.selectedSprintTaskIds.has(task.id)}
                        onSelect={() => ops.toggleSprintTaskSelection(task.id)} color={task.color}
                        taskType={task.taskType} importance={task.importance} reminderEnabled={task.reminderEnabled}
                        reminderTime={task.reminderTime} reminderDate={task.reminderDate}
                        onToggleReminder={() => ops.onToggleReminder(task)}
                    />
                    {task.subtasks && task.subtasks.length > 0 && task.subtasks.map((sub: any) => (
                        <SwipeableTaskRow
                            key={sub.id} id={sub.id} title={sub.title} completed={sub.completed}
                            estimatedTime={sub.estimatedTime} deadline={sub.deadline} menuIcon="dots-horizontal"
                            isSubtask={true}
                            onProgressUpdate={(id, val) => ops.handleSubtaskProgress(task.originalTaskId || task.id, sub.id, val, task.originalDate || task.date)}
                            onComplete={() => ops.handleSubtaskToggle(task.originalTaskId || task.id, sub.id, task.originalDate || task.date)}
                            onEdit={() => ops.openEditSubtask(task.originalTaskId || task.id, sub)}
                            onMenu={() => ops.openSubtaskMenu(task.originalTaskId || task.id, sub.id)}
                            formatDeadline={formatDeadline} onSwipeStart={ops.handleSwipeStart} onSwipeEnd={ops.handleSwipeEnd}
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
                        <TouchableOpacity style={styles.addTaskSpace} onPress={() => form.startAddingTask(dateString)}>
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
                                <TextInput ref={inputRef} style={styles.addTaskInput} placeholder="What needs to be done?"
                                    placeholderTextColor="#999" value={form.newTaskTitle} onChangeText={form.setNewTaskTitle}
                                    onSubmitEditing={() => form.handleAddTask(dateString)} blurOnSubmit={false} />
                                <TouchableOpacity onPress={form.cancelAddingTask}>
                                    <Ionicons name="close-circle" size={24} color="#CCC" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.addTaskActions}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                    <TouchableOpacity style={[styles.addOptionChip, form.newTaskDeadline && styles.addOptionChipActive]}
                                        onPress={() => { form.setCalendarMode('new'); form.setIsCalendarVisible(true); }}>
                                        <Ionicons name="calendar-outline" size={16} color={form.newTaskDeadline ? "#FFF" : "#666"} />
                                        <Text style={[styles.addOptionText, form.newTaskDeadline && { color: "#FFF" }]}>
                                            {form.newTaskDeadline ? formatDeadline(form.newTaskDeadline) : "Date"}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.addOptionChip, form.newTaskEstimatedTime && styles.addOptionChipActive]}
                                        onPress={() => { form.setDurationMode('new'); form.setIsDurationPickerVisible(true); }}>
                                        <Feather name="clock" size={16} color={form.newTaskEstimatedTime ? "#FFF" : "#666"} />
                                        <Text style={[styles.addOptionText, form.newTaskEstimatedTime && { color: "#FFF" }]}>
                                            {form.newTaskEstimatedTime || "Duration"}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.addOptionChip, form.newTaskReminderTime && styles.addOptionChipActive]}
                                        onPress={() => form.setIsTimePickerVisible(true)}>
                                        <Ionicons name="notifications-outline" size={16} color={form.newTaskReminderTime ? "#FFF" : "#666"} />
                                        <Text style={[styles.addOptionText, form.newTaskReminderTime && { color: "#FFF" }]}>
                                            {form.newTaskReminderTime ? "Times" : "Remind"}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.addSaveButton} onPress={() => form.handleAddTask(dateString)}>
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

    const handleDragStateChange = useCallback((isDragging: boolean) => {
        scrollRef.current?.setNativeProps({ scrollEnabled: !isDragging });
    }, []);

    if (isReorderMode) {
        return (
            <View style={{ flex: 1 }}>
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={styles.scrollContent}
                    onScroll={e => { mainScrollY.current = e.nativeEvent.contentOffset.y; }}
                    scrollEventThrottle={16}
                >
                    <ReorderableList
                        flatItems={reorderFlatItems}
                        ops={ops}
                        renderDateHeader={renderDateHeader}
                        onDragStateChange={handleDragStateChange}
                        scrollY={mainScrollY}
                        scrollRef={scrollRef}
                    />
                </ScrollView>
                <TouchableOpacity
                    onPress={() => {
                        setIsReorderMode(false);
                        setSortOption('manual');
                    }}
                    style={{
                        position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: '#10B981',
                        paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8
                    }}>
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>Done Reordering</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <FlatList data={listData} keyExtractor={(item) => item.key} contentContainerStyle={styles.scrollContent}
            renderItem={renderItem} removeClippedSubviews={false} />
    );
}
