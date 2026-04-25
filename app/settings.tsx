import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StorageService, ColorDefinition, SprintSettings } from '../src/services/storage';
import ColorSettingsModal from '../src/components/ColorSettingsModal';
import { useAuth } from '../src/providers/AuthProvider';
import { supabase, deleteUserAccount } from '../src/services/supabase';
import { flushSync } from '../src/services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsGroup = ({ title, children }: { title?: string, children: React.ReactNode }) => (
    <View style={styles.groupContainer}>
        {title && <Text style={styles.groupTitle}>{title.toUpperCase()}</Text>}
        <View style={styles.groupBlock}>
            {children}
        </View>
    </View>
);

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);
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

    const handleSignOut = async () => {
        Alert.alert(
            "Sign Out",
            "Your data is safely stored in the cloud. Local data will be cleared from this device.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        setIsSyncing(true);
                        try { await flushSync(); } catch {}
                        try {
                            await supabase.auth.signOut();
                            await AsyncStorage.clear();
                            router.replace('/');
                        } catch (err) {
                            Alert.alert('Error', 'Failed to sign out.');
                        } finally {
                            setIsSyncing(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSwitchAccount = async () => {
        Alert.alert(
            "Switch Account",
            "You'll be signed out and can log in with a different account. Local data will be cleared.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Switch",
                    onPress: async () => {
                        setIsSyncing(true);
                        try { await flushSync(); } catch {}
                        try {
                            await supabase.auth.signOut();
                            await AsyncStorage.clear();
                            router.replace('/auth');
                        } catch (err) {
                            Alert.alert('Error', 'Failed to switch.');
                        } finally {
                            setIsSyncing(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "Choose how to handle your data:",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Keep Data (Dissociate)",
                    onPress: () => {
                        Alert.alert(
                            "Dissociate Account?",
                            "Your cloud account will be deleted, but all your local data stays on this device. You'll continue as a guest.",
                            [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Dissociate",
                                    style: "destructive",
                                    onPress: async () => {
                                        setIsSyncing(true);
                                        try {
                                            const { error } = await deleteUserAccount();
                                            if (error) {
                                                Alert.alert('Error', error.message || 'Failed to delete account.');
                                            } else {
                                                Alert.alert('Done', 'Account removed. Your data is still here — you are now a guest.');
                                            }
                                        } catch (err) {
                                            Alert.alert('Error', 'Something went wrong.');
                                        } finally {
                                            setIsSyncing(false);
                                        }
                                    }
                                }
                            ]
                        );
                    }
                },
                {
                    text: "Delete Everything",
                    style: "destructive",
                    onPress: () => {
                        Alert.alert(
                            "Final Warning",
                            "This will permanently delete your cloud account AND wipe all local data. This cannot be undone.",
                            [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Yes, Delete It All",
                                    style: "destructive",
                                    onPress: async () => {
                                        setIsSyncing(true);
                                        try {
                                            await flushSync();
                                            const { error } = await deleteUserAccount();
                                            if (error) {
                                                Alert.alert('Error', error.message || 'Failed to delete account.');
                                            } else {
                                                await AsyncStorage.clear();
                                                Alert.alert('Done', 'Account and all data have been permanently deleted.');
                                                router.replace('/');
                                            }
                                        } catch (err) {
                                            Alert.alert('Error', 'Something went wrong.');
                                        } finally {
                                            setIsSyncing(false);
                                        }
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    };

    const handleWipeEverything = () => {
        Alert.alert(
            "Wipe All Data?",
            user 
                ? "This will erase everything on this device. Your cloud data will NOT be affected — you can sync it back by signing in again."
                : "This will permanently erase all your local data. Since you're a guest, this data cannot be recovered.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Wipe Everything",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.clear();
                        Alert.alert('Done', 'All local data has been wiped.');
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
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
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

                    {/* ACCOUNT */}
                    <SettingsGroup title="Account">
                        {!user ? (
                            <>
                                <TouchableOpacity style={styles.navRow} onPress={() => router.push('/auth')}>
                                    <View style={[styles.iconWrapper, { backgroundColor: '#007AFF' }]}>
                                        <Ionicons name="log-in" size={18} color="#FFF" />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowLabel}>Login</Text>
                                        <Text style={styles.rowSubLabel}>Restore synced data</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                                </TouchableOpacity>

                                <View style={styles.divider} />

                                <TouchableOpacity style={styles.navRow} onPress={() => router.push('/auth')}>
                                    <View style={[styles.iconWrapper, { backgroundColor: '#10B981' }]}>
                                        <Ionicons name="person-add" size={18} color="#FFF" />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowLabel}>Register New Account</Text>
                                        <Text style={styles.rowSubLabel}>Save guest data to cloud</Text>
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
                                        <Text style={styles.rowLabel}>Account Management</Text>
                                        <Text style={styles.rowSubLabel}>{user.email}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                                </TouchableOpacity>

                                <View style={styles.divider} />

                                <TouchableOpacity style={styles.navRow} onPress={handleSignOut} disabled={isSyncing}>
                                    <View style={[styles.iconWrapper, { backgroundColor: '#6B7280' }]}>
                                        <Ionicons name="log-out" size={18} color="#FFF" />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowLabel}>{isSyncing ? 'Saving...' : 'Sign Out'}</Text>
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.divider} />

                                <TouchableOpacity style={styles.navRow} onPress={handleDeleteAccount}>
                                    <View style={[styles.iconWrapper, { backgroundColor: '#EF4444' }]}>
                                        <Ionicons name="trash" size={18} color="#FFF" />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={[styles.rowLabel, { color: '#EF4444' }]}>Delete Account</Text>
                                    </View>
                                </TouchableOpacity>
                            </>
                        )}
                    </SettingsGroup>

                    {/* SPRINT CONFIGURATION */}
                    <SettingsGroup title="Sprint Configuration">
                        <View style={styles.row}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#3B82F6' }]}>
                                <Ionicons name="timer" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>Show Timer</Text>
                            </View>
                            <Switch value={sprintSettings.showTimer} onValueChange={() => handleToggleSprintSetting('showTimer')} />
                        </View>
                        <View style={styles.divider} />
                        
                        <View style={styles.row}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#F59E0B' }]}>
                                <Ionicons name="pause" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>Allow Pause</Text>
                            </View>
                            <Switch value={sprintSettings.allowPause} onValueChange={() => handleToggleSprintSetting('allowPause')} />
                        </View>
                        <View style={styles.divider} />

                        <View style={[styles.row, !sprintSettings.autoBreakMode && styles.rowDisabled]}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#10B981' }]}>
                                <Ionicons name="cafe" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>Automatic Breaks</Text>
                            </View>
                            <Switch value={!!sprintSettings.autoBreakMode} onValueChange={() => handleToggleSprintSetting('autoBreakMode')} />
                        </View>

                        {sprintSettings.autoBreakMode && (
                            <>
                                <View style={styles.dividerIndent} />
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>Work Duration (min)</Text>
                                    <TextInput style={styles.numInput} keyboardType="number-pad" value={workTimeStr} onChangeText={t => handleTextUpdate('autoBreakWorkTime', t, setWorkTimeStr)} maxLength={3} />
                                </View>
                                <View style={styles.dividerIndent} />
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>Break Duration (min)</Text>
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
                                <Text style={styles.rowLabel}>Automatic Sprint End</Text>
                            </View>
                            <Switch value={!!sprintSettings.maxDurationEnabled} onValueChange={() => handleToggleSprintSetting('maxDurationEnabled')} />
                        </View>

                        {sprintSettings.maxDurationEnabled && (
                            <>
                                <View style={styles.dividerIndent} />
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>Max Duration (min)</Text>
                                    <TextInput style={styles.numInput} keyboardType="number-pad" value={maxTimeStr} onChangeText={t => handleTextUpdate('maxDurationMinutes', t, setMaxTimeStr)} maxLength={3} />
                                </View>
                            </>
                        )}
                    </SettingsGroup>

                    {/* TIME PREFERENCE */}
                    <SettingsGroup title="Time Preference">
                        <View style={styles.row}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#6366F1' }]}>
                                <Ionicons name="time" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>24-Hour Time Format</Text>
                            </View>
                            <Switch value={!!sprintSettings.use24HourFormat} onValueChange={() => handleToggleSprintSetting('use24HourFormat')} />
                        </View>
                    </SettingsGroup>

                    {/* TAGS & CATEGORIES */}
                    <SettingsGroup title="Tags & Categories">
                        <TouchableOpacity style={styles.navRow} onPress={() => setIsColorModalVisible(true)}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#EC4899' }]}>
                                <Ionicons name="color-palette" size={18} color="#FFF" />
                            </View>
                            <View style={styles.rowTextContainer}>
                                <Text style={styles.rowLabel}>Color Meanings</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </SettingsGroup>
                    
                    {/* NOTE: Account security and danger zone moved to account.tsx */}

                    <Text style={styles.versionText}>Version 1.1.0</Text>

                </ScrollView>
            </KeyboardAvoidingView>

            <ColorSettingsModal
                visible={isColorModalVisible}
                onClose={() => setIsColorModalVisible(false)}
                userColors={userColors}
                onSave={handleSaveUserColors}
            />

            {isSyncing && (
                <View style={styles.syncOverlay}>
                    <View style={styles.syncModal}>
                        <Ionicons name="cloud-upload" size={32} color="#007AFF" />
                        <Text style={styles.syncText}>Saving to Cloud...</Text>
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
