import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SCREEN_HEIGHT, SCREEN_WIDTH, THEME, styles } from '../styles/taskEditDrawerStyles';
import TaskFeatureCarousel, { FeatureKey } from '../../../components/TaskFeatureCarousel';
import { ColorDefinition, RecurrenceRule } from '../../../services/storage';

interface TaskEditCarouselProps {
    activeFeature: FeatureKey | null;
    carouselPanY: Animated.Value;
    panY: Animated.Value;
    deadline: string | null;
    estimatedTime: string | null;
    recurrence: RecurrenceRule | null;
    color: string | undefined;
    taskType: 'task' | 'event' | 'work' | 'chore' | 'habit' | undefined;
    importance: number;
    reminderOffset: number | null;
    reminderTime: string | null;
    reminderEnabled: boolean;
    userColors?: ColorDefinition[];
    handleSaveRef: React.MutableRefObject<(skipAnimation?: boolean) => void>;
    activeFeatureRef: React.MutableRefObject<FeatureKey | null>;
    setActiveFeature: (feature: FeatureKey | null) => void;
    setDeadline: (deadline: string | null) => void;
    setEstimatedTime: (time: string | null) => void;
    setRecurrence: (rule: RecurrenceRule | null) => void;
    setColor: (color: string | undefined) => void;
    setTaskType: (type: 'task' | 'event' | 'work' | 'chore' | 'habit' | undefined) => void;
    setImportance: (importance: number) => void;
    updateReminder: (offset: number | null, time: string | null) => void;
    onRequestColorSettings: () => void;
}

export default function TaskEditCarousel({
    activeFeature,
    carouselPanY,
    panY,
    deadline,
    estimatedTime,
    recurrence,
    color,
    taskType,
    importance,
    reminderOffset,
    reminderTime,
    reminderEnabled,
    userColors,
    handleSaveRef,
    activeFeatureRef,
    setActiveFeature,
    setDeadline,
    setEstimatedTime,
    setRecurrence,
    setColor,
    setTaskType,
    setImportance,
    updateReminder,
    onRequestColorSettings,
}: TaskEditCarouselProps) {
    const closeAndSaveRef = useRef<() => void>(() => {});

    const closeAndSave = () => {
        Animated.parallel([
            Animated.timing(carouselPanY, {
                toValue: -SCREEN_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(panY, {
                toValue: SCREEN_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => {
            handleSaveRef.current(true);
        });
    };

    // Keep ref in sync for PanResponder closure
    useEffect(() => {
        closeAndSaveRef.current = closeAndSave;
    });

    // PanResponder for the bottom swipe zone ONLY
    const swipeZonePanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true, // Own all touches in this zone
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                carouselPanY.setOffset((carouselPanY as any)._value);
                carouselPanY.setValue(0);
            },
            onPanResponderMove: (_, gestureState) => {
                // Allow both up and down so the user can cancel mid-swipe
                carouselPanY.setValue(gestureState.dy < 0 ? gestureState.dy : 0);
            },
            onPanResponderRelease: (_, gestureState) => {
                carouselPanY.flattenOffset();
                const isTap = Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5;
                if (isTap) {
                    closeAndSaveRef.current();
                    return;
                }
                if (gestureState.dy < -80 || gestureState.vy < -1.0) {
                    // Committed swipe-up → save and close
                    Animated.parallel([
                        Animated.timing(carouselPanY, {
                            toValue: -SCREEN_HEIGHT,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                        Animated.timing(panY, {
                            toValue: SCREEN_HEIGHT,
                            duration: 200,
                            useNativeDriver: true,
                        })
                    ]).start(() => {
                        handleSaveRef.current(true);
                    });
                } else {
                    // Not far enough / dragged back down → cancel, snap back
                    Animated.spring(carouselPanY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 80,
                        friction: 10,
                    }).start();
                }
            },
        })
    ).current;

    if (!activeFeature) return null;

    return (
        <View style={styles.carouselOverlay}>
            <Animated.View
                style={[
                    styles.carouselSheet,
                    { transform: [{ translateY: carouselPanY }] }
                ]}
            >
                <View style={styles.carouselHeader}>
                    <TouchableOpacity onPress={() => setActiveFeature(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="chevron-back" size={24} color={THEME.textPrimary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: THEME.textPrimary }}>Edit Features</Text>
                    <TouchableOpacity onPress={closeAndSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: THEME.accent }}>Done</Text>
                    </TouchableOpacity>
                </View>
                <TaskFeatureCarousel
                    visible={!!activeFeature}
                    initialFeature={activeFeature}
                    deadline={deadline}
                    estimatedTime={estimatedTime}
                    recurrence={recurrence}
                    color={color}
                    taskType={taskType}
                    importance={importance}
                    onDeadlineChange={setDeadline}
                    onEstimateChange={setEstimatedTime}
                    onRecurrenceChange={setRecurrence}
                    onColorChange={setColor}
                    onTypeChange={setTaskType}
                    onImportanceChange={setImportance}
                    onReminderChange={updateReminder}
                    reminderOffset={reminderOffset}
                    reminderTime={reminderTime}
                    reminderEnabled={reminderEnabled}
                    onClose={closeAndSave}
                    userColors={userColors}
                    onRequestColorSettings={onRequestColorSettings}
                />

                {/* Swipe-up zone: covers the confirm button / action bar area at the bottom */}
                <View
                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, zIndex: 9999 }}
                    {...swipeZonePanResponder.panHandlers}
                />
            </Animated.View>
        </View>
    );
}

