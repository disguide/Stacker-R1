import { StyleSheet, Platform } from 'react-native';
import { THEME } from '../constants/theme';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        height: 60,
    },
    spacer: {
        flex: 1,
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 16,
        gap: 12,
    },
    toolbarButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    toolbarButtonActive: {
        backgroundColor: '#E3F2FD',
    },

    toolbarIcon: {
        fontSize: 18,
        color: THEME.textPrimary,
    },
    mailIcon: {
        width: 24,
        height: 18,
        justifyContent: 'flex-end',
        position: 'relative',
    },
    mailBody: {
        width: 24,
        height: 18,
        borderWidth: 2,
        borderColor: THEME.textPrimary,
        borderRadius: 2,
    },
    mailFlap: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        borderLeftWidth: 12,
        borderRightWidth: 12,
        borderTopWidth: 9,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: THEME.textPrimary,
        transform: [{ translateY: 2 }],
    },
    organizeIcon: {
        width: 24,
        height: 18,
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    organizeLine: {
        width: 24,
        height: 2,
        backgroundColor: THEME.textPrimary,
        borderRadius: 1,
    },
    viewNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        gap: 8,
    },
    arrowButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowButtonDisabled: {
        opacity: 0.3,
    },
    arrowText: {
        fontSize: 22,
        color: THEME.textPrimary,
        fontWeight: 'bold',
        // fontFamily removed for system default
    },
    arrowTextDisabled: {
        color: '#CCCCCC',
    },
    viewLabelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
    },
    viewLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        // fontFamily removed for system default
    },
    viewLabelArrow: {
        fontSize: 10,
        color: THEME.textPrimary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(51, 51, 51, 0.4)', // Darker overlay
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewPickerContainer: {
        backgroundColor: THEME.bg,
        borderRadius: 4,
        paddingVertical: 8,
        minWidth: 150,
        borderWidth: 2,
        borderColor: THEME.border,
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    viewPickerOption: {
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    viewPickerOptionActive: {
        backgroundColor: '#EAE8DE', // Selection color
    },
    viewPickerText: {
        fontSize: 16,
        color: THEME.textPrimary,
        textAlign: 'center',
        // fontFamily removed for system default
    },
    viewPickerTextActive: {
        fontWeight: 'bold',
        color: THEME.textPrimary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Push stats to the right
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    dateText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    todayText: {
        color: '#007AFF',
    },
    dateSubtext: {
        fontSize: 14,
        color: '#64748B',
        marginTop: -4, // Tweak alignment
        fontWeight: '500',
    },
    dailyStatsContainer: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    dailyStatsText: { // Legacy?
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },

    // New Date Header Styles
    todayHeader: {
        // Optional: Add background highlight for today?
    },
    dateBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    todayDateBadge: {
        backgroundColor: '#333333',
        borderColor: '#333333',
    },
    dateNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333333',
        // fontFamily removed for system default
    },
    todayDateNumber: {
        color: '#FFFFFF',
    },
    dateMonth: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    todayDateMonth: {
        color: '#E2E8F0',
    },
    dayName: {
        fontSize: 22, // Same as todayDayName
        fontWeight: '600',
        color: THEME.textPrimary,
        marginBottom: 2,
        // fontFamily removed, using system default
    },
    todayDateSubtext: {
        color: THEME.accent,
    },
    todayDayName: {
        color: THEME.accent,
        fontSize: 22, // Bigger than regular 16
        fontWeight: 'bold',
    },
    dailyTaskCount: {
        fontSize: 13,
        color: THEME.textSecondary,
    },
    dailyTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    dailyTimeSum: {
        fontSize: 13,
        fontWeight: '600',
        color: THEME.textPrimary,
    },
    dotSeparator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5E0',
    },
    emptyState: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 14,
        fontStyle: 'italic',
        color: THEME.textSecondary,
    },
    addTaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxPlaceholder: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        marginRight: 14,
        borderStyle: 'dashed',
    },
    addTaskActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    addOptionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        marginRight: 8,
        gap: 6,
    },
    addOptionChipActive: {
        backgroundColor: '#333333',
    },
    addOptionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748B',
    },
    addSaveButton: {
        backgroundColor: THEME.success,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginLeft: 8,
    },
    addSaveText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },

    taskContainer: {
        backgroundColor: THEME.bg,
        marginBottom: 16,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    sliderContainer: {
        paddingHorizontal: 0,
        marginTop: -10,
    },
    taskCheckbox: {
        width: 22,
        height: 22,
        borderRadius: 6, // Rounded square
        borderWidth: 1.5,
        borderColor: '#444444',
        marginRight: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    taskCheckboxInner: {
        width: 12,
        height: 12,
        backgroundColor: THEME.success, // Green for checkmark
        borderRadius: 2,
    },
    taskLeftContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    taskTitle: {
        fontSize: 16,
        color: THEME.textPrimary,
        lineHeight: 22,
    },
    taskTitleCompleted: {
        color: THEME.success, // Green text
        opacity: 0.8,
        textDecorationLine: 'line-through',
    },

    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
        borderRadius: 0,
        marginBottom: 0,
    },
    taskItemCompleted: {
        backgroundColor: THEME.successBg, // Soft green background
        paddingHorizontal: 8, // Add padding back for the background color
        borderRadius: 4,
    },
    taskMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    deadlineText: {
        fontSize: 12,
        color: '#E53E3E', // Red for deadline
        fontWeight: '600',
    },
    estimateText: {
        fontSize: 12,
        color: THEME.textSecondary,
        fontStyle: 'italic',
    },
    taskActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionButton: {
        padding: 8,
    },
    actionIcon: {
        // Removed text styles as we swapped to Icons
    },
    rolledOverTag: {
        marginRight: 4,
    },
    rolledOverText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#C05621',
        backgroundColor: '#FEEBC8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    addTaskSpace: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 4,
        gap: 12,
        opacity: 0.6,
    },
    addTaskIcon: {
        fontSize: 22,
        color: THEME.textSecondary,
        fontWeight: '300',
    },
    addTaskTextContainer: {
        flex: 1,
    },
    addTaskText: {
        fontSize: 16,
        color: THEME.textSecondary,
        // fontFamily removed for system default
        fontStyle: 'italic',
    },
    addTaskUnderline: {
        height: 1,
        backgroundColor: THEME.textSecondary,
        marginTop: 2,
        width: '100%',
        opacity: 0.5,
    },
    // Sprint Styles
    sprintHeaderButton: {
        backgroundColor: '#FFFFFF', // White
        borderRadius: 8, // Rectangular
        paddingHorizontal: 16,
        paddingVertical: 6,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
        borderWidth: 1.5,
        borderColor: '#000',
    },
    sprintHeaderButtonActive: {
        backgroundColor: '#000000',
        borderWidth: 0,
    },
    sprintHeaderButtonText: {
        color: '#000000',
        fontWeight: 'bold',
        fontSize: 13,
    },
    sprintHeaderButtonTextActive: {
        color: '#FFFFFF', // White text on Dark button
    },
    // Blue Theme Overrides
    sprintContainer: {
        backgroundColor: '#EBF8FF', // Light Blue Background
    },
    sprintHeader: {
        backgroundColor: '#EBF8FF',
    },
    sprintTaskCard: {
        backgroundColor: '#FFFFFF', // Keep white
        borderColor: '#007AFF', // Blue border?
        borderWidth: 1, // Highlight cards?
    },
    startSprintContainer: {
        position: 'absolute',
        bottom: 20, // Lower it a bit
        left: 12, // Moved closer to left edge
        right: 20,
        flexDirection: 'column', // Stack vertically
        alignItems: 'flex-start', // Align to left
        justifyContent: 'flex-end', // Stick to bottom
        zIndex: 200,
        elevation: 200,
        pointerEvents: 'box-none', // Allow clicking through empty space
    },
    startSprintButton: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 30, // Pill shape
        // flex: 1, // Remove flex to let it size to content or specific width if needed, but flex:1 fills space
        // flex: 1, // Removed flex to let it size naturally next to organize button
        gap: 12,
        // Clicky/Tactile Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 6,
        borderWidth: 2,
        borderColor: '#000',
    },
    startSprintButtonDisabled: {
        backgroundColor: '#F1F5F9', // Light Grey
        borderColor: '#CBD5E0',
        elevation: 0,
        shadowOpacity: 0,
    },
    startSprintText: {
        color: '#000000', // Black
        fontSize: 16,
        fontWeight: '900', // Extra bold
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    organizeMethodButton: {
        backgroundColor: '#FFFFFF',
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },



    fixedInputContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        justifyContent: 'flex-end',
        zIndex: 100, // Top of everything in index.tsx
        elevation: 100,
    },
    backdropLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(51, 51, 51, 0.4)', // Restored
        zIndex: 90, // Just below container
        elevation: 90,
    },
    addTaskContainer: {
        backgroundColor: '#FFFFFF', // Explict White
        padding: 16,
        borderTopWidth: 2,
        borderTopColor: THEME.border,
        elevation: 101, // Keep above
        zIndex: 101,
        // Shadow for clear separation
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    taskList: {
        // Optional spacing if needed, but taskCard has marginBottom
    },

    toolbarEmoji: {
        fontSize: 22,
    },
    miniChip: {
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    miniChipText: {
        fontSize: 12,
        color: THEME.textPrimary,
        fontWeight: 'bold',
    },
    cancelBtn: {
        padding: 4,
    },
    cancelAddText: {
        fontSize: 20,
        color: THEME.textSecondary,
        paddingHorizontal: 10,
    },
    separator: {
        height: 1,
        backgroundColor: '#E2E8F0', // Very light for paper effect
        marginVertical: 8,
        opacity: 0.5,
    },
    subtaskList: {
        marginLeft: 40,
        marginBottom: 8,
    },
    subtaskDisplayItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
    },
    subtaskDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#CBD5E0',
        marginRight: 8,
    },
    subtaskDotCompleted: {
        backgroundColor: '#CBD5E0',
    },
    subtaskDisplayText: {
        fontSize: 14,
        color: THEME.textSecondary,
    },
    subtaskDisplayTextCompleted: {
        textDecorationLine: 'line-through',
        color: '#CBD5E0',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: THEME.textSecondary,
    },
    taskCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 8,
        // Ensure content (slider) doesn't bleed
        overflow: 'hidden',
        // Shadow (optional but good for card)
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    subtaskRowWrapper: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9', // Subtle separator between main task and subtasks
    },
    addTaskInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    addTaskInput: {
        fontSize: 16,
        color: THEME.textPrimary,
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    tactileButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: THEME.surface,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: THEME.border,
        shadowColor: THEME.border,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 0,
    },
    tactileButtonText: {
        color: THEME.textPrimary,
        fontWeight: 'bold',
        fontSize: 14,
        // fontFamily removed for system default
    },
    addToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingBottom: 4,
        gap: 16,
    },
    toolbarIconBtn: {
        padding: 4,
    },
});
