import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StorageService, SavedSprint } from '../src/services/storage';

const { width } = Dimensions.get('window');

export default function AchievementsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { t, i18n } = useTranslation();
    
    // Data States
    const [personalSprints, setPersonalSprints] = useState<SavedSprint[]>([]);
    const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);
    const [totalWins, setTotalWins] = useState(0);
    const [selectedSprint, setSelectedSprint] = useState<SavedSprint | null>(null);

    const handleUnstar = async (sprintId: string) => {
        await StorageService.deleteSavedSprint(sprintId);
        setPersonalSprints(prev => prev.filter(s => s.id !== sprintId));
        setSelectedSprint(null);
    };

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

    // Derived System Milestones - KEPT EXACTLY THE SAME
    const systemMilestones = useMemo(() => [
        {
            id: '10h',
            title: t('achievements.milestones.hourClub.title'),
            description: t('achievements.milestones.hourClub.description'),
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
            title: t('achievements.milestones.centurion.title'),
            description: t('achievements.milestones.centurion.description'),
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
            title: t('achievements.milestones.firstStep.title'),
            description: t('achievements.milestones.firstStep.description'),
            target: 1,
            current: totalWorkSeconds > 0 ? 1 : 0,
            icon: 'footsteps',
            gradient: ['#F59E0B', '#D97706'],
            formatSuffix: '',
            currentFormat: totalWorkSeconds > 0 ? 1 : 0,
            targetFormat: 1
        }
    ], [totalWorkSeconds, totalWins, t]);

    const renderBarGraph = (sprint: SavedSprint) => {
        if (!sprint.timelineEvents || sprint.timelineEvents.length === 0) {
            return <View style={styles.emptyGraph} />;
        }
        
        let events = sprint.timelineEvents;
        if (events.length > 8) {
            events = events.slice(0, 8); // Slice for layout cleanliness if excessive events
        }

        const maxDuration = Math.max(...events.map(e => e.durationSeconds || 0));
        if (maxDuration === 0) return <View style={styles.emptyGraph} />;

        return (
            <View style={styles.barGraphWrapper}>
                {events.map((evt: any, i: number) => {
                    const heightPct = Math.max(10, (evt.durationSeconds / maxDuration) * 100);
                    return (
                        <View key={i} style={styles.barColumn}>
                            <View style={[styles.barFill, { height: `${heightPct}%`, backgroundColor: evt.type === 'break' ? '#E2E8F0' : '#1E293B' }]} />
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderPersonal = () => {
        if (personalSprints.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="trophy-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyText}>{t('achievements.noSprints')}</Text>
                    <Text style={styles.emptySub}>{t('achievements.noSprintsSub')}</Text>
                </View>
            );
        }

        // Simulating infinite scroll with duplicated loops if data is short
        const infiniteData = Array(10).fill(personalSprints).flat();
        
        // 2 cards visible logic: available space = width - paddingHorizontal(40) - gaps(12)
        const cardWidth = (width - 40 - 12) / 2;

        return (
            <View style={styles.carouselSection}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionHeader, { marginBottom: 0, paddingHorizontal: 0 }]}>{t('achievements.personalSprints')}</Text>
                    <TouchableOpacity onPress={() => router.push('/all-sprints')}>
                        <Text style={styles.viewAllText}>{t('achievements.viewAll')}</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={infiniteData}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContainer}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={[styles.carouselCard, { width: cardWidth }]}
                            activeOpacity={0.8}
                            onPress={() => setSelectedSprint(item)}
                        >
                            {/* 1. Date */}
                            <Text style={styles.carouselDate} numberOfLines={1}>
                                {new Date(item.date).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>

                            {/* 2. Title */}
                            <Text style={styles.carouselTitle} numberOfLines={2}>
                                {item.primaryTask || t('achievements.focusSession')}
                            </Text>
                            
                            {/* 3. Vertical Bar Graph */}
                            <View style={styles.carouselGraphContainer}>
                                {renderBarGraph(item)}
                            </View>
                            
                            {/* 4. Duration & 5. Tasks */}
                            <View style={styles.carouselCardBottom}>
                                <Text style={styles.carouselDuration}>
                                    {formatDuration(item.durationSeconds)}
                                </Text>
                                <Text style={styles.carouselTaskCount}>
                                    {item.taskCount || 0} {t('achievements.tasks')}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            </View>
        );
    };

    const renderSystem = () => {
        // SYSTEM ACHIEVEMENTS LOGIC KEPT EXACTLY THE SAME
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
                                    <Text style={styles.unlockedText}>{t('achievements.unlocked')}</Text>
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
                                    <Text style={styles.progressLabel}>{t('achievements.progress')}</Text>
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
                    <Text style={styles.backButtonText}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('achievements.title')}</Text>
                <View style={{ width: 60 }} />
            </View>

            {/* UNIFIED SCROLL VIEW */}
            <ScrollView 
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* TOP PART: Personal Sprints */}
                {renderPersonal()}
                
                <View style={styles.sectionDivider} />
                <Text style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>{t('achievements.systemAchievements')}</Text>
                
                {/* BOTTOM PART: System Achievements */}
                <View style={{ paddingHorizontal: 20 }}>
                    {renderSystem()}
                </View>
            </ScrollView>

            {/* Selected Sprint Modal (Drawer format perfectly preserved) */}
            {selectedSprint && (
                <View style={[styles.modalBackdrop, StyleSheet.absoluteFillObject]}>
                    <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setSelectedSprint(null)} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => handleUnstar(selectedSprint.id)} style={styles.modalIconBox}>
                                <Ionicons name="star" size={24} color="#F59E0B" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setSelectedSprint(null)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{maxHeight: Dimensions.get('window').height * 0.6}} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalDate}>
                                {new Date(selectedSprint.date).toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </Text>
                            <Text style={styles.modalTitle}>{selectedSprint.primaryTask || t('achievements.focusSession')}</Text>
                            
                            <View style={styles.modalStatsRow}>
                                <View style={styles.modalStatBox}>
                                    <Ionicons name="time-outline" size={18} color="#3B82F6" />
                                    <Text style={styles.modalStatLabel}>{formatDuration(selectedSprint.durationSeconds)}</Text>
                                </View>
                                {selectedSprint.taskCount ? (
                                    <View style={styles.modalStatBox}>
                                        <Ionicons name="checkmark-done" size={18} color="#10B981" />
                                        <Text style={[styles.modalStatLabel, { color: '#10B981' }]}>{selectedSprint.taskCount} {t('achievements.tasks')}</Text>
                                    </View>
                                ) : null}
                            </View>

                            {selectedSprint.note ? (
                                <View style={styles.modalNoteBox}>
                                    <Text style={styles.modalNoteLabel}>{t('achievements.sessionNote')}</Text>
                                    <Text style={styles.modalNoteText}>"{selectedSprint.note}"</Text>
                                </View>
                            ) : null}

                            {selectedSprint.timelineEvents && selectedSprint.timelineEvents.length > 0 && (
                                <View style={styles.modalTimeline}>
                                    <Text style={styles.modalNoteLabel}>{t('achievements.timeline')}</Text>
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
    // Global
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
    exitBtn: { flexDirection: 'row', alignItems: 'center' },
    backButtonText: { fontSize: 17, color: '#0F172A', fontWeight: '500' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    
    // Unified Layout Styles
    scrollArea: { flex: 1 },
    scrollContent: { paddingVertical: 20, paddingBottom: 60 },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B82F6',
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 32,
        marginHorizontal: 20,
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
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

    // Carousel Styles
    carouselSection: { marginTop: 8 },
    carouselContainer: {
        paddingHorizontal: 20,
        gap: 12,
    },
    carouselCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        height: 180,
    },
    carouselDate: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    carouselTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
        lineHeight: 18,
        marginBottom: 8,
        height: 36, // Reserve room for 2 lines
    },
    carouselGraphContainer: {
        flex: 1,
        marginVertical: 8,
        justifyContent: 'flex-end',
    },
    emptyGraph: {
        flex: 1,
    },
    barGraphWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: '100%',
        gap: 2,
    },
    barColumn: {
        flex: 1,
        maxWidth: 12,
        height: '100%',
        justifyContent: 'flex-end',
    },
    barFill: {
        width: '100%',
        borderRadius: 3,
    },
    carouselCardBottom: {
        marginTop: 4,
    },
    carouselDuration: {
        fontSize: 13,
        fontWeight: '800',
        color: '#3B82F6',
        marginBottom: 2,
    },
    carouselTaskCount: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },

    // System Cards Style (Kept exactly as before)
    systemContainer: { gap: 16 },
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
    systemCardUnlocked: { borderColor: '#E2E8F0' },
    systemCardLocked: { borderColor: '#F1F5F9', opacity: 0.8, backgroundColor: '#FAFAFA' },
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
        paddingRight: 40,
    },
    systemTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    textUnlocked: { color: '#0F172A' },
    textLocked: { color: '#64748B' },
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

    // Modal Styles (Floating Card)
    modalBackdrop: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 100,
    },
    modalDismissArea: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        width: '100%',
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        maxHeight: '80%',
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
