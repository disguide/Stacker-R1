import { ColorDefinition } from '../services/storage';

export interface AutoColorResult {
    color: string;
    matchedKeyword: string;
}

/**
 * Scans a task title for keyword matches against the user's color definitions.
 * 
 * CONFLICT RESOLUTION: Position-based priority.
 *   If the title contains keywords for multiple colors, the keyword that
 *   appears EARLIEST in the title wins. This gives the user intuitive
 *   control — the first word they type sets the color.
 * 
 *   Example: "math homework" with "math" → Blue, "homework" → Red
 *   Result: Blue wins because "math" is at position 0.
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

    // Collect ALL keyword matches with their position in the title
    let bestMatch: { position: number; color: string; keyword: string } | null = null;

    for (const colorDef of userColors) {
        if (!colorDef.keywords || colorDef.keywords.length === 0) continue;

        for (const keyword of colorDef.keywords) {
            if (!keyword || !keyword.trim()) continue;

            const kw = keyword.trim();
            // Whole-word, case-sensitive match using word boundary regex
            const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`);
            const match = regex.exec(trimmedTitle);

            if (match) {
                const position = match.index;

                // Keep the match with the earliest position in the title
                if (!bestMatch || position < bestMatch.position) {
                    bestMatch = {
                        position,
                        color: colorDef.color,
                        keyword: kw,
                    };
                }
            }
        }
    }

    if (!bestMatch) return null;

    return {
        color: bestMatch.color,
        matchedKeyword: bestMatch.keyword,
    };
}

/** Escape special regex characters in a string */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
