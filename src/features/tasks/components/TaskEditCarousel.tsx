import { useState } from 'react';
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
    task,
    activeFeature,
    setActiveFeature,
    deadline,
    estimatedTime,
    recurrence,
    onDeadlineChange,
    onEstimatedTimeChange,
    onRecurrenceChange,
    onClose,
    onDelete,
    onTagIdsChange,
}: TaskEditCarouselProps) {

    const carouselPanResponder = useState(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
                return gestureState.dy > 20 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderGrant: () => {
                carouselPanY.setOffset((carouselPanY as any)._value);
                carouselPanY.setValue(0);
            },
            onPanResponderMove: Animated.event(
                [null, { dy: carouselPanY }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (evt, gestureState) => {
                carouselPanY.flattenOffset();
                if (gestureState.dy > 150 || gestureState.vy > 1.5) {
                    // Workaround to access latest closeAndSave
                    closeAndSaveRef.current?.();
                } else {
                    Animated.spring(carouselPanY, {
                        toValue: 0,
                        useNativeDriver: false,
                        bounciness: 4
                    }).start();
                }
            },
        })
    )[0];

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

    useEffect(() => {
        closeAndSaveRef.current = closeAndSave;
    });

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
