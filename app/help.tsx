import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocalization } from '../src/providers/LocalizationProvider';

const HelpSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.card}>
            {children}
        </View>
    </View>
);

const HelpItem = ({ icon, color, title, description }: { icon: keyof typeof Ionicons.glyphMap, color: string, title: string, description: string }) => (
    <View style={styles.item}>
        <View style={[styles.iconBox, { backgroundColor: color }]}>
            <Ionicons name={icon} size={20} color="#FFF" />
        </View>
        <View style={styles.itemText}>
            <Text style={styles.itemTitle}>{title}</Text>
            <Text style={styles.itemDescription}>{description}</Text>
        </View>
    </View>
);

export default function HelpScreen() {
    const router = useRouter();
    const { t } = useLocalization();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="#007AFF" />
                    <Text style={styles.backButtonText}>{t('settings.title')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('help.title')}</Text>
                <View style={{ width: 80 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <HelpSection title={t('help.tipsAndTricks')}>
                    <HelpItem 
                        icon="bulb" 
                        color="#F59E0B" 
                        title={t('help.smallWins')} 
                        description={t('help.smallWinsDesc')}
                    />
                    <View style={styles.divider} />
                    <HelpItem 
                        icon="swap-vertical" 
                        color="#6366F1" 
                        title={t('help.quickReorganize')} 
                        description={t('help.quickReorganizeDesc')}
                    />
                    <View style={styles.divider} />
                    <HelpItem 
                        icon="color-filter" 
                        color="#EC4899" 
                        title={t('help.autoColor')} 
                        description={t('help.autoColorDesc')}
                    />
                    <View style={styles.divider} />
                    <HelpItem 
                        icon="analytics" 
                        color="#10B981" 
                        title={t('help.slideProgress')} 
                        description={t('help.slideProgressDesc')}
                    />
                    <View style={styles.divider} />
                    <HelpItem 
                        icon="leaf" 
                        color="#14B8A6" 
                        title={t('help.deepFocus')} 
                        description={t('help.deepFocusDesc')}
                    />
                    <View style={styles.divider} />
                    <HelpItem 
                        icon="notifications" 
                        color="#007AFF" 
                        title={t('help.smartReminders')} 
                        description={t('help.smartRemindersDesc')}
                    />
                    <View style={styles.divider} />
                    <HelpItem 
                        icon="flash" 
                        color="#F43F5E" 
                        title={t('help.quickAdd')} 
                        description={t('help.quickAddDesc')}
                    />
                </HelpSection>

                <HelpSection title={t('help.connect')}>
                    <TouchableOpacity onPress={() => console.log('Open Instagram/YouTube')}>
                        <HelpItem 
                            icon="logo-youtube" 
                            color="#FF0000" 
                            title={t('help.videoGuides')} 
                            description={t('help.videoGuidesDesc')}
                        />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity onPress={() => console.log('Open Website')}>
                        <HelpItem 
                            icon="globe" 
                            color="#000" 
                            title={t('help.website')} 
                            description={t('help.websiteDesc')}
                        />
                    </TouchableOpacity>
                </HelpSection>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>{t('help.footerHelp')}</Text>
                    <Text style={styles.versionText}>Stacker Version 1.1.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 16,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 80,
    },
    backButtonText: {
        fontSize: 17,
        color: '#007AFF',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 16,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        overflow: 'hidden',
    },
    item: {
        flexDirection: 'row',
        padding: 16,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    itemText: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 4,
    },
    itemDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5EA',
        marginLeft: 64,
    },
    footer: {
        marginTop: 16,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    versionText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
});
