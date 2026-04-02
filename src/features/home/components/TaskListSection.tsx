import React, { useMemo, useRef, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, UIManager, Platform, Dimensions, Alert, Animated, PanResponder, LayoutAnimation } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import SwipeableTaskRow from '../../../components/SwipeableTaskRow';
import { Ionicons, Feather } from '@expo/vector-icons';
import { styles } from '../../../styles/taskListStyles';
import { THEME } from '../../../constants/theme';
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
    isClumped: boolean;
    setIsClumped: (val: boolean) => void;
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
    flatItems, ops, renderDateHeader, onDragStateChange, scrollY, scrollRef, isClumped, sortOption
}: {
    flatItems: FlatItem[];
    ops: TaskListSectionProps['ops'];
    renderDateHeader: (date: Date) => React.ReactNode;
    onDragStateChange?: (isDragging: boolean) => void;
    scrollY: React.MutableRefObject<number>;
    scrollRef: React.RefObject<ScrollView>;
    isClumped: boolean;
    sortOption: string | null;
}) {
    const [items, setItems] = useState(flatItems);

    // Layout tracking
    const itemLayouts = useRef<{ y: number; height: number }[]>([]);
    const containerY = useRef(0);

    // Drag state
    const [activeIdx, setActiveIdx] = useState(-1);
    const spacerHeight = useRef(0);
    const targetGapRef = useRef(-1);
    const activeIdxRef = useRef(-1);
    const rowTranslations = useRef<Animated.Value[]>([]);

    const getRowTranslation = useCallback((idx: number) => {
        while (rowTranslations.current.length <= idx) {
            rowTranslations.current.push(new Animated.Value(0));
        }
        return rowTranslations.current[idx];
    }, []);

    // Auto-scroll state
    const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);
    const scrollRefProp = useRef<ScrollView>(null); // We need the scroll ref, see param below
    const scrollOffset = useRef(new Animated.Value(0)).current;

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
        activeIdxRef.current = idx;
        targetGapRef.current = idx;

        const layout = itemLayouts.current[idx];
        initialFingerY.current = layout ? (layout.y + layout.height / 2) : 0;
        initialScrollY.current = scrollY.current;
        currentDy.current = 0;
        spacerHeight.current = layout ? layout.height : 60;

        scrollOffset.setValue(0);

        onDragStateChange?.(true);
    }, [onDragStateChange, scrollY]);

    const handleDragMove = useCallback((dy: number, pageY: number) => {
        currentDy.current = dy;
        const scrollDelta = scrollY.current - initialScrollY.current;
        const fingerY = initialFingerY.current + dy + scrollDelta;

        const gap = findNearestGap(fingerY);

        const applyDisplacements = (targetGap: number) => {
            const total = itemLayouts.current.length;
            const dragIdx = activeIdxRef.current;
            for (let i = 0; i < total; i++) {
                if (i === dragIdx) continue;
                const trans = getRowTranslation(i);
                let toValue = 0;
                if (i >= targetGap && i < dragIdx) {
                    toValue = spacerHeight.current; // visually shift down
                } else if (i < targetGap && i > dragIdx) {
                    toValue = -spacerHeight.current; // visually shift up
                }
                Animated.spring(trans, {
                    toValue,
                    friction: 8,
                    tension: 45,
                    useNativeDriver: false // FIX: Must be false to prevent ghosting when swapping with JS-driven PanResponder!
                }).start();
            }
        };

        if (gap !== targetGapRef.current) {
            targetGapRef.current = gap;
            applyDisplacements(gap);
        }

        // Dynamic Edge-based Auto-scrolling
        const windowHeight = Dimensions.get('window').height;
        const topEdge = 250; // Massively increased top zone
        const bottomEdge = windowHeight - 250; // Massively increased bottom zone
        const maxScrollSpeed = 30; // Further reduced max speed to eliminate jitter and ensure buttery frames

        // Clear existing interval to prevent overlapping scrolls
        if (autoScrollTimer.current) {
            clearInterval(autoScrollTimer.current);
            autoScrollTimer.current = null;
        }

        // Ensure pageY is actually within screen bounds (PanResponder can occasionally give wildly negative values on fast swipes)
        if (pageY > 0 && pageY < topEdge) {
            // Scroll UP - Faster as you get closer to 0
            const distanceIntoZone = topEdge - Math.max(0, pageY);
            // Proportional speed formulation
            const scrollSpeed = Math.min(Math.max(2, (distanceIntoZone / topEdge) * maxScrollSpeed), maxScrollSpeed);

            autoScrollTimer.current = setInterval(() => {
                const nextY = Math.max(0, scrollY.current - scrollSpeed);
                if (scrollY.current !== nextY) { // Only scroll and re-eval if we actually moved
                    scrollY.current = nextY;
                    scrollRef.current?.scrollTo({ y: nextY, animated: false });

                    // Re-evaluate gap as we scroll
                    const newScrollDelta = nextY - initialScrollY.current;
                    scrollOffset.setValue(newScrollDelta);

                    const newFingerY = initialFingerY.current + currentDy.current + newScrollDelta;
                    const newGap = findNearestGap(newFingerY);
                    if (newGap !== targetGapRef.current) {
                        targetGapRef.current = newGap;
                        applyDisplacements(newGap);
                    }
                }
            }, 16);
        } else if (pageY > bottomEdge && pageY < windowHeight + 50) {
            // Scroll DOWN - Faster as you get closer to screen bottom
            const distanceIntoZone = pageY - bottomEdge;
            const zoneHeight = 250; // Match expanded bottom zone size
            // Proportional speed formulation
            const scrollSpeed = Math.min(Math.max(2, (distanceIntoZone / zoneHeight) * maxScrollSpeed), maxScrollSpeed);

            autoScrollTimer.current = setInterval(() => {
                const maxScroll = Math.max(0, containerY.current + (itemLayouts.current.length * 60) - windowHeight);
                const nextY = Math.min(maxScroll + 300, scrollY.current + scrollSpeed);
                if (scrollY.current !== nextY) { // Only scroll and re-eval if we actually moved
                    scrollY.current = nextY;
                    scrollRef.current?.scrollTo({ y: nextY, animated: false });

                    // Re-evaluate gap as we scroll
                    const newScrollDelta = nextY - initialScrollY.current;
                    scrollOffset.setValue(newScrollDelta);

                    const newFingerY = initialFingerY.current + currentDy.current + newScrollDelta;
                    const newGap = findNearestGap(newFingerY);
                    if (newGap !== targetGapRef.current) {
                        targetGapRef.current = newGap;
                        applyDisplacements(newGap);
                    }
                }
            }, 16);
        }
    }, [findNearestGap, scrollY, scrollRef]);

    const handleDrop = useCallback(() => {
        if (autoScrollTimer.current) {
            clearInterval(autoScrollTimer.current);
            autoScrollTimer.current = null;
        }

        rowTranslations.current.forEach(t => t.setValue(0));

        const tgtGap = targetGapRef.current;
        onDragStateChange?.(false);

        // Gap calculation: moving item[activeIdx] to tgtGap.
        // If it's placed in its own gap or exactly after itself, nothing changes.
        console.log(`[handleDrop] activeIdx: ${activeIdx}, tgtGap: ${tgtGap}`);

        if (activeIdx >= 0 && tgtGap !== activeIdx && tgtGap !== activeIdx + 1) {
            const currentItems = [...items];
            const sourceItem = currentItems[activeIdx];

            // Calculate actual effective insert index
            const insertAt = tgtGap > activeIdx ? tgtGap - 1 : tgtGap;

            // Only proceed if it actually moved to a new slot
            if (insertAt !== activeIdx && sourceItem && sourceItem.type === 'task') {
                setIsCommitting(true);
                currentItems.splice(activeIdx, 1);
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
        activeIdxRef.current = -1;
        targetGapRef.current = -1;
    }, [activeIdx, items, ops, onDragStateChange]);

    return (
        <View onLayout={e => { containerY.current = e.nativeEvent.layout.y || 0; }} style={{ width: '100%', paddingBottom: 100 }}>
            {items.map((item, idx) => {
                if (item.type === 'header') {
                    return (
                        <Animated.View
                            key={item.key}
                            style={{
                                zIndex: 5, // Ensure headers float above drifting normal tasks
                                transform: [{ translateY: getRowTranslation(idx) }] // Make header slide for spacers!
                            }}
                            onLayout={e => {
                                itemLayouts.current[idx] = {
                                    y: e.nativeEvent.layout.y,
                                    height: e.nativeEvent.layout.height
                                };
                            }}
                        >
                            {renderDateHeader(item.date)}
                        </Animated.View>
                    );
                }

                const task = item.data;
                const isActive = activeIdx === idx;

                let clumpStyle = {};
                let touchingTop = false;
                let touchingBottom = false;
                // Deactivate clumping visually when actively dragging
                if (isClumped && !isActive && activeIdx === -1) {
                    const prevItem = idx > 0 ? items[idx - 1] : null;
                    const nextItem = idx < items.length - 1 ? items[idx + 1] : null;

                    // Dynamic Clumping Logic (Reorder List)
                    const isMatchingTask = (otherItem: any) => {
                        if (!otherItem || otherItem.type !== 'task') return false;
                        const otherTask = otherItem.data;

                        if (sortOption === 'color') {
                            return (task.color || 'none') === (otherTask.color || 'none');
                        } else if (sortOption === 'importance') {
                            return (task.importance || 0) === (otherTask.importance || 0);
                        } else if (sortOption === 'estimatedTime') {
                            return task.estimatedTime === otherTask.estimatedTime;
                        } else if (sortOption === 'date' || sortOption === 'auto_organise' || sortOption === 'manual') {
                            return true;
                        }

                        return true;
                    };

                    const isPrevTask = isMatchingTask(prevItem);
                    const isNextTask = isMatchingTask(nextItem);

                    // Note: Check activeIdx out of the calculation, so dragging items don't clump
                    const isPrevValid = isPrevTask && (idx - 1) !== activeIdx;
                    const isNextValid = isNextTask && (idx + 1) !== activeIdx;

                    touchingTop = isPrevValid;
                    touchingBottom = isNextValid;

                    if (!isPrevValid && !isNextValid) {
                        clumpStyle = {};
                    } else if (!isPrevValid && isNextValid) {
                        clumpStyle = styles.taskCardClumpedFirst;
                    } else if (isPrevValid && isNextValid) {
                        clumpStyle = styles.taskCardClumpedMiddle;
                    } else if (isPrevValid && !isNextValid) {
                        clumpStyle = styles.taskCardClumpedLast;
                    }
                }

                return (
                    <DraggableRow
                        key={item.key}
                        index={idx}
                        task={task}
                        ops={ops}
                        isActive={isActive}
                        isClumped={isClumped}
                        clumpStyle={clumpStyle}
                        baseTranslateY={getRowTranslation(idx)}
                        scrollOffset={scrollOffset}
                        touchingTop={touchingTop}
                        touchingBottom={touchingBottom}
                        onLayout={e => {
                            itemLayouts.current[idx] = {
                                y: e.nativeEvent.layout.y,
                                height: e.nativeEvent.layout.height
                            };
                        }}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDrop}
                        style={isActive ? { zIndex: 9999 } : {}}
                    />
                );
            })}

        </View>
    );
}

// Sub-component wrapper attaching the gesture responder
const DraggableRow = React.memo(function DraggableRow({
    index, task, ops, isActive, onLayout, onDragStart, onDragMove, onDragEnd, isClumped, clumpStyle, touchingTop, touchingBottom, baseTranslateY, scrollOffset, style
}: {
    index: number;
    task: any;
    ops: TaskListSectionProps['ops'];
    isActive: boolean;
    onLayout: (e: any) => void;
    onDragStart: (idx: number, pageY: number) => void;
    onDragMove: (dy: number, pageY: number) => void;
    onDragEnd: () => void;
    isClumped?: boolean;
    clumpStyle?: any;
    touchingTop?: boolean;
    touchingBottom?: boolean;
    baseTranslateY: Animated.Value;
    scrollOffset: Animated.Value;
    style?: any;
}) {
    const pan = useRef(new Animated.ValueXY()).current;

    // Combine pan and scroll offset once so it doesn't break the animation graph on re-renders
    const activeTranslateY = useMemo(() => Animated.add(pan.y, scrollOffset), [pan.y, scrollOffset]);

    // Store latest callbacks and index so PanResponder doesn't trap old closures
    const handlersRef = useRef({ onDragStart, onDragMove, onDragEnd, index });
    React.useEffect(() => {
        handlersRef.current = { onDragStart, onDragMove, onDragEnd, index };
    }, [onDragStart, onDragMove, onDragEnd, index]);

    // Note: because reorder mode covers the whole row, we trigger drag immediately
    // or upon slight movement/hold. By returning true onStartShouldSetPanResponder,
    // the whole row becomes a drag grip.
    const panResponder = useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false, // PREVENT SCROLLVIEW FROM STEALING DRAG
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
                pan.setValue({ x: 0, y: 0 });
                handlersRef.current.onDragEnd();
            },
            onPanResponderTerminate: () => {
                pan.flattenOffset();
                pan.setValue({ x: 0, y: 0 });
                handlersRef.current.onDragEnd(); // e.g., if scrolled away or cancelled
            }
        }), [pan]
    );

    return (
        <Animated.View
            onLayout={onLayout}
            {...panResponder.panHandlers}
            style={[
                styles.taskCard,
                style,
                !isActive && { transform: [{ translateY: baseTranslateY }] },
                (touchingTop || touchingBottom) && !isActive && styles.taskCardClumped,
                !isActive && clumpStyle,
                isActive && {
                    transform: [{ translateY: activeTranslateY }, { scale: 1.02 }],
                    opacity: 0.9,
                    borderColor: THEME.success,
                    borderWidth: 2,
                    borderRadius: 12,
                    zIndex: 9999, // Massively elevated
                    elevation: 10,
                    shadowColor: THEME.shadowColor,
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
                daysRolled={task.daysRolled || 0} menuIcon="dots-horizontal" menuColor={THEME.textSecondary}
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
export function TaskListSection({ dates, calendarItems, sortOption, setSortOption, isReorderMode, setIsReorderMode, isClumped, setIsClumped, form, ops }: TaskListSectionProps) {
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

    const renderItem = useCallback(({ item, index }: { item: any, index: number }) => {
        const zIdx = listData.length - index;
        if (item.type === 'header') {
            return <View style={{ zIndex: zIdx, elevation: zIdx }}>{renderDateHeader(item.date)}</View>;
        } else if (item.type === 'task') {
            const task = item.data;

            let clumpStyle = {};
            let touchingTop = false;
            let touchingBottom = false;
            if (isClumped) {
                const prevItem = index > 0 ? listData[index - 1] : null;
                const nextItem = index < listData.length - 1 ? listData[index + 1] : null;

                // Dynamic Clumping Logic
                const isMatchingTask = (otherItem: any) => {
                    if (!otherItem || otherItem.type !== 'task') return false;
                    const otherTask = otherItem.data;

                    if (sortOption === 'color') {
                        return (task.color || 'none') === (otherTask.color || 'none');
                    } else if (sortOption === 'importance') {
                        return (task.importance || 0) === (otherTask.importance || 0);
                    } else if (sortOption === 'estimatedTime') {
                        return task.estimatedTime === otherTask.estimatedTime;
                    } else if (sortOption === 'date' || sortOption === 'auto_organise' || sortOption === 'manual') {
                        return true; // Default clumping (everything clumps together if adjacent)
                    }

                    return true;
                };

                const isPrevTask = isMatchingTask(prevItem);
                const isNextTask = isMatchingTask(nextItem);

                touchingTop = isPrevTask;
                touchingBottom = isNextTask;

                if (!isPrevTask && !isNextTask) {
                    clumpStyle = {}; // Solo task, regular styling
                } else if (!isPrevTask && isNextTask) {
                    clumpStyle = styles.taskCardClumpedFirst;
                } else if (isPrevTask && isNextTask) {
                    clumpStyle = styles.taskCardClumpedMiddle;
                } else if (isPrevTask && !isNextTask) {
                    clumpStyle = styles.taskCardClumpedLast;
                }
            }

            return (
                <View style={[styles.taskCard, (touchingTop || touchingBottom) && styles.taskCardClumped, clumpStyle, { zIndex: zIdx, elevation: zIdx }]}>
                    <SwipeableTaskRow
                        id={task.id} recurrence={task.rrule} title={task.title} completed={task.isCompleted}
                        deadline={task.deadline} estimatedTime={task.estimatedTime} progress={task.progress}
                        daysRolled={task.daysRolled || 0} menuIcon="dots-horizontal" menuColor={THEME.textSecondary}
                        onProgressUpdate={ops.updateTaskProgress} onComplete={() => ops.handleListTaskToggle(task)}
                        isCompleting={ops.completingTaskIds.has(task.id)} onEdit={() => ops.openEditDrawer(task)}
                        onMenu={() => ops.openMenu(task)} onMenuLongPress={() => ops.onStartMoveToDate?.(task)} formatDeadline={formatDeadline}
                        onSwipeStart={ops.handleSwipeStart} onSwipeEnd={ops.handleSwipeEnd}
                        isSelectionMode={ops.isSprintSelectionMode} isSelected={ops.selectedSprintTaskIds.has(task.id)}
                        onSelect={() => ops.toggleSprintTaskSelection(task.id)} color={task.color}
                        taskType={task.taskType} importance={task.importance} reminderEnabled={task.reminderEnabled}
                        reminderTime={task.reminderTime} reminderDate={task.reminderDate}
                        onToggleReminder={() => ops.onToggleReminder(task)}
                        touchingTop={touchingTop} touchingBottom={touchingBottom}
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
                                    <Ionicons name="close-circle" size={24} color={THEME.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.addTaskActions}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                    <TouchableOpacity style={[styles.addOptionChip, form.newTaskDeadline && styles.addOptionChipActive]}
                                        onPress={() => { form.setCalendarMode('new'); form.setIsCalendarVisible(true); }}>
                                        <Ionicons name="calendar-outline" size={16} color={form.newTaskDeadline ? THEME.bg : THEME.textSecondary} />
                                        <Text style={[styles.addOptionText, form.newTaskDeadline && { color: THEME.bg }]}>
                                            {form.newTaskDeadline ? formatDeadline(form.newTaskDeadline) : "Date"}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.addOptionChip, form.newTaskEstimatedTime && styles.addOptionChipActive]}
                                        onPress={() => { form.setDurationMode('new'); form.setIsDurationPickerVisible(true); }}>
                                        <Feather name="clock" size={16} color={form.newTaskEstimatedTime ? THEME.bg : THEME.textSecondary} />
                                        <Text style={[styles.addOptionText, form.newTaskEstimatedTime && { color: THEME.bg }]}>
                                            {form.newTaskEstimatedTime || "Duration"}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.addOptionChip, form.newTaskReminderTime && styles.addOptionChipActive]}
                                        onPress={() => form.setIsTimePickerVisible(true)}>
                                        <Ionicons name="notifications-outline" size={16} color={form.newTaskReminderTime ? THEME.bg : THEME.textSecondary} />
                                        <Text style={[styles.addOptionText, form.newTaskReminderTime && { color: THEME.bg }]}>
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
    }, [listData, isClumped, sortOption, ops, form, renderDateHeader]);

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
                        isClumped={isClumped}
                        sortOption={sortOption}
                    />
                </ScrollView>
                <TouchableOpacity
                    onPress={() => {
                        setIsReorderMode(false);
                        setSortOption('manual');
                    }}
                    style={{
                        position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: THEME.success,
                        paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28,
                        shadowColor: THEME.shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8
                    }}>
                    <Text style={{ color: THEME.bg, fontSize: 16, fontWeight: 'bold' }}>Done Reordering</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <FlashList
                data={listData}
                keyExtractor={(item: any) => item.key}
                contentContainerStyle={styles.scrollContent}
                renderItem={renderItem}
                getItemType={(item: any) => item.type}
                // @ts-ignore
                estimatedItemSize={70}
            />
        </View>
    );
}
