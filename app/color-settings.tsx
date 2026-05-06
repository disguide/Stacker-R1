import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    LayoutAnimation,
    UIManager,
    Animated,
    PanResponder,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ColorDefinition, StorageService } from '../src/services/storage';

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

const PRESET_COLORS = [
    '#FF3B30', // Red
    '#FF9500', // Orange
    '#FFCC00', // Yellow
    '#34C759', // Green
    '#007AFF', // Blue
    '#5856D6', // Purple
    '#FF2D55', // Pink
    '#5AC8FA', // Teal
];

export default function ColorSettingsScreen() {
    const router = useRouter();
    const [colors, setColors] = useState<ColorDefinition[]>([]);
    const [newColorHex, setNewColorHex] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [pendingKeyword, setPendingKeyword] = useState<Record<string, string>>({});
    const [isScrollEnabled, setIsScrollEnabled] = useState(true);
    const scrollRef = useRef<ScrollView>(null);
    const scrollY = useRef(0);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            const data = await StorageService.loadUserColors();
            if (mounted) {
                if (!data || data.length === 0) {
                    setColors(StorageService.getDefaultUserColors());
                } else {
                    setColors(data);
                }
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    const persistChanges = (newColors: ColorDefinition[]) => {
        setColors(newColors);
        StorageService.saveUserColors(newColors);
    };

    const handleLabelChange = (id: string, text: string) => {
        setColors(prev => prev.map(c => c.id === id ? { ...c, label: text } : c));
    };

    const handleLabelBlur = () => {
        StorageService.saveUserColors(colors);
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

    const handleAddPresetColor = (hex: string) => {
        const newColor: ColorDefinition = {
            id: `custom_${Date.now()}`,
            color: hex.toUpperCase(),
            label: ''
        };
        const newColors = [...colors, newColor];
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        persistChanges(newColors);
        setIsAdding(false);
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Delete Color Meaning?',
            'Are you sure you want to permanently remove this color meaning and all of its auto-detect keywords? This action cannot be undone.',
            [
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
            ]
        );
    };

    const handleAddKeyword = (colorId: string) => {
        const kw = (pendingKeyword[colorId] || '').trim();
        if (!kw) return;

        const conflictColor = colors.find(c => 
            c.id !== colorId && (c.keywords || []).some(k => k === kw)
        );

        const doAdd = () => {
            const newColors = colors.map(c => {
                if (c.id !== colorId) return c;
                const existing = c.keywords || [];
                if (existing.some(k => k === kw)) return c;
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
        Alert.alert(
            'Remove Keyword',
            `Are you sure you want to remove the auto-detect keyword "${kw}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        const newColors = colors.map(c => {
                            if (c.id !== colorId) return c;
                            return { ...c, keywords: (c.keywords || []).filter(k => k !== kw) };
                        });
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        persistChanges(newColors);
                    }
                }
            ]
        );
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtnPlaceholder}>
                    <Text style={styles.headerBtnText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Color Settings</Text>
                <View style={styles.headerDoneBtn} /> 
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={isScrollEnabled}
                    onScroll={e => { scrollY.current = Math.max(0, e.nativeEvent.contentOffset.y); }}
                    scrollEventThrottle={16}
                >

                    {/* Colors Block */}
                    <Text style={styles.sectionTitle}>PALETTE & LABELS</Text>
                    
                    <ReorderablePaletteList
                        colors={colors}
                        persistChanges={persistChanges}
                        handleLabelChange={handleLabelChange}
                        handleLabelBlur={handleLabelBlur}
                        handleDelete={handleDelete}
                        pendingKeyword={pendingKeyword}
                        setPendingKeyword={setPendingKeyword}
                        handleAddKeyword={handleAddKeyword}
                        handleRemoveKeyword={handleRemoveKeyword}
                        setIsScrollEnabled={setIsScrollEnabled}
                        scrollRef={scrollRef}
                        scrollY={scrollY}
                    />

                    {/* Add Custom Color */}
                    <View style={[styles.cardGroup, { paddingVertical: isAdding ? 16 : 0 }]}>
                        {isAdding ? (
                            <View style={{ paddingHorizontal: 16 }}>
                                <Text style={styles.keywordsLabel}>Choose a preset color:</Text>
                                <View style={styles.presetGrid}>
                                    {PRESET_COLORS.map(color => (
                                        <TouchableOpacity 
                                            key={color} 
                                            style={[styles.presetSwatch, { backgroundColor: color }]}
                                            onPress={() => handleAddPresetColor(color)}
                                        />
                                    ))}
                                </View>
                                
                                <Text style={[styles.keywordsLabel, { marginTop: 16 }]}>Or enter custom hex code:</Text>
                                <View style={[styles.addRow, { paddingHorizontal: 0 }]}>
                                    <Text style={styles.hash}>#</Text>
                                    <TextInput
                                        style={styles.hexInput}
                                        placeholder="FF00CC"
                                        value={newColorHex}
                                        onChangeText={setNewColorHex}
                                        maxLength={6}
                                        autoCapitalize="characters"
                                        placeholderTextColor="#C7C7CC"
                                    />
                                    <TouchableOpacity onPress={handleAddColor} style={styles.addSaveBtn}>
                                        <Text style={styles.addSaveBtnText}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                                
                                <TouchableOpacity onPress={() => setIsAdding(false)} style={{ alignItems: 'center', marginTop: 12 }}>
                                    <Text style={styles.addCancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => { setIsAdding(true); }} style={styles.addTriggerProminent}>
                                <Ionicons name="add-circle" size={22} color={IOS_THEME.blue} style={{ marginRight: 8 }} />
                                <Text style={styles.addTriggerTextProminent}>Add New Color</Text>
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
        </SafeAreaView>
    );
}

// ==========================================
// Custom Drag and Drop implementation
// ==========================================

function ReorderablePaletteList({
    colors,
    persistChanges,
    handleLabelChange,
    handleLabelBlur,
    handleDelete,
    pendingKeyword,
    setPendingKeyword,
    handleAddKeyword,
    handleRemoveKeyword,
    setIsScrollEnabled,
    scrollRef,
    scrollY
}: any) {
    const [items, setItems] = useState(colors);
    const itemLayouts = useRef<{ y: number; height: number }[]>([]);
    const [activeIdx, setActiveIdx] = useState(-1);
    const targetGapRef = useRef(-1);
    const activeIdxRef = useRef(-1);
    const rowTranslations = useRef<Animated.Value[]>([]);
    
    const scrollOffset = useRef(new Animated.Value(0)).current;
    const initialScrollY = useRef(0);
    const currentDy = useRef(0);
    const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (activeIdx === -1) {
            setItems(colors);
        }
    }, [colors, activeIdx]);

    const getRowTranslation = (idx: number) => {
        while (rowTranslations.current.length <= idx) {
            rowTranslations.current.push(new Animated.Value(0));
        }
        return rowTranslations.current[idx];
    };

    const getBarYForGap = (gap: number) => {
        const layouts = itemLayouts.current;
        if (layouts.length === 0) return 0;
        if (gap <= 0) return layouts[0]?.y || 0;
        if (gap >= layouts.length) {
            const last = layouts[layouts.length - 1];
            return (last?.y || 0) + (last?.height || 0);
        }
        return layouts[gap]?.y || 0;
    };

    const applyDisplacements = () => {
        const idx = activeIdxRef.current;
        if (idx === -1) return;
        
        const scrollDelta = scrollY.current - initialScrollY.current;
        const layouts = itemLayouts.current;
        const currentCenter = (layouts[idx]?.y || 0) + (layouts[idx]?.height || 0) / 2 + currentDy.current + scrollDelta;

        let bestGap = 0;
        let minDistance = Infinity;

        for (let i = 0; i <= layouts.length; i++) {
            const barY = getBarYForGap(i);
            const dist = Math.abs(currentCenter - barY);
            if (dist < minDistance) {
                minDistance = dist;
                bestGap = i;
            }
        }

        if (targetGapRef.current !== bestGap) {
            targetGapRef.current = bestGap;
            Animated.parallel(
                items.map((_: any, i: number) => {
                    if (i === activeIdxRef.current) return Animated.timing(new Animated.Value(0), { toValue: 0, duration: 0, useNativeDriver: true });
                    let shift = 0;
                    if (i < activeIdxRef.current && i >= bestGap) shift = layouts[activeIdxRef.current]?.height || 0;
                    if (i > activeIdxRef.current && i < bestGap) shift = -(layouts[activeIdxRef.current]?.height || 0);
                    return Animated.timing(getRowTranslation(i), {
                        toValue: shift,
                        duration: 200,
                        useNativeDriver: true
                    });
                })
            ).start();
        }
    };

    const handleDragStart = (idx: number, yPos: number) => {
        setActiveIdx(idx);
        activeIdxRef.current = idx;
        targetGapRef.current = idx;
        initialScrollY.current = scrollY.current;
        scrollOffset.setValue(0);
        currentDy.current = 0;
        setIsScrollEnabled(false);
    };

    const handleDragMove = (idx: number, dy: number, pageY: number) => {
        currentDy.current = dy;

        const windowHeight = Dimensions.get('window').height;
        const topEdge = 150;
        const bottomEdge = windowHeight - 150;
        const maxScrollSpeed = 20;

        if (autoScrollTimer.current) {
            cancelAnimationFrame(autoScrollTimer.current as unknown as number);
            clearInterval(autoScrollTimer.current as unknown as number);
            autoScrollTimer.current = null;
        }

        const scrollLoop = (direction: 'up' | 'down', speed: number) => {
            const nextY = direction === 'up'
                ? Math.max(0, scrollY.current - speed)
                : scrollY.current + speed;

            if (scrollY.current !== nextY) {
                scrollY.current = nextY;
                scrollRef.current?.scrollTo({ y: nextY, animated: false });

                const newScrollDelta = nextY - initialScrollY.current;
                scrollOffset.setValue(newScrollDelta);

                applyDisplacements();

                autoScrollTimer.current = requestAnimationFrame(() => scrollLoop(direction, speed)) as unknown as NodeJS.Timeout;
            }
        };

        if (pageY > 0 && pageY < topEdge) {
            const speed = Math.max(2, ((topEdge - pageY) / topEdge) * maxScrollSpeed);
            autoScrollTimer.current = requestAnimationFrame(() => scrollLoop('up', speed)) as unknown as NodeJS.Timeout;
        } else if (pageY > bottomEdge && pageY < windowHeight) {
            const speed = Math.max(2, ((pageY - bottomEdge) / 150) * maxScrollSpeed);
            autoScrollTimer.current = requestAnimationFrame(() => scrollLoop('down', speed)) as unknown as NodeJS.Timeout;
        }

        applyDisplacements();
    };

    const handleDrop = (idx: number, dy: number) => {
        if (autoScrollTimer.current) {
            cancelAnimationFrame(autoScrollTimer.current as unknown as number);
            clearInterval(autoScrollTimer.current as unknown as number);
            autoScrollTimer.current = null;
        }

        const targetGap = targetGapRef.current;
        setIsScrollEnabled(true);

        if (targetGap !== -1 && targetGap !== idx && targetGap !== idx + 1) {
            const currentItems = [...items];
            const [moved] = currentItems.splice(idx, 1);
            let insertIdx = targetGap > idx ? targetGap - 1 : targetGap;
            currentItems.splice(insertIdx, 0, moved);
            
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            persistChanges(currentItems);
        }

        setActiveIdx(-1);
        activeIdxRef.current = -1;
        targetGapRef.current = -1;
        rowTranslations.current.forEach(anim => anim.setValue(0));
    };

    return (
        <View>
            {items.map((item: any, idx: number) => (
                <DraggablePaletteRow
                    key={item.id}
                    item={item}
                    index={idx}
                    isActive={activeIdx === idx}
                    baseTranslateY={getRowTranslation(idx)}
                    scrollOffset={scrollOffset}
                    onLayout={(e: any) => {
                        itemLayouts.current[idx] = {
                            y: e.nativeEvent.layout.y,
                            height: e.nativeEvent.layout.height
                        };
                    }}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDrop}
                    handleLabelChange={handleLabelChange}
                    handleLabelBlur={handleLabelBlur}
                    handleDelete={handleDelete}
                    pendingKeyword={pendingKeyword}
                    setPendingKeyword={setPendingKeyword}
                    handleAddKeyword={handleAddKeyword}
                    handleRemoveKeyword={handleRemoveKeyword}
                />
            ))}
        </View>
    );
}

const DraggablePaletteRow = React.memo(function DraggablePaletteRow({
    item, index, isActive, baseTranslateY, scrollOffset, onLayout, onDragStart, onDragMove, onDragEnd,
    handleLabelChange, handleLabelBlur, handleDelete, pendingKeyword, setPendingKeyword, handleAddKeyword, handleRemoveKeyword
}: any) {
    const pan = useRef(new Animated.ValueXY()).current;
    const initialY = useRef(0);

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e, gestureState) => {
            initialY.current = e.nativeEvent.pageY || 0;
            onDragStart(index, initialY.current);
        },
        onPanResponderMove: (e, gestureState) => {
            pan.setValue({ x: 0, y: gestureState.dy });
            onDragMove(index, gestureState.dy, e.nativeEvent.pageY);
        },
        onPanResponderRelease: (e, gestureState) => {
            onDragEnd(index, gestureState.dy);
            Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
                speed: 20,
                bounciness: 4
            }).start();
        },
        onPanResponderTerminate: (e, gestureState) => {
            onDragEnd(index, gestureState.dy);
            Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true
            }).start();
        }
    }), [index, onDragStart, onDragMove, onDragEnd]);

    return (
        <Animated.View
            onLayout={onLayout}
            style={[
                styles.colorGroup,
                !isActive && { transform: [{ translateY: baseTranslateY }] },
                isActive && {
                    transform: [{ translateY: Animated.add(pan.y, scrollOffset) }],
                    zIndex: 999,
                    elevation: 10,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    opacity: 0.95
                }
            ]}
        >
            <View style={styles.colorRowMain}>
                {/* DRAG HANDLE ON FAR LEFT */}
                <View 
                    {...panResponder.panHandlers} 
                    style={{ paddingRight: 12, paddingVertical: 8 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="menu" size={24} color="#C6C6C8" />
                </View>

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
                    {(item.keywords || []).map((kw: string) => (
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
                        onChangeText={(text) => setPendingKeyword((prev: any) => ({ ...prev, [item.id]: text }))}
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
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: IOS_THEME.surface,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 10 : 24, // Using SafeAreaView so padding is standard
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
    },
    colorRowMain: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
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
        paddingLeft: 52,
        paddingBottom: 16,
        backgroundColor: IOS_THEME.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5EA',
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
    addTriggerProminent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 48,
        justifyContent: 'center',
    },
    addTriggerTextProminent: {
        fontSize: 17,
        fontWeight: '500',
        color: IOS_THEME.blue,
    },
    presetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
        justifyContent: 'flex-start',
    },
    presetSwatch: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
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
