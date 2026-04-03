import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VIEW_CONFIG, ViewMode, THEME } from '../constants/theme';

interface ViewMenuProps {
    visible: boolean;
    onClose: () => void;
    onSelectView: (viewMode: ViewMode) => void;
    currentView: ViewMode;
    anchor?: { pageX: number; pageY: number; width: number; height: number };
}

export const ViewMenu = ({ visible, onClose, onSelectView, currentView, anchor }: ViewMenuProps) => {
    const MENU_ITEMS = Object.keys(VIEW_CONFIG).map((mode) => ({
        id: mode as ViewMode,
        label: VIEW_CONFIG[mode as ViewMode].label,
        icon: mode === 'day' ? 'today-outline' :
              mode === '3days' ? 'calendar-outline' :
              mode === 'week' ? 'calendar-clear-outline' :
              mode === 'month' ? 'calendar-number-outline' : 'albums-outline',
        color: currentView === mode ? THEME.accent : THEME.textPrimary,
        bold: currentView === mode,
    }));

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

    // Default positioning if anchor is missing for whatever reason
    // Based on the organize menu style
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
                        // Center under the button usually, or anchor slightly offset
                        anchor ? { 
                            marginTop: anchor.pageY + anchor.height + 8,
                            marginLeft: anchor.pageX - 90 + (anchor.width / 2) // Perfectly center the 180px wide menu
                        } : {
                            marginTop: 130, // Fallback
                            alignSelf: 'center',
                        },
                        { 
                            transform: [{ translateY: slideAnim }],
                            opacity: fadeAnim 
                        }
                    ]}
                >
                    <Text style={styles.menuTitle}>View Timeline</Text>
                    
                    {MENU_ITEMS.map((item, index) => {
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
                                    style={[styles.menuItem, item.bold && styles.menuItemActive]} 
                                    onPress={() => {
                                        onSelectView(item.id);
                                        onClose();
                                    }}
                                >
                                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                                    <Text style={[
                                        styles.menuText, 
                                        item.bold && { color: item.color, fontWeight: '700' }
                                    ]}>
                                        {item.label}
                                    </Text>
                                    {item.bold && (
                                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                            <Ionicons name="checkmark" size={18} color={item.color} />
                                        </View>
                                    )}
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
        // We handle alignment via margins dynamically
        alignItems: 'flex-start',
    },
    menuContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        width: 180,
        borderRadius: 24,
        padding: 12,
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
    menuItemActive: {
        backgroundColor: '#F0F9FF',
    },
    menuText: {
        fontSize: 15,
        color: '#1E293B',
        fontWeight: '600',
    },
});
