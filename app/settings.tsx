import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StorageService, ColorDefinition, SprintSettings } from '../src/services/storage';
import ColorSettingsModal from '../src/components/ColorSettingsModal';

export default function SettingsScreen() {
    const router = useRouter();
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);
    const [userColors, setUserColors] = useState<ColorDefinition[]>([]);
    const [sprintSettings, setSprintSettings] = useState<SprintSettings>({ showTimer: true, allowPause: true });

    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            const colors = await StorageService.loadUserColors();
            const sprint = await StorageService.loadSprintSettings();
            if (mounted) {
                setUserColors(colors);
                setSprintSettings(sprint);
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

            <ScrollView style={styles.content}>

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
                                value={sprintSettings.autoBreakWorkTime?.toString() || '25'}
                                onChangeText={(text) => handleUpdateSprintSetting('autoBreakWorkTime', parseInt(text) || 25)}
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
                                value={sprintSettings.autoBreakDuration?.toString() || '5'}
                                onChangeText={(text) => handleUpdateSprintSetting('autoBreakDuration', parseInt(text) || 5)}
                                maxLength={3}
                            />
                        </View>
                    </>
                )}

                <View style={styles.divider} />

                <Text style={styles.sectionHeader}>General</Text>

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
                <Text style={styles.versionText}>Version 1.1.0</Text>

            </ScrollView>

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
    }
});
