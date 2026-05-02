import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/services/supabase';
import { StorageService } from '../src/services/storage';
import { migrateGuestToCloud } from '../src/services/SyncService';
import { useAuth } from '../src/providers/AuthProvider';

export default function AuthScreen() {
    const router = useRouter();
    const { user, authEvent } = useAuth();
    const [emailFlow, setEmailFlow] = useState(false);
    const [recoveryMode, setRecoveryMode] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // Detect if we opened from a recovery link
    React.useEffect(() => {
        if (authEvent === 'PASSWORD_RECOVERY') {
            setEmailFlow(true);
            setRecoveryMode(true);
        }
    }, [authEvent]);

    const markAuthSeenAndProceed = async () => {
        try {
            const state = await StorageService.loadUIState() || {};
            await StorageService.saveUIState({ ...state, hasSeenAuth: true });
        } catch {
            // ignore
        }
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    const handleEmailAuth = async (isSignUp: boolean) => {
        if (!authEmail || (!recoveryMode && !authPassword)) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }
        setAuthLoading(true);

        if (recoveryMode) {
            // Handle password update after recovery
            const { error } = await supabase.auth.updateUser({ password: authPassword });
            setAuthLoading(false);
            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert('Success', 'Password updated successfully!', [
                    { text: 'OK', onPress: () => {
                        setRecoveryMode(false);
                        markAuthSeenAndProceed();
                    }}
                ]);
            }
            return;
        }

        const { error } = isSignUp 
            ? await supabase.auth.signUp({ email: authEmail, password: authPassword })
            : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
            
        setAuthLoading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            if (isSignUp) {
                Alert.alert('Success', 'Check your email for the confirmation link!', [
                    { text: 'OK', onPress: markAuthSeenAndProceed }
                ]);
            } else {
                markAuthSeenAndProceed();
            }
        }
    };

    const handleForgotPassword = async () => {
        if (!authEmail) {
            Alert.alert('Error', 'Please enter your email address first.');
            return;
        }
        setAuthLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
            redirectTo: 'stacker://auth'
        });
        setAuthLoading(true);
        setAuthLoading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Success', 'Reset link sent! Check your inbox.');
        }
    };

    const renderEmailFlow = () => (
        <View style={styles.formContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setEmailFlow(false)}>
                <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>{recoveryMode ? 'Reset Password' : 'Sign In with Email'}</Text>
            <Text style={styles.subtitle}>
                {recoveryMode 
                    ? 'Enter a new password for your account.' 
                    : 'Enter your email and password to continue.'}
            </Text>

            <TextInput 
                style={styles.input} 
                placeholder="Email Address" 
                value={authEmail} 
                onChangeText={setAuthEmail} 
                autoCapitalize="none" 
                keyboardType="email-address" 
            />
            <TextInput 
                style={styles.input} 
                placeholder={recoveryMode ? "New Password" : "Password"} 
                value={authPassword} 
                onChangeText={setAuthPassword} 
                secureTextEntry 
            />

            {!recoveryMode && (
                <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordButton}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
            )}
            
            <View style={styles.actionButtons}>
                <TouchableOpacity 
                    style={[styles.primaryButton, authLoading && styles.buttonDisabled]} 
                    onPress={() => handleEmailAuth(false)}
                    disabled={authLoading}
                >
                    {authLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>{recoveryMode ? 'Save Password' : 'Sign In'}</Text>}
                </TouchableOpacity>

                {!recoveryMode && (
                    <TouchableOpacity 
                        style={[styles.secondaryButton, authLoading && styles.buttonDisabled]} 
                        onPress={() => handleEmailAuth(true)}
                        disabled={authLoading}
                    >
                        {authLoading ? <ActivityIndicator color="#007AFF" /> : <Text style={styles.secondaryButtonText}>Create Account</Text>}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderMainFlow = () => (
        <View style={styles.formContainer}>
            <View style={styles.heroSection}>
                <View style={styles.logoPlaceholder}>
                     <Ionicons name="layers" size={48} color="#000" />
                </View>
                <Text style={styles.brandTitle}>Stacker</Text>
                <Text style={styles.subtitle}>Supercharge your productivity.</Text>
            </View>

            <View style={styles.optionsBlock}>
                <TouchableOpacity 
                    style={[styles.optionButton, styles.shadowSm, { backgroundColor: '#000' }]} 
                    onPress={() => Alert.alert('Coming Soon', 'Sign in with Apple will be available in the next update.')}
                >
                    <Ionicons name="logo-apple" size={22} color="#FFF" style={styles.optionIcon} />
                    <Text style={[styles.optionText, { color: '#FFF' }]}>Continue with Apple</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.optionButton, styles.shadowSm, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F0F0F0' }]} 
                    onPress={() => Alert.alert('Coming Soon', 'Sign in with Google will be available in the next update.')}
                >
                    <Ionicons name="logo-google" size={22} color="#333" style={styles.optionIcon} />
                    <Text style={[styles.optionText, { color: '#333' }]}>Continue with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.optionButton, styles.shadowSm, { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6' }]} 
                    onPress={() => setEmailFlow(true)}
                >
                    <Ionicons name="mail-outline" size={22} color="#333" style={styles.optionIcon} />
                    <Text style={[styles.optionText, { color: '#333' }]}>Continue with Email</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.guestSeparator}>
                <View style={[styles.line, { backgroundColor: '#F3F4F6' }]} />
                <Text style={styles.orText}>OR</Text>
                <View style={[styles.line, { backgroundColor: '#F3F4F6' }]} />
            </View>

            <TouchableOpacity style={styles.guestButton} onPress={markAuthSeenAndProceed}>
                <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </TouchableOpacity>
            
            <Text style={styles.disclaimerText}>
                No account required to use the core features.
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.keyboardView}
            >
                {emailFlow ? renderEmailFlow() : renderMainFlow()}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FCFCFC',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    formContainer: {
        width: '100%',
        alignItems: 'center',
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 48,
        marginTop: -40,
    },
    logoPlaceholder: {
        width: 80,
        height: 80,
        backgroundColor: '#FFF',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 2,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 24,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandTitle: {
        fontSize: 38,
        fontWeight: '900',
        letterSpacing: -1,
        marginBottom: 8,
        color: '#000',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -0.5,
        marginBottom: 10,
        color: '#000',
        alignSelf: 'flex-start',
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
    },
    optionsBlock: {
        width: '100%',
        gap: 14,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        height: 56,
    },
    shadowSm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 1,
    },
    optionIcon: {
        marginRight: 10,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
    },
    guestSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginVertical: 28,
    },
    line: {
        flex: 1,
        height: 1,
    },
    orText: {
        paddingHorizontal: 16,
        color: '#D1D5DB',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 1,
    },
    guestButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        backgroundColor: '#F9FAFB',
        borderRadius: 100,
    },
    guestButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
    disclaimerText: {
        marginTop: 32,
        fontSize: 13,
        color: '#9CA3AF',
        textAlign: 'center',
    },
    input: {
        width: '100%',
        height: 56,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        borderRadius: 14,
        paddingHorizontal: 18,
        fontSize: 16,
        marginBottom: 16,
        color: '#000',
    },
    actionButtons: {
        width: '100%',
        gap: 14,
        marginTop: 16,
    },
    primaryButton: {
        backgroundColor: '#000',
        height: 56,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        backgroundColor: '#FFF',
        height: 56,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginTop: -8,
        marginBottom: 24,
        paddingHorizontal: 4,
    },
    forgotPasswordText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    }
});
