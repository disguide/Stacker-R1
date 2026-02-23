import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StorageService, UserProfile, GoalItem, GoalEventType } from '../src/services/storage';
import TaskEditDrawer from '../src/components/TaskEditDrawer';
import { Task } from '../src/features/tasks/types';

const CATEGORY_COLORS: Record<string, string> = {
    traits: '#8B5CF6',
    habits: '#3B82F6',
    environment: '#F59E0B',
    outcomes: '#10B981',
};
const FALLBACK_COLOR = '#94A3B8';

type TLEvent = {
    id: string;
    goalId: string;
    title: string;
    isGoal: boolean;
    type: GoalEventType | 'present' | 'start';
    date: Date;
    color: string;
    goalBase: GoalItem;
};

export default function TimelineScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [userColors, setUserColors] = useState<any[]>([]);

    // Load colors for the editor
    React.useEffect(() => {
        StorageService.loadUserColors().then((colors: any) => setUserColors(colors));
    }, []);

    // Load profile
    useFocusEffect(
        useCallback(() => {
            const load = async () => {
                try {
                    const p = await StorageService.loadProfile();
                    setProfile(p);
                } catch (e) {
                    if (__DEV__) console.warn('[Timeline] Failed to load profile', e);
                }
            };
            load();
        }, [])
    );

    const getEventColor = (ev: TLEvent) => {
        return ev.type === 'present' ? '#10B981' :
            ev.type === 'start' ? '#64748B' :
                ev.type === 'added' ? '#3B82F6' :
                    ev.type === 'modified' ? '#F59E0B' :
                        ev.type === 'achieved' ? '#10B981' :
                            ev.type === 'cancelled' ? '#EF4444' : '#94A3B8';
    };

    // Extract all events
    const events = useMemo(() => {
        if (!profile) return [];
        const allGoals = [
            ...(profile.goals || []).map(g => ({ ...g, isGoal: true })),
            ...(profile.antigoals || []).map(g => ({ ...g, isGoal: false })),
        ];

        const evs: TLEvent[] = [];
        for (const g of allGoals) {
            const color = g.color || (g.category ? CATEGORY_COLORS[g.category] : FALLBACK_COLOR);

            if (g.createdAt) {
                const hasExplicitAdd = g.events?.some(e => e.type === 'added');
                if (!hasExplicitAdd) {
                    evs.push({ id: `add-${g.id}`, goalId: g.id, title: g.title, isGoal: g.isGoal, type: 'added', date: new Date(g.createdAt), color, goalBase: g });
                }
            }

            if (g.events && g.events.length > 0) {
                for (const e of g.events) {
                    evs.push({
                        id: e.id, goalId: g.id, title: g.title, isGoal: g.isGoal,
                        type: e.type, date: new Date(e.date), color, goalBase: g
                    });
                }
            }

            // Always add implicit achieved/cancelled if not found in explicit events
            const hasExplicitAchieved = g.events?.some(e => e.type === 'achieved');
            if (g.completed && g.completedAt && !hasExplicitAchieved) {
                evs.push({ id: `ach-${g.id}`, goalId: g.id, title: g.title, isGoal: g.isGoal, type: 'achieved', date: new Date(g.completedAt), color, goalBase: g });
            }

            const hasExplicitCancelled = g.events?.some(e => e.type === 'cancelled');
            if (g.cancelled && !hasExplicitCancelled) {
                evs.push({ id: `can-${g.id}`, goalId: g.id, title: g.title, isGoal: g.isGoal, type: 'cancelled', date: new Date(), color, goalBase: g });
            }
        }

        // Sort completely ascending for chronological list (oldest first)
        evs.sort((a, b) => a.date.getTime() - b.date.getTime());

        const earliestDate = evs.length > 0 ? evs[0].date : new Date();

        // Add Start Event at TOP (index 0)
        const startDate = new Date(earliestDate);
        startDate.setMinutes(startDate.getMinutes() - 1);
        evs.unshift({
            id: 'timeline-start',
            goalId: 'none',
            title: 'The Journey Begins',
            isGoal: true,
            type: 'start',
            date: startDate,
            color: '#64748B',
            goalBase: {} as any
        });

        // Add Present Event at BOTTOM (last index)
        evs.push({
            id: 'timeline-present',
            goalId: 'none',
            title: 'Present Day',
            isGoal: true,
            type: 'present',
            date: new Date(),
            color: '#10B981',
            goalBase: {} as any
        });

        return evs;
    }, [profile]);

    // UI actions
    const deleteEvent = async (goalId: string, eventId: string, type: GoalEventType) => {
        if (!profile) return;

        if (eventId.startsWith('add-')) {
            Alert.alert('Cannot Delete', 'To delete the creation event, you must delete the entire goal from the main list.');
            return;
        }

        const np = { ...profile };
        const updater = (g: GoalItem) => {
            if (g.id !== goalId) return g;
            const newEvents = (g.events || []).filter(e => e.id !== eventId);
            let updates: any = { events: newEvents };
            if (type === 'achieved') {
                updates.completed = false;
                updates.completedAt = undefined;
            } else if (type === 'cancelled') {
                updates.cancelled = false;
            }
            return { ...g, ...updates };
        };

        np.goals = (np.goals || []).map(updater);
        np.antigoals = (np.antigoals || []).map(updater);
        setProfile(np);
        setExpandedId(null);
        await StorageService.saveProfile(np);
    };

    const handleSaveTask = async (updatedTask: Task) => {
        if (!profile) return;
        const np = { ...profile };
        const now = new Date().toISOString();

        const updater = (g: GoalItem) => {
            if (g.id !== updatedTask.id) return g;
            return {
                ...g,
                title: updatedTask.title,
                category: (updatedTask as any).category || g.category,
                color: updatedTask.color || g.color,
                events: [...(g.events || []), { id: Date.now().toString(), type: 'modified' as GoalEventType, date: now }]
            };
        };

        np.goals = (np.goals || []).map(updater);
        np.antigoals = (np.antigoals || []).map(updater);
        setProfile(np);
        setEditingTask(null);
        await StorageService.saveProfile(np);
    };

    const markCancelled = (goalId: string, title: string) => {
        Alert.alert('Cancel Goal', `Mark "${title}" as cancelled?`, [
            { text: 'Keep It', style: 'cancel' },
            {
                text: 'Cancel It', style: 'destructive', onPress: async () => {
                    if (!profile) return;
                    const np = { ...profile };
                    const now = new Date().toISOString();
                    const updater = (g: GoalItem) => {
                        if (g.id !== goalId) return g;
                        return {
                            ...g,
                            cancelled: true,
                            events: [...(g.events || []), { id: Date.now().toString(), type: 'cancelled' as GoalEventType, date: now }]
                        };
                    };
                    np.goals = (np.goals || []).map(updater);
                    np.antigoals = (np.antigoals || []).map(updater);
                    setProfile(np);
                    setExpandedId(null);
                    await StorageService.saveProfile(np);
                }
            },
        ]);
    };

    const renderItem = ({ item, index }: { item: TLEvent; index: number }) => {
        const isExpanded = expandedId === item.id;
        const evColor = getEventColor(item);
        const actionWord = item.type === 'present' ? 'Timeline' :
            item.type === 'start' ? 'Timeline' :
                item.type === 'added' ? 'Added' :
                    item.type === 'modified' ? 'Reconsidered' :
                        item.type === 'achieved' ? 'Completed' :
                            item.type === 'cancelled' ? 'Cancelled' : 'Updated';

        const isSystemNode = item.type === 'present' || item.type === 'start';

        const dateStr = item.date.toLocaleDateString([], { month: 'short', day: 'numeric', year: item.date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
        const timeStr = item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const fullDateStr = `${dateStr} @ ${timeStr}`;

        if (isSystemNode) {
            return (
                <View style={styles.systemNodeContainer}>
                    {/* Maintain the vertical connecting track on the left */}
                    {item.type === 'start' && <View style={[styles.trackLine, { top: 0, height: 28, left: 20 }]} />}
                    {item.type === 'present' && <View style={[styles.trackLine, { top: 28, bottom: 0, left: 20 }]} />}

                    <View style={styles.systemSeparatorLine} />
                    <View style={styles.systemDateBubble}>
                        <Text style={styles.systemDateText}>
                            {item.title} • {dateStr}
                        </Text>
                    </View>
                    <View style={styles.systemSeparatorLine} />
                </View>
            );
        }

        return (
            <TouchableOpacity
                activeOpacity={0.6}
                style={styles.row}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
                {/* Timeline Track (Left Side) */}
                <View style={styles.trackContent}>
                    {/* The continuous line */}
                    <View style={styles.trackLine} />

                    {/* The node placed at the top of the row to align with the first line of text */}
                    {isSystemNode ? (
                        <View style={[styles.trackCapNode, { backgroundColor: evColor }]} />
                    ) : (
                        <View style={[styles.trackHollowNode, { borderColor: evColor }]} />
                    )}
                </View>

                {/* Text Content (Right Side) */}
                <View style={[styles.textContent, isExpanded && styles.textContentExpanded]}>
                    <View style={styles.textLine}>
                        <Text style={[styles.actionWord, { color: evColor }]}>{actionWord} • {fullDateStr}:</Text>
                        <Text style={[styles.titleText, item.type === 'cancelled' && styles.strike]} numberOfLines={isExpanded ? undefined : 1}>
                            {item.title}
                        </Text>
                    </View>

                    {/* Expanded Details beneath the single line */}
                    {isExpanded && (
                        <View style={styles.expandedContent}>
                            <View style={styles.actionsRow}>
                                {!isSystemNode && (
                                    <>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => deleteEvent(item.goalId, item.id, item.type as GoalEventType)}>
                                            <MaterialCommunityIcons name="delete-outline" size={14} color="#64748B" />
                                            <Text style={styles.actionLabel}>Remove</Text>
                                        </TouchableOpacity>

                                        <Text style={styles.actionDivider}>|</Text>

                                        <TouchableOpacity style={styles.actionBtn} onPress={() => {
                                            const t: Task = {
                                                id: item.goalBase.id,
                                                title: item.goalBase.title,
                                                completed: item.goalBase.completed || false,
                                                color: item.goalBase.color,
                                                date: new Date().toISOString(),
                                                // @ts-ignore mapping temporary fields backwards to drawer UI
                                                category: item.goalBase.category
                                            };
                                            setEditingTask(t);
                                        }}>
                                            <MaterialCommunityIcons name="pencil-outline" size={14} color="#64748B" />
                                            <Text style={styles.actionLabel}>Edit</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    )}
                </View>

            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Timeline Archive',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
                            <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => null
                }}
            />

            <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <TaskEditDrawer
                visible={!!editingTask}
                task={editingTask}
                onClose={() => setEditingTask(null)}
                onSave={handleSaveTask}
                onRequestCalendar={() => { Alert.alert('Not Available', 'Calendar selection is limited inside Timeline archive mode.'); }}
                onRequestDuration={() => { Alert.alert('Not Available', 'Duration selection is limited inside Timeline archive mode.'); }}
                onRequestTime={() => { Alert.alert('Not Available', 'Time selection is limited inside Timeline archive mode.'); }}
                userColors={userColors}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    listContent: {
        paddingVertical: 16,
        paddingBottom: 100
    },

    // Row Layout
    row: {
        flexDirection: 'row',
        minHeight: 60,
    },

    // Right Text Content
    textContent: {
        flex: 1,
        paddingRight: 16,
        justifyContent: 'center',
    },
    textContentExpanded: {
        justifyContent: 'flex-start',
        paddingTop: 16, // Align top line of text with the track Node
        paddingBottom: 16
    },
    textLine: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    actionWord: {
        fontSize: 14,
        fontWeight: '800',
        marginRight: 6,
    },
    titleText: {
        fontSize: 14,
        color: '#334155',
        flex: 1,
        lineHeight: 20,
    },
    strike: {
        textDecorationLine: 'line-through',
        color: '#94A3B8'
    },

    // Expanded State
    expandedContent: {
        marginTop: 8,
    },
    dateText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 6,
        gap: 4,
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    actionDivider: {
        fontSize: 14,
        color: '#CBD5E1',
        marginHorizontal: 4,
    },

    // Left Timeline Track
    trackContent: {
        width: 48,
        alignItems: 'center',
    },
    trackLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 8, // Thickness of the continuous background track
        backgroundColor: '#E2E8F0', // Slightly darker generic line color
    },
    trackHollowNode: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 4, // Ring thickness
        backgroundColor: '#FFFFFF', // Hollow center
        position: 'absolute',
        top: 22, // Positions the node next to the first line of text (adjusted for centering)
        zIndex: 2,
    },
    trackCapNode: {
        width: 24, // Wide line separator for start/end
        height: 8, // Thick slab
        borderRadius: 4,
        position: 'absolute',
        top: 25,
        zIndex: 2,
    },

    // System Node Separators
    systemNodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        position: 'relative',
        minHeight: 56,
    },
    systemSeparatorLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#E2E8F0',
    },
    systemDateBubble: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginHorizontal: 12,
    },
    systemDateText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    }
});
