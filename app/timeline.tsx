import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StorageService, UserProfile, GoalItem, GoalEventType } from '../src/services/storage';

const CATEGORY_COLORS: Record<string, string> = {
    traits: '#8B5CF6',
    habits: '#3B82F6',
    environment: '#F59E0B',
    outcomes: '#10B981',
};
const FALLBACK_COLOR = '#94A3B8';

// Constants for Proportional Scaling
const PIXELS_PER_DAY = 50;
const MIN_GAP = 0;
const MAX_GAP = 500;

type TLEvent = {
    id: string;
    goalId: string;
    title: string;
    isGoal: boolean;
    type: GoalEventType | 'present' | 'start' | 'time-jump';
    date: Date;
    color: string;
    goalBase: GoalItem;
    computedMarginTop?: number;
    jumpLabel?: string;
};

export default function TimelineScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

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
                            ev.type === 'cancelled' ? '#EF4444' : '#64748B';
    };

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

            const hasExplicitAchieved = g.events?.some(e => e.type === 'achieved');
            if (g.completed && g.completedAt && !hasExplicitAchieved) {
                evs.push({ id: `ach-${g.id}`, goalId: g.id, title: g.title, isGoal: g.isGoal, type: 'achieved', date: new Date(g.completedAt), color, goalBase: g });
            }
        }

        evs.sort((a, b) => a.date.getTime() - b.date.getTime());

        const earliestDate = evs.length > 0 ? evs[0].date : new Date();

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

        const finalEvs: TLEvent[] = [];
        for (let i = 0; i < evs.length; i++) {
            const currentEv = evs[i];
            currentEv.computedMarginTop = MIN_GAP;

            if (i > 0) {
                const prevEv = evs[i - 1];
                const msDiff = currentEv.date.getTime() - prevEv.date.getTime();
                const daysDiff = msDiff / (1000 * 60 * 60 * 24);

                const isSameCalendarDay = currentEv.date.getFullYear() === prevEv.date.getFullYear() &&
                    currentEv.date.getMonth() === prevEv.date.getMonth() &&
                    currentEv.date.getDate() === prevEv.date.getDate();

                if (isSameCalendarDay) {
                    currentEv.computedMarginTop = MIN_GAP;
                } else if (daysDiff > 0.001) {
                    const rawGap = Math.floor(daysDiff * PIXELS_PER_DAY);
                    let finalGap = Math.max(MIN_GAP, rawGap);

                    if (finalGap > MAX_GAP) {
                        finalGap = MAX_GAP;
                        const jumpLabel = daysDiff >= 30
                            ? `${Math.floor(daysDiff / 30)} Month${Math.floor(daysDiff / 30) > 1 ? 's' : ''} Later`
                            : `${Math.floor(daysDiff)} Day${Math.floor(daysDiff) > 1 ? 's' : ''} Later`;

                        finalEvs.push({
                            id: `jump-${currentEv.id}`,
                            goalId: 'none',
                            title: 'Time Jump',
                            isGoal: false,
                            type: 'time-jump',
                            date: new Date(prevEv.date.getTime() + (msDiff / 2)),
                            color: '#CBD5E1',
                            goalBase: {} as any,
                            computedMarginTop: MAX_GAP / 2,
                            jumpLabel
                        });

                        currentEv.computedMarginTop = MAX_GAP / 2;
                    } else {
                        currentEv.computedMarginTop = finalGap;
                    }
                }
            }
            finalEvs.push(currentEv);
        }

        return finalEvs;
    }, [profile]);

    const deleteEvent = async (goalId: string, eventId: string, type: GoalEventType) => {
        if (!profile) return;
        if (eventId.startsWith('add-')) {
            Alert.alert('Cannot Delete', 'To delete the creation event, you must delete the entire goal from the main list.');
            return;
        }

        Alert.alert(
            'Delete Event?',
            'Are you sure you want to remove this event from the timeline? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const np = { ...profile };
                        const updater = (g: GoalItem) => {
                            if (g.id !== goalId) return g;
                            const newEvents = (g.events || []).filter(e => e.id !== eventId);
                            let updates: any = { events: newEvents };
                            if (type === 'achieved') {
                                updates.completed = false;
                                updates.completedAt = undefined;
                            }
                            return { ...g, ...updates };
                        };

                        np.goals = (np.goals || []).map(updater);
                        np.antigoals = (np.antigoals || []).map(updater);
                        setProfile(np);
                        setExpandedId(null);
                        await StorageService.saveProfile(np);
                    }
                }
            ]
        );
    };

    // deleted handleTimelineSaveTask

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
        const isTimeJump = item.type === 'time-jump';

        // Unconditional Year Formatting: "23 February 2026"
        const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const strippedDateStr = item.date.toLocaleDateString(undefined, dateOpts);

        const dynamicMargin = item.computedMarginTop || 0;

        if (isTimeJump) {
            return (
                <View style={[styles.rowContainer, { paddingTop: dynamicMargin }]}>
                    <View style={styles.trackCol}>
                        <View style={styles.timeJumpPill}>
                            <Ionicons name="time-outline" size={12} color="#94A3B8" />
                            <Text style={styles.jumpText}>{item.jumpLabel}</Text>
                        </View>
                    </View>
                    <View style={styles.rightCol} />
                </View>
            );
        }

        if (isSystemNode) {
            return (
                <View style={[styles.rowContainer, { paddingTop: dynamicMargin }]}>
                    <View style={styles.trackCol}>
                        <View style={[styles.auraNode, { backgroundColor: evColor + '20' }]}>
                            <View style={[styles.solidDot, { backgroundColor: evColor }]} />
                        </View>
                    </View>
                    <View style={styles.rightCol}>
                        <Text style={styles.systemTitleText}>{item.title}</Text>
                    </View>
                </View>
            );
        }

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.rowContainer, { paddingTop: dynamicMargin }]}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
                <View style={styles.trackCol}>
                    <View style={[styles.auraNode, { backgroundColor: evColor + '25', top: 18 }]}>
                        <View style={[styles.solidDot, { backgroundColor: evColor }]} />
                    </View>
                </View>

                <View style={styles.rightCol}>
                    <View style={[styles.eventCard, isExpanded && styles.eventCardExpanded]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderLeft}>
                                <Text style={[styles.cardActionWord, { color: evColor }]}>{actionWord}</Text>
                                <View style={[styles.typeTag, { backgroundColor: item.isGoal ? '#DBEAFE' : '#FEE2E2' }]}>
                                    <Text style={[styles.typeTagText, { color: item.isGoal ? '#2563EB' : '#EF4444' }]}>
                                        {item.isGoal ? 'GOAL' : 'ANTI-GOAL'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.dateText}>{strippedDateStr}</Text>
                        </View>

                        <Text style={styles.cardGoalTitle} numberOfLines={isExpanded ? undefined : 2}>
                            {item.title}
                        </Text>

                        {isExpanded && (
                            <View style={styles.expandedContent}>
                                {item.goalBase.note ? (
                                    <View style={styles.noteContainer}>
                                        <Text style={styles.noteLabel}>NOTE</Text>
                                        <Text style={styles.noteText}>{item.goalBase.note}</Text>
                                    </View>
                                ) : null}

                                <View style={styles.cardActionsFooter}>
                                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => deleteEvent(item.goalId, item.id, item.type as GoalEventType)}>
                                        <MaterialCommunityIcons name="delete-outline" size={14} color="#64748B" />
                                        <Text style={styles.cardActionText}>Delete Event</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: false,
                }}
            />

            {/* Solid Header Background for Back Button Area */}
            <View style={[styles.headerBar, { height: insets.top + (Platform.OS === 'ios' ? 44 : 56) }]} />

            {/* Custom Back Button */}
            <TouchableOpacity 
                style={[styles.backButton, { top: insets.top + (Platform.OS === 'ios' ? 0 : 8) }]} 
                onPress={() => router.back()}
                activeOpacity={0.7}
            >
                <Ionicons name="chevron-back" size={28} color="#007AFF" />
                <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.flatListWrapper}>
                {/* Continuous background track line */}
                <View style={[styles.mainTrackLine, { left: 27 }]} />
                
                <FlatList
                    data={events}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </View>


        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 85, // Reduced from 100 to block less
        backgroundColor: '#F8FAFC', // Match container bg
        zIndex: 90,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backButton: {
        position: 'absolute',
        top: 44, // Slightly higher up
        left: 20,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 80,
    },
    backButtonText: {
        fontSize: 17,
        fontWeight: '500',
        color: '#007AFF',
        marginLeft: -4,
    },
    listContent: {
        paddingTop: 100, // Reduced from 120 to hit the sweet spot
        paddingHorizontal: 0,
        paddingBottom: 150
    },
    flatListWrapper: {
        flex: 1,
        position: 'relative',
    },
    // 2-Column Base
    rowContainer: {
        flexDirection: 'row',
        position: 'relative',
        minHeight: 64, // Defines safe padding since tracks bridge the gaps naturally
        width: '100%',
        paddingBottom: 8, // Native fixed gap instead of proportional spacing
    },

    // TRACK
    trackCol: {
        width: 56,
        alignItems: 'center',
        position: 'relative',
    },
    mainTrackLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: '#E2E8F0',
    },
    auraNode: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: 14,
        zIndex: 2,
    },
    solidDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },

    // Time Jumps
    timeJumpPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        top: 18,
        position: 'absolute',
        zIndex: 3,
        gap: 4,
    },
    jumpText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // CONTENT
    rightCol: {
        flex: 1,
        paddingLeft: 4,
        paddingRight: 16,
    },
    systemTitleText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569',
        marginTop: 15,
        letterSpacing: -0.2,
    },
    eventCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    eventCardExpanded: {
        borderColor: '#E2E8F0',
        shadowOpacity: 0.08,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    typeTag: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    typeTagText: {
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cardActionWord: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    dateText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        letterSpacing: 0.3,
    },
    cardGoalTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1E293B',
        lineHeight: 22,
    },
    expandedContent: {
        marginTop: 12,
    },
    noteContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 2,
        borderLeftColor: '#E2E8F0',
    },
    noteLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 4,
    },
    noteText: {
        fontSize: 13,
        color: '#475569',
        fontStyle: 'italic',
        lineHeight: 18,
    },
    cardActionsFooter: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingRight: 4,
    },
    cardActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    cardActionDivider: {
        fontSize: 12,
        color: '#CBD5E1',
        marginHorizontal: 4,
    },

    // MODAL STYLES
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        paddingBottom: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    modalHeader: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 20,
    },
    modalLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    modalInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1E293B',
        marginBottom: 20,
        minHeight: 52,
    },
    categoryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 28,
    },
    categoryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 100,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
    },
    categoryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    categoryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 16,
    },
    modalBtnCancel: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748B',
    },
    modalBtnSave: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: '#0F172A',
    },
    modalSaveText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    }
});
