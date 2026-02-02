import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, FlatList, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TagDefinition } from '../services/storage';

interface TagSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    tags: TagDefinition[];
    onSaveTags: (tags: TagDefinition[]) => void;
}

const COLORS = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#64748B', // Slate
    '#000000', // Black
];

const PRESET_EMOJIS = ['🏷️', '📚', '💼', '💪', '🏠', '🛒', '✈️', '🎉', '❤️', '⭐'];

export default function TagSettingsModal({ visible, onClose, tags, onSaveTags }: TagSettingsModalProps) {
    const [localTags, setLocalTags] = useState<TagDefinition[]>([]);

    // Editing State
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
            // Update existing
            const updated = localTags.map(t =>
                t.id === editingId ? { ...t, label: editLabel, color: editColor, symbol: editSymbol } : t
            );
            setLocalTags(updated);
        } else {
            // Create new
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
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Manage Tags</Text>
                        <TouchableOpacity onPress={handleClose}>
                            <Text style={styles.saveText}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                        {/* Editor Section */}
                        <View style={styles.editorContainer}>
                            <Text style={styles.sectionTitle}>{editingId ? 'Edit Tag' : 'New Tag'}</Text>

                            {/* Label Input */}
                            <TextInput
                                style={styles.input}
                                placeholder="Tag Name (e.g. Work)"
                                value={editLabel}
                                onChangeText={setEditLabel}
                            />

                            {/* Symbol Input */}
                            <View style={styles.row}>
                                <Text style={styles.label}>Symbol:</Text>
                                <TextInput
                                    style={styles.symbolInput}
                                    placeholder="🏷️"
                                    value={editSymbol}
                                    onChangeText={(text) => setEditSymbol(text.slice(0, 2))} // Limit length
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
                                style={[styles.actionBtn, { backgroundColor: editLabel ? '#000' : '#CCC' }]}
                                onPress={handleSaveEdit}
                                disabled={!editLabel}
                            >
                                <Text style={styles.actionBtnText}>
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
                                            <Ionicons name="pencil" size={20} color="#666" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(tag.id)} style={styles.iconBtn}>
                                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end', // Bottom sheet style or center? Center for settings
        alignItems: 'center',
    },
    container: {
        width: '100%',
        height: '90%',
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: '10%',
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
    title: { fontSize: 18, fontWeight: '600' },
    saveText: { color: 'blue', fontWeight: '600', fontSize: 16 },
    content: { flex: 1 },

    editorContainer: { padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
    input: {
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 16,
        backgroundColor: '#F9FAFB'
    },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '500', color: '#666', marginRight: 12, marginBottom: 8 },
    symbolInput: {
        width: 50,
        height: 50,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        fontSize: 24,
        textAlign: 'center',
        marginRight: 12,
        backgroundColor: '#F9FAFB'
    },
    presetRow: { flex: 1 },
    presetItem: { padding: 8 },
    presetEmoji: { fontSize: 20 },

    colorsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    colorCircle: { width: 36, height: 36, borderRadius: 18 },
    colorSelected: { borderWidth: 3, borderColor: '#DDD', transform: [{ scale: 1.1 }] },

    actionBtn: {
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8
    },
    actionBtnText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
    cancelEditBtn: { padding: 12, alignItems: 'center' },
    cancelEditText: { color: 'red' },

    divider: { height: 8, backgroundColor: '#F3F4F6' },

    listContainer: { padding: 20 },
    emptyText: { color: '#999', fontStyle: 'italic' },
    tagRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
    },
    tagPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    tagSymbol: { marginRight: 8, fontSize: 18 },
    tagLabel: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    rowActions: { flexDirection: 'row', gap: 16 },
    iconBtn: { padding: 4 }
});
