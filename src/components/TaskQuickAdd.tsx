import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RecurrenceRule } from '../features/tasks/types';

interface TaskQuickAddProps {
    visible: boolean;
    isSubtask: boolean;
    title: string;
    onChangeTitle: (text: string) => void;
    onSave: () => void;
    onCancel: () => void;

    // Feature Triggers
    onOpenCalendar: () => void;
    onOpenDuration: () => void;
    onOpenRecurrence: () => void;
    onOpenReminder: () => void;
    onOpenProperties: () => void;

    // Active Values
    deadline: string | null;
    onClearDeadline: () => void;

    estimatedTime: string | null;
    onClearEstimatedTime: () => void;

    recurrence: RecurrenceRule | null;
    onClearRecurrence: () => void;
}

export const TaskQuickAdd: React.FC<TaskQuickAddProps> = ({
    visible,
    isSubtask,
    title,
    onChangeTitle,
    onSave,
    onCancel,
    onOpenCalendar,
    onOpenDuration,
    onOpenRecurrence,
    onOpenReminder,
    onOpenProperties,
    deadline,
    onClearDeadline,
    estimatedTime,
    onClearEstimatedTime,
    recurrence,
    onClearRecurrence
}) => {
    const inputRef = useRef<TextInput>(null);

    // Auto-focus when becoming visible
    useEffect(() => {
        if (visible) {
            // Small delay to ensure layout is ready
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <>
            <TouchableOpacity
                style={styles.backdropLayer}
                activeOpacity={1}
                onPress={onCancel}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.fixedInputContainer}
                pointerEvents="box-none"
            >
                <View style={styles.addTaskContainer}>
                    <View style={styles.addTaskInputWrapper}>
                        <TextInput
                            ref={inputRef}
                            style={styles.addTaskInput}
                            placeholder={isSubtask ? "Add a subtask..." : "Write something..."}
                            placeholderTextColor="#999"
                            value={title}
                            onChangeText={onChangeTitle}
                            autoFocus
                            onSubmitEditing={onSave}
                        />
                        <TouchableOpacity onPress={onSave} style={styles.tactileButton}>
                            <Text style={styles.tactileButtonText}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.addToolbar}>
                        <TouchableOpacity onPress={onOpenCalendar} style={styles.toolbarIconBtn}>
                            <Text style={styles.toolbarEmoji}>📅</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onOpenDuration} style={styles.toolbarIconBtn}>
                            <Text style={styles.toolbarEmoji}>⏱</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.toolbarIconBtn} onPress={onOpenReminder}>
                            <Text style={styles.toolbarEmoji}>⏰</Text>
                        </TouchableOpacity>

                        {!isSubtask && (
                            <TouchableOpacity style={styles.toolbarIconBtn} onPress={onOpenRecurrence}>
                                <Text style={styles.toolbarEmoji}>🔁</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.toolbarIconBtn} onPress={onOpenProperties}>
                            <Text style={styles.toolbarEmoji}>🏷️</Text>
                        </TouchableOpacity>

                        {deadline && (
                            <TouchableOpacity onPress={onClearDeadline} style={styles.miniChip}>
                                <Text style={styles.miniChipText}>{deadline}</Text>
                            </TouchableOpacity>
                        )}
                        {estimatedTime && (
                            <TouchableOpacity onPress={onClearEstimatedTime} style={styles.miniChip}>
                                <Text style={styles.miniChipText}>{estimatedTime}</Text>
                            </TouchableOpacity>
                        )}
                        {recurrence && (
                            <TouchableOpacity onPress={onClearRecurrence} style={styles.miniChip}>
                                <Text style={styles.miniChipText}>
                                    {recurrence.frequency === 'weekly' && recurrence.daysOfWeek
                                        ? 'Custom W'
                                        : recurrence.frequency.charAt(0).toUpperCase() + recurrence.frequency.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={{ flex: 1 }} />

                        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                            <Text style={styles.cancelAddText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </>
    );
};

const styles = StyleSheet.create({
    backdropLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 998,
    },
    fixedInputContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        justifyContent: 'flex-end',
    },
    addTaskContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    addTaskInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    addTaskInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        minHeight: 24,
        padding: 0,
    },
    tactileButton: {
        backgroundColor: '#333',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginLeft: 8,
    },
    tactileButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    addToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    toolbarIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolbarEmoji: {
        fontSize: 16,
    },
    miniChip: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 4,
    },
    miniChipText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '500',
    },
    cancelBtn: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
    },
    cancelAddText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
