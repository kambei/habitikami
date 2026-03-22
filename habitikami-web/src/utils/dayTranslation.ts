export const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

/**
 * Translates an Italian day name (as stored in the sheet) to the current locale's day names.
 * @param italianDay The day name in Italian (e.g., "Lunedì")
 * @param translatedDays Array of translated day names from i18n
 * @returns The translated day name, or the original if not found
 */
export function translateDay(italianDay: string, translatedDays: string[]): string {
    const dayIndex = ITALIAN_DAYS.findIndex(d => d.toLowerCase() === italianDay.toLowerCase());
    if (dayIndex !== -1 && translatedDays[dayIndex]) {
        return translatedDays[dayIndex];
    }
    return italianDay;
}
