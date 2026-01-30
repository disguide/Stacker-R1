import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';

import { StorageService, Task } from '../src/services/storage';

// Theme - consistent with index.tsx
const THEME = {
    bg: '#F8FAFC',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    accent: '#3B82F6', // Blue like the sprint button
    success: '#10B981',
    border: '#E2E8F0',
    timerBg: '#FFFFFF',
    cardBg: '#FFFFFF',
};

export default function SprintScreen() {
    useKeepAwake(); // Keep screen on during sprint
    const router = useRouter();
    const params = useLocalSearchParams();
    const { taskIds } = params;

    const [tasks, setTasks] = useState<Task[]>([]);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const startTimeRef = useRef<number>(Date.now());

    // Initial Load
    useEffect(() => {
        startTimeRef.current = Date.now();
        loadSprintTasks();
    }, [taskIds]);

    const loadSprintTasks = async () => {
        try {
            const sprintTasks = await StorageService.loadSprintTasks();
            if (sprintTasks && sprintTasks.length > 0) {
                setTasks(sprintTasks);
            } else {
                console.warn("No sprint tasks found in storage");
            }
        } catch (e) {
            console.error("Failed to load sprint tasks", e);
        }
    };

    const handleSwitchTask = () => {
        setTasks(prevTasks => {
            if (prevTasks.length <= 1) return prevTasks;
            // Create a copy to avoid mutating the previous state directly (though slice created a copy before, this is explicit)
            const [first, ...rest] = prevTasks;
            return [...rest, first];
        });
    };

    const handleCompleteTask = async () => {
        if (!tasks[0]) return;

        const taskToComplete = tasks[0];
        setCompletedTasks(prev => [...prev, taskToComplete]);

        // TODO: Persist completion to storage if needed
        // await StorageService.completeTask(taskToComplete.id);

        if (tasks.length <= 1) {
            finishSprint([...completedTasks, taskToComplete]);
        } else {
            // Remove first task
            setTasks(prev => prev.slice(1));
        }
    };

    const finishSprint = (finalCompletedTasks: Task[] = completedTasks) => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);

        router.replace({
            pathname: '/sprint-summary',
            params: {
                duration: duration.toString(),
                tasks: JSON.stringify(finalCompletedTasks)
            }
        });
    };

    const currentTask = tasks[0];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sprint Mode</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Main Content Area */}
            <View style={styles.contentContainer}>

                {/* Current Task Card */}
                <View style={styles.cardContainer}>
                    {currentTask ? (
                        <>
                            <View style={styles.taskInfo}>
                                <Text style={styles.currentLabel}>NOW WORKING ON</Text>
                                <Text style={styles.taskTitle}>{currentTask.title}</Text>
                                {currentTask.estimatedTime && (
                                    <Text style={styles.taskEstimate}>Est: {currentTask.estimatedTime}</Text>
                                )}
                            </View>

                            {/* Split Pill Control */}
                            <View style={styles.splitPillContainer}>
                                <TouchableOpacity
                                    style={styles.pillLeft}
                                    onPress={handleSwitchTask}
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons name="swap-horizontal" size={24} color="#64748B" />
                                    <Text style={styles.pillTextLeft}>Switch</Text>
                                </TouchableOpacity>

                                <View style={styles.pillDivider} />

                                <TouchableOpacity
                                    style={styles.pillRight}
                                    onPress={handleCompleteTask}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                                    <Text style={styles.pillTextRight}>Complete</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <Text style={styles.emptyText}>Loading tasks...</Text>
                    )}
                </View>

                {/* Next Up List */}
                <View style={styles.nextUpContainer}>
                    <Text style={styles.nextUpLabel}>NEXT UP</Text>
                    <ScrollView style={styles.nextScroll} showsVerticalScrollIndicator={false}>
                        {tasks.slice(1).map((t, i) => (
                            <View key={t.id} style={styles.nextItem}>
                                <Text style={styles.nextTitle} numberOfLines={1}>{t.title}</Text>
                            </View>
                        ))}
                        {tasks.length <= 1 && (
                            <Text style={styles.noNextText}>Last task!</Text>
                        )}
                    </ScrollView>
                </View>

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.textPrimary,
    },
    closeButton: {
        padding: 8,
    },
    contentContainer: {
        flex: 1,
        paddingTop: 20,
    },
    cardContainer: {
        marginHorizontal: 20,
        backgroundColor: THEME.cardBg,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        minHeight: 320, // Taller card
        marginBottom: 30,
    },
    taskInfo: {
        alignItems: 'center',
        width: '100%',
        flex: 1,
        justifyContent: 'center',
    },
    currentLabel: {
        fontSize: 12,
        color: THEME.accent,
        fontWeight: 'bold',
        marginBottom: 16,
        letterSpacing: 1,
    },
    taskTitle: {
        fontSize: 28, // Bigger title
        fontWeight: 'bold',
        color: THEME.textPrimary,
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 34,
    },
    taskEstimate: {
        fontSize: 18,
        color: THEME.textSecondary,
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        color: THEME.textSecondary,
        fontSize: 16,
    },

    // Split Pill Styles
    splitPillContainer: {
        flexDirection: 'row',
        width: '100%',
        height: 72, // Big touch target
        backgroundColor: '#F1F5F9', // Light Slate for the Switch side
        borderRadius: 36, // Fully rounded pill
        overflow: 'hidden',
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pillLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F8FAFC', // Slightly lighter than container
    },
    pillRight: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: THEME.success, // Green
    },
    pillDivider: {
        width: 1,
        backgroundColor: '#E2E8F0',
    },
    pillTextLeft: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748B', // Slate text
    },
    pillTextRight: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF', // White text
    },

    nextUpContainer: {
        flex: 1,
        paddingHorizontal: 30,
        backgroundColor: 'rgba(255,255,255,0.5)', // Subtle backdrop?
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 30,
    },
    nextUpLabel: {
        fontSize: 12,
        color: THEME.textSecondary,
        fontWeight: 'bold',
        marginBottom: 16,
        letterSpacing: 1,
    },
    nextScroll: {
        flex: 1,
    },
    nextItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    nextTitle: {
        fontSize: 16,
        color: '#64748B',
    },
    noNextText: {
        fontStyle: 'italic',
        color: '#94A3B8',
        marginTop: 10,
    },
});
