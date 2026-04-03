import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StorageService, ColorDefinition, SprintSettings } from '../src/services/storage';
import ColorSettingsModal from '../src/components/ColorSettingsModal';

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);
    const [userColors, setUserColors] = useState<ColorDefinition[]>([]);
    const [sprintSettings, setSprintSettings] = useState<SprintSettings>({ showTimer: true, allowPause: true });
    
    // Local string state to allow "empty" inputs while typing
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
        if (text === '') return; // Allow deletion
        const num = parseInt(text);
        if (!isNaN(num)) {
            // Even if 0, we update but the logic in sprint.tsx will skip processing it
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

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with Back Button */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Text style={styles.backButtonText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.placeholder} />
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

                <Text style={styles.sectionHeader}>Sprint Configuration</Text>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Show Timer</Text>
                        <Text style={styles.settingSubLabel}>Display elapsed time during sprint</Text>
                    </View>
                    <Switch
                        value={sprintSettings.showTimer}
                        onValueChange={() => handleToggleSprintSetting('showTimer')}
                        trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                    />
                </View>

                <View style={[styles.settingRow, { borderBottomWidth: 1 }]}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Allow Pause</Text>
                        <Text style={styles.settingSubLabel}>Enable pausing sprints mid-session</Text>
                    </View>
                    <Switch
                        value={sprintSettings.allowPause}
                        onValueChange={() => handleToggleSprintSetting('allowPause')}
                        trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                    />
                </View>

                {/* Automatic Break Settings */}
                <View style={[styles.settingRow, { borderBottomWidth: sprintSettings.autoBreakMode ? 1 : 0 }]}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Automatic Breaks</Text>
                        <Text style={styles.settingSubLabel}>Automatically trigger breaks after a set work duration</Text>
                    </View>
                    <Switch
                        value={!!sprintSettings.autoBreakMode}
                        onValueChange={() => handleToggleSprintSetting('autoBreakMode')}
                        trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                    />
                </View>

                {sprintSettings.autoBreakMode && (
                    <>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Work Duration (min)</Text>
                            </View>
                            <TextInput
                                style={styles.timeInput}
                                keyboardType="number-pad"
                                value={workTimeStr}
                                onChangeText={(text) => handleTextUpdate('autoBreakWorkTime', text, setWorkTimeStr)}
                                maxLength={3}
                            />
                        </View>
                        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Break Duration (min)</Text>
                            </View>
                            <TextInput
                                style={styles.timeInput}
                                keyboardType="number-pad"
                                value={breakTimeStr}
                                onChangeText={(text) => handleTextUpdate('autoBreakDuration', text, setBreakTimeStr)}
                                maxLength={3}
                            />
                        </View>
                    </>
                )}

                <View style={styles.divider} />
                
                <Text style={styles.sectionHeader}>Sprint Goal</Text>
                
                <View style={[styles.settingRow, { borderBottomWidth: sprintSettings.maxDurationEnabled ? 1 : 0 }]}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Automatic Sprint End</Text>
                        <Text style={styles.settingSubLabel}>Automatically finish the sprint when time is up</Text>
                    </View>
                    <Switch
                        value={!!sprintSettings.maxDurationEnabled}
                        onValueChange={() => handleToggleSprintSetting('maxDurationEnabled')}
                        trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                    />
                </View>

                {sprintSettings.maxDurationEnabled && (
                    <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Max Duration (min)</Text>
                        </View>
                        <TextInput
                            style={styles.timeInput}
                            keyboardType="number-pad"
                            value={maxTimeStr}
                            onChangeText={(text) => handleTextUpdate('maxDurationMinutes', text, setMaxTimeStr)}
                            maxLength={3}
                        />
                    </View>
                )}

                <View style={styles.divider} />
                
                <Text style={styles.sectionHeader}>Time Preference</Text>
                
                <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>24-Hour Time Format</Text>
                        <Text style={styles.settingSubLabel}>Use 24-hour clock (e.g. 14:00) instead of AM/PM</Text>
                    </View>
                    <Switch
                        value={!!sprintSettings.use24HourFormat}
                        onValueChange={() => handleToggleSprintSetting('use24HourFormat')}
                        trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                    />
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionHeader}>Tags & Categories</Text>

                {/* Manage Color Meanings Button */}
                <TouchableOpacity style={styles.menuItem} onPress={() => setIsColorModalVisible(true)}>
                    <View style={styles.menuItemLeft}>
                        <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
                            <Ionicons name="color-palette-outline" size={20} color="#333" />
                        </View>
                        <View>
                            <Text style={styles.menuItemText}>Color Meanings</Text>
                            <Text style={styles.menuItemSubText}>Assign text to colors (e.g. Red = School)</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#CCC" />
                </TouchableOpacity>

                {/* Placeholder for other settings */}
                <View style={styles.divider} />
                
                <View style={styles.resetSection}>
                    <Text style={styles.sectionHeaderRed}>DANGER ZONE</Text>
                    <TouchableOpacity style={styles.resetFullBtn} onPress={handleResetEverything}>
                        <Ionicons name="trash-bin-outline" size={20} color="#EF4444" />
                        <Text style={styles.resetFullText}>Reset All Data & Statistics</Text>
                    </TouchableOpacity>
                    <Text style={styles.resetSubtext}>
                        This action is permanent and will clear your entire profile, including all goals and history.
                    </Text>
                </View>

                <View style={styles.divider} />
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
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        paddingVertical: 4,
        paddingRight: 12,
    },
    backButtonText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000000',
    },
    placeholder: {
        width: 60,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120, // Extra space for keyboard and comfort
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 16,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    menuItemText: {
        fontSize: 16,
        color: '#333',
    },
    menuItemSubText: {
        fontSize: 12,
        color: '#999',
        marginTop: 2
    },
    divider: {
        height: 20,
    },
    versionText: {
        textAlign: 'center',
        color: '#999',
        fontSize: 12,
        marginBottom: 20
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    settingInfo: {
        flex: 1,
        marginRight: 16
    },
    settingLabel: {
        fontSize: 16,
        color: '#333',
        marginBottom: 2
    },
    settingSubLabel: {
        fontSize: 12,
        color: '#94A3B8'
    },
    timeInput: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        fontSize: 16,
        color: '#333',
        width: 60,
        textAlign: 'center',
    },
    // Reset Styles
    resetSection: {
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 24,
    },
    sectionHeaderRed: {
        fontSize: 12,
        fontWeight: '900',
        color: '#EF4444',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    resetFullBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    resetFullText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#EF4444',
    },
    resetSubtext: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 10,
        fontWeight: '500',
        lineHeight: 18,
    },
});
