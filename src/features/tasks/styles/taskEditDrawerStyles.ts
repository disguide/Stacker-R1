import { StyleSheet, Platform, Dimensions } from 'react-native';

export const SCREEN_HEIGHT = Dimensions.get('window').height;
export const SCREEN_WIDTH = Dimensions.get('window').width;

// Theme Constants
export const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    accent: '#007AFF',
    border: '#333333',
    surface: '#FFFDF5',
    shadowColor: '#333333',
};

export const styles = StyleSheet.create({
    absoluteContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100, // Ensure it sits above other content but below Modal
        justifyContent: 'flex-end',
    },
    overlay: {
        // confusing name legacy, replaced by absoluteContainer basically
        flex: 1,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(51, 51, 51, 0.4)',
        zIndex: 1,
    },
    drawer: {
        backgroundColor: '#FFFFFF', // Explict white
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: 2,
        borderTopColor: THEME.border,
        paddingBottom: 130, // Brought higher up per user request
        minHeight: 410,
        // Removed elevation/shadow/opacity issues
        elevation: 0,
        zIndex: 10,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 8, // Reduced padding
    },
    // ... (keep existing)
    compactHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 10,
    },
    compactTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textSecondary,
    },
    compactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingHorizontal: 4, // Align with input
    },
    compactChip: {
        backgroundColor: THEME.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    compactChipText: {
        fontSize: 13,
        color: THEME.textPrimary,
        fontWeight: '500',
    },
    compactAddBtn: {
        backgroundColor: THEME.textPrimary,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    compactAddBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: THEME.textSecondary,
        borderRadius: 2,
        opacity: 0.3,
    },
    content: {
        paddingHorizontal: 20,
        flex: 1, // Ensure ScrollView takes space
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    headerCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: THEME.textPrimary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    headerCheckboxChecked: {
        backgroundColor: THEME.accent,
        borderColor: THEME.accent,
    },
    headerCheckboxInner: {
        width: 12,
        height: 12,
        backgroundColor: '#FFF',
        borderRadius: 2,
    },
    headerTagBanner: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 2,
    },
    headerTagSymbol: {
        fontSize: 16,
    },
    title: {
        flex: 1,
        fontSize: 22,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        // fontFamily removed for system default
    },
    saveButton: {
        fontSize: 16,
        fontWeight: 'bold',
        color: THEME.accent,
    },
    input: {
        fontSize: 18,
        borderBottomWidth: 2,
        borderBottomColor: '#E2E8F0',
        paddingVertical: 12,
        marginBottom: 16,
        color: THEME.textPrimary,
        // fontFamily removed for system default
    },
    // Carousel Styles
    carouselContainer: {
        marginBottom: 24,
    },
    carouselContent: {
        paddingHorizontal: 0,
        gap: 12,
    },
    featureCard: {
        width: 120,
        height: 80,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 10,
        justifyContent: 'space-between',
        // Minimal shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 60, // Heavy margin under the 4 squares as requested
    },
    featureCardGrid: {
        width: '48%',
        height: 80,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 10,
        justifyContent: 'space-between',
        // Minimal shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    featureIconContainer: {
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    featureLabel: {
        fontSize: 11,
        color: THEME.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    featureValue: {
        fontSize: 13,
        fontWeight: '600',
        color: THEME.textSecondary,
    },
    featureValueActive: {
        color: THEME.textPrimary,
        fontWeight: 'bold',
    },
    featureClearHtml: {
        position: 'absolute',
        top: 6,
        right: 6,
    },

    // Legacy / Shared
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: THEME.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tagScroll: {
        flexDirection: 'row',
    },


    // Tag Styles
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
    },
    tagEmoji: { fontSize: 14, marginRight: 4 },
    tagLabel: { fontSize: 13, fontWeight: '600' },

    // Color Picker Styles (This section is now redundant due to the new colorCircle/colorSelected above, but keeping for context if other styles were here)
    // The original colorCircle and colorSelected were replaced.

    // Type Chip Styles
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: 'transparent',
        gap: 6
    },
    typeChipSelected: {
        backgroundColor: '#333333',
        borderColor: '#333333',
    },
    typeChipText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    typeChipTextSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    deadlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    calendarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: THEME.surface,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: THEME.border,
        flex: 1,
        justifyContent: 'space-between',
        // Shadow
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    calendarButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textPrimary,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    calendarIcon: {
        fontSize: 18,
        color: THEME.textSecondary,
        fontWeight: 'bold',
    },
    clearButton: {
        padding: 12,
    },
    clearButtonText: {
        fontSize: 18,
        color: THEME.textSecondary,
        fontWeight: 'bold',
    },
    deleteButton: {
        marginTop: 10,
        alignItems: 'center',
        paddingVertical: 16,
        backgroundColor: '#FFF5F5',
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#FC8181',
        marginBottom: 20,
    },
    deleteText: {
        color: '#C53030',
        fontWeight: 'bold',
        fontSize: 16,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    subtaskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 4,
    },
    subtaskCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#444',
        marginRight: 12,
    },
    subtaskCheckboxChecked: {
        backgroundColor: THEME.accent,
        borderColor: THEME.accent,
    },
    subtaskText: {
        flex: 1,
        fontSize: 16,
        color: THEME.textPrimary,
    },
    subtaskTextDone: {
        textDecorationLine: 'line-through',
        color: THEME.textSecondary,
        opacity: 0.6,
    },
    deleteSubtaskText: {
        fontSize: 20,
        color: THEME.textSecondary,
        paddingHorizontal: 8,
    },
    addSubtaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    addSubtaskInput: {
        flex: 1,
        backgroundColor: THEME.surface,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 4,
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        color: THEME.textPrimary,
    },
    tactileAddBtn: {
        width: 44,
        height: 44,
        backgroundColor: THEME.surface,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: THEME.border,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    tactileAddBtnText: {
        fontSize: 24,
        color: THEME.textPrimary,
        fontWeight: '400',
    },

    // New Action Buttons (Tags)
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        marginBottom: 12
    },
    actionIconContainer: { marginRight: 10 },
    actionText: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333' },

    // Properties Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    modalDone: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.accent,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 12,
        marginTop: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    typeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        gap: 6
    },
    typeButtonActive: {
        backgroundColor: '#F0F9FF',
        borderColor: THEME.accent,
    },
    typeButtonText: {
        fontSize: 14,
        color: '#64748B',
    },
    importanceRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    importanceButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    importanceButtonActive: {
        backgroundColor: '#333',
        borderColor: '#333',
    },
    importanceText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
    },
    importanceTextActive: {
        color: '#FFF',
    },
    colorRow: {
        paddingVertical: 4,
        gap: 12
    },
    colorCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    colorSelected: {
        borderWidth: 3,
        borderColor: '#333',
        transform: [{ scale: 1.1 }],
    },

    // Carousel Overlay — centred floating window
    carouselOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    carouselSheet: {
        width: '92%',
        height: '80%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    carouselHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },

});
