import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StorageService, SavedSprint } from '../src/services/storage';

const { width } = Dimensions.get('window');

type TabType = 'personal' | 'system';

export default function AchievementsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('personal');
    
    // Data States
    const [personalSprints, setPersonalSprints] = useState<SavedSprint[]>([]);
    const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);
    const [totalWins, setTotalWins] = useState(0);
    const [selectedSprint, setSelectedSprint] = useState<SavedSprint | null>(null);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let mounted = true;
        
        const loadData = async () => {
            const saved = await StorageService.loadSavedSprints();
            const history = await StorageService.loadSprintHistory();
            
            if (mounted) {
                // Personal Achievements
                setPersonalSprints(saved);
                
                // System Stats Calculation
                const seconds = history.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
                const wins = history.reduce((acc, s) => acc + (s.taskCount || 0), 0);
                
                setTotalWorkSeconds(seconds);
                setTotalWins(wins);
            }
        };
        
        loadData();
        return () => { mounted = false; };
    }, []);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const switchTab = (tab: TabType) => {
        if (tab === activeTab) return;
        
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: tab === 'system' ? 20 : -20, duration: 150, useNativeDriver: true })
        ]).start(() => {
            setActiveTab(tab);
            slideAnim.setValue(tab === 'system' ? -20 : 20);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true })
            ]).start();
        });
    };

    // Derived System Milestones
    const systemMilestones = useMemo(() => [
        {
            id: '10h',
            title: '10 Hour Club',
            description: 'Log 10 hours of deep work time.',
            target: 36000,
            current: totalWorkSeconds,
            icon: 'time',
            gradient: ['#3B82F6', '#2563EB'],
            formatSuffix: 'h',
            currentFormat: Math.floor(totalWorkSeconds / 3600),
            targetFormat: 10
        },
        {
            id: '100tasks',
            title: 'Centurion',
            description: 'Complete 100 tasks during focus sprints.',
            target: 100,
            current: totalWins,
            icon: 'checkmark-done-circle',
            gradient: ['#10B981', '#059669'],
            formatSuffix: '',
            currentFormat: totalWins,
            targetFormat: 100
        },
        {
            id: 'first_sprint',
            title: 'First Step',
            description: 'Complete your first focus sprint.',
            target: 1,
            current: totalWorkSeconds > 0 ? 1 : 0,
            icon: 'footsteps',
            gradient: ['#F59E0B', '#D97706'],
            formatSuffix: '',
            currentFormat: totalWorkSeconds > 0 ? 1 : 0,
            targetFormat: 1
        }
    ], [totalWorkSeconds, totalWins]);

    const renderPersonal = () => {
        if (personalSprints.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="trophy-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyText}>You haven't saved any master sprints yet.</Text>
                    <Text style={styles.emptySub}>Save your best focus sessions from the summary screen to build your Hall of Fame.</Text>
                </View>
            );
        }

        return (
            <View style={styles.gridContainer}>
                {personalSprints.map((sprint, idx) => (
                    <TouchableOpacity 
                        key={sprint.id} 
                        style={styles.personalCard}
                        activeOpacity={0.8}
                        onPress={() => setSelectedSprint(sprint)}
                    >
                        <LinearGradient
                            colors={['#FFFFFF', '#F8FAFC']}
                            start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                            style={styles.personalCardInner}
                        >
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.cardDate} numberOfLines={1}>
                                    {new Date(sprint.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </Text>
                            </View>
                            
                            <View style={styles.cardBody}>
                                <Text style={styles.primaryTaskText} numberOfLines={3}>
                                    {sprint.primaryTask || 'Focus Session'}
                                </Text>
                            </View>
                            
                            <View style={styles.cardFooter}>
                                <View style={styles.durationPill}>
                                    <Ionicons name="time" size={12} color="#3B82F6" />
                                    <Text style={styles.durationPillText}>{formatDuration(sprint.durationSeconds)}</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderSystem = () => {
        return (
            <View style={styles.systemContainer}>
                {systemMilestones.map((milestone) => {
                    const isUnlocked = milestone.current >= milestone.target;
                    const progressRatio = Math.min(milestone.current / milestone.target, 1);
                    
                    return (
                        <View key={milestone.id} style={[styles.systemCard, isUnlocked ? styles.systemCardUnlocked : styles.systemCardLocked]}>
                            {isUnlocked && (
                                <View style={styles.unlockedBadge}>
                                    <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                                    <Text style={styles.unlockedText}>UNLOCKED</Text>
                                </View>
                            )}
                            
                            <View style={styles.systemCardHeader}>
                                <LinearGradient
                                    colors={isUnlocked ? milestone.gradient as [string, string] : ['#E2E8F0', '#CBD5E1']}
                                    style={styles.systemIconBox}
                                >
                                    <Ionicons name={milestone.icon as any} size={24} color={isUnlocked ? "#FFF" : "#94A3B8"} />
                                </LinearGradient>
                                <View style={styles.systemCardTextWrap}>
                                    <Text style={[styles.systemTitle, isUnlocked ? styles.textUnlocked : styles.textLocked]}>{milestone.title}</Text>
                                    <Text style={styles.systemDesc}>{milestone.description}</Text>
                                </View>
                            </View>

                            <View style={styles.progressContainer}>
                                <View style={styles.progressHeader}>
                                    <Text style={styles.progressLabel}>Progress</Text>
                                    <Text style={styles.progressText}>
                                        {milestone.currentFormat}{milestone.formatSuffix} / {milestone.targetFormat}{milestone.formatSuffix}
                                    </Text>
                                </View>
                                <View style={styles.progressBarBg}>
                                    <Animated.View style={[
                                        styles.progressBarFill, 
                                        { 
                                            width: `${progressRatio * 100}%`,
                                            backgroundColor: isUnlocked ? milestone.gradient[0] : '#94A3B8'
                                        }
                                    ]} />
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.exitBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Achievements</Text>
                <View style={{ width: 60 }} />
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <View style={styles.tabSwitcher}>
                    <TouchableOpacity 
                        style={[styles.tabBtn, activeTab === 'personal' && styles.tabBtnActive]}
                        onPress={() => switchTab('personal')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'personal' && styles.tabTextActive]}>Personal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabBtn, activeTab === 'system' && styles.tabBtnActive]}
                        onPress={() => switchTab('system')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'system' && styles.tabTextActive]}>System</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content Area */}
            <ScrollView 
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
                    {activeTab === 'personal' ? renderPersonal() : renderSystem()}
                </Animated.View>
            </ScrollView>

            {/* Selected Sprint Modal */}
            {selectedSprint && (
                <View style={[styles.modalBackdrop, StyleSheet.absoluteFillObject]}>
                    <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setSelectedSprint(null)} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconBox}>
                                <Ionicons name="star" size={24} color="#F59E0B" />
                            </View>
                            <TouchableOpacity onPress={() => setSelectedSprint(null)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{maxHeight: Dimensions.get('window').height * 0.6}} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalDate}>
                                {new Date(selectedSprint.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </Text>
                            <Text style={styles.modalTitle}>{selectedSprint.primaryTask || 'Focus Session'}</Text>
                            
                            <View style={styles.modalStatsRow}>
                                <View style={styles.modalStatBox}>
                                    <Ionicons name="time-outline" size={18} color="#3B82F6" />
                                    <Text style={styles.modalStatLabel}>{formatDuration(selectedSprint.durationSeconds)}</Text>
                                </View>
                                {selectedSprint.taskCount ? (
                                    <View style={styles.modalStatBox}>
                                        <Ionicons name="checkmark-done" size={18} color="#10B981" />
                                        <Text style={[styles.modalStatLabel, { color: '#10B981' }]}>{selectedSprint.taskCount} Tasks</Text>
                                    </View>
                                ) : null}
                            </View>

                            {selectedSprint.note ? (
                                <View style={styles.modalNoteBox}>
                                    <Text style={styles.modalNoteLabel}>SESSION NOTE</Text>
                                    <Text style={styles.modalNoteText}>"{selectedSprint.note}"</Text>
                                </View>
                            ) : null}

                            {selectedSprint.timelineEvents && selectedSprint.timelineEvents.length > 0 && (
                                <View style={styles.modalTimeline}>
                                    <Text style={styles.modalNoteLabel}>TIMELINE</Text>
                                    {selectedSprint.timelineEvents.map((evt: any, i: number, arr: any[]) => (
                                        <View key={i} style={styles.timelineRow}>
                                            <View style={styles.timelineVisuals}>
                                                <View style={[styles.timelineDot, { backgroundColor: evt.type === 'break' ? '#10B981' : '#3B82F6' }]} />
                                                {i < arr.length - 1 && <View style={styles.timelineLine} />}
                                            </View>
                                            <View style={styles.timelineEventContent}>
                                                <Text style={styles.timelineEventText} numberOfLines={1}>{evt.title}</Text>
                                                <Text style={styles.timelineEventDuration}>{formatDuration(evt.durationSeconds)}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 10,
    },
    exitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 17,
        color: '#0F172A',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
    },
    tabContainer: {
        backgroundColor: '#FFF',
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 5,
        elevation: 2,
        zIndex: 5,
    },
    tabSwitcher: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        padding: 4,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 10,
    },
    tabBtnActive: {
        backgroundColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    tabTextActive: {
        color: '#0F172A',
        fontWeight: '800',
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 60,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569',
        marginTop: 16,
        textAlign: 'center',
    },
    emptySub: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Personal Cards Gallery Style
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    personalCard: {
        width: '47%',
        aspectRatio: 1, // Make it square
        borderRadius: 20,
        backgroundColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        marginBottom: 8,
    },
    personalCardInner: {
        flex: 1,
        padding: 14,
        justifyContent: 'space-between',
    },
    cardHeaderRow: {
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    cardDate: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    cardBody: {
        flex: 1,
        justifyContent: 'center',
    },
    primaryTaskText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 22,
    },
    cardFooter: {
        alignItems: 'flex-start',
        paddingTop: 8,
    },
    durationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    durationPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#3B82F6',
    },

    // System Cards Style
    systemContainer: {
        gap: 16,
    },
    systemCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
    },
    systemCardUnlocked: {
        borderColor: '#E2E8F0',
    },
    systemCardLocked: {
        borderColor: '#F1F5F9',
        opacity: 0.8,
        backgroundColor: '#FAFAFA',
    },
    unlockedBadge: {
        position: 'absolute',
        top: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    unlockedText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    systemCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    systemIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    systemCardTextWrap: {
        flex: 1,
        paddingRight: 40, // Space for unlocked badge
    },
    systemTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    textUnlocked: {
        color: '#0F172A',
    },
    textLocked: {
        color: '#64748B',
    },
    systemDesc: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
    progressContainer: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    progressText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    progressBarBg: {
        height: 8,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },

    // Modal Styles
    modalBackdrop: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        zIndex: 100,
    },
    modalDismissArea: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
    },
    modalDate: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 30,
        marginBottom: 20,
    },
    modalStatsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    modalStatBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 6,
    },
    modalStatLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B82F6',
    },
    modalNoteBox: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 24,
    },
    modalNoteLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 8,
    },
    modalNoteText: {
        fontSize: 15,
        color: '#1E293B',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    modalTimeline: {
        marginTop: 8,
    },
    timelineRow: {
        flexDirection: 'row',
        minHeight: 40,
    },
    timelineVisuals: {
        width: 16,
        alignItems: 'center',
        marginRight: 12,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
        zIndex: 2,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginTop: 4,
        marginBottom: -4,
        zIndex: 1,
    },
    timelineEventContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 16,
    },
    timelineEventText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        flex: 1,
        marginRight: 8,
    },
    timelineEventDuration: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: 'bold',
    }
});
