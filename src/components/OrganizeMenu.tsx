import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

interface OrganizeMenuProps {
    visible: boolean;
    onClose: () => void;
    onSelectFilter: (filterType: string) => void;
    isClumped: boolean;
    anchor?: { pageX: number; pageY: number; width: number; height: number };
}

export const OrganizeMenu = ({ visible, onClose, onSelectFilter, isClumped, anchor }: OrganizeMenuProps) => {
    const MENU_ITEMS = [
        { id: 'auto_organise', label: 'Auto Organise', icon: 'auto-fix', iconLib: 'MaterialCommunityIcons', color: '#3B82F6', bold: true },
        { id: 'urgent', label: 'Urgent', icon: 'alert-decagram-outline', iconLib: 'MaterialCommunityIcons', color: '#EF4444' },
        { id: 'date', label: 'Due Date', icon: 'calendar-clock', iconLib: 'MaterialCommunityIcons', color: '#333' },
        { id: 'quick_wins', label: 'Quick Wins', icon: 'lightning-bolt', iconLib: 'MaterialCommunityIcons', color: '#F59E0B' },
        { id: 'procrastinated', label: 'Procrastinated', icon: 'history', iconLib: 'MaterialCommunityIcons', color: '#6366F1' },
        { id: 'divider', type: 'divider' },
        { id: 'manual_reorder', label: 'Manual Reorder', icon: 'drag', iconLib: 'MaterialCommunityIcons', color: '#10B981', bold: true },
        { 
            id: isClumped ? 'clump_off' : 'clump_on', 
            label: isClumped ? 'Declump Tasks' : 'Clump Tasks', 
            icon: isClumped ? 'format-line-spacing' : 'format-line-weight', 
            iconLib: 'MaterialCommunityIcons', 
            color: '#8B5CF6', 
            bold: true 
        },
    ];
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-20)).current;
    const itemAnims = useRef(MENU_ITEMS.map(() => new Animated.Value(0))).current;
    const [shouldRender, setShouldRender] = useState(visible);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();

            const animations = itemAnims.map((anim, i) => 
                Animated.spring(anim, {
                    toValue: 1,
                    delay: i * 40,
                    friction: 7,
                    tension: 50,
                    useNativeDriver: true,
                })
            );
            Animated.stagger(40, animations).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                ...itemAnims.map(anim => Animated.timing(anim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }))
            ]).start(() => setShouldRender(false));
        }
    }, [visible]);

    if (!shouldRender) return null;

    const renderIcon = (item: any) => {
        if (item.iconLib === 'MaterialCommunityIcons') {
            return <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />;
        }
        return <Ionicons name={item.icon} size={20} color={item.color} />;
    };

    return (
        <Pressable 
            style={[StyleSheet.absoluteFill, { zIndex: 999 }]} 
            onPress={onClose}
        >
            <Animated.View 
                style={[
                    styles.overlay, 
                    { opacity: fadeAnim }
                ]}
            >
                <Animated.View 
                    style={[
                        styles.menuContainer,
                        anchor ? { marginTop: anchor.pageY + anchor.height + 8 } : {},
                        { 
                            transform: [{ translateY: slideAnim }],
                            opacity: fadeAnim 
                        }
                    ]}
                >
                    <Text style={styles.menuTitle}>Organize By</Text>
                    
                    {MENU_ITEMS.map((item, index) => {
                        if (item.type === 'divider') {
                            return (
                                <Animated.View 
                                    key={`divider-${index}`}
                                    style={[styles.divider, { opacity: itemAnims[index] }]} 
                                />
                            );
                        }

                        return (
                            <Animated.View
                                key={item.id}
                                style={{
                                    opacity: itemAnims[index],
                                    transform: [{
                                        translateY: itemAnims[index].interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [15, 0]
                                        })
                                    }]
                                }}
                            >
                                <TouchableOpacity 
                                    style={styles.menuItem} 
                                    onPress={() => {
                                        onSelectFilter(item.id as string);
                                        onClose();
                                    }}
                                >
                                    {renderIcon(item)}
                                    <Text style={[
                                        styles.menuText, 
                                        item.bold && { color: item.color, fontWeight: '700' }
                                    ]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })}
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.3)', 
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    menuContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        width: 250,
        borderRadius: 24,
        padding: 12,
        marginTop: 154, 
        marginRight: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 12,
    },
    menuTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        gap: 12,
    },
    menuText: {
        fontSize: 15,
        color: '#1E293B',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(226, 232, 240, 1)',
        marginVertical: 8,
        marginHorizontal: 12,
    },
});
