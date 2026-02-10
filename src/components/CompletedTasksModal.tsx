import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    Platform,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Theme Constants
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    border: '#333333',
    surface: '#FFFDF5',
    shadowColor: '#333333',
};

interface Task {
    id: string;
    title: string;
    completed?: boolean;
    date: string;
}

interface CompletedTasksModalProps {
    visible: boolean;
    onClose: () => void;
    tasks: Task[];
    onRestore: (taskId: string) => void;
    onDelete: (taskId: string) => void;
}

export default function CompletedTasksModal({ visible, onClose, tasks, onRestore, onDelete }: CompletedTasksModalProps) {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Completed History</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeText}>Done</Text>
                    </TouchableOpacity>
                </View>

                {/* List */}
                <FlatList
                    data={tasks}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="documents-outline" size={48} color="#CCC" />
                            <Text style={styles.emptyText}>No completed tasks yet.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={styles.taskItem}>
                            <View style={styles.taskInfo}>
                                <Text style={styles.taskTitle}>{item.title}</Text>
                                <Text style={styles.taskDate}>Finished on {item.date}</Text>
                            </View>

                            <View style={styles.actions}>
                                <TouchableOpacity onPress={() => onRestore(item.id)} style={styles.iconBtn}>
                                    <Ionicons name="refresh" size={20} color={THEME.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.iconBtn}>
                                    <Ionicons name="trash-outline" size={20} color="#C53030" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 2,
        borderBottomColor: THEME.border,
        backgroundColor: THEME.surface,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        // fontFamily removed for system default
    },
    closeButton: {
        padding: 8,
    },
    closeText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    listContent: {
        padding: 20,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        opacity: 0.6,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        color: THEME.textSecondary,
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.surface,
        padding: 16,
        marginBottom: 12,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        // Shadow
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    taskInfo: {
        flex: 1,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: THEME.textPrimary,
        textDecorationLine: 'line-through',
        opacity: 0.7,
        marginBottom: 4,
    },
    taskDate: {
        fontSize: 12,
        color: THEME.textSecondary,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    iconBtn: {
        padding: 8,
    },
});
