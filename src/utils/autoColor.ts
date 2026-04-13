import { ColorDefinition } from '../services/storage';

export interface AutoColorResult {
    color: string;
    matchedKeyword: string;
}

/**
 * Scans a task title for keyword matches against the user's color definitions.
 * Returns the first match found (priority = color order in the list).
 * 
 * Matching is case-insensitive and whole-word only to prevent
 * false positives (e.g., "red" won't match "bored").
 * 
 * This is a pure function with zero side effects.
 */
export function detectAutoColor(
    title: string,
    userColors: ColorDefinition[]
): AutoColorResult | null {
    if (!title || !userColors || userColors.length === 0) return null;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return null;

    for (const colorDef of userColors) {
        if (!colorDef.keywords || colorDef.keywords.length === 0) continue;

        for (const keyword of colorDef.keywords) {
            if (!keyword || !keyword.trim()) continue;

            const kw = keyword.trim();
            // Whole-word, case-insensitive match using word boundary regex
            const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');

            if (regex.test(trimmedTitle)) {
                return {
                    color: colorDef.color,
                    matchedKeyword: kw,
                };
            }
        }
    }

    return null;
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
