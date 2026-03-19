import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

interface OrganizeMenuProps {
    visible: boolean;
    onClose: () => void;
    onSelectFilter: (filterType: string) => void;
    isClumped: boolean;
    anchor?: { pageX: number; pageY: number; width: number; height: number } | null;
}

export const OrganizeMenu = ({ visible, onClose, onSelectFilter, isClumped, anchor }: OrganizeMenuProps) => {
    if (!visible) return null;

    // Default fallback position if measurement fails
    const topPosition = anchor ? anchor.pageY + anchor.height + 8 : 142;
    const rightPosition = anchor ? Dimensions.get('window').width - anchor.pageX - anchor.width : 16;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
                <View style={[styles.menuContainer, { top: topPosition, right: rightPosition }]}>
                    <Text style={styles.menuTitle}>Organize By</Text>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('auto_organise')}>
                        <MaterialCommunityIcons name="auto-fix" size={20} color="#3B82F6" />
                        <Text style={[styles.menuText, { color: '#3B82F6', fontWeight: 'bold' }]}>Auto Organise</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('importance')}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#333" />
                        <Text style={styles.menuText}>Importance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('date')}>
                        <MaterialCommunityIcons name="calendar-clock" size={20} color="#333" />
                        <Text style={styles.menuText}>Due Date</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('estimatedTime')}>
                        <MaterialCommunityIcons name="clock-outline" size={20} color="#333" />
                        <Text style={styles.menuText}>Estimated Time</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('color')}>
                        <Ionicons name="color-palette-outline" size={20} color="#333" />
                        <Text style={styles.menuText}>Color</Text>
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 }} />

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('manual_reorder')}>
                        <MaterialCommunityIcons name="drag" size={20} color="#10B981" />
                        <Text style={[styles.menuText, { color: '#10B981', fontWeight: 'bold' }]}>Manual Reorder</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('clump_off')}>
                        <MaterialCommunityIcons name="format-line-spacing" size={20} color="#EF4444" />
                        <Text style={[styles.menuText, { color: '#EF4444', fontWeight: 'bold' }]}>Declump Tasks</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    menuContainer: {
        position: 'absolute',
        backgroundColor: '#FFF',
        width: 250,
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 10,
    },
    menuTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#999',
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        gap: 12,
    },
    menuText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
});
