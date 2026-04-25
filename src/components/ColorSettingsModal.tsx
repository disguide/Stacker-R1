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
    Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ColorDefinition, ColorSettings, StorageService } from '../services/storage';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const IOS_THEME = {
    bg: '#F2F2F7',               // iOS grouped background
    surface: '#FFFFFF',          // Card white
    textPrimary: '#000000',
    textSecondary: '#8A8A8E',    // iOS secondary text
    border: '#C6C6C8',           // iOS separator
    accent: '#10B981',           // Keep app accent, but use it cleanly
    danger: '#FF3B30',           // iOS Red
    blue: '#007AFF',             // iOS Blue
};

interface ColorSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    userColors: ColorDefinition[];
    colorSettings?: ColorSettings;
    onSave: (colors: ColorDefinition[]) => void;
    onSaveSettings?: (settings: ColorSettings) => void;
}

export default function ColorSettingsModal({ visible, onClose, userColors, colorSettings, onSave, onSaveSettings }: ColorSettingsModalProps) {
    const [colors, setColors] = useState<ColorDefinition[]>([]);
    const [newColorHex, setNewColorHex] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [pendingKeyword, setPendingKeyword] = useState<Record<string, string>>({});

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
            setPendingKeyword({});
            isMounted.current = true;
        } else {
            isMounted.current = false;
        }
    }, [visible, userColors, colorSettings]);

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
    };

    const handleDelete = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newColors = colors.filter(c => c.id !== id);
        persistChanges(newColors);
    };

    // ── Keyword helpers ──────────────────────────────────────────────────────
    const handleAddKeyword = (colorId: string) => {
        const kw = (pendingKeyword[colorId] || '').trim().toLowerCase();
        if (!kw) return;

        // Check for duplicate keyword on OTHER colors
        const conflictColor = colors.find(c => 
            c.id !== colorId && (c.keywords || []).some(k => k.toLowerCase() === kw)
        );

        const doAdd = () => {
            const newColors = colors.map(c => {
                if (c.id !== colorId) return c;
                const existing = c.keywords || [];
                if (existing.some(k => k.toLowerCase() === kw)) return c; // dedupe
                return { ...c, keywords: [...existing, kw] };
            });
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            persistChanges(newColors);
            setPendingKeyword(prev => ({ ...prev, [colorId]: '' }));
        };

        if (conflictColor) {
            const conflictLabel = conflictColor.label || conflictColor.color;
            Alert.alert(
                'Keyword Conflict',
                `"${kw}" is already assigned to ${conflictLabel}.\n\nIf both colors have this keyword, the one that appears first in your task title will win.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Add Anyway', onPress: doAdd },
                ]
            );
        } else {
            doAdd();
        }
    };

    const handleRemoveKeyword = (colorId: string, kw: string) => {
        const newColors = colors.map(c => {
            if (c.id !== colorId) return c;
            return { ...c, keywords: (c.keywords || []).filter(k => k !== kw) };
        });
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        persistChanges(newColors);
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

    const handleReset = () => {
        Alert.alert('Reset Colors', 'Revert all color settings to default entries?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reset',
                style: 'destructive',
                onPress: () => {
                    const defaults = StorageService.getDefaultUserColors();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    persistChanges(defaults);
                }
            }
        ]);
    };

    const handleClose = () => {
        onSave(colors); // Final safety save
        if (onSaveSettings) {
            onSaveSettings({});
        }
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={handleClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.headerBtnPlaceholder}>
                        <Text style={styles.headerBtnText}>Close</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Color Settings</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.headerDoneBtn}>
                        <Text style={styles.headerBtnTextBold}>Done</Text>
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

                        {/* Colors Block */}
                        <Text style={styles.sectionTitle}>PALETTE & LABELS</Text>
                        
                        {colors.map((item, index) => (
                            <View key={item.id} style={styles.colorGroup}>
                                <View style={styles.colorRowMain}>
                                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                                    
                                    <TextInput
                                        style={styles.labelInput}
                                        placeholder="Label (e.g. Work, Health)"
                                        value={item.label}
                                        onChangeText={(text) => handleLabelChange(item.id, text)}
                                        onBlur={handleLabelBlur}
                                        onEndEditing={handleLabelBlur}
                                        placeholderTextColor="#C7C7CC"
                                    />

                                    <View style={styles.actionIcons}>
                                        <TouchableOpacity 
                                            onPress={() => moveColor(index, 'up')} 
                                            disabled={index === 0}
                                            hitSlop={{ top: 10, bottom: 5, left: 10, right: 10 }}
                                        >
                                            <Ionicons name="chevron-up" size={18} color={index === 0 ? '#E5E5EA' : IOS_THEME.textSecondary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => moveColor(index, 'down')} 
                                            disabled={index === colors.length - 1}
                                            hitSlop={{ top: 5, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons name="chevron-down" size={18} color={index === colors.length - 1 ? '#E5E5EA' : IOS_THEME.textSecondary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => handleDelete(item.id)} 
                                            style={{ marginLeft: 8 }}
                                        >
                                            <Ionicons name="remove-circle" size={22} color={IOS_THEME.danger} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Keywords Editor Segment */}
                                <View style={styles.keywordsSection}>
                                    <Text style={styles.keywordsLabel}>Auto-detect words:</Text>
                                    
                                    <View style={styles.kwChips}>
                                        {(item.keywords || []).map(kw => (
                                            <View key={kw} style={styles.kwChip}>
                                                <Text style={styles.kwChipText}>{kw}</Text>
                                                <TouchableOpacity onPress={() => handleRemoveKeyword(item.id, kw)}>
                                                    <Ionicons name="close-circle" size={16} color="#AEAEB2" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                    
                                    <View style={styles.kwInputContainer}>
                                        <TextInput
                                            style={styles.kwInput}
                                            placeholder="Type word and press return..."
                                            placeholderTextColor="#C7C7CC"
                                            value={pendingKeyword[item.id] || ''}
                                            onChangeText={(text) => setPendingKeyword(prev => ({ ...prev, [item.id]: text }))}
                                            onSubmitEditing={() => handleAddKeyword(item.id)}
                                            returnKeyType="done"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity 
                                            onPress={() => handleAddKeyword(item.id)}
                                            style={[styles.kwAddBtn, { opacity: (pendingKeyword[item.id] || '').trim() ? 1 : 0.5 }]}
                                            disabled={!(pendingKeyword[item.id] || '').trim()}
                                        >
                                            <Text style={styles.kwAddBtnText}>Add</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}

                        {/* Add Custom Color */}
                        <View style={styles.cardGroup}>
                            {isAdding ? (
                                <View style={styles.addRow}>
                                    <Text style={styles.hash}>#</Text>
                                    <TextInput
                                        style={styles.hexInput}
                                        placeholder="FF00CC"
                                        value={newColorHex}
                                        onChangeText={setNewColorHex}
                                        maxLength={6}
                                        autoCapitalize="characters"
                                        autoFocus
                                        placeholderTextColor="#C7C7CC"
                                    />
                                    <TouchableOpacity onPress={handleAddColor} style={styles.addSaveBtn}>
                                        <Text style={styles.addSaveBtnText}>Save</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.addCancelBtn}>
                                        <Text style={styles.addCancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity onPress={() => { setIsAdding(true); }} style={styles.addTrigger}>
                                    <Text style={styles.addTriggerText}>Add Custom Color...</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={{ height: 20 }} />

                        <TouchableOpacity onPress={handleReset} style={[styles.cardGroup, { marginBottom: 60 }]}>
                            <View style={styles.resetTrigger}>
                                <Text style={styles.resetTriggerText}>Reset All to Defaults</Text>
                            </View>
                        </TouchableOpacity>

                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: IOS_THEME.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 16 : 24, // Account for formSheet
        paddingBottom: 16,
        backgroundColor: IOS_THEME.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: IOS_THEME.border,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: IOS_THEME.textPrimary,
        letterSpacing: -0.4,
    },
    headerBtnPlaceholder: {
        minWidth: 60,
    },
    headerBtnText: {
        fontSize: 17,
        color: IOS_THEME.blue,
        letterSpacing: -0.4,
    },
    headerDoneBtn: {
        minWidth: 60,
        alignItems: 'flex-end',
    },
    headerBtnTextBold: {
        fontSize: 17,
        fontWeight: '600',
        color: IOS_THEME.blue,
        letterSpacing: -0.4,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 24,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '400',
        color: IOS_THEME.textSecondary,
        paddingHorizontal: 16,
        marginBottom: 8,
        letterSpacing: -0.1,
    },
    sectionFooter: {
        fontSize: 13,
        color: IOS_THEME.textSecondary,
        paddingHorizontal: 16,
        marginTop: 8,
        marginBottom: 24,
        lineHeight: 18,
    },
    cardGroup: {
        backgroundColor: IOS_THEME.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: IOS_THEME.border,
        marginBottom: 24,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 44,
    },
    rowTitle: {
        fontSize: 17,
        color: IOS_THEME.textPrimary,
    },
    // Colors Block
    colorGroup: {
        backgroundColor: IOS_THEME.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: IOS_THEME.border,
        marginBottom: 16,
    },
    colorRowMain: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5EA',
    },
    colorDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 12,
    },
    labelInput: {
        flex: 1,
        fontSize: 17,
        color: IOS_THEME.textPrimary,
    },
    actionIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    keywordsSection: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FAFAFA',
    },
    keywordsLabel: {
        fontSize: 13,
        color: IOS_THEME.textSecondary,
        marginBottom: 8,
    },
    kwChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    kwChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5E5EA',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    kwChipText: {
        fontSize: 13,
        color: '#000',
    },
    kwInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    kwInput: {
        flex: 1,
        height: 36,
        backgroundColor: '#E5E5EA',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 15,
        color: IOS_THEME.textPrimary,
    },
    kwAddBtn: {
        backgroundColor: IOS_THEME.blue,
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 36,
        justifyContent: 'center',
    },
    kwAddBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    // Add row
    addTrigger: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 44,
        justifyContent: 'center',
    },
    addTriggerText: {
        fontSize: 17,
        color: IOS_THEME.blue,
    },
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 44,
    },
    hash: {
        fontSize: 17,
        color: IOS_THEME.textSecondary,
        marginRight: 4,
    },
    hexInput: {
        flex: 1,
        fontSize: 17,
        color: IOS_THEME.textPrimary,
    },
    addSaveBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: IOS_THEME.blue,
        borderRadius: 6,
        marginRight: 8,
    },
    addSaveBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    addCancelBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    addCancelBtnText: {
        color: IOS_THEME.danger,
        fontSize: 14,
    },
    // Reset Row
    resetTrigger: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resetTriggerText: {
        fontSize: 17,
        color: IOS_THEME.danger,
    },
});
