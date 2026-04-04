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
    const carouselPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true, // Own the touch in the bottom zone
            onStartShouldSetPanResponderCapture: () => false,
            // Capture phase: let children handle their own touches first.
            onMoveShouldSetPanResponderCapture: () => false,
            // Bubbling phase: if child didn't claim, we claim if it's a solid upward swipe.
            onMoveShouldSetPanResponder: (_, gestureState) => {
                 // Make swipe up more responsive (threshold -15)
                 return gestureState.dy < -15 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
            },
            onPanResponderGrant: () => {
                carouselPanY.setOffset((carouselPanY as any)._value);
                carouselPanY.setValue(0);
            },
            onPanResponderMove: (_, gestureState) => {
                // Only allow upward translation
                if (gestureState.dy < 0) {
                    carouselPanY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                carouselPanY.flattenOffset();
                if (gestureState.dy < -100 || gestureState.vy < -1.2) {
                    // Swiped up far enough -> save and close EVERYTHING simultaneously
                    Animated.parallel([
                        Animated.timing(carouselPanY, {
                            toValue: -SCREEN_HEIGHT,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                        Animated.timing(panY, {
                            toValue: SCREEN_HEIGHT,
                            duration: 200, // Sync the background dim fade and main drawer slide down perfectly
                            useNativeDriver: true,
                        })
                    ]).start(() => {
                        handleSaveRef.current(true); // Save and return to home WITHOUT second delay
                    });
                } else {
                    // Snap back
                    Animated.spring(carouselPanY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

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

    if (!activeFeature) return null;

    return (
        <View style={styles.carouselOverlay}>
            <Animated.View
                style={[
                    styles.carouselSheet,
                    { transform: [{ translateY: carouselPanY }] }
                ]}
                {...carouselPanResponder.panHandlers}
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
                
            </Animated.View>
        </View>
    );
}
