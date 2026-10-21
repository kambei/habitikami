import type { HabitSlot, HabitType } from '../types';

export interface TemplateHabit {
    name: { en: string; it: string };
    description: { en: string; it: string };
    color: string;
    slot: HabitSlot;
    type: HabitType;
    target?: number;
    unit?: { en: string; it: string };
}

export interface HabitTemplate {
    id: string;
    icon: string;
    title: { en: string; it: string };
    subtitle: { en: string; it: string };
    habits: TemplateHabit[];
}

/** Ready-made habit packs offered in the template picker (#15). */
export const HABIT_TEMPLATES: HabitTemplate[] = [
    {
        id: 'fitness',
        icon: '💪',
        title: { en: 'Fitness', it: 'Fitness' },
        subtitle: { en: 'Move every day, a little or a lot', it: 'Muoversi ogni giorno, poco o tanto' },
        habits: [
            { name: { en: 'Exercise', it: 'Esercizio' }, description: { en: 'At least 20 minutes of any training', it: 'Almeno 20 minuti di allenamento di qualsiasi tipo' }, color: '#ef4444', slot: 'morning', type: 'number', target: 20, unit: { en: 'min', it: 'min' } },
            { name: { en: 'Stretching', it: 'Stretching' }, description: { en: 'Five minutes of mobility', it: 'Cinque minuti di mobilità' }, color: '#f97316', slot: 'evening', type: 'check' },
            { name: { en: 'Walk', it: 'Camminata' }, description: { en: 'Steps add up: a walk outside', it: 'I passi contano: una camminata fuori' }, color: '#84cc16', slot: 'afternoon', type: 'number', target: 8000, unit: { en: 'steps', it: 'passi' } },
            { name: { en: 'Water', it: 'Acqua' }, description: { en: 'Stay hydrated', it: 'Resta idratato' }, color: '#0ea5e9', slot: 'any', type: 'number', target: 8, unit: { en: 'glasses', it: 'bicchieri' } },
        ],
    },
    {
        id: 'productivity',
        icon: '🧠',
        title: { en: 'Productivity', it: 'Produttività' },
        subtitle: { en: 'Protect your attention', it: 'Proteggi la tua attenzione' },
        habits: [
            { name: { en: 'Deep work', it: 'Deep work' }, description: { en: 'One focused block without interruptions', it: 'Un blocco di concentrazione senza interruzioni' }, color: '#6366f1', slot: 'morning', type: 'number', target: 90, unit: { en: 'min', it: 'min' } },
            { name: { en: 'No social media', it: 'Niente social' }, description: { en: 'No scrolling until the evening', it: 'Niente scroll fino a sera' }, color: '#8b5cf6', slot: 'any', type: 'check' },
            { name: { en: 'Journaling', it: 'Diario' }, description: { en: 'Three lines about the day', it: 'Tre righe sulla giornata' }, color: '#d946ef', slot: 'evening', type: 'check' },
            { name: { en: 'Plan tomorrow', it: 'Pianifica domani' }, description: { en: 'Pick the three things that matter', it: 'Scegli le tre cose che contano' }, color: '#3b82f6', slot: 'evening', type: 'check' },
        ],
    },
    {
        id: 'wellbeing',
        icon: '🧘',
        title: { en: 'Mental wellbeing', it: 'Benessere mentale' },
        subtitle: { en: 'Small daily resets', it: 'Piccoli reset quotidiani' },
        habits: [
            { name: { en: 'Meditation', it: 'Meditazione' }, description: { en: 'Even five minutes count', it: 'Anche cinque minuti contano' }, color: '#10b981', slot: 'morning', type: 'number', target: 10, unit: { en: 'min', it: 'min' } },
            { name: { en: 'Gratitude', it: 'Gratitudine' }, description: { en: 'One thing that went well', it: 'Una cosa andata bene' }, color: '#fcd34d', slot: 'evening', type: 'check' },
            { name: { en: 'Sleep 8h', it: 'Dormire 8h' }, description: { en: 'In bed on time', it: 'A letto in orario' }, color: '#a5b4fc', slot: 'evening', type: 'check' },
            { name: { en: 'Time outdoors', it: 'Tempo all\'aperto' }, description: { en: 'Daylight and fresh air', it: 'Luce del giorno e aria fresca' }, color: '#22c55e', slot: 'afternoon', type: 'number', target: 30, unit: { en: 'min', it: 'min' } },
        ],
    },
    {
        id: 'quit-smoking',
        icon: '🚭',
        title: { en: 'Quit smoking', it: 'Smettere di fumare' },
        subtitle: { en: 'Resist, notice, replace', it: 'Resisti, osserva, sostituisci' },
        habits: [
            { name: { en: 'Smoke-free day', it: 'Giorno senza fumo' }, description: { en: 'Not a single cigarette today', it: 'Nemmeno una sigaretta oggi' }, color: '#f43f5e', slot: 'any', type: 'check' },
            { name: { en: 'Trigger log', it: 'Diario trigger' }, description: { en: 'Write down when the craving came and why', it: 'Annota quando è arrivata la voglia e perché' }, color: '#fdba74', slot: 'evening', type: 'check' },
            { name: { en: 'Replacement exercise', it: 'Esercizio sostitutivo' }, description: { en: 'Breathing, a walk or water instead of a cigarette', it: 'Respirazione, una camminata o acqua al posto della sigaretta' }, color: '#5eead4', slot: 'any', type: 'check' },
        ],
    },
];
