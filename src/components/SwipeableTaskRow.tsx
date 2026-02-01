import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Animated, Platform } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

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

interface SwipeableTaskRowProps {
    id: string;
    title: string;
    completed: boolean;
    deadline?: string;
    estimatedTime?: string;
    progress?: number;
    daysRolled?: number;
    recurrence?: any; // Avoiding strict type import for now to keep component decoupled, or import RecurrenceRule

    // Customization
    menuIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
    menuColor?: string;

    // Handlers
    onProgressUpdate: (id: string, progress: number) => void;
    onComplete: () => void;
    onEdit: () => void;
    onMenu: () => void;
    // Formatters handling
    formatDeadline: (date: string) => string;

    // NEW: Scroll Locking Callbacks
    onSwipeStart?: () => void;
    onSwipeEnd?: () => void;
    // Indentation
    isSubtask?: boolean;
    // Selection Mode
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    // NEW: Cooldown State
    isCompleting?: boolean;
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

export default function SwipeableTaskRow({
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
    ...props // Catch-all for recurrence to avoid destructuring mess or add it explicitly
}: SwipeableTaskRowProps) {
    const [containerWidth, setContainerWidth] = useState(0);

    // Animation Values
    const progressAnim = useRef(new Animated.Value(progress)).current;

    // Local state for text display
    const [displayProgress, setDisplayProgress] = useState(progress);

    React.useEffect(() => {
        // Sync external props
        progressAnim.setValue(progress);
        setDisplayProgress(progress);
    }, [progress]);

    const originalProgressRef = useRef(progress);
    useEffect(() => { originalProgressRef.current = progress }, [progress]);

    const widthRef = useRef(0);
    const touchStartProgress = useRef(0);

    const handleLayout = (e: any) => {
        const w = e.nativeEvent.layout.width;
        setContainerWidth(w);
        widthRef.current = w;
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            // Only capture if drag is significant (avoids stealing taps on checkbox)
            onMoveShouldSetPanResponder: (_, gestureState) => {
                if (isSelectionMode) return false;
                return !completed && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) * 1.2 > Math.abs(gestureState.dy);
            },
            onPanResponderTerminationRequest: () => false,

            onPanResponderGrant: (evt, gestureState) => {
                const w = widthRef.current;
                if (w <= 0) return;

                if (onSwipeStart) onSwipeStart();

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
                    if (onSwipeEnd) onSwipeEnd();
                    return;
                }

                const deltaPercent = (gestureState.dx / w) * 100;
                let finalP = touchStartProgress.current + deltaPercent;
                finalP = Math.max(0, Math.min(100, finalP));

                // Sticky at 100%
                if (finalP > 90) finalP = 100;

                // Update animation and text immediately
                progressAnim.setValue(finalP);
                setDisplayProgress(finalP);
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (onSwipeEnd) onSwipeEnd();

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
                    Animated.timing(progressAnim, {
                        toValue: 100,
                        duration: 100,
                        useNativeDriver: false
                    }).start(() => {
                        onComplete();
                    });
                    setDisplayProgress(100);
                    onProgressUpdate(id, 100);
                } else {
                    Animated.spring(progressAnim, {
                        toValue: finalP,
                        useNativeDriver: false,
                        bounciness: 0,
                        speed: 20
                    }).start();

                    setDisplayProgress(finalP);
                    onProgressUpdate(id, finalP);
                }
            },
            onPanResponderTerminate: () => {
                if (onSwipeEnd) onSwipeEnd();

                const resetVal = originalProgressRef.current;
                Animated.spring(progressAnim, {
                    toValue: resetVal,
                    useNativeDriver: false,
                    bounciness: 0
                }).start();
                setDisplayProgress(resetVal);
            }
        })
    ).current;

    return (
        <View
            style={[styles.container, (completed || isCompleting) && styles.containerCompleted]}
            onLayout={handleLayout} // Measure Full Container
        >
            {/* Full Width Background Progress Fill - Hidden in Selection Mode */}
            {!completed && !isCompleting && !isSelectionMode && (
                <Animated.View style={[
                    styles.progressFill,
                    {
                        width: progressAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ['0%', '100%']
                        })
                    }
                ]} />
            )}

            {/* Slider Zone */}
            <View
                style={styles.sliderZone}
                {...(!isSelectionMode ? panResponder.panHandlers : {})}
            >
                {/* Make entire row tappable in Selection Mode */}
                <TouchableOpacity
                    style={[styles.sliderContent, isSubtask && { paddingLeft: 44 }]}
                    onPress={isSelectionMode ? onSelect : undefined}
                    disabled={!isSelectionMode}
                    activeOpacity={1} // No opacity change for row tap, checking box handles visual
                >
                    {/* Checkbox: Now a proper touchable */}
                    <TouchableOpacity
                        style={[
                            styles.taskCheckbox,
                            isSelectionMode && styles.selectionCheckbox,
                            isSelectionMode && isSelected && styles.selectionCheckboxSelected
                        ]}
                        onPress={isSelectionMode ? onSelect : onComplete}
                        activeOpacity={0.7}
                        // Increase hit slop to make it easier to tap
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {isSelectionMode ? (
                            isSelected && <View style={styles.selectionInner} />
                        ) : (
                            (completed || isCompleting) && <View style={styles.taskCheckboxInner} />
                        )}
                    </TouchableOpacity>

                    <View style={{ flex: 1, paddingRight: 8 }} pointerEvents="none">
                        <Text style={[styles.taskTitle, (completed || isCompleting) && styles.taskTitleCompleted]}>
                            {title}
                        </Text>

                        <View style={styles.taskMetaRow}>
                            {deadline && (
                                <View style={styles.metaItem}>
                                    <Ionicons name="calendar-outline" size={12} color={THEME.textSecondary} />
                                    <Text style={styles.metaText}>
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
                                    <MaterialCommunityIcons name="redo-variant" size={14} color="#C05621" style={{ marginRight: 2 }} />
                                    <Text style={styles.rolledOverText}>Roll x{daysRolled}</Text>
                                </View>
                            )}
                            {/* Recurrence Tag */}
                            {props.recurrence && (
                                <View style={styles.rolledOverTag}>
                                    <Text style={{ fontSize: 12 }}>🔁</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </View>


            {/* Action Zone (Right Side) */}
            <View style={styles.actionZone}>
                <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
                    <MaterialCommunityIcons name="pencil" size={20} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={onMenu}>
                    <MaterialCommunityIcons name={menuIcon} size={20} color={menuColor} />
                </TouchableOpacity>
            </View>
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9', // Very subtle divider
        minHeight: 60,
        overflow: 'hidden', // Contain progress bar
        position: 'relative',
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingLeft: 12, // Restored padding
    },
    taskCheckbox: {
        width: 24, // Slightly larger
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#444',
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent', // Transparent to see fill? Or white? Keep white for checkbox check
        zIndex: 20
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
        lineHeight: 22,
        marginBottom: 2,
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
        marginTop: 4,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#64748B',
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    rolledOverTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 4,
        backgroundColor: '#FEEBC8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    rolledOverText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#C05621',
    },
    actionZone: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        zIndex: 10,
        backgroundColor: 'transparent', // Or match bg to hide slider if needed
    },
    actionButton: {
        padding: 8,
    },
    // Selection Styles
    selectionCheckbox: {
        borderColor: '#007AFF', // Blue for selection
        borderRadius: 12, // Circle
    },
    selectionCheckboxSelected: {
        backgroundColor: '#007AFF',
    },
    selectionInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
    },
});
