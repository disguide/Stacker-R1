import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';

export function ActionBar({ onReset, onConfirm, hasValue }: {
    onReset: () => void;
    onConfirm: () => void;
    hasValue: boolean;
}) {
    return (
        <View style={p.actionBar}>
            <TouchableOpacity
                style={[p.actionBtn, p.resetBtn, !hasValue && { opacity: 0.4 }]}
                onPress={onReset}
                disabled={!hasValue}
            >
                <MaterialCommunityIcons name="close" size={18} color="#EF4444" />
                <Text style={p.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[p.actionBtn, p.confirmBtn]} onPress={onConfirm}>
                <Ionicons name="checkmark" size={18} color="#FFF" />
                <Text style={p.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
        </View>
    );
}

const p = StyleSheet.create({
    actionBar: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: THEME.border,
        backgroundColor: '#FFF',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 10,
    },
    resetBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#FECACA',
        backgroundColor: '#FFF5F5',
    },
    resetBtnText: {
        color: '#EF4444',
        fontWeight: '600',
        fontSize: 14,
    },
    confirmBtn: {
        flex: 2,
        backgroundColor: THEME.green,
    },
    confirmBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 15,
    },
});
