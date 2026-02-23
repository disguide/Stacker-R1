import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
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
    const load = async () => { try { setProfile(await StorageService.loadProfile()); } catch (e) { if (__DEV__) console.warn('[Timeline] Failed to load profile', e); } };

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

    // Group events by day
    const groupedEvents = useMemo(() => {
        const groups: { [dateStr: string]: TLEvent[] } = {};
        events.forEach(ev => {
            const dateStr = ev.date.toDateString();
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(ev);
        });
        return Object.values(groups);
    }, [events]);

    const getEventColor = (ev: TLEvent) => {
        return ev.type === 'added' ? '#3B82F6' :
            ev.type === 'modified' ? '#F59E0B' :
                ev.type === 'achieved' ? '#10B981' :
                    ev.type === 'cancelled' ? '#EF4444' : '#94A3B8';
    };

    const renderRawText = (ev: TLEvent) => {
        const isExpanded = expandedId === ev.id;
        const evColor = getEventColor(ev);
        const actionWord = ev.type === 'added' ? 'Added' :
            ev.type === 'modified' ? 'Modified' :
                ev.type === 'achieved' ? (ev.isGoal ? 'Achieved' : 'Maintained') :
                    ev.type === 'cancelled' ? 'Cancelled' : 'Updated';

        return (
            <TouchableOpacity
                activeOpacity={0.6}
                style={st.rawTextCont}
                onPress={() => setExpandedId(isExpanded ? null : ev.id)}
            >
                <View style={st.rawTextRow}>
                    <Text style={[st.rawActionText, { color: evColor }]}>{actionWord}:</Text>
                    <Text style={[st.rawTitleText, ev.type === 'cancelled' && st.strike]} numberOfLines={isExpanded ? undefined : 1}>
                        {ev.title}
                    </Text>
                </View>

                {isExpanded && (
                    <View style={st.rawExpandedContent}>
                        <Text style={st.rawDateText}>{ev.type.toUpperCase()}</Text>
                        <View style={st.rawActionsRow}>
                            <TouchableOpacity style={st.rawActionBtn} onPress={() => undoEvent(ev.goalId, ev.id, ev.type)}>
                                <Text style={st.rawActionLabel}>Undo</Text>
                            </TouchableOpacity>
                            {!ev.goalBase.cancelled && ev.type !== 'cancelled' && (
                                <>
                                    <Text style={st.rawActionDivider}>|</Text>
                                    <TouchableOpacity style={st.rawActionBtn} onPress={() => markCancelled(ev.goalId, ev.title)}>
                                        <Text style={[st.rawActionLabel, { color: '#EF4444' }]}>Cancel</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderDayCluster = (dayEvents: TLEvent[], groupIndex: number) => {
        const dateStr = fmtD(dayEvents[0].date);
        const isLastGroup = groupIndex === groupedEvents.length - 1;

        // Separate goals from anti-goals to render on left vs right sides
        const leftEvents = dayEvents.filter(e => e.isGoal);
        const rightEvents = dayEvents.filter(e => !e.isGoal);

        return (
            <View key={`day-${groupIndex}`} style={st.dayClusterCont}>
                {groupIndex > 0 && <View style={st.dateHeaderSpace} />}

                <View style={st.dateHeader}>
                    <Text style={st.dateLabel}>{dateStr}</Text>
                </View>

                <View style={st.clusterRow}>
                    {/* Background SVG for drawing diagonal connection curves */}
                    <DayConnections dayEvents={dayEvents} expandedId={expandedId} />

                    {/* Left Column (Goals Text) */}
                    <View style={st.sideCol}>
                        {leftEvents.map((ev, i) => (
                            <View key={`text-${ev.id}`} style={st.textRowWrapperLeft}>
                                {renderRawText(ev)}
                            </View>
                        ))}
                    </View>

                    {/* Center Column (Clustered Dots) */}
                    <View style={st.centerCol}>
                        {!isLastGroup && <View style={st.thinTrack} />}
                        <View style={st.dotsContainer}>
                            {dayEvents.map((ev, i) => {
                                const evColor = getEventColor(ev);
                                return (
                                    <View
                                        key={`dot-${ev.id}`}
                                        style={[
                                            st.microDot,
                                            { backgroundColor: evColor },
                                            // Extreme tight negative clustering (-10px overlap)
                                            i > 0 && { marginTop: -10 }
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    {/* Right Column (Anti-Goals Text) */}
                    <View style={[st.sideCol, { alignItems: 'flex-start' }]}>
                        {rightEvents.map((ev, i) => (
                            <View key={`text-${ev.id}`} style={st.textRowWrapperRight}>
                                {renderRawText(ev)}
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        );
    };

    // (Legacy renderEvent removed in favor of renderDayCluster)

    if (!profile) return null;

    return (
        <SafeAreaView style={st.safe} edges={['top']}>
            <View style={st.header}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>Archive</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={st.legend}>
                <View style={st.legendSide}>
                    <Text style={st.legendText}>Goals</Text>
                    <View style={[st.legendDot, { backgroundColor: '#3B82F6' }]} />
                </View>
                <View style={st.legendDivider} />
                <View style={[st.legendSide, { alignItems: 'flex-start' }]}>
                    <View style={[st.legendDot, { backgroundColor: '#EF4444', marginRight: 4 }]} />
                    <Text style={st.legendText}>Anti-Goals</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={st.scroll}>
                {groupedEvents.length === 0 ? (
                    <Text style={st.empty}>No timeline events yet.</Text>
                ) : (
                    groupedEvents.map((group, i) => renderDayCluster(group, i))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// Smart SVG overlay that draws smooth bezier diagonal curves linking the 
// spread-out text items to their physically squished microDots in the center
const DayConnections = ({ dayEvents, expandedId }: { dayEvents: TLEvent[], expandedId: string | null }) => {
    // Math constants to estimate node and text position based on stylesheet rules
    const dotSize = 18;
    const dotOverlapMargin = -10;
    const textRowMinHeight = 28;
    const textPaddingVertical = 6;
    const expandedExtraHeight = 44; // Estimated extra height drop for expanded actions

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Using SVG to draw precise diagonal lines from dot Y to text Y */}
            {dayEvents.length > 0 && <Svg style={StyleSheet.absoluteFill}>
                {dayEvents.map((ev, i) => {
                    const isGoal = ev.isGoal;

                    // 1. Calculate Dot Y Center
                    // First dot is at top. Each subsequent squishes -10px up.
                    const dotY = (i * (dotSize + dotOverlapMargin)) + (dotSize / 2) + 8; // +8 for centerCol paddingTop

                    // 2. Calculate Text Y Center
                    let textYOffset = 0;
                    for (let j = 0; j < i; j++) {
                        if (dayEvents[j].isGoal === isGoal) {
                            textYOffset += textRowMinHeight + (textPaddingVertical * 2);
                            if (dayEvents[j].id === expandedId) textYOffset += expandedExtraHeight;
                        }
                    }

                    // Point exactly at the middle of the text block's first line
                    const textY = textYOffset + 14;

                    const evColor = ev.type === 'added' ? '#3B82F6' :
                        ev.type === 'modified' ? '#F59E0B' :
                            ev.type === 'achieved' ? '#10B981' :
                                ev.type === 'cancelled' ? '#EF4444' : '#94A3B8';

                    // X Coordinates
                    // SVG width is 100% of clusterRow. Center trunk is at 50%.
                    const centerLeftDotX = '48%';
                    const centerRightDotX = '52%';
                    const textEdgeLeftX = '38%';
                    const textEdgeRightX = '62%';

                    if (isGoal) {
                        return (
                            <Path
                                key={`line-${ev.id}`}
                                d={`M ${textEdgeLeftX} ${textY} C 44% ${textY}, 44% ${dotY}, ${centerLeftDotX} ${dotY}`}
                                stroke={evColor}
                                strokeWidth="1.5"
                                strokeOpacity="0.4"
                                fill="none"
                            />
                        );
                    } else {
                        return (
                            <Path
                                key={`line-${ev.id}`}
                                d={`M ${textEdgeRightX} ${textY} C 56% ${textY}, 56% ${dotY}, ${centerRightDotX} ${dotY}`}
                                stroke={evColor}
                                strokeWidth="1.5"
                                strokeOpacity="0.4"
                                fill="none"
                            />
                        );
                    }
                })}
            </Svg>}
        </View >
    );
};

const st = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },

    legend: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    legendSide: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    legendDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },
    legendDivider: { width: 1, height: 16, backgroundColor: '#E2E8F0' },
    legendText: { fontSize: 11, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },

    scroll: { paddingTop: 16, paddingBottom: 120 },
    empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontStyle: 'italic' },

    dayClusterCont: { marginBottom: 24, width: '100%' },
    dateHeaderSpace: { height: 20 },
    dateHeader: { paddingHorizontal: 20, marginBottom: 12, alignItems: 'center' },
    dateLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },

    clusterRow: { flexDirection: 'row', paddingHorizontal: 8, position: 'relative' },

    // Thin main line going through the center of the clusters
    thinTrack: { position: 'absolute', width: 2, top: 12, bottom: -40, left: '50%', backgroundColor: '#E2E8F0', zIndex: 0 },

    sideCol: { flex: 1, flexDirection: 'column' },
    centerCol: { width: 30, alignItems: 'center', paddingTop: 8, zIndex: 10 },

    dotsContainer: { alignItems: 'center', width: '100%', zIndex: 12 },

    // Bigger dot node to forcefully touch neighbors
    microDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFF' },

    textRowWrapperLeft: { width: '100%', paddingRight: 16 },
    textRowWrapperRight: { width: '100%', paddingLeft: 16 },

    // Raw Minimalist Text Styling with a bottom dashed line to discern compressed items
    rawTextCont: {
        width: '100%',
        paddingVertical: 6,
        minHeight: 28, // Forces the row to be tall enough that the 18px dots don't completely swallow each other, leaving just an edge of overlap
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        borderStyle: 'dashed',
        justifyContent: 'center'
    },
    rawTextRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
    rawActionText: { fontSize: 13, fontWeight: '800', marginRight: 4 },
    rawTitleText: { fontSize: 13, color: '#334155', flex: 1, lineHeight: 18 },
    strike: { textDecorationLine: 'line-through', color: '#94A3B8' },

    rawExpandedContent: { marginTop: 4, paddingTop: 4, marginLeft: 2 },
    rawDateText: { fontSize: 9, fontWeight: '700', color: '#64748B' },
    rawActionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
    rawActionBtn: { paddingVertical: 2 },
    rawActionLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
    rawActionDivider: { fontSize: 10, color: '#CBD5E1' }
});
