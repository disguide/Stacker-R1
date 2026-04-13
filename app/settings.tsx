import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StorageService, ColorDefinition, SprintSettings } from '../src/services/storage';
import ColorSettingsModal from '../src/components/ColorSettingsModal';
import { useAuth } from '../src/providers/AuthProvider';
import { supabase, deleteUserAccount } from '../src/services/supabase';

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
    
    const [workTimeStr, setWorkTimeStr] = useState('25');
    
    // Account Security State
    const [newPassword, setNewPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [isSecurityLoading, setIsSecurityLoading] = useState(false);
    
    // Auth State
    const { user } = useAuth();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account?",
            "This will permanently delete your account. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: () => {
                        Alert.alert(
                            "Final Warning",
                            "Are you absolutely sure you want to delete your cloud account?",
                            [
                                { text: "Cancel", style: "cancel" },
                                { 
                                    text: "Yes, Delete It", 
                                    style: "destructive",
                                    onPress: async () => {
                                        const { error } = await deleteUserAccount();
                                        if (error) {
                                            Alert.alert('Error', error.message || 'Make sure the delete_user RPC is setup in Supabase.');
                                        } else {
                                            Alert.alert('Success', 'Your account has been deleted.');
                                            router.replace('/');
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

    const handleResetEverything = async () => {
        Alert.alert(
            "RESET EVERYTHING?",
            "This will delete ALL goals, anti-goals, sprint history, and statistics. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "RESET ALL DATA", 
                    style: "destructive", 
                    onPress: async () => {
                        await StorageService.clearAllData();
                        router.replace('/');
                    }
                }
            ]
        );
    };

    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters.');
            return;
        }
        setIsSecurityLoading(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setIsSecurityLoading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Success', 'Password updated successfully!');
            setNewPassword('');
        }
    };

    const handleUpdateEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            Alert.alert('Error', 'Please enter a valid email address.');
            return;
        }
        setIsSecurityLoading(true);
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        setIsSecurityLoading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Verification Sent', 'Please check both your old and new email addresses for confirmation links.');
            setNewEmail('');
        }
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

                    {/* TOP ACCOUNT CARD */}
                    <SettingsGroup>
                        <View style={styles.accountCard}>
                            <View style={styles.accountHeader}>
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={{ fontSize: 24 }}>👤</Text>
                                </View>
                                <View style={styles.accountInfo}>
                                    <Text style={styles.accountName}>{user ? (user.email?.split('@')[0] || 'User') : 'Guest'}</Text>
                                    <Text style={styles.accountStatus}>{user ? 'Signed In' : 'Unregistered Account'}</Text>
                                </View>
                            </View>
                            
                            {!user ? (
                                <View style={styles.authForm}>
                                    <TouchableOpacity 
                                        style={[styles.authButton, { backgroundColor: '#007AFF', width: '100%' }]} 
                                        onPress={() => router.push('/auth')}
                                    >
                                        <Text style={[styles.authText, { color: '#FFF' }]}>Sign In / Create Account</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.authDisclaimer}>Sign in to sync your goals, sprints, and history across all your devices.</Text>
                                </View>
                            ) : (
                                <View style={styles.authForm}>
                                    <Text style={styles.authEmailText}>{user.email}</Text>
                                    <View style={[styles.authButtons, { flexDirection: 'row', marginTop: 12 }]}>
                                        <TouchableOpacity 
                                            style={[styles.authButton, { backgroundColor: '#E2E8F0', flex: 1 }]} 
                                            onPress={async () => {
                                                await supabase.auth.signOut();
                                                router.push('/auth');
                                            }}
                                        >
                                            <Text style={[styles.authText, { color: '#333' }]}>Switch</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={[styles.authButton, { backgroundColor: '#EF4444', flex: 1 }]} 
                                            onPress={handleSignOut}
                                        >
                                            <Text style={[styles.authText, { color: '#FFF' }]}>Sign Out</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
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
                    
                    {/* ACCOUNT SECURITY */}
                    {user && (
                        <SettingsGroup title="Account Security">
                            <View style={styles.securityItem}>
                                <Text style={styles.securityLabel}>Change Password</Text>
                                <View style={styles.securityInputRow}>
                                    <TextInput 
                                        style={styles.securityInput} 
                                        placeholder="New Password" 
                                        secureTextEntry 
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                    />
                                    <TouchableOpacity 
                                        style={[styles.securityButton, isSecurityLoading && styles.rowDisabled]} 
                                        onPress={handleUpdatePassword}
                                        disabled={isSecurityLoading}
                                    >
                                        <Text style={styles.securityButtonText}>Update</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.dividerIndent} />

                            <View style={styles.securityItem}>
                                <Text style={styles.securityLabel}>Update Email</Text>
                                <View style={styles.securityInputRow}>
                                    <TextInput 
                                        style={styles.securityInput} 
                                        placeholder="New Email Address" 
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={newEmail}
                                        onChangeText={setNewEmail}
                                    />
                                    <TouchableOpacity 
                                        style={[styles.securityButton, isSecurityLoading && styles.rowDisabled]} 
                                        onPress={handleUpdateEmail}
                                        disabled={isSecurityLoading}
                                    >
                                        <Text style={styles.securityButtonText}>Update</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.securityNote}>Requires verification link sent to your new email.</Text>
                            </View>
                        </SettingsGroup>
                    )}
                    <SettingsGroup>
                        <TouchableOpacity style={styles.dangerRow} onPress={handleResetEverything}>
                            <Text style={styles.dangerText}>Delete All Data & Statistics</Text>
                        </TouchableOpacity>
                        
                        {user && (
                            <>
                                <View style={[styles.divider, { marginLeft: 0 }]} />
                                <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount}>
                                    <Text style={styles.dangerText}>Delete Cloud Account</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </SettingsGroup>

                    <Text style={styles.versionText}>Version 1.1.0</Text>

                </ScrollView>
            </KeyboardAvoidingView>

            <ColorSettingsModal
                visible={isColorModalVisible}
                onClose={() => setIsColorModalVisible(false)}
                userColors={userColors}
                onSave={handleSaveUserColors}
            />
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
    }
});
