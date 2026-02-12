import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TagDefinition } from '../services/storage';

const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    surface: '#FFFFFF',
};

interface TagSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    tags: TagDefinition[];
    onSaveTags: (tags: TagDefinition[]) => void;
}

const COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6',
    '#6366F1', '#8B5CF6', '#EC4899', '#64748B', '#000000',
];

const PRESET_EMOJIS = ['🏷️', '📚', '💼', '💪', '🏠', '🛒', '✈️', '🎉', '❤️', '⭐'];

export default function TagSettingsModal({ visible, onClose, tags, onSaveTags }: TagSettingsModalProps) {
    const [localTags, setLocalTags] = useState<TagDefinition[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [editColor, setEditColor] = useState(COLORS[0]);
    const [editSymbol, setEditSymbol] = useState('🏷️');

    useEffect(() => {
        if (visible) {
            setLocalTags(tags);
            resetEdit();
        }
    }, [visible, tags]);

    const resetEdit = () => {
        setEditingId(null);
        setEditLabel('');
        setEditColor(COLORS[0]);
        setEditSymbol('🏷️');
    };

    const handleStartEdit = (tag: TagDefinition) => {
        setEditingId(tag.id);
        setEditLabel(tag.label);
        setEditColor(tag.color);
        setEditSymbol(tag.symbol);
    };

    const handleSaveEdit = () => {
        if (!editLabel.trim()) return;
        if (editingId) {
            const updated = localTags.map(t =>
                t.id === editingId ? { ...t, label: editLabel, color: editColor, symbol: editSymbol } : t
            );
            setLocalTags(updated);
        } else {
            const newTag: TagDefinition = {
                id: Date.now().toString(),
                label: editLabel,
                color: editColor,
                symbol: editSymbol
            };
            setLocalTags([...localTags, newTag]);
        }
        resetEdit();
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Tag', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    setLocalTags(localTags.filter(t => t.id !== id));
                    if (editingId === id) resetEdit();
                }
            }
        ]);
    };

    const handleClose = () => {
        onSaveTags(localTags);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
                <View style={styles.container} onStartShouldSetResponder={() => true}>
                    <Text style={styles.title}>Manage Tags</Text>

                    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                        {/* Editor Section */}
                        <View style={styles.editorContainer}>
                            <Text style={styles.sectionTitle}>{editingId ? 'Edit Tag' : 'New Tag'}</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Tag Name (e.g. Work)"
                                placeholderTextColor="#94A3B8"
                                value={editLabel}
                                onChangeText={setEditLabel}
                            />

                            {/* Symbol Input */}
                            <View style={styles.symbolRow}>
                                <Text style={styles.label}>Symbol:</Text>
                                <TextInput
                                    style={styles.symbolInput}
                                    placeholder="🏷️"
                                    value={editSymbol}
                                    onChangeText={(text) => setEditSymbol(text.slice(0, 2))}
                                />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
                                    {PRESET_EMOJIS.map(emo => (
                                        <TouchableOpacity key={emo} onPress={() => setEditSymbol(emo)} style={styles.presetItem}>
                                            <Text style={styles.presetEmoji}>{emo}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Color Picker */}
                            <Text style={styles.label}>Color:</Text>
                            <View style={styles.colorsGrid}>
                                {COLORS.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.colorCircle, { backgroundColor: c }, editColor === c && styles.colorSelected]}
                                        onPress={() => setEditColor(c)}
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: editLabel ? '#38A169' : '#E2E8F0' }]}
                                onPress={handleSaveEdit}
                                disabled={!editLabel}
                            >
                                <Text style={[styles.actionBtnText, { color: editLabel ? '#FFF' : '#94A3B8' }]}>
                                    {editingId ? 'Update Tag' : 'Add Tag'}
                                </Text>
                            </TouchableOpacity>

                            {editingId && (
                                <TouchableOpacity style={styles.cancelEditBtn} onPress={resetEdit}>
                                    <Text style={styles.cancelEditText}>Cancel Edit</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.divider} />

                        {/* List of Tags */}
                        <View style={styles.listContainer}>
                            <Text style={styles.sectionTitle}>Your Tags</Text>
                            {localTags.length === 0 && (
                                <Text style={styles.emptyText}>No tags created yet.</Text>
                            )}
                            {localTags.map(tag => (
                                <View key={tag.id} style={styles.tagRow}>
                                    <View style={[styles.tagPreview, { backgroundColor: tag.color }]}>
                                        <Text style={styles.tagSymbol}>{tag.symbol}</Text>
                                        <Text style={styles.tagLabel}>{tag.label}</Text>
                                    </View>
                                    <View style={styles.rowActions}>
                                        <TouchableOpacity onPress={() => handleStartEdit(tag)} style={styles.iconBtn}>
                                            <Ionicons name="pencil" size={18} color={THEME.textSecondary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(tag.id)} style={styles.iconBtn}>
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                        <View style={{ height: 20 }} />
                    </ScrollView>

                    {/* Footer — Unified pattern */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
                            <Text style={styles.cancelButtonText}>Close</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={handleClose} style={styles.saveButton}>
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
    content: { flex: 1 },

    editorContainer: { padding: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 10, color: THEME.textPrimary },
    input: {
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 8,
        padding: 10,
        fontSize: 15,
        marginBottom: 12,
        backgroundColor: THEME.surface,
        color: THEME.textPrimary,
    },
    symbolRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '500', color: THEME.textSecondary, marginRight: 8, marginBottom: 6 },
    symbolInput: {
        width: 44,
        height: 44,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 8,
        fontSize: 22,
        textAlign: 'center',
        marginRight: 8,
        backgroundColor: THEME.surface,
    },
    presetRow: { flex: 1 },
    presetItem: { padding: 6 },
    presetEmoji: { fontSize: 18 },

    colorsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    colorCircle: { width: 28, height: 28, borderRadius: 14 },
    colorSelected: { borderWidth: 3, borderColor: THEME.border, transform: [{ scale: 1.15 }] },

    actionBtn: {
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    actionBtnText: { fontWeight: '600', fontSize: 14 },
    cancelEditBtn: { padding: 10, alignItems: 'center' },
    cancelEditText: { color: '#EF4444', fontWeight: '600', fontSize: 13 },

    divider: { height: 1, backgroundColor: THEME.border, marginHorizontal: 16 },

    listContainer: { padding: 16 },
    emptyText: { color: THEME.textSecondary, fontStyle: 'italic', fontSize: 13 },
    tagRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: THEME.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    tagPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    tagSymbol: { marginRight: 6, fontSize: 16 },
    tagLabel: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
    rowActions: { flexDirection: 'row', gap: 12 },
    iconBtn: { padding: 4 },

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
