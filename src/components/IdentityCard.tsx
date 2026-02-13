import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Dimensions, Modal, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../services/storage';

interface IdentityCardProps {
    identity: NonNullable<UserProfile['identity']>;
    onUpdate: (identity: UserProfile['identity']) => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

type BodyPart = 'head' | 'torso' | 'arms' | 'legs';
type Side = 'anti' | 'hero';

export default function IdentityCard({ identity, onUpdate }: IdentityCardProps) {
    // Animation State
    const flipAnim = React.useRef(new Animated.Value(0)).current;
    const [flipped, setFlipped] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false);

    // Edit State
    const [editing, setEditing] = useState<{ side: Side; part: BodyPart; label: string; sublabel: string; color: string } | null>(null);
    const [tempValue, setTempValue] = useState('');

    const handleFlip = () => {
        if (isFlipping) return;
        setIsFlipping(true);

        const toValue = flipped ? 0 : 180;

        Animated.timing(flipAnim, {
            toValue,
            duration: 600,
            useNativeDriver: true,
        }).start(() => {
            setFlipped(!flipped);
            setIsFlipping(false);
        });
    };

    const frontInterpolate = flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['0deg', '180deg'],
    });

    const backInterpolate = flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['180deg', '360deg'],
    });

    const frontOpacity = flipAnim.interpolate({
        inputRange: [89, 90],
        outputRange: [1, 0],
    });

    const backOpacity = flipAnim.interpolate({
        inputRange: [89, 90],
        outputRange: [0, 1],
    });

    const frontStyle: any = {
        transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
        opacity: frontOpacity,
        zIndex: flipped ? 0 : 1, // Simple zIndex swap based on state, though opacity handles visibility
    };

    const backStyle: any = {
        transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
        opacity: backOpacity,
        zIndex: flipped ? 1 : 0,
    };

    const openEdit = (side: Side, part: BodyPart, label: string, sublabel: string, color: string) => {
        const val = identity[side]?.[part] || '';
        setEditing({ side, part, label, sublabel, color });
        setTempValue(val);
    };

    const saveEdit = () => {
        if (!editing) return;
        const newIdentity = { ...identity };
        if (!newIdentity[editing.side]) newIdentity[editing.side] = {};
        newIdentity[editing.side][editing.part] = tempValue;
        onUpdate(newIdentity);
        setEditing(null);
    };

    return (
        <View style={styles.container}>
            <View style={styles.cardContainer}>
                {/* FRONT: FRANKENSTEIN (ANTI) */}
                <Animated.View style={[styles.card, styles.frontCard, frontStyle]}>
                    <View style={styles.cardHeader}>
                        <View style={styles.headerTitleRow}>
                            <Text style={styles.cardTitle}>THE FRANKENSTEIN</Text>
                            <View style={styles.badgeAnti}>
                                <Text style={styles.badgeTextAnti}>ANTI-IDENTITY</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.cardSubtitle}>The deprecating version. Traits to delete.</Text>

                    <View style={styles.partsList}>
                        <PartRow
                            label="THE HEAD" sublabel="Mindset & Beliefs" color="#B91C1C"
                            value={identity.anti?.head}
                            placeholder="Limiting beliefs (e.g. 'I am lazy')"
                            onPress={() => openEdit('anti', 'head', "THE HEAD", "Mindset & Beliefs", "#EF4444")}
                        />
                        <PartRow
                            label="THE TORSO" sublabel="Environment & Standards" color="#B91C1C"
                            value={identity.anti?.torso}
                            placeholder="Toxic people or chaos"
                            onPress={() => openEdit('anti', 'torso', "THE TORSO", "Environment & Standards", "#EF4444")}
                        />
                        <PartRow
                            label="THE ARMS" sublabel="Bad Habits & Actions" color="#B91C1C"
                            value={identity.anti?.arms}
                            placeholder="Vices (e.g. Doomscrolling)"
                            onPress={() => openEdit('anti', 'arms', "THE ARMS", "Bad Habits & Actions", "#EF4444")}
                        />
                        <PartRow
                            label="THE LEGS" sublabel="Negative Outcomes" color="#B91C1C"
                            value={identity.anti?.legs}
                            placeholder="Results to avoid (e.g. Debt)"
                            onPress={() => openEdit('anti', 'legs', "THE LEGS", "Negative Outcomes", "#EF4444")}
                            isLast
                        />
                    </View>
                </Animated.View>

                {/* BACK: HERO (IDEAL) */}
                <Animated.View style={[styles.card, styles.backCard, backStyle]}>
                    <View style={styles.cardHeader}>
                        <View style={styles.headerTitleRow}>
                            <Text style={styles.cardTitleHero}>THE HERO</Text>
                            <View style={styles.badgeHero}>
                                <Text style={styles.badgeTextHero}>TRUE IDENTITY</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.cardSubtitle}>The V2.0 version. Who you are becoming.</Text>

                    <View style={styles.partsList}>
                        <PartRow
                            label="THE HEAD" sublabel="Core Values & Vision" color="#1D4ED8"
                            value={identity.hero?.head}
                            placeholder="New models (e.g. 'I am disciplined')"
                            onPress={() => openEdit('hero', 'head', "THE HEAD", "Core Values & Vision", "#3B82F6")}
                        />
                        <PartRow
                            label="THE TORSO" sublabel="High-Performer Environment" color="#1D4ED8"
                            value={identity.hero?.torso}
                            placeholder="Inspiring network & order"
                            onPress={() => openEdit('hero', 'torso', "THE TORSO", "High-Performer Environment", "#3B82F6")}
                        />
                        <PartRow
                            label="THE ARMS" sublabel="Power Habits & Skills" color="#1D4ED8"
                            value={identity.hero?.arms}
                            placeholder="Daily protocols (e.g. Deep Work)"
                            onPress={() => openEdit('hero', 'arms', "THE ARMS", "Power Habits & Skills", "#3B82F6")}
                        />
                        <PartRow
                            label="THE LEGS" sublabel="Target Results & KPIs" color="#1D4ED8"
                            value={identity.hero?.legs}
                            placeholder="Outcomes (e.g. $10k/mo, 6-pack)"
                            onPress={() => openEdit('hero', 'legs', "THE LEGS", "Target Results & KPIs", "#3B82F6")}
                            isLast
                        />
                    </View>
                </Animated.View>

                {/* FLIP BUTTON (Moved inside container for positioning) */}
                <TouchableOpacity style={styles.flipButtonCorner} onPress={handleFlip} activeOpacity={0.8}>
                    <Ionicons name="swap-horizontal" size={20} color="#FFF" />
                    <Text style={styles.flipButtonTextSmall}>FLIP CARD</Text>
                </TouchableOpacity>
            </View>

            {/* Old flip button removed */}

            {/* EDIT MODAL */}
            <Modal visible={!!editing} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { borderColor: editing?.color }]}>
                        <View style={[styles.modalHeader, { backgroundColor: editing?.color }]}>
                            <View>
                                <Text style={styles.modalTitle}>{editing?.label}</Text>
                                <Text style={styles.modalSubtitle}>{editing?.sublabel}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setEditing(null)}>
                                <Ionicons name="close-circle" size={28} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.modalInput}
                            value={tempValue}
                            onChangeText={setTempValue}
                            placeholder="Describe this part..."
                            multiline
                            autoFocus
                        />
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: editing?.color }]} onPress={saveEdit}>
                            <Text style={styles.saveBtnText}>SAVE PART</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const PartRow = ({ label, sublabel, value, placeholder, onPress, color, isLast }: any) => (
    <TouchableOpacity style={[styles.partRow, !isLast && styles.borderBottom]} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.partIcon}>
            <Ionicons name={getIcon(label)} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.partLabel, { color }]}>{label}</Text>

            </View>
            {value ? (
                <Text style={styles.partValue} numberOfLines={2}>{value}</Text>
            ) : (
                <Text style={styles.partPlaceholder}>{placeholder}</Text>
            )}
        </View>
        <Ionicons name="pencil" size={14} color="#CBD5E1" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
);

const getIcon = (label: string) => {
    if (label.includes('HEAD')) return 'skull-outline';
    if (label.includes('TORSO')) return 'shirt-outline';
    if (label.includes('ARMS')) return 'barbell-outline';
    if (label.includes('LEGS')) return 'footsteps-outline';
    return 'body-outline';
};

const styles = StyleSheet.create({
    container: { alignItems: 'center', marginVertical: 16 },
    cardContainer: { width: CARD_WIDTH, height: 420 },
    card: {
        position: 'absolute', width: '100%', height: '100%', borderRadius: 24,
        backgroundColor: '#FFF', padding: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16,
        elevation: 8, borderWidth: 1,
    },
    frontCard: { borderColor: '#FECACA', backgroundColor: '#FFF5F5' }, // Very light red bg
    backCard: { borderColor: '#BFDBFE', backgroundColor: '#F0F9FF' }, // Very light blue bg

    cardHeader: { marginBottom: 16 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontFamily: 'monospace', fontSize: 20, fontWeight: '900', color: '#991B1B', letterSpacing: -0.5 },
    cardTitleHero: { fontSize: 20, fontWeight: '800', color: '#1E40AF', letterSpacing: 0.5 },

    badgeAnti: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeTextAnti: { fontSize: 10, fontWeight: '800', color: '#991B1B' },
    badgeHero: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeTextHero: { fontSize: 10, fontWeight: '800', color: '#1E40AF' },

    cardSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 24, fontStyle: 'italic' },

    partsList: {
        backgroundColor: '#FFF', borderRadius: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
        elevation: 2
    },
    partRow: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 12 },
    borderBottom: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    partIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
    partLabel: { fontSize: 11, fontWeight: '800', opacity: 0.8 },
    partValue: { fontSize: 14, color: '#1E293B', fontWeight: '500', lineHeight: 20 },
    partPlaceholder: { fontSize: 14, color: '#94A3B8', fontStyle: 'italic' },

    flipButtonCorner: {
        position: 'absolute',
        bottom: 24, left: 24,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#0F172A',
        paddingVertical: 8, paddingHorizontal: 16,
        borderRadius: 20,
        zIndex: 10, // Ensure it sits on top of the cards
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4
    },
    flipButtonTextSmall: { color: '#FFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', borderWidth: 2 },
    modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    modalSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
    modalInput: { padding: 20, fontSize: 16, color: '#333', minHeight: 120, textAlignVertical: 'top' },
    saveBtn: { margin: 20, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
