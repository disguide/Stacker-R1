import { useState } from 'react';
import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
    Platform
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Theme Constants
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    border: '#333333',
    surface: '#FFFDF5',
    shadowColor: '#333333',
};

export interface TaskMenuProps {
    visible: boolean;
    onClose: () => void;
    onAddSubtask: () => void;
    onDelete: () => void;
    isSubtask?: boolean;
    onEdit: () => void;
    onMoveToDate?: () => void;
    enableSubtasks?: boolean;
}

export default function TaskMenu({ visible, onClose, onAddSubtask, onDelete, isSubtask = false, onEdit, onMoveToDate, enableSubtasks = true }: TaskMenuProps) {
    const [panY] = useState(() => new Animated.Value(SCREEN_HEIGHT));

    useEffect(() => {
        if (visible) {
            Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 0,
            }).start();
        } else {
            Animated.timing(panY, {
                toValue: SCREEN_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <Animated.View style={[styles.menu, { transform: [{ translateY: panY }] }]}>
                            {/* Handle */}
                            <View style={styles.handleContainer}>
                                <View style={styles.handle} />
                            </View>

                            {/* Options */}
                            {!isSubtask && enableSubtasks && (
                                <>
                                    <TouchableOpacity
                                        style={styles.option}
                                        onPress={() => {
                                            onClose();
                                            setTimeout(onAddSubtask, 300);
                                        }}
                                    >
                                        <View style={styles.optionIconContainer}>
                                            <MaterialCommunityIcons name="subdirectory-arrow-right" size={22} color={THEME.textPrimary} />
                                        </View>
                                        <Text style={styles.optionText}>Add Subtask</Text>
                                    </TouchableOpacity>

                                    <View style={styles.separator} />
                                </>
                            )}

                            <TouchableOpacity
                                style={styles.option}
                                onPress={() => {
                                    onClose();
                                    setTimeout(onEdit, 300);
                                }}
                            >
                                <View style={styles.optionIconContainer}>
                                    <MaterialCommunityIcons name="pencil-outline" size={22} color={THEME.textPrimary} />
                                </View>
                                <Text style={styles.optionText}>Edit</Text>
                            </TouchableOpacity>

                            <View style={styles.separator} />

                            {/* Move to Date - Only for parent tasks */}
                            {!isSubtask && onMoveToDate && (
                                <>
                                    <TouchableOpacity
                                        style={styles.option}
                                        onPress={() => {
                                            onClose();
                                            setTimeout(onMoveToDate, 300);
                                        }}
                                    >
                                        <View style={styles.optionIconContainer}>
                                            <MaterialCommunityIcons name="calendar-arrow-right" size={22} color={THEME.textPrimary} />
                                        </View>
                                        <Text style={styles.optionText}>Move to Date</Text>
                                    </TouchableOpacity>

                                    <View style={styles.separator} />
                                </>
                            )}

                            <TouchableOpacity
                                style={styles.option}
                                onPress={() => {
                                    onClose();
                                    setTimeout(onDelete, 300);
                                }}
                            >
                                <View style={styles.optionIconContainer}>
                                    <Ionicons name="trash-outline" size={22} color="#C53030" />
                                </View>
                                <Text style={[styles.optionText, styles.deleteText]}>{isSubtask ? 'Delete Subtask' : 'Delete Task'}</Text>
                            </TouchableOpacity>

                            {/* Bottom Safety Spacer */}
                            <View style={{ height: 20 }} />
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(51, 51, 51, 0.4)',
    },
    menu: {
        backgroundColor: THEME.bg,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: 2,
        borderTopColor: THEME.border,
        paddingHorizontal: 20,
        paddingBottom: 20,
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 16,
        marginBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#999',
        borderRadius: 2,
        opacity: 0.3,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
    },
    optionIconContainer: {
        width: 24,
        alignItems: 'center',
        marginRight: 16,
    },
    optionIcon: {
        fontSize: 20,
        marginRight: 16,
        width: 24,
        textAlign: 'center',
        color: THEME.textPrimary,
    },
    optionText: {
        fontSize: 18,
        color: THEME.textPrimary,
        fontWeight: 'bold',
        // fontFamily removed for system default
    },
    separator: {
        height: 1,
        backgroundColor: '#E2E8F0',
        width: '100%',
    },
    deleteText: {
        color: '#C53030',
    },
});
