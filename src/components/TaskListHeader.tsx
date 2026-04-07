import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { styles } from '../styles/taskListStyles';
import { VIEW_CONFIG, ViewMode } from '../constants/theme';
import { useMail } from '../features/mail/useMail';
import SettingsButton from './SettingsButton';
import ProfileButton from './ProfileButton';

interface TaskListHeaderProps {
    userAvatar?: string;
    offset: number;
    onOffsetChange: (newOffset: number) => void;
    viewMode: ViewMode;
    isSprintSelectionMode: boolean;
    onToggleSprint: () => void;
    showViewPicker: boolean; // Keeping for rotating arrow state or backwards compatibility temporarily
    onViewPress: (layout: { pageX: number; pageY: number; width: number; height: number }) => void;
    onOpenReminders: () => void;
    onOrganize: (layout: { pageX: number; pageY: number; width: number; height: number }) => void;
    isOrganizeMenuVisible: boolean;
}

export const TaskListHeader: React.FC<TaskListHeaderProps> = ({
    userAvatar,
    offset,
    onOffsetChange,
    viewMode,
    isSprintSelectionMode,
    onToggleSprint,
    showViewPicker,
    onViewPress,
    onOpenReminders,
    onOrganize,
    isOrganizeMenuVisible
}) => {
    const insets = useSafeAreaInsets();
    const rotateAnim = React.useRef(new Animated.Value(0)).current;

    const viewRotateAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.spring(rotateAnim, {
            toValue: isOrganizeMenuVisible ? 1 : 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40
        }).start();

        Animated.spring(viewRotateAnim, {
            toValue: showViewPicker ? 1 : 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40
        }).start();
    }, [isOrganizeMenuVisible, showViewPicker]);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg']
    });

    const viewRotation = viewRotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg']
    });

    const router = useRouter();
    const { unreadCount } = useMail();
    const organizeBtnRef = useRef<View>(null);
    const viewBtnRef = useRef<View>(null);

    const handleOrganizePress = () => {
        organizeBtnRef.current?.measure((x, y, width, height, pageX, pageY) => {
            onOrganize({ pageX, pageY, width, height });
        });
    };

    const handleViewPress = () => {
        viewBtnRef.current?.measure((x, y, width, height, pageX, pageY) => {
            onViewPress({ pageX, pageY, width, height });
        });
    };

    return (
        <View>
            <View style={[styles.header, isSprintSelectionMode && styles.sprintHeader]}>
                <ProfileButton avatarUri={userAvatar} />

                <View style={styles.toolbar}>

                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => router.push('/friends')}
                    >
                        <Ionicons name="people-outline" size={26} color="#333" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => router.push('/journal')}
                    >
                        <Ionicons name="book-outline" size={26} color="#333" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => router.push('/mail')}
                    >
                        <View>
                            <Ionicons name="mail-outline" size={26} color="#333" />
                            {unreadCount > 0 && (
                                <View style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -8,
                                    backgroundColor: '#007AFF', // Stacker Blue
                                    borderRadius: 10,
                                    minWidth: 18,
                                    height: 18,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    paddingHorizontal: 4,
                                    borderWidth: 1.5,
                                    borderColor: '#FFF',
                                    zIndex: 10
                                }}>
                                    <Text style={{
                                        color: '#FFF',
                                        fontSize: 10,
                                        fontWeight: '800',
                                        textAlign: 'center',
                                        lineHeight: 14,
                                    }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => router.push('/long-term')}
                    >
                        <Ionicons name="telescope-outline" size={26} color="#333" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={onOpenReminders}
                    >
                        <Ionicons name="notifications-outline" size={26} color="#333" />
                    </TouchableOpacity>
                </View>


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
                    ref={viewBtnRef as any}
                    style={styles.viewLabelButton}
                    onPress={handleViewPress}
                >
                    <Text style={styles.viewLabel}>{VIEW_CONFIG[viewMode].label}</Text>
                    <Animated.View style={{ transform: [{ rotate: viewRotation }] }}>
                        <Ionicons name="chevron-down" size={16} color="#666" style={{ marginTop: 2 }} />
                    </Animated.View>
                </TouchableOpacity>


                <TouchableOpacity
                    style={styles.arrowButton}
                    onPress={() => onOffsetChange(offset + 1)}
                >
                    <Ionicons name="chevron-forward" size={24} color="#333" />
                </TouchableOpacity>


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

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    ref={organizeBtnRef as any}
                    style={styles.toolbarButton}
                    onPress={handleOrganizePress}
                >
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <MaterialCommunityIcons name="sort-variant" size={24} color="#333" />
                    </Animated.View>
                </TouchableOpacity>
            </View>
        </View>
    );
};
