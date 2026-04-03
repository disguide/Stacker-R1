export const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    accent: '#007AFF',
    border: '#E2E8F0',
    surface: '#FFFFFF',
    green: '#38A169',
};

export type FeatureKey = 'deadline' | 'properties' | 'recurrence' | 'reminder';

export const FEATURE_ORDER: FeatureKey[] = ['deadline', 'properties', 'recurrence', 'reminder'];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
    deadline: 'Deadline',
    properties: 'Properties',
    recurrence: 'Repeat',
    reminder: 'Remind',
};

export const FEATURE_ICONS: Record<FeatureKey, { name: string; lib: 'mci' | 'ion' }> = {
    deadline: { name: 'calendar-clock', lib: 'mci' },
    properties: { name: 'tag-outline', lib: 'mci' },
    recurrence: { name: 'repeat', lib: 'mci' },
    reminder: { name: 'bell-outline', lib: 'mci' },
};
