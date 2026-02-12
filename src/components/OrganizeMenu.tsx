import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

interface OrganizeMenuProps {
    visible: boolean;
    onClose: () => void;
    onSelectFilter: (filterType: string) => void;
}

export const OrganizeMenu = ({ visible, onClose, onSelectFilter }: OrganizeMenuProps) => {
    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
                <View style={styles.menuContainer}>
                    <Text style={styles.menuTitle}>Organize By</Text>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('importance')}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#333" />
                        <Text style={styles.menuText}>Importance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('date')}>
                        <MaterialCommunityIcons name="calendar-clock" size={20} color="#333" />
                        <Text style={styles.menuText}>Due Date</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('recurrence')}>
                        <MaterialCommunityIcons name="repeat" size={20} color="#333" />
                        <Text style={styles.menuText}>Recurrence</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => onSelectFilter('color')}>
                        <Ionicons name="color-palette-outline" size={20} color="#333" />
                        <Text style={styles.menuText}>Color</Text>
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
        justifyContent: 'flex-start', // Align to top
        alignItems: 'flex-end',      // Align to right
    },
    menuContainer: {
        backgroundColor: '#FFF',
        width: 250,
        borderRadius: 12,
        padding: 16,
        marginTop: 142, // Adjusted to appear below the button (Organize button is in nav row)
        marginRight: 16, // Align with the button on the right
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
