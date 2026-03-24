
export interface UserProfile {
    email: string;
    spreadsheetId: string;
}

export interface HabitData {
    day: string;
    date: string;
    habits: Record<string, boolean>;
    // ... potentially other fields
}

export type SheetType = 'Weekdays' | 'Weekend' | 'Notes' | 'Counters'; // Added Notes, Counters
export type ViewType = SheetType | 'Graphs' | 'Focus' | 'MobNotes' | 'SmokeTemptation' | 'Help'; // Added MobNotes, SmokeTemptation, Help

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
