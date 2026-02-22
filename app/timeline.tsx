import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StorageService, UserProfile, GoalItem, GoalEventType } from '../src/services/storage';

const CATEGORY_COLORS: Record<string, string> = {
    traits: '#8B5CF6',
    habits: '#3B82F6',
    environment: '#F59E0B',
    outcomes: '#10B981',
};
const FALLBACK_COLOR = '#94A3B8';

const fmtD = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

type TLEvent = {
    id: string;
    goalId: string;
    title: string;
    isGoal: boolean;
    type: GoalEventType;
    date: Date;
    color: string;
    goalBase: GoalItem;
};

export default function TimelineScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useFocusEffect(useCallback(() => { load(); }, []));
    const load = async () => { try { setProfile(await StorageService.loadProfile()); } catch (e) { } };

    const undoEvent = async (goalId: string, eventId: string, type: GoalEventType) => {
        if (!profile) return;
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

    const events = useMemo(() => {
        if (!profile) return [];
        const allGoals = [
            ...(profile.goals || []).map(g => ({ ...g, isGoal: true })),
            ...(profile.antigoals || []).map(g => ({ ...g, isGoal: false })),
        ];

        const evs: TLEvent[] = [];
        for (const g of allGoals) {
            const color = g.color || (g.category ? CATEGORY_COLORS[g.category] : FALLBACK_COLOR);

            // 1. ALWAYS inject the 'added' node if we have a creation date
            if (g.createdAt) {
                // If it already explicitly tracked its adding, don't double count it
                const hasExplicitAdd = g.events?.some(e => e.type === 'added');
                if (!hasExplicitAdd) {
                    evs.push({ id: `add-${g.id}`, goalId: g.id, title: g.title, isGoal: g.isGoal, type: 'added', date: new Date(g.createdAt), color, goalBase: g });
                }
            }

            // 2. Add explicit tracked events (if any)
            if (g.events && g.events.length > 0) {
                for (const e of g.events) {
                    evs.push({
                        id: e.id, goalId: g.id, title: g.title, isGoal: g.isGoal,
                        type: e.type, date: new Date(e.date), color, goalBase: g,
                    });
                }
            } else {
                // 3. Add inferred status events (for legacy goals without event arrays)
                if (g.completed && g.completedAt) {
                    evs.push({ id: `ach-${g.id}`, goalId: g.id, title: g.title, isGoal: g.isGoal, type: 'achieved', date: new Date(g.completedAt), color, goalBase: g });
                }
                if (g.cancelled) {
                    evs.push({ id: `can-${g.id}`, goalId: g.id, title: g.title, isGoal: g.isGoal, type: 'cancelled', date: new Date(), color, goalBase: g });
                }
            }
        }
        return evs.sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first
    }, [profile]);


    const renderEvent = (ev: TLEvent, index: number) => {
        const isExpanded = expandedId === ev.id;
        const iconName = ev.type === 'added' ? 'add' :
            ev.type === 'achieved' ? (ev.isGoal ? 'star' : 'checkmark') :
                ev.type === 'cancelled' ? 'close' : 'pencil';

        const evColor = ev.type === 'added' ? '#3B82F6' :
            ev.type === 'modified' ? '#F59E0B' :
                ev.type === 'achieved' ? '#10B981' :
                    ev.type === 'cancelled' ? '#EF4444' : '#94A3B8';

        const nodeStyle = ev.type === 'cancelled' ? [st.node, { backgroundColor: '#475569', borderColor: '#334155' }] :
            (ev.type === 'achieved' ? [st.node, { backgroundColor: evColor, borderColor: evColor }] :
                [st.node, { borderColor: evColor }]);

        const isLast = index === events.length - 1;

        // Same-day = tight cluster (2px), different day = breathing room (20px)
        let isSameDayAsPrev = false;
        if (index > 0) {
            const prevEv = events[index - 1];
            isSameDayAsPrev = ev.date.toDateString() === prevEv.date.toDateString();
        }
        const rowGap = isSameDayAsPrev ? 2 : 20;

        // Show date header only when the day changes
        const showDateHeader = !isSameDayAsPrev;

        const actionWord = ev.type === 'added' ? 'Added' :
            ev.type === 'modified' ? 'Modified' :
                ev.type === 'achieved' ? (ev.isGoal ? 'Achieved' : 'Maintained') :
                    ev.type === 'cancelled' ? 'Cancelled' : 'Updated';

        // Build the compact chip content - single line when collapsed
        const chipContent = (side: 'left' | 'right') => {
            const borderSide = side === 'left'
                ? { borderLeftColor: evColor, borderLeftWidth: 3 }
                : { borderRightColor: evColor, borderRightWidth: 3 };

            return (
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={[st.chip, borderSide]}
                    onPress={() => setExpandedId(isExpanded ? null : ev.id)}
                >
                    {/* Collapsed: single line with icon + title */}
                    <View style={st.chipRow}>
                        <Ionicons name={iconName as any} size={10} color={evColor} style={{ marginRight: 4 }} />
                        <Text style={[st.chipActionText, { color: evColor }]}>{actionWord}:</Text>
                        <Text
                            style={[st.chipTitle, ev.type === 'cancelled' && st.strike]}
                            numberOfLines={isExpanded ? undefined : 1}
                        >
                            {ev.title}
                        </Text>
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={10} color="#64748B" style={{ marginLeft: 4 }} />
                    </View>

                    {/* Expanded: date + full title + actions */}
                    {isExpanded && (
                        <View style={st.expandedContent}>
                            <Text style={st.chipDate}>{fmtD(ev.date)} • {ev.type.toUpperCase()}</Text>
                            <View style={st.expandedActions}>
                                <TouchableOpacity style={st.actionBtn} onPress={() => undoEvent(ev.goalId, ev.id, ev.type)}>
                                    <Ionicons name="arrow-undo" size={14} color="#94A3B8" />
                                    <Text style={st.actionText}>Undo</Text>
                                </TouchableOpacity>
                                {!ev.goalBase.cancelled && ev.type !== 'cancelled' && (
                                    <TouchableOpacity style={st.actionBtn} onPress={() => markCancelled(ev.goalId, ev.title)}>
                                        <Ionicons name="trash" size={14} color="#EF4444" />
                                        <Text style={[st.actionText, { color: '#FCA5A5' }]}>Cancel</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                </TouchableOpacity>
            );
        };

        return (
            <View key={ev.id}>
                {/* Date separator label */}
                {showDateHeader && (
                    <View style={[st.dateHeader, { marginTop: index === 0 ? 0 : 16 }]}>
                        <View style={st.dateLine} />
                        <Text style={st.dateLabel}>{fmtD(ev.date)}</Text>
                        <View style={st.dateLine} />
                    </View>
                )}
                <View style={[st.eventRow, { marginTop: rowGap }]}>
                    {/* Left Side (Goals) */}
                    <View style={st.sideCol}>
                        {ev.isGoal && (
                            <View style={st.cardWrapperLeft}>
                                {chipContent('left')}
                                <View style={[st.branchLeft, { backgroundColor: evColor + '50' }]} />
                            </View>
                        )}
                    </View>

                    {/* Center Trunk */}
                    <View style={st.centerCol}>
                        {!isLast && <View style={[st.trackLine, { backgroundColor: evColor + '30' }]} />}
                        <View style={nodeStyle}>
                            <Ionicons name={iconName as any} size={10} color={(ev.type === 'achieved' || ev.type === 'cancelled') ? '#FFF' : evColor} />
                        </View>
                    </View>

                    {/* Right Side (Anti-Goals) */}
                    <View style={[st.sideCol, { alignItems: 'flex-start' }]}>
                        {!ev.isGoal && (
                            <View style={st.cardWrapperRight}>
                                {chipContent('right')}
                                <View style={[st.branchRight, { backgroundColor: evColor + '50' }]} />
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    if (!profile) return null;

    return (
        <SafeAreaView style={st.safe} edges={['top']}>
            <View style={st.header}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>Timeline</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={st.legend}>
                <View style={st.legendSide}>
                    <Text style={st.legendText}>Goals</Text>
                    <View style={[st.legendDot, { backgroundColor: '#3B82F6' }]} />
                </View>
                <View style={st.legendDivider} />
                <View style={[st.legendSide, { alignItems: 'flex-start' }]}>
                    <Text style={st.legendText}>Anti-Goals</Text>
                    <View style={[st.legendDot, { backgroundColor: '#EF4444' }]} />
                </View>
            </View>

            <ScrollView contentContainerStyle={st.scroll}>
                {events.length === 0 ? (
                    <Text style={st.empty}>No timeline events yet.</Text>
                ) : (
                    events.map(renderEvent)
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const st = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F172A' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },

    legend: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', gap: 12 },
    legendSide: { flex: 1, alignItems: 'flex-end', gap: 3 },
    legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
    legendDivider: { width: 1, height: 20, backgroundColor: '#334155' },
    legendText: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },

    scroll: { paddingTop: 8, paddingBottom: 100 },
    empty: { textAlign: 'center', color: '#64748B', marginTop: 40, fontStyle: 'italic' },

    // Date header
    dateHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 },
    dateLine: { flex: 1, height: 1, backgroundColor: '#1E293B' },
    dateLabel: { fontSize: 10, fontWeight: '700', color: '#475569', paddingHorizontal: 8, letterSpacing: 0.5 },

    // Event row - tight layout
    eventRow: { flexDirection: 'row', paddingHorizontal: 12 },
    trackLine: { position: 'absolute', width: 2, top: 18, bottom: -20, zIndex: 0 },

    sideCol: { flex: 1, justifyContent: 'center', alignItems: 'flex-end' },
    centerCol: { width: 30, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, zIndex: 10 },

    // Smaller node
    node: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },

    cardWrapperLeft: { paddingRight: 6, width: '100%', position: 'relative' },
    cardWrapperRight: { paddingLeft: 6, width: '100%', position: 'relative' },

    branchLeft: { position: 'absolute', right: 0, top: 13, width: 6, height: 2 },
    branchRight: { position: 'absolute', left: 0, top: 13, width: 6, height: 2 },

    // Compact chip card
    chip: { backgroundColor: '#1E293B', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, width: '100%' },
    chipRow: { flexDirection: 'row', alignItems: 'center' },
    chipActionText: { fontSize: 11, fontWeight: '700', marginRight: 4 },
    chipTitle: { fontSize: 11, color: '#E2E8F0', flex: 1 },
    chipDate: { fontSize: 9, fontWeight: '700', color: '#64748B', marginTop: 4, marginBottom: 2 },
    strike: { textDecorationLine: 'line-through', color: '#64748B' },

    // Expanded content inside chip
    expandedContent: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#334155' },
    expandedActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
    actionText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
});
