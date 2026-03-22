
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

// Data structure for resistance counters
export type CounterData = {
    date: string;
    smoke: number;
    smoked: number;
    coffee: number;
}
