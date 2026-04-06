import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    LayoutAnimation,
    UIManager,
    Vibration,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ColorDefinition, StorageService } from '../services/storage';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const THEME = {
    bg: '#FAFAF6', // Slightly parchment-like off-white
    textPrimary: '#0F172A', // Slate 900
    textSecondary: '#64748B', // Slate 500
    border: '#E2E8F0', // Slate 200
    surface: '#FFFFFF',
    accent: '#10B981', // Emerald 500
    danger: '#EF4444', // Red 500
};

interface ColorSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    userColors: ColorDefinition[];
    onSave: (colors: ColorDefinition[]) => void;
}

export default function ColorSettingsModal({ visible, onClose, userColors, onSave }: ColorSettingsModalProps) {
    const [colors, setColors] = useState<ColorDefinition[]>([]);
    const [newColorHex, setNewColorHex] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // Track the initial mount to skip auto-saves on first load
    const isMounted = useRef(false);

    useEffect(() => {
        if (visible) {
            let safeColors = Array.isArray(userColors) ? userColors : [];
            if (safeColors.length === 0) {
                safeColors = StorageService.getDefaultUserColors();
            }
            setColors(JSON.parse(JSON.stringify(safeColors)));
            setIsAdding(false);
            setNewColorHex('');
            isMounted.current = true;
        } else {
            isMounted.current = false;
        }
    }, [visible, userColors]);

    const persistChanges = (newColors: ColorDefinition[]) => {
        setColors(newColors);
        onSave(newColors);
    };

    const handleLabelChange = (id: string, text: string) => {
        setColors(prev => prev.map(c => c.id === id ? { ...c, label: text } : c));
    };

    const handleLabelBlur = () => {
        if (isMounted.current) {
            onSave(colors);
        }
    };

    const handleAddColor = () => {
        if (!newColorHex) return;
        let hex = newColorHex.startsWith('#') ? newColorHex : `#${newColorHex}`;
        if (!/^#[0-9A-F]{6}$/i.test(hex)) {
            Alert.alert('Invalid Color', 'Please enter a valid Hex code (e.g., #FF5500)');
            return;
        }
        const newColor: ColorDefinition = {
            id: `custom_${Date.now()}`,
            color: hex.toUpperCase(),
            label: ''
        };
        const newColors = [...colors, newColor];
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        persistChanges(newColors);
        setNewColorHex('');
        setIsAdding(false);
        Vibration.vibrate(10);
    };

    const handleDelete = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newColors = colors.filter(c => c.id !== id);
        persistChanges(newColors);
        Vibration.vibrate(10);
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
        Vibration.vibrate(5);
    };

    const handleReset = () => {
        Alert.alert('Reset Palette', 'Revert all color meanings to default entries?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reset Defaults',
                style: 'destructive',
                onPress: () => {
                    const defaults = StorageService.getDefaultUserColors();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                    persistChanges(defaults);
                    Vibration.vibrate(20);
                }
            }
        ]);
    };

    const handleClose = () => {
        onSave(colors); // Final safety save
        onClose();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
                <View style={styles.container} onStartShouldSetResponder={() => true}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerBar} />
                        <Text style={styles.title}>Color Meanings</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
                            <Ionicons name="close-circle" size={24} color={THEME.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}
                    >
                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.description}>
                                Define what your task colors represent. Reorder or add custom labels—changes save instantly.
                            </Text>

                            {colors.map((item, index) => (
                                <View key={item.id} style={styles.row}>
                                    <View style={styles.dragHandle}>
                                        <TouchableOpacity 
                                            onPress={() => moveColor(index, 'up')} 
                                            disabled={index === 0}
                                            hitSlop={{ top: 10, bottom: 5, left: 10, right: 10 }}
                                        >
                                            <Ionicons name="chevron-up" size={16} color={index === 0 ? '#E2E8F0' : THEME.textSecondary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => moveColor(index, 'down')} 
                                            disabled={index === colors.length - 1}
                                            hitSlop={{ top: 5, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons name="chevron-down" size={16} color={index === colors.length - 1 ? '#E2E8F0' : THEME.textSecondary} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[styles.colorChip, { backgroundColor: item.color }]}>
                                        <View style={styles.colorGlare} />
                                    </View>

                                    <View style={styles.inputWrapper}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Label meaning..."
                                            value={item.label}
                                            onChangeText={(text) => handleLabelChange(item.id, text)}
                                            onBlur={handleLabelBlur}
                                            onEndEditing={handleLabelBlur}
                                            placeholderTextColor="#94A3B8"
                                            selectionColor={THEME.accent}
                                        />
                                    </View>

                                    <TouchableOpacity 
                                        onPress={() => handleDelete(item.id)} 
                                        style={styles.deleteButton}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={THEME.danger} />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {/* Add Section */}
                            <View style={styles.addSection}>
                                {isAdding ? (
                                    <View style={styles.addRow}>
                                        <View style={styles.hexInputWrapper}>
                                            <Text style={styles.hash}>#</Text>
                                            <TextInput
                                                style={styles.hexInput}
                                                placeholder="FF00CC"
                                                value={newColorHex}
                                                onChangeText={setNewColorHex}
                                                maxLength={6}
                                                autoCapitalize="characters"
                                                autoFocus
                                                placeholderTextColor="#94A3B8"
                                            />
                                        </View>
                                        <TouchableOpacity onPress={handleAddColor} style={styles.addButtonCircle}>
                                            <Ionicons name="checkmark" size={20} color="#FFF" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.cancelAdd}>
                                            <Ionicons name="close" size={20} color={THEME.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity 
                                        onPress={() => { setIsAdding(true); Vibration.vibrate(5); }} 
                                        style={styles.addTrigger}
                                    >
                                        <MaterialCommunityIcons name="plus-circle" size={20} color={THEME.accent} />
                                        <Text style={styles.addTriggerText}>Add Custom Color</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                                <Text style={styles.resetText}>Reset to Defaults</Text>
                            </TouchableOpacity>

                            <View style={{ height: 100 }} />
                        </ScrollView>
                    </KeyboardAvoidingView>

                    {/* Simple Bottom Guard */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleClose} style={styles.doneButton}>
                            <Text style={styles.doneText}>Done</Text>
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
        backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate 900 with transparency
        justifyContent: 'flex-end',
    },
    container: {
        height: '75%',
        backgroundColor: THEME.bg,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 25,
    },
    header: {
        paddingTop: 12,
        paddingBottom: 20,
        alignItems: 'center',
    },
    headerBar: {
        width: 40,
        height: 4,
        backgroundColor: THEME.border,
        borderRadius: 2,
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: THEME.textPrimary,
        letterSpacing: -0.5,
    },
    closeIcon: {
        position: 'absolute',
        top: 20,
        right: 20,
    },
    description: {
        fontSize: 13,
        color: THEME.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 30,
        marginBottom: 24,
        lineHeight: 18,
    },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: 20 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.surface,
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: THEME.border,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    dragHandle: {
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
    },
    colorChip: {
        width: 36,
        height: 36,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.05)',
        overflow: 'hidden',
    },
    colorGlare: {
        width: '100%',
        height: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    inputWrapper: {
        flex: 1,
        marginHorizontal: 12,
    },
    input: {
        fontSize: 15,
        fontWeight: '600',
        color: THEME.textPrimary,
        height: 40,
        padding: 0,
    },
    deleteButton: {
        padding: 8,
    },
    addSection: {
        marginTop: 8,
    },
    addTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: THEME.border,
        borderStyle: 'dashed',
        borderRadius: 16,
        paddingVertical: 14,
    },
    addTriggerText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '700',
        color: THEME.accent,
    },
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    hexInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
    },
    hash: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textSecondary,
        marginRight: 4,
    },
    hexInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: THEME.textPrimary,
    },
    addButtonCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: THEME.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelAdd: {
        padding: 8,
    },
    resetButton: {
        alignSelf: 'center',
        marginTop: 32,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    resetText: {
        fontSize: 13,
        fontWeight: '600',
        color: THEME.textSecondary,
        textDecorationLine: 'underline',
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        backgroundColor: THEME.bg,
    },
    doneButton: {
        backgroundColor: THEME.textPrimary,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: THEME.textPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    doneText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
});
