// ============================================================================
// === CONFIGURATION & TYPES ===
// ============================================================================

// Design Tokens (Modern Stationery)
export const THEME = {
    bg: '#F8FAFC', // Slate 50
    textPrimary: '#1E293B', // Slate 800
    textSecondary: '#64748B', // Slate 500
    accent: '#3B82F6', // Blue 500
    border: '#333333', // Ink Black
    surface: '#FFFDF5', // Warm Cream
    inputBg: '#F2F0E9', // Darker Oat
    shadowColor: '#333333',
    success: '#38A169', // Green
    successBg: '#F0FFF4', // Light Green
};

// View Mode Types
export type ViewMode = 'day' | '3days' | 'week' | 'month' | 'all';

export const VIEW_CONFIG: Record<ViewMode, { label: string; days: number }> = {
    'day': { label: 'Day', days: 1 },
    '3days': { label: '3 Days', days: 3 },
    'week': { label: 'Week', days: 7 },
    'month': { label: 'Month', days: 30 },
    'all': { label: 'All', days: 90 },
};
