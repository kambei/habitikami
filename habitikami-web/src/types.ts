
export interface UserProfile {
    email: string;
    spreadsheetId: string;
}

/**
 * Value of one habit cell: checkbox states (`TRUE`/`FALSE`), `SKIP`, `HALF`,
 * or a number for quantitative habits (the raw value; the target lives in HabitMeta).
 */
export type HabitCellValue = boolean | 'skipped' | 'half' | number;

export interface HabitData {
    day: string;
    date: string;
    habits: Record<string, HabitCellValue>;
    // ... potentially other fields
}

export type HabitType = 'check' | 'number';
export type HabitSlot = 'any' | 'morning' | 'afternoon' | 'evening';

/** Per-habit metadata stored in the HabitMeta sheet (see utils/habitMeta.ts). */
export interface HabitMeta {
    description: string;
    type: HabitType;
    /** Daily goal for quantitative habits (value >= target counts as done). */
    target?: number;
    /** Free-text unit shown next to the value, e.g. "glasses", "min". */
    unit?: string;
    slot: HabitSlot;
    /** Optional reminder time, "HH:MM" local. */
    time?: string;
}

export type SheetType = 'Weekdays' | 'Weekend' | 'Notes' | 'Counters'; // Added Notes, Counters
export type ViewType = SheetType | 'Graphs' | 'Focus' | 'MobNotes' | 'SmokeTemptation' | 'Training' | 'Help'; // Added MobNotes, SmokeTemptation, Training, Help

export interface TrainingLogEntry {
    date: string;       // DD/MM/YYYY
    section: string;    // e.g. 'Piano', 'Stretch', 'Sedia', etc.
    exercise: string;   // exercise name
    session: string;    // 'Mattina' | 'Pomeriggio' | 'Unica'
    duration: string;   // e.g. '3×30s', '5 min'
}

export interface GuidedStep {
    message: string;
    options: string[];
}

export interface SchedaStep {
    message: string;
    options: string[];
    allowFreeText: boolean;
    progress: number;
    completed: boolean;
    compiledDocument?: string;
}

export interface NoteData {
    date: string;
    content: string;
    links: string[]; // List of dates this note links to
}

export interface TemptationAction {
    id: string; // The column name in the spreadsheet
    label: string;
    color: string;
    type: 'resist' | 'succumb' | 'other';
}

export interface TemptationConfig {
    id: string;
    label: string;
    icon: string;
    actions: TemptationAction[];
}

// Data structure for resistance counters
export type CounterData = {
    date: string;
    [key: string]: any; // Allow any counter name
}

/** One mood/anxiety assessment, stored in the Mood sheet (see utils/mood.ts). */
export interface MoodEntry {
    date: string;        // ISO timestamp of the assessment
    timestamp: number;   // ms epoch
    anxiety: number;     // 0-100
    mood: number;        // 0-100 (0 = very bad, 100 = great)
    label: string;       // e.g. "Guided Session", "Emotion Diary"
    source?: 'chat' | 'worksheet' | 'local';
}

/** Free-text note of one habit on one day (HabitNotes sheet, see utils/habitNotes.ts). */
export interface HabitNote {
    date: string;   // DD/MM/YYYY
    habit: string;
    note: string;
}
