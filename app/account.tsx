import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useAuth } from '../src/providers/AuthProvider';
import { supabase, deleteUserAccount } from '../src/services/supabase';
import { StorageService } from '../src/services/storage';
import { flushSync } from '../src/services/SyncService';

const SettingsGroup = ({ title, children }: { title?: string, children: React.ReactNode }) => (
    <View style={styles.groupContainer}>
        {title && <Text style={styles.groupTitle}>{title.toUpperCase()}</Text>}
        <View style={styles.groupBlock}>
            {children}
        </View>
    </View>
);

export default function AccountScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    
    // Account Security State
    const [newPassword, setNewPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [isSecurityLoading, setIsSecurityLoading] = useState(false);
    
    const [isSyncing, setIsSyncing] = useState(false);
    const { user } = useAuth();

    const handleSignOut = async () => {
        setIsSyncing(true);
        try {
            await flushSync(); // Ensure data is pushed before session ends
            await supabase.auth.signOut();
        } catch (err) {
            console.error('Sign out sync failed:', err);
            // Even if sync fails, we let them sign out if they insist, 
            // but we'll alert them.
            Alert.alert(t('account.cloudSaveDelayed'), t('account.cloudSaveDelayedMsg'), [
                { text: t('account.wait'), style: 'cancel', onPress: () => setIsSyncing(false) },
                { text: t('account.signOut'), style: 'destructive', onPress: async () => {
                    await supabase.auth.signOut();
                }}
            ]);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account?",
            "This will permanently delete your account. This action cannot be undone.",
            [
                { text: t('account.cancel'), style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: () => {
                        Alert.alert(
                            "Final Warning",
                            "Are you absolutely sure you want to delete your cloud account?",
                            [
                                { text: t('account.cancel'), style: "cancel" },
                                { 
                                    text: "Yes, Delete It", 
                                    style: "destructive",
                                    onPress: async () => {
                                        setIsSyncing(true);
                                        await flushSync();
                                        const { error } = await deleteUserAccount();
                                        setIsSyncing(false);
                                        if (error) {
                                            Alert.alert(t('account.error'), error.message || t('account.setupRpc'));
                                        } else {
                                            Alert.alert(t('account.success'), t('account.accountDeleted'));
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

    const handleResetEverything = async () => {
        Alert.alert(
            "RESET EVERYTHING?",
            "This will delete ALL goals, anti-goals, sprint history, and statistics. This cannot be undone.",
            [
                { text: t('account.cancel'), style: "cancel" },
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
            Alert.alert(t('account.error'), t('account.passwordMinLength'));
            return;
        }
        setIsSecurityLoading(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setIsSecurityLoading(false);
        if (error) {
            Alert.alert(t('account.error'), error.message);
        } else {
            Alert.alert(t('account.success'), t('account.passwordUpdated'));
            setNewPassword('');
        }
    };

    const handleUpdateEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            Alert.alert(t('account.error'), t('account.invalidEmail'));
            return;
        }
        setIsSecurityLoading(true);
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        setIsSecurityLoading(false);
        if (error) {
            Alert.alert(t('account.error'), error.message);
        } else {
            Alert.alert(t('account.verificationSent'), t('account.verificationSentMsg'));
            setNewEmail('');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="#007AFF" />
                    <Text style={styles.backButtonText}>{t('account.back')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('account.account')}</Text>
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
                                    <Text style={styles.accountStatus}>{user ? t('account.signedIn') : t('account.unregisteredAccount')}</Text>
                                </View>
                            </View>
                            
                            {!user ? (
                                <View style={styles.authForm}>
                                    <TouchableOpacity 
                                        style={[styles.authButton, { backgroundColor: '#007AFF', width: '100%' }]} 
                                        onPress={() => router.push('/auth')}
                                    >
                                        <Text style={[styles.authText, { color: '#FFF' }]}>{t('account.signInCreate')}</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.authDisclaimer}>Sign in to sync your goals, sprints, and history across all your devices.</Text>
                                </View>
                            ) : (
                                <View style={styles.authForm}>
                                    <Text style={styles.authEmailText}>{user.email}</Text>
                                    <View style={[styles.authButtons, { flexDirection: 'row', marginTop: 12 }]}>
                                        <TouchableOpacity 
                                            style={[styles.authButton, { backgroundColor: '#E2E8F0', flex: 1, opacity: isSyncing ? 0.5 : 1 }]} 
                                            disabled={isSyncing}
                                            onPress={async () => {
                                                setIsSyncing(true);
                                                try {
                                                    await flushSync();
                                                } catch (e) {
                                                    console.warn('[Account] Pre-switch sync failed:', e);
                                                }
                                                await supabase.auth.signOut();
                                                setIsSyncing(false);
                                                router.push('/auth');
                                            }}
                                        >
                                            <Text style={[styles.authText, { color: '#333' }]}>{isSyncing ? 'Saving...' : t('account.switch')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={[styles.authButton, { backgroundColor: '#EF4444', flex: 1, opacity: isSyncing ? 0.5 : 1 }]} 
                                            disabled={isSyncing}
                                            onPress={handleSignOut}
                                        >
                                            <Text style={[styles.authText, { color: '#FFF' }]}>{isSyncing ? 'Syncing...' : t('account.signOut')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </SettingsGroup>

                    {/* ACCOUNT SECURITY */}
                    {user && (
                        <SettingsGroup title="Account Security">
                            <View style={styles.securityItem}>
                                <Text style={styles.securityLabel}>{t('account.changePassword')}</Text>
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
                                <Text style={styles.securityLabel}>{t('account.updateEmail')}</Text>
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
                    
                    {/* DANGER ZONE */}
                    <SettingsGroup>
                        <TouchableOpacity style={styles.dangerRow} onPress={handleResetEverything}>
                            <Text style={styles.dangerText}>Delete All Local Data & Statistics</Text>
                        </TouchableOpacity>
                        
                        {user && (
                            <>
                                <View style={[styles.divider, { marginLeft: 0 }]} />
                                <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount}>
                                    <Text style={styles.dangerText}>{t('account.deleteCloudAccount')}</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </SettingsGroup>

                </ScrollView>
            </KeyboardAvoidingView>

            {isSyncing && (
                <View style={styles.syncOverlay}>
                    <View style={styles.syncModal}>
                        <Ionicons name="cloud-upload" size={32} color="#007AFF" />
                        <Text style={styles.syncText}>{t('account.savingToCloud')}</Text>
                    </View>
                </View>
            )}
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
        paddingTop: 16,
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
    authForm: {
        marginTop: 8,
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
    divider: {
        height: 1,
        backgroundColor: '#E5E5EA',
        marginLeft: 54,
    },
    dividerIndent: {
        height: 1,
        backgroundColor: '#E5E5EA',
        marginLeft: 16,
    },
    rowDisabled: {
        opacity: 0.5,
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
    }
});
