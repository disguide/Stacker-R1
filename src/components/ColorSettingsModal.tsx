import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, LayoutAnimation, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorDefinition, TASK_COLORS, StorageService } from '../services/storage';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ColorSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    userColors: ColorDefinition[];
    onSave: (colors: ColorDefinition[]) => void;
}

export default function ColorSettingsModal({ visible, onClose, userColors, onSave }: ColorSettingsModalProps) {
    const [colors, setColors] = useState<ColorDefinition[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [newColorHex, setNewColorHex] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (visible) {
            // Safeguard against undefined userColors
            let safeColors = Array.isArray(userColors) ? userColors : [];

            // If empty, force defaults to ensure UI is never empty
            if (safeColors.length === 0) {
                safeColors = StorageService.getDefaultUserColors();
                // Optionally save these immediately to fix parent state? 
                // Better to just let user view them, and save on "Close" or "Edit".
            }

            setColors(JSON.parse(JSON.stringify(safeColors))); // Deep copy
            setIsEditing(false);
            setIsAdding(false);
            setNewColorHex('');
        }
    }, [visible, userColors]);

    const persistChanges = (newColors: ColorDefinition[]) => {
        setColors(newColors);
        onSave(newColors);
    };

    const handleLabelChange = (id: string, text: string) => {
        setColors(prev => prev.map(c => c.id === id ? { ...c, label: text } : c));
    };

    const handleLabelSubmit = () => {
        if (colors.length === 0) return;
        onSave(colors);
    };

    const handleAddColor = () => {
        if (!newColorHex) return;
        const hex = newColorHex.startsWith('#') ? newColorHex : `#${newColorHex}`;

        // Simple Hex Validation
        if (!/^#[0-9A-F]{6}$/i.test(hex)) {
            Alert.alert('Invalid Color', 'Please enter a valid Hex code (e.g., #FF5500)');
            return;
        }

        const newColor: ColorDefinition = {
            id: `custom_${Date.now()}`,
            color: hex,
            label: ''
        };

        const newColors = [...colors, newColor];
        persistChanges(newColors);
        setNewColorHex('');
        setIsAdding(false);
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Color', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    const newColors = colors.filter(c => c.id !== id);
                    persistChanges(newColors);
                }
            }
        ]);
    };

    const moveColor = (index: number, direction: 'up' | 'down') => {
        const newColors = [...colors];
        if (direction === 'up' && index > 0) {
            [newColors[index], newColors[index - 1]] = [newColors[index - 1], newColors[index]];
        } else if (direction === 'down' && index < newColors.length - 1) {
            [newColors[index], newColors[index + 1]] = [newColors[index + 1], newColors[index]];
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        persistChanges(newColors);
    };

    const handleSave = () => {
        // Prevent saving empty list (which would wipe storage)
        // We know we should always have at least the defaults.
        if (colors.length === 0) {
            onClose();
            return;
        }
        onSave(colors);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => {
                            if (colors.length > 0) {
                                onSave(colors);
                            }
                            onClose();
                        }} style={styles.closeBtn}>
                            <Text style={styles.headerBtnText}>Leave</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Color Meanings</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}
                    >
                        <View style={styles.toolbar}>
                            <Text style={styles.subtitle}>
                                Customize your color palette.
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => {
                                    Alert.alert('Reset Colors', 'Revert to the default 7 colors? This will remove custom colors.', [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Reset',
                                            style: 'destructive',
                                            onPress: () => {
                                                const defaults = StorageService.getDefaultUserColors();
                                                onSave(defaults); // Save immediately
                                                setColors(defaults);
                                            }
                                        }
                                    ]);
                                }} style={styles.editBtn}>
                                    <Text style={styles.editBtnText}>Reset</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editBtn}>
                                    <Text style={styles.editBtnText}>{isEditing ? 'Done' : 'Edit'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {colors.map((item, index) => (
                                <View key={item.id} style={styles.row}>
                                    {isEditing && (
                                        <View style={styles.reorderControls}>
                                            <TouchableOpacity onPress={() => moveColor(index, 'up')} disabled={index === 0}>
                                                <Ionicons name="chevron-up" size={20} color={index === 0 ? '#EEE' : '#666'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => moveColor(index, 'down')} disabled={index === colors.length - 1}>
                                                <Ionicons name="chevron-down" size={20} color={index === colors.length - 1 ? '#EEE' : '#666'} />
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <View style={[styles.colorCircle, { backgroundColor: item.color }]} />

                                    <TextInput
                                        style={styles.input}
                                        placeholder="Label (optional)"
                                        value={item.label}
                                        onChangeText={(text) => handleLabelChange(item.id, text)}
                                        onEndEditing={handleLabelSubmit} // Auto-save on return
                                        onBlur={handleLabelSubmit} // Auto-save on tap away
                                        placeholderTextColor="#999"
                                        editable={!isEditing} // Disable editing text while reordering
                                    />

                                    {isEditing && (
                                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {/* Add New Color Section */}
                            {!isEditing && (
                                <View style={styles.addSection}>
                                    {isAdding ? (
                                        <View style={styles.addRow}>
                                            <View style={styles.hexInputContainer}>
                                                <Text style={styles.hashText}>#</Text>
                                                <TextInput
                                                    style={styles.hexInput}
                                                    placeholder="FF5500"
                                                    value={newColorHex}
                                                    onChangeText={setNewColorHex}
                                                    maxLength={6}
                                                    autoCapitalize="characters"
                                                />
                                            </View>
                                            <TouchableOpacity onPress={handleAddColor} style={styles.confirmAddBtn}>
                                                <Text style={styles.confirmAddText}>Add</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.cancelAddBtn}>
                                                <Ionicons name="close" size={20} color="#666" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity onPress={() => setIsAdding(true)} style={styles.addButton}>
                                            <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
                                            <Text style={styles.addButtonText}>Add Custom Color</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View >
            </View >
        </Modal >
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        width: '100%',
        height: '90%',
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    closeBtn: { padding: 4 },
    headerBtnText: { fontSize: 16, color: '#666' },
    title: { fontSize: 18, fontWeight: '600' },
    saveText: { color: '#007AFF', fontWeight: '600', fontSize: 16 },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        marginBottom: 8,
    },
    subtitle: {
        color: '#64748B',
        fontSize: 14,
        flex: 1,
    },
    editBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
    },
    editBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
    },
    content: { flex: 1 },
    scrollContent: { padding: 20 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#FFF',
        padding: 8,
        borderRadius: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F8F8'
    },
    reorderControls: {
        flexDirection: 'column',
        marginRight: 8,
        alignItems: 'center',
        gap: 2
    },
    dragHandle: {
        padding: 8,
        marginRight: 4,
    },
    colorCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)'
    },
    input: {
        flex: 1,
        height: 40,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        color: '#333'
    },
    deleteBtn: {
        padding: 8,
        marginLeft: 8,
    },
    addSection: {
        marginTop: 10,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderStyle: 'dashed'
    },
    addButtonText: {
        marginLeft: 8,
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '500',
    },
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    hexInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginRight: 8,
        height: 44,
    },
    hashText: {
        fontSize: 16,
        color: '#999',
        marginRight: 4,
    },
    hexInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    confirmAddBtn: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        marginRight: 8,
    },
    confirmAddText: {
        color: '#FFF',
        fontWeight: '600',
    },
    cancelAddBtn: {
        padding: 8,
    }
});
