import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, LayoutAnimation, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorDefinition, TASK_COLORS, StorageService } from '../services/storage';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    surface: '#FFFFFF',
};

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
            let safeColors = Array.isArray(userColors) ? userColors : [];
            if (safeColors.length === 0) {
                safeColors = StorageService.getDefaultUserColors();
            }
            setColors(JSON.parse(JSON.stringify(safeColors)));
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
        if (colors.length === 0) {
            onClose();
            return;
        }
        onSave(colors);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleSave}>
                <View style={styles.container} onStartShouldSetResponder={() => true}>
                    <Text style={styles.title}>Color Meanings</Text>

                    {/* Toolbar */}
                    <View style={styles.toolbar}>
                        <Text style={styles.subtitle}>Customize your palette</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity onPress={() => {
                                Alert.alert('Reset Colors', 'Revert to the default 7 colors?', [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Reset',
                                        style: 'destructive',
                                        onPress: () => {
                                            const defaults = StorageService.getDefaultUserColors();
                                            onSave(defaults);
                                            setColors(defaults);
                                        }
                                    }
                                ]);
                            }} style={styles.toolBtn}>
                                <Text style={styles.toolBtnText}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.toolBtn}>
                                <Text style={styles.toolBtnText}>{isEditing ? 'Done' : 'Edit'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}
                    >
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
                                                <Ionicons name="chevron-up" size={18} color={index === 0 ? '#E2E8F0' : THEME.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => moveColor(index, 'down')} disabled={index === colors.length - 1}>
                                                <Ionicons name="chevron-down" size={18} color={index === colors.length - 1 ? '#E2E8F0' : THEME.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <View style={[styles.colorCircle, { backgroundColor: item.color }]} />

                                    <TextInput
                                        style={styles.input}
                                        placeholder="Label (optional)"
                                        value={item.label}
                                        onChangeText={(text) => handleLabelChange(item.id, text)}
                                        onEndEditing={handleLabelSubmit}
                                        onBlur={handleLabelSubmit}
                                        placeholderTextColor="#94A3B8"
                                        editable={!isEditing}
                                    />

                                    {isEditing && (
                                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {/* Add New Color */}
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
                                                    placeholderTextColor="#94A3B8"
                                                />
                                            </View>
                                            <TouchableOpacity onPress={handleAddColor} style={styles.confirmAddBtn}>
                                                <Text style={styles.confirmAddText}>Add</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.cancelAddBtn}>
                                                <Ionicons name="close" size={18} color={THEME.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity onPress={() => setIsAdding(true)} style={styles.addButton}>
                                            <Ionicons name="add-circle-outline" size={20} color="#38A169" />
                                            <Text style={styles.addButtonText}>Add Custom Color</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            <View style={{ height: 16 }} />
                        </ScrollView>
                    </KeyboardAvoidingView>

                    {/* Footer — Unified pattern */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleSave} style={styles.cancelButton}>
                            <Text style={styles.cancelButtonText}>Close</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                            <Text style={styles.saveButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: 340,
        maxHeight: '80%',
        backgroundColor: THEME.bg,
        borderRadius: 16,
        overflow: 'hidden',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: THEME.textPrimary,
        textAlign: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
    },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    subtitle: {
        color: THEME.textSecondary,
        fontSize: 13,
        flex: 1,
    },
    toolBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: THEME.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    toolBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: THEME.textPrimary,
    },
    content: { flex: 1 },
    scrollContent: { padding: 16 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: THEME.surface,
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    reorderControls: {
        flexDirection: 'column',
        marginRight: 6,
        alignItems: 'center',
        gap: 2,
    },
    colorCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    input: {
        flex: 1,
        height: 36,
        backgroundColor: THEME.bg,
        borderRadius: 6,
        paddingHorizontal: 10,
        fontSize: 14,
        color: THEME.textPrimary,
    },
    deleteBtn: {
        padding: 6,
        marginLeft: 4,
    },
    addSection: {
        marginTop: 6,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 8,
        backgroundColor: THEME.surface,
        borderStyle: 'dashed',
    },
    addButtonText: {
        marginLeft: 6,
        fontSize: 14,
        color: '#38A169',
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
        backgroundColor: THEME.surface,
        borderRadius: 8,
        paddingHorizontal: 10,
        marginRight: 6,
        height: 40,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    hashText: {
        fontSize: 14,
        color: THEME.textSecondary,
        marginRight: 4,
    },
    hexInput: {
        flex: 1,
        fontSize: 14,
        color: THEME.textPrimary,
    },
    confirmAddBtn: {
        backgroundColor: '#38A169',
        paddingHorizontal: 14,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        marginRight: 6,
    },
    confirmAddText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 13,
    },
    cancelAddBtn: {
        padding: 6,
    },

    // Unified footer
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderColor: THEME.border,
    },
    cancelButton: { paddingVertical: 10, paddingRight: 15 },
    cancelButtonText: { color: '#EF4444', fontWeight: '600' },
    saveButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#38A169',
        borderRadius: 8,
    },
    saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});
