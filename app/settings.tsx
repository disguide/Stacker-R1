import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { TagDefinition, StorageService } from '../src/services/storage';
import TagSettingsModal from '../src/components/TagSettingsModal';

export default function SettingsScreen() {
    const router = useRouter();
    const [isTagsModalVisible, setIsTagsModalVisible] = useState(false);
    const [tags, setTags] = useState<TagDefinition[]>([]);

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        const t = await StorageService.loadTags();
        setTags(t);
    };

    const handleSaveTags = async (updatedTags: TagDefinition[]) => {
        setTags(updatedTags);
        await StorageService.saveTags(updatedTags);
        // Modal closes automatically, or we rely on onClose prop which calls this?
        // TagSettingsModal behavior: HandleClose helper calls onSaveTags then onClose.
        // We should ensure tags are reloaded in main app on return (via useFocusEffect there).
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
                <Text style={styles.sectionHeader}>General</Text>

                {/* Manage Tags Button */}
                <TouchableOpacity style={styles.menuItem} onPress={() => setIsTagsModalVisible(true)}>
                    <View style={styles.menuItemLeft}>
                        <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
                            <Ionicons name="pricetags-outline" size={20} color="#333" />
                        </View>
                        <Text style={styles.menuItemText}>Manage Tags</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#CCC" />
                </TouchableOpacity>

                {/* Placeholder for other settings */}
                <View style={styles.divider} />
                <Text style={styles.versionText}>Version 1.0.0</Text>

            </ScrollView>

            <TagSettingsModal
                visible={isTagsModalVisible}
                onClose={() => setIsTagsModalVisible(false)}
                tags={tags}
                onSaveTags={handleSaveTags}
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
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 16,
        textTransform: 'uppercase'
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
    divider: {
        height: 30,
    },
    versionText: {
        textAlign: 'center',
        color: '#999',
        fontSize: 12,
        marginBottom: 20
    }
});
