import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, Animated, PanResponder, Dimensions, LayoutAnimation } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StorageService, SavedSprint } from '../src/services/storage';

export default function SavedSprintsScreen() {
    const router = useRouter();
    const [sprints, setSprints] = useState<SavedSprint[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [noteVisibleIds, setNoteVisibleIds] = useState<Set<string>>(new Set());

    // Reordering State
    const [activeIdx, setActiveIdx] = useState(-1);
    const activeIdxRef = useRef(-1);
    const scrollRef = useRef<ScrollView>(null);
    const itemLayouts = useRef<Record<string, { y: number; height: number }>>({});
    const rowTranslations = useRef<Animated.Value[]>([]);
    
    // Coordination refs
    const initialFingerY = useRef(0);
    const initialScrollY = useRef(0);
    const currentScrollY = useRef(0);

    useEffect(() => {
        let mounted = true;
        StorageService.loadSavedSprints().then(data => {
            if (mounted) {
                const sorted = [...data].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
                setSprints(sorted);
            }
        });
        return () => { mounted = false; };
    }, []);

    const getRowTranslation = (idx: number) => {
        while (rowTranslations.current.length <= idx) {
            rowTranslations.current.push(new Animated.Value(0));
        }
        return rowTranslations.current[idx];
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Sprint",
            "Are you sure you want to remove this sprint timeline?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: () => {
                        // Secondary confirmation to prevent accidents
                        Alert.alert(
                            "Confirm Permanent Deletion",
                            "This action cannot be undone. All data for this sprint will be lost.",
                            [
                                { text: "Cancel", style: "cancel" },
                                { 
                                    text: "Permanently Delete", 
                                    style: "destructive",
                                    onPress: async () => {
                                        await StorageService.deleteSavedSprint(id);
                                        setSprints(prev => prev.filter(s => s.id !== id));
                                        delete itemLayouts.current[id];
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    };

    const toggleExpand = (id: string) => {
        if (activeIdxRef.current !== -1) return;
        setExpandedId(expandedId === id ? null : id);
    };

    const toggleNote = (id: string, e?: any) => {
        if (e && e.stopPropagation) e.stopPropagation();
        setNoteVisibleIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // --- Reordering Logic --- //
    const GAP_SIZE = 8;

    const findNearestGap = (fingerY: number) => {
        for (let i = 0; i < sprints.length; i++) {
            const item = itemLayouts.current[sprints[i].id];
            if (!item) continue;
            const center = item.y + (item.height / 2);
            if (fingerY < center) return i;
        }
        return sprints.length;
    };

    const handleReorderCommit = async (newSprints: SavedSprint[]) => {
        const updates = newSprints.map((s, idx) => ({ ...s, sortOrder: idx }));
        setSprints(updates);
        await StorageService.updateSavedSprints(updates);
    };

    const onDragStart = (idx: number) => {
        const sprint = sprints[idx];
        if (!sprint) return;
        const layout = itemLayouts.current[sprint.id];
        if (!layout) return;
        
        setActiveIdx(idx);
        activeIdxRef.current = idx;
        initialFingerY.current = layout.y + layout.height / 2;
        initialScrollY.current = currentScrollY.current;
        
        scrollRef.current?.setNativeProps({ scrollEnabled: false });
    };

    const onDragMove = (dy: number) => {
        if (activeIdxRef.current === -1) return;
        const scrollDelta = currentScrollY.current - initialScrollY.current;
        const fingerY = initialFingerY.current + dy + scrollDelta;
        const gap = findNearestGap(fingerY);
        
        const activeSprint = sprints[activeIdxRef.current];
        const activeLayout = activeSprint ? itemLayouts.current[activeSprint.id] : null;
        if (!activeLayout) return;
        const spacerHeight = activeLayout.height + GAP_SIZE;

        sprints.forEach((_, i) => {
            if (i === activeIdxRef.current) return;
            const trans = getRowTranslation(i);
            
            let toValue = 0;
            if (i >= gap && i < activeIdxRef.current) toValue = spacerHeight;
            else if (i < gap && i > activeIdxRef.current) toValue = -spacerHeight;
            
            Animated.spring(trans, {
                toValue,
                friction: 12,
                tension: 50,
                useNativeDriver: false
            }).start();
        });
    };

    const onDragEnd = (dy: number) => {
        if (activeIdxRef.current === -1) return;
        scrollRef.current?.setNativeProps({ scrollEnabled: true });
        
        const scrollDelta = currentScrollY.current - initialScrollY.current;
        const fingerY = initialFingerY.current + dy + scrollDelta;
        const gap = findNearestGap(fingerY);
        
        if (gap !== activeIdxRef.current && gap !== activeIdxRef.current + 1) {
            const newSprints = [...sprints];
            const [moved] = newSprints.splice(activeIdxRef.current, 1);
            const insertAt = gap > activeIdxRef.current ? gap - 1 : gap;
            newSprints.splice(insertAt, 0, moved);
            
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            handleReorderCommit(newSprints);
        }
        
        rowTranslations.current.forEach(t => t.setValue(0));
        activeIdxRef.current = -1;
        setActiveIdx(-1);
    };

    const handleUpdateSprint = async (id: string, updates: Partial<SavedSprint>) => {
        const next = sprints.map(s => s.id === id ? { ...s, ...updates } : s);
        setSprints(next);
        await StorageService.updateSavedSprints(next);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.exitBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Saved Sprints</Text>
                <View style={{ width: 60 }} />
            </View>
            
            <ScrollView 
                ref={scrollRef}
                style={styles.list} 
                contentContainerStyle={styles.listContent}
                onScroll={e => { currentScrollY.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
                keyboardShouldPersistTaps="handled"
            >
                {sprints.length === 0 ? (
                    <Text style={styles.emptyText}>You haven't saved any sprints yet.</Text>
                ) : (
                    sprints.map((sprint, idx) => (
                        <DraggableSprintCard
                            key={sprint.id}
                            sprint={sprint}
                            index={idx}
                            isExpanded={expandedId === sprint.id}
                            isNoteVisible={noteVisibleIds.has(sprint.id)}
                            onToggleExpand={() => toggleExpand(sprint.id)}
                            onToggleNote={(e: any) => toggleNote(sprint.id, e)}
                            onDelete={() => handleDelete(sprint.id)}
                            onUpdate={(updates: any) => handleUpdateSprint(sprint.id, updates)}
                            formatDuration={formatDuration}
                            baseTranslateY={getRowTranslation(idx)}
                            activeIdx={activeIdx}
                            onDragStart={onDragStart}
                            onDragMove={onDragMove}
                            onDragEnd={onDragEnd}
                            onLayout={(e: any) => {
                                itemLayouts.current[sprint.id] = e.nativeEvent.layout;
                            }}
                        />
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const DraggableSprintCard = React.memo((props: any) => {
    const { 
        sprint, index, isExpanded, isNoteVisible, onToggleExpand, onToggleNote, onDelete, onUpdate, formatDuration, baseTranslateY, activeIdx, onDragStart, onDragMove, onDragEnd, onLayout
    } = props;
    
    // Internal state for editing to feel snappy
    const [localTitle, setLocalTitle] = useState(sprint.primaryTask);
    const [localNote, setLocalNote] = useState(sprint.note || '');

    useEffect(() => {
        setLocalTitle(sprint.primaryTask);
        setLocalNote(sprint.note || '');
    }, [sprint.primaryTask, sprint.note]);

    // Use refs to avoid PanResponder closure issues
    const propsRef = useRef(props);
    useEffect(() => { propsRef.current = props; }, [props]);

    const isActive = activeIdx === index;
    const pan = useRef(new Animated.ValueXY()).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => {
                pan.setOffset({ x: 0, y: 0 });
                pan.setValue({ x: 0, y: 0 });
                propsRef.current.onDragStart(propsRef.current.index);
            },
            onPanResponderMove: (_, gesture) => {
                pan.y.setValue(gesture.dy);
                propsRef.current.onDragMove(gesture.dy);
            },
            onPanResponderRelease: (_, gesture) => {
                pan.flattenOffset();
                propsRef.current.onDragEnd(gesture.dy);
            },
            onPanResponderTerminate: () => {
                propsRef.current.onDragEnd(0);
            }
        })
    ).current;

    return (
        <Animated.View 
            onLayout={onLayout}
            style={[
                { transform: [{ translateY: isActive ? pan.y : baseTranslateY }] },
                isActive && { zIndex: 100, elevation: 12, opacity: 0.95, transform: [{ translateY: pan.y }, { scale: 1.02 }] }
            ]}
        >
            <TouchableOpacity 
                style={[styles.sprintCard, isExpanded && styles.sprintCardExpanded]}
                activeOpacity={0.7}
                onPress={onToggleExpand}
            >
                <View style={styles.sprintCardHeader}>
                    <View style={styles.dragHandle} {...panResponder.panHandlers}>
                        <Ionicons name="reorder-two-outline" size={20} color="#94A3B8" />
                    </View>
                    <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.headerMainInfo}>
                        <TextInput
                            style={styles.primaryTaskInput}
                            value={localTitle}
                            onChangeText={setLocalTitle}
                            onBlur={() => onUpdate({ primaryTask: localTitle })}
                            placeholder="Title"
                            placeholderTextColor="#94A3B8"
                            multiline={false}
                        />
                        <View style={styles.secondaryInfo}>
                            <Text style={styles.sprintDate}>
                                {new Date(sprint.date).toLocaleDateString(undefined, { 
                                    month: 'short', day: 'numeric', year: 'numeric' 
                                })}
                            </Text>
                            <View style={styles.statDot} />
                            <Text style={styles.sprintDuration}>{formatDuration(sprint.durationSeconds)}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={onToggleNote} style={styles.noteBtn}>
                            <Ionicons name={isNoteVisible ? "document-text" : "document-text-outline"} size={18} color={isNoteVisible ? "#3B82F6" : (sprint.note ? "#94A3B8" : "#CBD5E1")} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
                            <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        <Ionicons 
                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                            size={20} 
                            color="#64748B" 
                            style={{ marginLeft: 6 }}
                        />
                    </View>
                </View>

                {isNoteVisible && (
                    <View style={styles.noteContainer}>
                        <Text style={styles.noteLabel}>Sprint Note</Text>
                        <TextInput
                            style={styles.noteInput}
                            value={localNote}
                            onChangeText={setLocalNote}
                            onBlur={() => onUpdate({ note: localNote })}
                            placeholder="Add a note..."
                            placeholderTextColor="#94A3B8"
                            multiline
                        />
                    </View>
                )}

                {isExpanded && (
                    <View style={styles.timelineList}>
                        {sprint.timelineEvents && sprint.timelineEvents.map((evt: any, idx: number, arr: any[]) => {
                            const isTask = evt.type === 'task';
                            const isBreak = evt.type === 'break';
                            return (
                                <View key={idx} style={styles.timelineRow}>
                                    <View style={styles.timelineVisuals}>
                                        <View style={[
                                            styles.timelineDot,
                                            { backgroundColor: isTask ? '#3B82F6' : (isBreak ? '#10B981' : '#94A3B8') }
                                        ]} />
                                        {idx < arr.length - 1 && <View style={styles.timelineVerticalLine} />}
                                    </View>
                                    <View style={styles.timelineContent}>
                                        <View style={styles.timelineTextRow}>
                                            <Text style={styles.timelineEventTitle} numberOfLines={1}>
                                                {evt.title}
                                            </Text>
                                            <Text style={styles.timelineEventDuration}>
                                                {formatDuration(evt.durationSeconds)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        justifyContent: 'space-between'
    },
    exitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    backButtonText: {
        fontSize: 17,
        color: '#0F172A',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
    },
    list: { flex: 1, backgroundColor: '#F8FAFC' },
    listContent: { padding: 8, paddingBottom: 60, gap: 8 },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginTop: 40,
        fontSize: 15,
        fontStyle: 'italic'
    },
    sprintCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    sprintCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sprintCardExpanded: {
        borderColor: '#3B82F6',
    },
    headerMainInfo: {
        flex: 1,
    },
    primaryTaskInput: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        padding: 0,
        margin: 0,
        marginBottom: 2,
    },
    secondaryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sprintDate: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B'
    },
    statDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#CBD5E1',
        marginHorizontal: 6,
    },
    sprintDuration: {
        fontSize: 12,
        fontWeight: '700',
        color: '#3B82F6'
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deleteBtn: {
        padding: 4,
    },
    dragHandle: {
        paddingRight: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 8,
    },
    rankText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#3B82F6',
    },
    noteBtn: {
        padding: 4,
        marginRight: 2,
    },
    noteContainer: {
        marginTop: 8,
        padding: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    noteLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    noteInput: {
        fontSize: 13,
        color: '#1E293B',
        lineHeight: 18,
        padding: 0,
        margin: 0,
    },
    timelineList: {
        marginTop: 12,
    },
    timelineRow: {
        flexDirection: 'row',
        minHeight: 45,
    },
    timelineVisuals: {
        width: 20,
        alignItems: 'center',
        marginRight: 8,
    },
    timelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
        zIndex: 2,
    },
    timelineVerticalLine: {
        width: 1.5,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginTop: 2,
        marginBottom: -6,
        zIndex: 1,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 15,
    },
    timelineTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    timelineEventTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B'
    },
    timelineEventDuration: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: 'bold'
    },
});
