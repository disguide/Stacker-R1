import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { styles } from '../styles/taskListStyles';
import { VIEW_CONFIG, ViewMode } from '../constants/theme';
import SettingsButton from './SettingsButton';
import ProfileButton from './ProfileButton';

interface TaskListHeaderProps {
    userAvatar?: string;
    offset: number;
    onOffsetChange: (newOffset: number) => void;
    viewMode: ViewMode;
    isSprintSelectionMode: boolean;
    onToggleSprint: () => void;
    showViewPicker: boolean;
    setShowViewPicker: (show: boolean) => void;
}

export const TaskListHeader: React.FC<TaskListHeaderProps> = ({
    userAvatar,
    offset,
    onOffsetChange,
    viewMode,
    isSprintSelectionMode,
    onToggleSprint,
    showViewPicker,
    setShowViewPicker
}) => {
    const router = useRouter();

    return (
        <View>
            <View style={[styles.header, isSprintSelectionMode && styles.sprintHeader]}>
                <ProfileButton avatarUri={userAvatar} />

                <View style={styles.toolbar}>
                    <TouchableOpacity
                        style={styles.todayButton}
                        onPress={() => onOffsetChange(0)}
                    >
                        <Text style={styles.todayButtonText}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => {/* Friends Logic */ }}
                    >
                        <Ionicons name="people-outline" size={24} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => router.push('/mail')}
                    >
                        <Ionicons name="mail-outline" size={24} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => router.push('/long-term')}
                    >
                        <Ionicons name="telescope-outline" size={24} color="#333" />
                    </TouchableOpacity>
                </View>

                <View style={styles.spacer} />
                <SettingsButton />
            </View>

            {/* View Navigation Row */}
            <View style={styles.viewNavRow}>
                <TouchableOpacity
                    style={[styles.arrowButton, offset === 0 && styles.arrowButtonDisabled]}
                    onPress={() => offset > 0 && onOffsetChange(offset - 1)}
                    disabled={offset === 0}
                >
                    <Ionicons name="chevron-back" size={24} color={offset === 0 ? '#CCC' : '#333'} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.viewLabelButton}
                    onPress={() => setShowViewPicker(true)}
                >
                    <Text style={styles.viewLabel}>{VIEW_CONFIG[viewMode].label}</Text>
                    <Ionicons name="chevron-down" size={16} color="#666" style={{ marginTop: 2 }} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.arrowButton}
                    onPress={() => onOffsetChange(offset + 1)}
                >
                    <Ionicons name="chevron-forward" size={24} color="#333" />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    style={[
                        styles.sprintHeaderButton,
                        isSprintSelectionMode && styles.sprintHeaderButtonActive
                    ]}
                    onPress={onToggleSprint}
                >
                    <Text style={[
                        styles.sprintHeaderButtonText,
                        isSprintSelectionMode && styles.sprintHeaderButtonTextActive
                    ]}>
                        {isSprintSelectionMode ? "Cancel" : "Sprint"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};
