export interface Color {
    red: number;
    green: number;
    blue: number;
    alpha?: number;
}

/**
 * Converts a hex string (e.g. "#FF0000") to a Sheets API Color object (0-1 floats).
 */
export function hexToSheetColor(hex: string): Color {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    return { red: r, green: g, blue: b, alpha: 1 };
}

/**
 * Converts a Sheets API Color object (0-1 floats) to a hex string.
 */
export function sheetColorToHex(color: Color): string {
    const toHex = (c: number | undefined) => {
        if (c === undefined) return '00';
        const val = Math.round(c * 255);
        const hex = val.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`;
}

// Preset palette matching Graphs.tsx + duplicates/alternatives
export const PRESET_COLORS = [
    '#Fca5a5', '#fdba74', '#fcd34d', '#bef264', '#86efac',
    '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc', '#93c5fd',
    '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#fda4af',
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#d946ef', '#f43f5e', '#ffffff', '#000000'
];
