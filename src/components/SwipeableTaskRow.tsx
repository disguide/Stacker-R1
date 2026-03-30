import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Animated, Platform } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { TagDefinition } from '../services/storage'; // Import type

// Calculate urgency color for deadline tag based on days remaining
const getDeadlineUrgencyColor = (deadline?: string): string | null => {
    if (!deadline) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(deadline);
    due.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 1) return '#EF4444'; // Red — 1D or less / overdue
    if (daysUntil === 2) return '#F59E0B'; // Orange — 2D
    if (daysUntil === 3) return '#EAB308'; // Yellow — 3D
    return null;
};

// Theme - mirroring the one in index.tsx
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    accent: '#007AFF',
    border: '#333333',
    surface: '#FFFDF5',
    success: '#38A169',
    successBg: '#F0FFF4',
};

const hexToRgba = (hex: string, opacity: number) => {
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + opacity + ')';
    }
    return hex;
};

interface SwipeableTaskRowProps {
    id: string;
    title: string;
    completed: boolean;
    deadline?: string;
    estimatedTime?: string;
    progress?: number;
    daysRolled?: number;
    recurrence?: any; // Avoiding strict type import for now to keep component decoupled, or import RecurrenceRule
    // activeTags?: TagDefinition[]; // Removed
    color?: string; // New: Color Stripe
    taskType?: 'task' | 'event' | 'work' | 'chore' | 'habit'; // New: Type Shape
    importance?: number; // New: Importance Level (1, 2, 3)
    reminderEnabled?: boolean;
    reminderTime?: string; // HH:mm
    reminderDate?: string; // YYYY-MM-DD

    // Customization
    menuIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
    menuColor?: string;

    // Handlers
    onProgressUpdate: (id: string, progress: number) => void;
    onComplete: () => void;
    onEdit: () => void;
    onMenu: () => void;
    onMenuLongPress?: () => void; // Long-press 3-dots → Move to Date
    onToggleReminder?: () => void; // Toggle callback for reminder tag
    // Formatters handling
    formatDeadline: (date: string) => string;

    // NEW: Scroll Locking Callbacks
    onSwipeStart?: () => void;
    onSwipeEnd?: () => void;

    // NEW: DraggableFlatList Integration
    onStartDrag?: () => void;
    // Indentation
    isSubtask?: boolean;
    // Selection Mode
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    // NEW: Cooldown State
    isCompleting?: boolean;
    isReorderMode?: boolean;
    // NEW: Clump Touching State
    touchingTop?: boolean;
    touchingBottom?: boolean;
}

// Helper to calculate remaining time locally
const calculateRemainingTime = (estimatedTime: string, progress: number) => {
    if (!estimatedTime) return null;
    if (progress >= 100) return 'Done';

    let totalMinutes = 0;

    // 1. Try parsing "1h 30m", "90m", "1.5h", "1,5h"
    const hoursMatch = estimatedTime.match(/(\d+(?:[.,]\d+)?)\s*h/i);
    const minutesMatch = estimatedTime.match(/(\d+(?:[.,]\d+)?)\s*m/i) || estimatedTime.match(/h\s*(\d+(?:[.,]\d+)?)/i);

    // 2. Try parsing "1:30" (Colon format)
    const colonMatch = estimatedTime.match(/(\d+):(\d+)/);

    if (colonMatch) {
        totalMinutes = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
    } else {
        if (hoursMatch) totalMinutes += parseFloat(hoursMatch[1].replace(',', '.')) * 60;
        if (minutesMatch) totalMinutes += parseFloat(minutesMatch[1].replace(',', '.'));
    }

    // 3. Fallback: Just a number? (e.g. "90", "1.5") -> assume minutes OR hours if small?
    // Let's assume minutes for unitless, unless user means "1.5" (likely hours). But standard is minutes.
    if (totalMinutes === 0 && /^[\d.,]+$/.test(estimatedTime.trim())) {
        totalMinutes = parseFloat(estimatedTime.trim().replace(',', '.'));
    }

    // If we still have 0 but there was a string, likely unparseable, return original
    if (totalMinutes === 0) return estimatedTime;

    // Calculate remaining based on progress percentage
    const remaining = progress > 0 ? Math.round(totalMinutes * (1 - progress / 100)) : totalMinutes;

    const h = Math.floor(remaining / 60);
    const m = remaining % 60;

    // Format output: 1h45, 45min, or 2h
    if (h > 0) {
        return m > 0 ? `${h}h${m}` : `${h}h`;
    } else {
        return `${m}min`;
    }
};

function SwipeableTaskRow({
    id,
    title,
    completed,
    deadline,
    estimatedTime,
    progress = 0,
    daysRolled = 0,
    menuIcon = "dots-vertical",
    menuColor = "#94A3B8",
    onProgressUpdate,
    onComplete,
    onEdit,
    onMenu,
    formatDeadline,
    onSwipeStart,
    onSwipeEnd,
    isSubtask = false,
    isSelectionMode = false,
    isSelected = false,
    onSelect,
    isCompleting = false,
    isReorderMode = false,
    touchingTop = false,
    touchingBottom = false,
    ...props // Catch-all for recurrence to avoid destructuring mess or add it explicitly
}: SwipeableTaskRowProps) {
    const [containerWidth, setContainerWidth] = useState(0);

    // Animation Values
    const progressAnim = useMemo(() => new Animated.Value(progress), []);

    // Lock updates during completion delay to prevent snap-back
    const isLocalCompleting = useRef(false);

    // Local state for descriptions
    const [displayProgress, setDisplayProgress] = useState(progress);

    React.useEffect(() => {
        // Sync external props ONLY if we aren't in the middle of completing
        if (!isLocalCompleting.current) {
            progressAnim.setValue(progress);
            setDisplayProgress(progress);
        }
    }, [progress]);

    const originalProgressRef = useRef(progress);
    useEffect(() => { originalProgressRef.current = progress }, [progress]);

    const widthRef = useRef(0);
    const touchStartProgress = useRef(0);
    const viewRef = useRef<View>(null);
    const containerPageX = useRef<number | null>(null);

    const handleLayout = (e: any) => {
        const w = e.nativeEvent.layout.width;
        setContainerWidth(w);
        widthRef.current = w;
    };

    const stateRef = useRef({ isSelectionMode, isReorderMode, completed, onSwipeStart, onSwipeEnd, onProgressUpdate, onComplete, id });
    useEffect(() => {
        stateRef.current = { isSelectionMode, isReorderMode, completed, onSwipeStart, onSwipeEnd, onProgressUpdate, onComplete, id };
    }, [isSelectionMode, isReorderMode, completed, onSwipeStart, onSwipeEnd, onProgressUpdate, onComplete, id]);

    const panResponder = useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            // Only capture if drag is significant (avoids stealing taps on checkbox)
            onMoveShouldSetPanResponder: (_, gestureState) => {
                const { isSelectionMode, isReorderMode, completed } = stateRef.current;
                if (isSelectionMode || isReorderMode) return false;
                // Only if horizontal swipe > vertical move
                return !completed && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) * 1.2 > Math.abs(gestureState.dy);
            },
            onPanResponderTerminationRequest: () => false,

            onPanResponderGrant: (evt, gestureState) => {
                const w = widthRef.current;
                if (w <= 0) return;

                if (stateRef.current.onSwipeStart) stateRef.current.onSwipeStart();

                const locationX = evt.nativeEvent.locationX;

                const startP = (locationX / w) * 100;
                const clampedStart = Math.max(0, Math.min(100, startP));

                touchStartProgress.current = clampedStart;

                // Immediate visual update
                setDisplayProgress(clampedStart);

                Animated.timing(progressAnim, {
                    toValue: clampedStart,
                    duration: 50, // Slightly faster
                    useNativeDriver: false,
                }).start();

                // Asynchronously capture true screen coordinates to guarantee perfect tracking
                if (viewRef.current) {
                    viewRef.current.measure((x, y, width, height, pageX, pageY) => {
                        containerPageX.current = pageX;
                        // Recalculate based on true screen position of finger (x0) and container (pageX)
                        const realStartP = ((gestureState.x0 - pageX) / widthRef.current) * 100;
                        const clampedReal = Math.max(0, Math.min(100, realStartP));
                        touchStartProgress.current = clampedReal;
                        progressAnim.setValue(clampedReal);
                        setDisplayProgress(clampedReal);
                    });
                }
            },
            onPanResponderMove: (evt, gestureState) => {
                const w = widthRef.current;
                if (w <= 0) return;

                // Cancel if vertical scroll detected (increased tolerance)
                if (Math.abs(gestureState.dy) > 300) {
                    const resetVal = originalProgressRef.current;
                    Animated.spring(progressAnim, {
                        toValue: resetVal,
                        useNativeDriver: false,
                        bounciness: 0
                    }).start();
                    setDisplayProgress(resetVal);
                    if (stateRef.current.onSwipeEnd) stateRef.current.onSwipeEnd();
                    return;
                }

                let finalP;
                if (containerPageX.current !== null) {
                    // Absolute physically perfect tracking!
                    finalP = ((gestureState.moveX - containerPageX.current) / w) * 100;
                } else {
                    // Fallback to relative tracking
                    const deltaPercent = (gestureState.dx / w) * 100;
                    finalP = touchStartProgress.current + deltaPercent;
                }

                finalP = Math.max(0, Math.min(100, finalP));

                // Update animation and text immediately
                progressAnim.setValue(finalP);
                setDisplayProgress(finalP);
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (stateRef.current.onSwipeEnd) stateRef.current.onSwipeEnd();

                // Checkbox tap handled by TouchableOpacity below, not here

                const w = widthRef.current;
                if (w <= 0) return;

                // Cancel if vertical drag was dominant (increased tolerance)
                if (Math.abs(gestureState.dy) > 300) {
                    const resetVal = originalProgressRef.current;
                    Animated.spring(progressAnim, {
                        toValue: resetVal,
                        useNativeDriver: false,
                        bounciness: 0
                    }).start();
                    setDisplayProgress(resetVal);
                    return;
                }

                const deltaPercent = (gestureState.dx / w) * 100;
                let finalP = touchStartProgress.current + deltaPercent;
                finalP = Math.max(0, Math.min(100, finalP));

                if (finalP > 90) finalP = 100;

                if (finalP === 100) {
                    isLocalCompleting.current = true; // Lock state
                    Animated.timing(progressAnim, {
                        toValue: 100,
                        duration: 100,
                        useNativeDriver: false
                    }).start(() => {
                        // Add delay before completion
                        setTimeout(() => {
                            stateRef.current.onComplete();
                        }, 50); // Immediate trigger (delegating delay to parent handler)
                    });
                    setDisplayProgress(100);
                    stateRef.current.onProgressUpdate(stateRef.current.id, 100);
                } else {
                    Animated.spring(progressAnim, {
                        toValue: finalP,
                        useNativeDriver: false,
                        bounciness: 0,
                        speed: 20
                    }).start();

                    setDisplayProgress(finalP);
                    stateRef.current.onProgressUpdate(stateRef.current.id, finalP);
                }
            },
            onPanResponderTerminate: () => {
                if (stateRef.current.onSwipeEnd) stateRef.current.onSwipeEnd();

                const resetVal = originalProgressRef.current;
                Animated.spring(progressAnim, {
                    toValue: resetVal,
                    useNativeDriver: false,
                    bounciness: 0
                }).start();
                setDisplayProgress(resetVal);
            }
        }), []
    );

    return (
        <View
            style={[
                { position: 'relative', flex: 1 },
                isSubtask && { minHeight: 40 }
            ]}
            onLayout={handleLayout} // Measure Full Container
        >

            {/* Dynamic Sweeping Background and Border */}
            {!isSelectionMode && (
                <View style={{ position: 'absolute', top: -6, bottom: -1, left: -1, right: -6, borderRadius: 0, overflow: 'hidden' }} pointerEvents="none">
                    <Animated.View style={[
                        styles.progressFill,
                        {
                            top: 0,
                            left: 0,
                            bottom: 0,
                            borderTopWidth: 6,
                            borderLeftWidth: 1,
                            borderBottomWidth: 1,
                            borderColor: props.color ? hexToRgba(props.color, (completed || isCompleting) ? 0.25 : 0.15) : hexToRgba('#38A169', (completed || isCompleting) ? 0.35 : 0.25),
                            borderTopLeftRadius: touchingTop || isSubtask ? 0 : 12,
                            borderBottomLeftRadius: touchingBottom || isSubtask ? 0 : 12,
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0,
                            width: progressAnim.interpolate({
                                inputRange: [0, 100],
                                outputRange: ['0%', '100%']
                            }),
                            backgroundColor: props.color ? hexToRgba(props.color, (completed || isCompleting) ? 0.25 : 0.15) : ((completed || isCompleting) ? '#F0FFF4' : '#E6FFFA'),
                            opacity: progressAnim.interpolate({
                                inputRange: [0, 5, 100],
                                outputRange: [0, 1, 1]
                            })
                        }
                    ]} />
                </View>
            )}

            <View
                ref={viewRef}
                style={[
                    styles.container,
                    isSubtask && { minHeight: 40 }
                ]}
            >
                {/* Color Stripe - Static */}
                <View style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    borderTopLeftRadius: touchingTop || isSubtask ? 0 : 6,
                    borderBottomLeftRadius: touchingBottom || isSubtask ? 0 : 10,
                    backgroundColor: props.color || '#CBD5E0',
                    zIndex: 2,
                }} />

                {/* Slider Zone */}
                <View
                    style={styles.sliderZone}
                    {...(!isSelectionMode && !isReorderMode ? panResponder.panHandlers : {})}
                >
                    {/* Make entire row tappable in Selection Mode */}
                    <TouchableOpacity
                        style={[
                            styles.sliderContent,
                            isSubtask && { paddingLeft: 44, paddingVertical: 4 }
                        ]}
                        onPress={isSelectionMode ? onSelect : undefined}
                        disabled={!isSelectionMode}
                        activeOpacity={1} // No opacity change for row tap, checking box handles visual
                    >


                        {/* In reorder mode: show drag handle instead of checkbox */}
                        {isReorderMode ? (
                            <View
                                style={[
                                    styles.taskCheckbox,
                                    { borderWidth: 0, alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }
                                ]}
                            >
                                <MaterialCommunityIcons name="drag" size={22} color="#94A3B8" />
                            </View>
                        ) : (
                            <>
                                {/* Checkbox: Now a proper touchable */}
                                <TouchableOpacity
                                    style={[
                                        styles.taskCheckbox,
                                        isSelectionMode && styles.selectionCheckbox,
                                        isSelectionMode && isSelected && styles.selectionCheckboxSelected,
                                        !isSelectionMode && {
                                            borderColor: props.color || '#444',
                                            borderRadius: props.taskType === 'event' || props.taskType === 'habit' ? 12 : 6,
                                            width: isSubtask ? 18 : 24,
                                            height: isSubtask ? 18 : 24,
                                        }
                                    ]}
                                    onPress={isSelectionMode ? onSelect : onComplete}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    {isSelectionMode ? (
                                        isSelected && <View style={styles.selectionInner} />
                                    ) : (
                                        (completed || isCompleting) && <View style={[
                                            styles.taskCheckboxInner,
                                            {
                                                backgroundColor: props.color || '#38A169',
                                                borderRadius: props.taskType === 'event' || props.taskType === 'habit' ? 6 : 2,
                                                width: isSubtask ? 10 : 14,
                                                height: isSubtask ? 10 : 14,
                                            }
                                        ]} />
                                    )}
                                </TouchableOpacity>
                            </>
                        )}


                        <View style={{ flex: 1, paddingRight: 8 }} pointerEvents="box-none">
                            <Text style={[
                                styles.taskTitle,
                                (completed || isCompleting) && styles.taskTitleCompleted,
                                isSubtask && { fontSize: 14 },
                            ]}>
                                {title}
                            </Text>

                            <View style={styles.taskMetaRow}>
                                {deadline && (
                                    <View style={styles.metaItem}>
                                        <Ionicons name="calendar-outline" size={14} color={getDeadlineUrgencyColor(deadline) || THEME.textSecondary} />
                                        <Text style={[styles.metaText, getDeadlineUrgencyColor(deadline) && { color: getDeadlineUrgencyColor(deadline), fontWeight: 'bold' }]}>
                                            {(() => {
                                                try {
                                                    return formatDeadline(deadline);
                                                } catch {
                                                    return deadline;
                                                }
                                            })()}
                                        </Text>
                                    </View>
                                )}
                                {estimatedTime && (
                                    <View style={styles.metaItem}>
                                        <Feather name="clock" size={12} color={THEME.textSecondary} />
                                        <Text style={styles.metaText}>{calculateRemainingTime(estimatedTime, displayProgress)}</Text>
                                    </View>
                                )}
                                {daysRolled > 0 && (
                                    <View style={styles.rolledOverTag}>
                                        <MaterialCommunityIcons name="redo-variant" size={14} color="#64748B" style={{ marginRight: 2 }} />
                                        <Text style={styles.rolledOverText}>Roll x{daysRolled}</Text>
                                    </View>
                                )}
                                {/* Recurrence Tag */}
                                {props.recurrence && (
                                    <View style={styles.rolledOverTag}>
                                        <MaterialCommunityIcons name="repeat" size={14} color="#64748B" />
                                    </View>
                                )}
                                {/* Importance logic moved to top right action zone */}
                                {/* Reminder Tag - Toggleable - Hidden in reorder mode */}
                                {!isReorderMode && props.reminderTime && (
                                    <TouchableOpacity
                                        onPress={props.onToggleReminder}
                                        style={[
                                            styles.rolledOverTag,
                                            {
                                                backgroundColor: (props.reminderEnabled ?? true) ? '#FEF3C7' : '#F1F5F9', // Amber vs Gray 100
                                                marginRight: 4
                                            }
                                        ]}
                                    >
                                        <Text style={[
                                            styles.rolledOverText,
                                            {
                                                color: (props.reminderEnabled ?? true) ? '#B45309' : '#94A3B8', // Orange vs Gray 400
                                                textDecorationLine: (props.reminderEnabled ?? true) ? 'none' : 'line-through'
                                            }
                                        ]}>
                                            🔔 {props.reminderTime}
                                            {props.reminderDate && props.reminderDate !== new Date().toISOString().split('T')[0] ? ` (${props.reminderDate.slice(5)})` : ''}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                    </TouchableOpacity>
                </View>



                {/* Absolute Top Right Corner Stars */}
                {props.importance ? (
                    <View style={{ position: 'absolute', top: 4, right: 8, flexDirection: 'row', zIndex: 10 }}>
                        {Array.from({ length: props.importance }).map((_, i) => (
                            <MaterialCommunityIcons key={i} name="star" size={10} color="#F59E0B" style={{ marginHorizontal: -1 }} />
                        ))}
                    </View>
                ) : null}

                {/* Action Zone (Right Side) - Hidden in reorder mode */}
                {!isReorderMode && (
                    <View style={styles.actionZone}>
                        <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
                            <MaterialCommunityIcons name="pencil" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={onMenu}>
                            <MaterialCommunityIcons name={menuIcon} size={20} color={menuColor} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Percentage Indicator - Absolute Bottom Right of ROW */}
                <Text style={styles.percentageText}>
                    {Math.round(displayProgress)}%
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: 'transparent',
        borderBottomWidth: 0,
        minHeight: 52,
        overflow: 'hidden', // Contain progress bar
        position: 'relative',
        borderRadius: 0, // Fit inside the soft 12px parent
    },
    containerCompleted: {
        backgroundColor: '#F0FFF4',
        opacity: 0.8,
    },
    progressFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: '#E6FFFA', // Light Teal/Green tint for progress
        zIndex: 0, // Behind content
    },
    sliderZone: {
        flex: 1,
        justifyContent: 'center',
        zIndex: 1, // Above progress fill
        paddingLeft: 0, // Remove padding from container logic
    },
    sliderContent: {
        flex: 1, // Ensure it fills available space for absolute positioning
        flexDirection: 'row',
        alignItems: 'flex-start', // Top alignment for tall tasks
        paddingVertical: 12, // Increased from 6
        paddingLeft: 12,
    },
    taskCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#444',
        marginRight: 10,
        // marginTop: 0, // Removed for center alignment
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        zIndex: 20,
        alignSelf: 'center', // Added: Vertically center the checkbox independently
    },
    taskCheckboxInner: {
        width: 14,
        height: 14,
        backgroundColor: '#38A169',
        borderRadius: 2,
    },
    taskTitle: {
        fontSize: 16,
        color: '#333333',
        lineHeight: 22, // HEIGHT REFERENCE
        marginBottom: 0, // Reduced to tighten vertical gap
        paddingRight: 74, // Avoid overlapping Absolute Action Buttons
    },
    taskTitleCompleted: {
        color: '#38A169',
        opacity: 0.8,
        textDecorationLine: 'line-through',
    },
    taskMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2, // Slightly tighter
        flexWrap: 'wrap',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#64748B',
        // fontFamily removed for system default
    },
    rolledOverTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 4,
        // backgroundColor: '#F1F5F9', // Removed background
        paddingHorizontal: 0, // Removed padding
        paddingVertical: 0,
        // borderRadius: 4,
    },
    rolledOverText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#64748B', // Slate-500
    },
    actionZone: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'flex-start', // Top align
        paddingTop: 6, // Set back to 6 to keep buttons from crushing tags below
        paddingHorizontal: 8, // Add padding to separate from edge
        zIndex: 20
    },
    actionButton: {
        padding: 8,
        marginHorizontal: 2
    },
    percentageText: {
        position: 'absolute',
        bottom: 2,
        right: 6, // Far bottom right
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: 'bold',
        opacity: 0.6,
        zIndex: 10
    },
    selectionCheckbox: {
        borderWidth: 1.5,
        borderColor: '#CCC',
        borderRadius: 4,
        backgroundColor: '#FFF'
    },
    selectionCheckboxSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF'
    },
    selectionInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
    }
});


// Add a custom comparison function to prevent unnecessary re-renders in FlashList
export default React.memo(SwipeableTaskRow, (prevProps, nextProps) => {
    return (
        prevProps.id === nextProps.id &&
        prevProps.title === nextProps.title &&
        prevProps.completed === nextProps.completed &&
        prevProps.deadline === nextProps.deadline &&
        prevProps.estimatedTime === nextProps.estimatedTime &&
        prevProps.progress === nextProps.progress &&
        prevProps.daysRolled === nextProps.daysRolled &&
        prevProps.color === nextProps.color &&
        prevProps.taskType === nextProps.taskType &&
        prevProps.importance === nextProps.importance &&
        prevProps.reminderEnabled === nextProps.reminderEnabled &&
        prevProps.reminderTime === nextProps.reminderTime &&
        prevProps.reminderDate === nextProps.reminderDate &&
        prevProps.isSelectionMode === nextProps.isSelectionMode &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isCompleting === nextProps.isCompleting &&
        prevProps.isReorderMode === nextProps.isReorderMode &&
        prevProps.touchingTop === nextProps.touchingTop &&
        prevProps.touchingBottom === nextProps.touchingBottom
        // Note: we ignore function props like onProgressUpdate as they might be redefined but shouldn't trigger re-renders
    );
});
