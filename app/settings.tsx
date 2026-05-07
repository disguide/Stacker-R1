import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StorageService, ColorDefinition, SprintSettings } from '../src/services/storage';
import { useAuth } from '../src/providers/AuthProvider';
import { supabase, deleteUserAccount } from '../src/services/supabase';
import { flushSync } from '../src/services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsGroup = ({ title, children }: { title?: string, children: React.ReactNode }) => (
    <View style={styles.groupContainer}>
        {title && <Text style={styles.groupTitle}>{title}</Text>}
        <View style={styles.groupBlock}>
            {children}
        </View>
    </View>
);

export default function SettingsScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [userColors, setUserColors] = useState<ColorDefinition[]>([]);
    const [sprintSettings, setSprintSettings] = useState<SprintSettings>({ showTimer: true, allowPause: true });
    const { user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Sprint Settings State
    const [workTimeStr, setWorkTimeStr] = useState('25');

    const [breakTimeStr, setBreakTimeStr] = useState('5');
    const [maxTimeStr, setMaxTimeStr] = useState('60');

    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            const colors = await StorageService.loadUserColors();
            const sprint = await StorageService.loadSprintSettings();
            if (mounted) {
                setUserColors(colors);
                setSprintSettings(sprint);
                setWorkTimeStr(sprint.autoBreakWorkTime?.toString() || '25');
                setBreakTimeStr(sprint.autoBreakDuration?.toString() || '5');
                setMaxTimeStr(sprint.maxDurationMinutes?.toString() || '60');
            }
        };
        loadData();
        return () => { mounted = false; };
    }, []);

    const handleSaveUserColors = async (colors: ColorDefinition[]) => {
        setUserColors(colors);
        await StorageService.saveUserColors(colors);
    };

    const handleToggleSprintSetting = async (key: keyof SprintSettings) => {
        const newSettings = { ...sprintSettings, [key]: !sprintSettings[key] };
        setSprintSettings(newSettings);
        await StorageService.saveSprintSettings(newSettings);
    };

    const handleUpdateSprintSetting = async (key: keyof SprintSettings, value: any) => {
        const newSettings = { ...sprintSettings, [key]: value };
        setSprintSettings(newSettings);
        await StorageService.saveSprintSettings(newSettings);
    };

    const handleTextUpdate = (key: keyof SprintSettings, text: string, setter: (s: string) => void) => {
        setter(text);
        if (text === '') return;
        const num = parseInt(text);
        if (!isNaN(num)) {
            handleUpdateSprintSetting(key, num);
        }
    };

    const handleWipeEverything = () => {
        Alert.alert(
            t('settings.wipeData'),
            user 
                ? t('settings.wipeDataUserMsg')
                : t('settings.wipeDataGuestMsg'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('settings.wipeEverything'),
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.clear();
                        Alert.alert(t('common.done'), t('settings.dataWiped'));
                        router.replace('/');
                    }
                }
            ]
        );
    };



    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="#007AFF" />
                    <Text style={styles.backButtonText}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('settings.title')}</Text>
                <View style={{ width: 70 }} />
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView 
                    style={styles.content} 
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <SettingsGroup title={t('settings.account')}>
                        {!user ? (
                            <>
                                <TouchableOpacity style={styles.navRow} onPress={() => router.push('/auth')}>
                                    <View style={[styles.iconWrapper, { backgroundColor: '#007AFF' }]}>
                                        <Ionicons name="log-in" size={18} color="#FFF" />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowLabel}>{t('settings.login')}</Text>
                                        <Text style={styles.rowSubLabel}>{t('settings.loginSub')}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                                </TouchableOpacity>

                                <View style={styles.divider} />

                                <TouchableOpacity style={styles.navRow} onPress={() => router.push('/auth')}>
                                    <View style={[styles.iconWrapper, { backgroundColor: '#10B981' }]}>
                                        <Ionicons name="person-add" size={18} color="#FFF" />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowLabel}>{t('settings.register')}</Text>
                                        <Text style={styles.rowSubLabel}>{t('settings.registerSub')}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity style={styles.navRow} onPress={() => router.push('/account')}>
                                    <View style={[styles.iconWrapper, { backgroundColor: '#007AFF' }]}>
                                        <Ionicons name="person" size={18} color="#FFF" />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowLabel}>{t('settings.accountManagement')}</Text>
                                        <Text style={styles.rowSubLabel}>{user.email}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                                </TouchableOpacity>
                            </>
                        )}
                    </SettingsGroup>

                    {/* TAGS & CATEGORIES */}
                    <SettingsGroup title={t('settings.tagsAndCategories')}>
                        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/color-settings')}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#EC4899' }]}>
                                <Ionicons name="color-palette" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>{t('settings.colorMeanings')}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </SettingsGroup>

                    {/* SPRINT CONFIGURATION */}
                    <SettingsGroup title={t('settings.sprintConfiguration')}>
                        <View style={styles.row}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#3B82F6' }]}>
                                <Ionicons name="timer" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>{t('settings.showTimer')}</Text>
                            </View>
                            <Switch value={sprintSettings.showTimer} onValueChange={() => handleToggleSprintSetting('showTimer')} />
                        </View>
                        <View style={styles.divider} />
                        
                        <View style={styles.row}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#F59E0B' }]}>
                                <Ionicons name="pause" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>{t('settings.allowPause')}</Text>
                            </View>
                            <Switch value={sprintSettings.allowPause} onValueChange={() => handleToggleSprintSetting('allowPause')} />
                        </View>
                        <View style={styles.divider} />

                        <View style={[styles.row, !sprintSettings.autoBreakMode && styles.rowDisabled]}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#10B981' }]}>
                                <Ionicons name="cafe" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>{t('settings.automaticBreaks')}</Text>
                            </View>
                            <Switch value={!!sprintSettings.autoBreakMode} onValueChange={() => handleToggleSprintSetting('autoBreakMode')} />
                        </View>

                        {sprintSettings.autoBreakMode && (
                            <>
                                <View style={styles.dividerIndent} />
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>{t('settings.workDuration')}</Text>
                                    <TextInput style={styles.numInput} keyboardType="number-pad" value={workTimeStr} onChangeText={t => handleTextUpdate('autoBreakWorkTime', t, setWorkTimeStr)} maxLength={3} />
                                </View>
                                <View style={styles.dividerIndent} />
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>{t('settings.breakDuration')}</Text>
                                    <TextInput style={styles.numInput} keyboardType="number-pad" value={breakTimeStr} onChangeText={t => handleTextUpdate('autoBreakDuration', t, setBreakTimeStr)} maxLength={3} />
                                </View>
                            </>
                        )}
                        <View style={styles.divider} />
                        
                        <View style={[styles.row, !sprintSettings.maxDurationEnabled && styles.rowDisabled]}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#8B5CF6' }]}>
                                <Ionicons name="flag" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>{t('settings.automaticSprintEnd')}</Text>
                            </View>
                            <Switch value={!!sprintSettings.maxDurationEnabled} onValueChange={() => handleToggleSprintSetting('maxDurationEnabled')} />
                        </View>

                        {sprintSettings.maxDurationEnabled && (
                            <>
                                <View style={styles.dividerIndent} />
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>{t('settings.maxDuration')}</Text>
                                    <TextInput style={styles.numInput} keyboardType="number-pad" value={maxTimeStr} onChangeText={t => handleTextUpdate('maxDurationMinutes', t, setMaxTimeStr)} maxLength={3} />
                                </View>
                            </>
                        )}
                    </SettingsGroup>

                    {/* TIME PREFERENCE */}
                    <SettingsGroup title={t('settings.timePreference')}>
                        <View style={styles.row}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#6366F1' }]}>
                                <Ionicons name="time" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>{t('settings.format24h')}</Text>
                            </View>
                            <Switch value={!!sprintSettings.use24HourFormat} onValueChange={() => handleToggleSprintSetting('use24HourFormat')} />
                        </View>
                    </SettingsGroup>


                    
                    {/* NOTE: Account security and danger zone moved to account.tsx */}

                    {/* LANGUAGE */}
                    <SettingsGroup title={t('settings.language')}>
                        <View style={styles.inputRow}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#FF9500' }]}>
                                <Ionicons name="language" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>{t('settings.language')}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {['en', 'fr', 'es', 'zh'].map(lang => (
                                    <TouchableOpacity
                                        key={lang}
                                        style={{ padding: 6, borderRadius: 6, backgroundColor: sprintSettings.language === lang || (!sprintSettings.language && lang === 'en') ? '#007AFF' : '#E5E5EA' }}
                                        onPress={() => {
                                            handleUpdateSprintSetting('language', lang);
                                            i18n.changeLanguage(lang);
                                        }}
                                    >
                                        <Text style={{ color: sprintSettings.language === lang || (!sprintSettings.language && lang === 'en') ? '#FFF' : '#333', fontSize: 14, fontWeight: 'bold' }}>{lang.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </SettingsGroup>

                    <Text style={styles.versionText}>{t('settings.version')}</Text>

                </ScrollView>
            </KeyboardAvoidingView>

            {isSyncing && (
                <View style={styles.syncOverlay}>
                    <View style={styles.syncModal}>
                        <Ionicons name="cloud-upload" size={32} color="#007AFF" />
                        <Text style={styles.syncText}>{t('settings.savingToCloud')}</Text>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7', // Standard iOS Settings Background
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
        width: 70,
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
        paddingBottom: 60,
    },
    groupContainer: {
        marginBottom: 24,
    },
    groupTitle: {
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 16,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    groupBlock: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        minHeight: 50,
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        minHeight: 50,
    },
    rowDisabled: {
        opacity: 0.9,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 16,
        minHeight: 50,
        paddingLeft: 54, // Align with text
    },
    iconWrapper: {
        width: 28,
        height: 28,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    rowTextContainer: {
        flex: 1,
    },
    rowLabel: {
        fontSize: 16,
        color: '#000',
    },
    rowSubLabel: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 2,
    },
    inputLabel: {
        fontSize: 16,
        color: '#000',
    },
    numInput: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'right',
        minWidth: 40,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5EA',
        marginLeft: 54, // Starts after icon
    },
    dividerIndent: {
        height: 1,
        backgroundColor: '#E5E5EA',
        marginLeft: 54,
    },
    
    // Auth Custom Elements
    accountCard: {
        padding: 16,
    },
    accountHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E5E5EA',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    accountInfo: {
        flex: 1,
    },
    accountName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
    },
    accountStatus: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    authButtons: {
        gap: 10,
    },
    authButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
    },
    authIcon: {
        marginRight: 8,
    },
    authText: {
        fontSize: 15,
        fontWeight: '600',
    },
    authDisclaimer: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 12,
    },

    dangerRow: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    dangerText: {
        fontSize: 16,
        color: '#FF3B30',
    },
    versionText: {
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 13,
        marginTop: 8,
    },
    authForm: {
        marginTop: 8,
    },
    authInput: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        fontSize: 15,
        marginBottom: 12,
        color: '#000',
    },
    authEmailText: {
        fontSize: 16,
        color: '#6B7280',
        paddingVertical: 8,
        textAlign: 'center',
    },
    securityItem: {
        padding: 16,
    },
    securityLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    securityInputRow: {
        flexDirection: 'row',
        gap: 10,
    },
    securityInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    securityButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: 8,
    },
    securityButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    securityNote: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 6,
    },
    syncOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    syncModal: {
        backgroundColor: '#FFF',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    syncText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
});
