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

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Theme Constants
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    border: '#333333',
    surface: '#FFFDF5',
    shadowColor: '#333333',
};

interface TaskMenuProps {
    visible: boolean;
    onClose: () => void;
    onAddSubtask: () => void;
    onDelete: () => void;
    isSubtask?: boolean;
}

export default function TaskMenu({ visible, onClose, onAddSubtask, onDelete, isSubtask = false }: TaskMenuProps) {
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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
                            {!isSubtask && (
                                <>
                                    <TouchableOpacity
                                        style={styles.option}
                                        onPress={() => {
                                            onClose();
                                            setTimeout(onAddSubtask, 300);
                                        }}
                                    >
                                        <Text style={styles.optionIcon}>↳</Text>
                                        <Text style={styles.optionText}>Add Subtask</Text>
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
                                <Text style={[styles.optionIcon, styles.deleteText]}>🗑️</Text>
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
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
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
