// ============================================================================
// InForma! Training Data
// Extracted from inForma!.html — all exercise catalogs, daily plans, sections
// ============================================================================

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Exercise {
  name: string;
  icon: string;
  duration: string;
  target?: string;
  description?: string;
  progression?: string;
  muscles?: string;
  why?: string;
  steps?: string;
  category?: string;
  youtubeQuery?: string;
}

export interface DailyPlan {
  title: string;
  duration: string;
  exercises: PlanExercise[];
}

export interface PlanExercise {
  name: string;
  duration: string;
  icon: string;
}

export type DayKey = 'lun' | 'mar' | 'mer' | 'gio' | 'ven' | 'sab' | 'dom';

export interface DayInfo {
  key: DayKey;
  labelShort: string;
  labelFull: string;
  jsDay: number;
}

export interface TrainingSection {
  key: string;
  icon: string;
  label: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export const DAYS: DayInfo[] = [
  { key: 'lun', labelShort: 'LUN', labelFull: 'Luned\u00ec', jsDay: 1 },
  { key: 'mar', labelShort: 'MAR', labelFull: 'Marted\u00ec', jsDay: 2 },
  { key: 'mer', labelShort: 'MER', labelFull: 'Mercoled\u00ec', jsDay: 3 },
  { key: 'gio', labelShort: 'GIO', labelFull: 'Gioved\u00ec', jsDay: 4 },
  { key: 'ven', labelShort: 'VEN', labelFull: 'Venerd\u00ec', jsDay: 5 },
  { key: 'sab', labelShort: 'SAB', labelFull: 'Sabato', jsDay: 6 },
  { key: 'dom', labelShort: 'DOM', labelFull: 'Domenica', jsDay: 0 },
];

// ---------------------------------------------------------------------------
// Sections (tabs + accent colours)
// ---------------------------------------------------------------------------

export const SECTIONS: TrainingSection[] = [
  { key: 'plan', icon: '\uD83D\uDCCB', label: 'Piano', color: '#FF6B35' },
  { key: 'stretch', icon: '\uD83E\uDDD8', label: 'Stretch', color: '#E0A526' },
  { key: 'chair', icon: '\uD83E\uDE91', label: 'Sedia', color: '#2E86AB' },
  { key: 'aikido', icon: '\uD83E\uDD4B', label: 'Aikido', color: '#6B5CE7' },
  { key: 'shaolin', icon: '\uD83D\uDC09', label: 'Shaolin', color: '#A23B72' },
  { key: 'iso', icon: '\uD83E\uDDF1', label: 'Isometria', color: '#EF476F' },
  { key: 'craving', icon: '\uD83D\uDEAD', label: 'Anti-Fumo', color: '#3BB273' },
];

// ---------------------------------------------------------------------------
// Morning Plans (MO)
// ---------------------------------------------------------------------------

export const MORNING_PLANS: Record<DayKey, DailyPlan> = {
  lun: {
    title: 'Core & Isometria Shaolin',
    duration: '25 min',
    exercises: [
      { name: '\uD83D\uDCF1 MadMuscles \u2014 Tai Chi', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: 'Stretching risveglio (sez. \uD83E\uDDD8)', duration: '5 min', icon: '\uD83E\uDDD8' },
      { name: 'Plank frontale (tappetino)', duration: '3\u00D730s', icon: '\uD83E\uDDF1' },
      { name: 'Horse Stance (Ma Bu)', duration: '3\u00D720s', icon: '\uD83D\uDC0E' },
      { name: 'Hollow Body Hold (tappetino)', duration: '3\u00D715s', icon: '\uD83C\uDF19' },
      { name: 'Wall Sit', duration: '3\u00D730s', icon: '\uD83E\uDDF1' },
      { name: 'Superman Hold (tappetino)', duration: '3\u00D715s', icon: '\uD83E\uDDB8' },
      { name: 'Respirazione diaframmatica', duration: '2 min', icon: '\uD83C\uDF2C\uFE0F' },
    ],
  },
  mar: {
    title: 'Cardio Corda & Gambe',
    duration: '25 min',
    exercises: [
      { name: '\uD83D\uDCF1 MadMuscles \u2014 Tai Chi', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: 'Stretching risveglio', duration: '5 min', icon: '\uD83E\uDDD8' },
      { name: 'Corda per saltare', duration: '3\u00D72min (30s pausa)', icon: '\uD83E\uDE22' },
      { name: 'Squat isometrico', duration: '3\u00D720s', icon: '\uD83E\uDDB5' },
      { name: 'Affondi statici', duration: '3\u00D715s/gamba', icon: '\uD83E\uDDBF' },
      { name: 'Calf Raise Hold', duration: '3\u00D720s', icon: '\uD83E\uDDB6' },
      { name: 'Respirazione box', duration: '2 min', icon: '\uD83C\uDF2C\uFE0F' },
    ],
  },
  mer: {
    title: 'Upper Body, Aikido & Shaolin',
    duration: '25 min',
    exercises: [
      { name: '\uD83D\uDCF1 MadMuscles \u2014 Tai Chi', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: 'Aiki Taiso solo warmup (sez. \uD83E\uDD4B)', duration: '5 min', icon: '\uD83E\uDD4B' },
      { name: 'Push-up Hold met\u00E0 (tappetino)', duration: '3\u00D715s', icon: '\uD83D\uDCAA' },
      { name: 'Dead Hang (barra)', duration: '3\u00D720s', icon: '\uD83D\uDD29' },
      { name: 'Palmi uniti pressione Shaolin', duration: '3\u00D710s', icon: '\uD83D\uDE4F' },
      { name: 'Mani intrecciate \u2014 tira', duration: '3\u00D710s', icon: '\uD83E\uDD1D' },
      { name: 'Plank laterale (tappetino)', duration: '2\u00D720s/lato', icon: '\uD83D\uDCD0' },
    ],
  },
  gio: {
    title: 'Cardio Cyclette & Core',
    duration: '25 min',
    exercises: [
      { name: '\uD83D\uDCF1 MadMuscles \u2014 Tai Chi', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: 'Stretching risveglio', duration: '5 min', icon: '\uD83E\uDDD8' },
      { name: 'Cyclette HIIT', duration: '10 min (30s forte/30s lento)', icon: '\uD83D\uDEB4' },
      { name: 'Plank tocco spalla (tappetino)', duration: '3\u00D730s', icon: '\uD83E\uDDF1' },
      { name: 'Boat Pose Hold (tappetino)', duration: '3\u00D715s', icon: '\u26F5' },
      { name: 'Glute Bridge Hold (tappetino)', duration: '3\u00D720s', icon: '\uD83C\uDF09' },
      { name: 'Respirazione 4-7-8', duration: '2 min', icon: '\uD83C\uDF2C\uFE0F' },
    ],
  },
  ven: {
    title: 'Full Body Isometrico',
    duration: '25 min',
    exercises: [
      { name: '\uD83D\uDCF1 MadMuscles \u2014 Tai Chi', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: 'Aiki Taiso solo warmup', duration: '5 min', icon: '\uD83E\uDD4B' },
      { name: 'Horse Stance profonda', duration: '3\u00D725s', icon: '\uD83D\uDC0E' },
      { name: 'Push-up Hold basso (tappetino)', duration: '3\u00D710s', icon: '\uD83D\uDCAA' },
      { name: 'Dead Hang', duration: '3\u00D7max', icon: '\uD83D\uDD29' },
      { name: 'Wall Sit', duration: '3\u00D730s', icon: '\uD83E\uDDF1' },
      { name: 'Hollow Body (tappetino)', duration: '3\u00D715s', icon: '\uD83C\uDF19' },
      { name: 'Meditazione Ki / Furitama', duration: '3 min', icon: '\uD83E\uDDD8' },
    ],
  },
  sab: {
    title: 'Endurance, Forza & Tai Chi Attivo',
    duration: '55-70 min',
    exercises: [
      { name: '\uD83D\uDCF1 MadMuscles \u2014 Tai Chi', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: 'Stretching completo (tappetino)', duration: '8 min', icon: '\uD83E\uDDD8' },
      { name: 'Corda per saltare', duration: '5\u00D72min', icon: '\uD83E\uDE22' },
      { name: 'Circuito Shaolin (sez. \uD83D\uDC09)', duration: '3 giri', icon: '\uD83D\uDC09' },
      { name: 'Pull-ups (o negatives)', duration: '4\u00D7max', icon: '\uD83D\uDD29' },
      { name: 'Push-ups varianti', duration: '4\u00D715', icon: '\uD83D\uDCAA' },
      { name: 'Squat jump', duration: '3\u00D712', icon: '\uD83E\uDDB5' },
      { name: 'Plank front + laterale (tappetino)', duration: '3\u00D745s', icon: '\uD83E\uDDF1' },
      { name: 'Horse Stance challenge', duration: '1\u00D7max', icon: '\uD83D\uDC0E' },
      { name: '\uD83D\uDCF1 MadMuscles \u2014 Tai Chi (peso)', duration: '15-20 min', icon: '\uD83D\uDC32' },
      { name: 'Stretching defaticante (tappetino)', duration: '5 min', icon: '\uD83E\uDDD8' },
    ],
  },
  dom: {
    title: 'Mobilit\u00E0, Aikido & Recovery',
    duration: '55-65 min',
    exercises: [
      { name: '\uD83D\uDCF1 MadMuscles \u2014 Tai Chi', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: "Bici all'aperto", duration: '20-30 min moderato', icon: '\uD83D\uDEB2' },
      { name: 'Aiki Taiso completo (sez. \uD83E\uDD4B)', duration: '10 min', icon: '\uD83E\uDD4B' },
      { name: 'Stretching profondo (tappetino)', duration: '10 min', icon: '\uD83E\uDD38' },
      { name: '\uD83D\uDCF1 Yoga Go \u2014 Tai Chi (relax)', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: 'Meditazione Ki / Furitama', duration: '5 min', icon: '\uD83E\uDDD8' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Afternoon Plans (PM) — sab/dom don't have afternoon sessions
// ---------------------------------------------------------------------------

export const AFTERNOON_PLANS: Partial<Record<DayKey, DailyPlan>> = {
  lun: {
    title: 'Cardio Cyclette & Gambe',
    duration: '25 min',
    exercises: [
      { name: 'Cyclette HIIT', duration: '12 min (40s/20s)', icon: '\uD83D\uDEB4' },
      { name: 'Squat profondi', duration: '3\u00D715', icon: '\uD83E\uDDB5' },
      { name: 'Affondi alternati', duration: '3\u00D712', icon: '\uD83E\uDDBF' },
      { name: 'Horse Stance', duration: '2\u00D730s', icon: '\uD83D\uDC0E' },
      { name: 'Stretching gambe (tappetino)', duration: '5 min', icon: '\uD83E\uDDD8' },
      { name: '\uD83D\uDCF1 Yoga Go \u2014 Tai Chi (sera)', duration: '10-15 min', icon: '\u262F\uFE0F' },
    ],
  },
  mar: {
    title: 'Upper Body & Pull',
    duration: '25 min',
    exercises: [
      { name: 'Pull-ups (o Australian)', duration: '4\u00D7max', icon: '\uD83D\uDD29' },
      { name: 'Push-ups varianti', duration: '4\u00D712', icon: '\uD83D\uDCAA' },
      { name: 'Dead Hang', duration: '3\u00D7max', icon: '\uD83D\uDD29' },
      { name: 'Isometrici braccia Shaolin', duration: '3\u00D710s', icon: '\uD83D\uDE4F' },
      { name: 'Stretching spalle + polsi', duration: '5 min', icon: '\uD83E\uDDD8' },
      { name: '\uD83D\uDCF1 Yoga Go \u2014 Tai Chi (sera)', duration: '10-15 min', icon: '\u262F\uFE0F' },
    ],
  },
  mer: {
    title: 'Corda + Core Sedia',
    duration: '25 min',
    exercises: [
      { name: 'Corda per saltare', duration: '4\u00D72min', icon: '\uD83E\uDE22' },
      { name: 'Seated Knee-to-Elbow (sez. \uD83E\uDE91)', duration: '3\u00D720', icon: '\uD83E\uDE91' },
      { name: 'Seated Torso Rotation', duration: '3\u00D716', icon: '\uD83E\uDE91' },
      { name: 'Plank (tappetino)', duration: '3\u00D740s', icon: '\uD83E\uDDF1' },
      { name: 'Stretching (tappetino)', duration: '5 min', icon: '\uD83E\uDDD8' },
      { name: '\uD83D\uDCF1 Yoga Go \u2014 Tai Chi (sera)', duration: '10-15 min', icon: '\u262F\uFE0F' },
    ],
  },
  gio: {
    title: 'Pull & Isometria',
    duration: '25 min',
    exercises: [
      { name: 'Pull-ups', duration: '5\u00D7max', icon: '\uD83D\uDD29' },
      { name: 'Push-up isometrico (tappetino)', duration: '3\u00D715s', icon: '\uD83D\uDCAA' },
      { name: 'Wall Sit una gamba', duration: '2\u00D715s/g', icon: '\uD83E\uDDF1' },
      { name: 'Pressione palmi Shaolin', duration: '3\u00D712s', icon: '\uD83D\uDE4F' },
      { name: 'Stretching completo (tappetino)', duration: '5 min', icon: '\uD83E\uDDD8' },
      { name: '\uD83D\uDCF1 Yoga Go \u2014 Tai Chi (sera)', duration: '10-15 min', icon: '\u262F\uFE0F' },
    ],
  },
  ven: {
    title: 'Cardio Leggero & Tai Chi',
    duration: '30 min',
    exercises: [
      { name: 'Cyclette moderata', duration: '12 min', icon: '\uD83D\uDEB4' },
      { name: 'Corda leggera', duration: '2\u00D72min', icon: '\uD83E\uDE22' },
      { name: '\uD83D\uDCF1 Yoga Go \u2014 Tai Chi (sera)', duration: '10-15 min', icon: '\u262F\uFE0F' },
      { name: 'Stretching profondo (tappetino)', duration: '5 min', icon: '\uD83E\uDDD8' },
    ],
  },
  sab: {
    title: 'Tai Chi Serale',
    duration: '10-15 min',
    exercises: [
      { name: '\uD83D\uDCF1 Yoga Go \u2014 Tai Chi (sera)', duration: '10-15 min', icon: '\u262F\uFE0F' },
    ],
  },
  dom: {
    title: 'Tai Chi Serale',
    duration: '10-15 min',
    exercises: [
      { name: '\uD83D\uDCF1 Yoga Go \u2014 Tai Chi (sera)', duration: '10-15 min', icon: '\u262F\uFE0F' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Stretching Exercises (ST)
// ---------------------------------------------------------------------------

export const STRETCHING_EXERCISES: Exercise[] = [
  {
    name: 'Neck Rolls',
    icon: '\uD83D\uDD04',
    duration: '',
    target: 'Collo, trapezio',
    description: 'In piedi o seduto, schiena dritta. Ruota la testa lentamente in cerchio completo: mento al petto \u2192 orecchio alla spalla \u2192 testa leggermente indietro \u2192 altro lato. 5 rotazioni per direzione, movimenti lenti. Mai forzare.',
    youtubeQuery: 'neck+rolls+stretch+tutorial',
  },
  {
    name: 'Lateral Neck Stretch',
    icon: '\u2194\uFE0F',
    duration: '',
    target: 'SCM, trapezio superiore',
    description: "In piedi o seduto. Inclina orecchio sinistro verso spalla sinistra. La mano sinistra sulla testa approfondisce delicatamente. Braccio destro si allunga verso il basso. 15-20s per lato. Non sollevare la spalla verso l'orecchio.",
    youtubeQuery: 'lateral+neck+stretch+tutorial',
  },
  {
    name: 'Shoulder Rolls',
    icon: '\uD83D\uDD03',
    duration: '',
    target: 'Deltoidi, trapezio, romboidi',
    description: 'In piedi, braccia rilassate ai fianchi. Solleva spalle verso orecchie, ruota indietro e gi\u00F9 descrivendo cerchi ampi. 10 rotazioni indietro, poi 10 avanti.',
    youtubeQuery: 'shoulder+rolls+warmup',
  },
  {
    name: 'Cross-Body Shoulder Stretch',
    icon: '\uD83D\uDCAA',
    duration: '',
    target: 'Deltoide posteriore',
    description: 'Braccio destro dritto attraverso il petto. Col sinistro, premi il destro verso di te sopra il gomito. Spalla bassa, non sollevarla. 20-30s per lato.',
    youtubeQuery: 'cross+body+shoulder+stretch',
  },
  {
    name: 'Overhead Triceps Stretch',
    icon: '\uD83D\uDE46',
    duration: '',
    target: 'Tricipiti, dorsali laterali',
    description: 'Braccio destro sopra la testa, piega gomito: la mano raggiunge la schiena tra le scapole. Mano sinistra premi gomito destro verso il basso. 20s per lato.',
    youtubeQuery: 'overhead+triceps+stretch',
  },
  {
    name: 'Cat-Cow (tappetino)',
    icon: '\uD83D\uDC31',
    duration: '',
    target: 'Colonna, mobilit\u00E0 spinale, core',
    description: 'A quattro zampe sul tappetino, mani sotto spalle, ginocchia sotto fianchi. INSPIRA: inarca schiena, pancia verso pavimento, sguardo su (Mucca). ESPIRA: arrotonda schiena verso soffitto, mento al petto (Gatto). Alterna fluidamente, ogni fase dura un respiro completo. 10-12 reps.',
    youtubeQuery: 'cat+cow+stretch+tutorial',
  },
  {
    name: "Child's Pose (tappetino)",
    icon: '\uD83E\uDDD2',
    duration: '',
    target: 'Schiena, fianchi, caviglie, spalle',
    description: 'In ginocchio sul tappetino, seduto sui talloni. Braccia avanti, busto tra le cosce, fronte a terra. Respira nella schiena bassa. 30-45s. Variante laterale: sposta mani a destra per allungare lato sinistro e viceversa.',
    youtubeQuery: 'child+pose+yoga+tutorial',
  },
  {
    name: 'Standing Forward Fold',
    icon: '\uD83D\uDE47',
    duration: '',
    target: 'Femorali, schiena bassa, polpacci',
    description: 'In piedi, piega avanti dai fianchi (non dalla schiena). Braccia penzolano verso pavimento. Ginocchia leggermente piegate se femorali rigidi. Lascia dondolare il busto. 20-30s.',
    youtubeQuery: 'standing+forward+fold+stretch',
  },
  {
    name: 'Standing Quad Stretch',
    icon: '\uD83E\uDDB5',
    duration: '',
    target: 'Quadricipiti, flessori anca',
    description: 'In piedi (appoggio a muro). Piega ginocchio destro, afferra piede destro dietro con la mano. Tira tallone verso gluteo, ginocchia vicine. Spingi fianco avanti per intensificare. 20-30s/gamba.',
    youtubeQuery: 'standing+quad+stretch',
  },
  {
    name: 'Hip Flexor Lunge (tappetino)',
    icon: '\uD83E\uDDBF',
    duration: '',
    target: 'Psoas, flessori anca, quadricipiti',
    description: 'Affondo basso sul tappetino: ginocchio destro a terra, piede sinistro avanti a 90\u00B0. Spingi fianchi avanti/gi\u00F9. Allungamento nella coscia anteriore lato posteriore. Braccia su fianchi o sopra la testa. 20-30s/lato.',
    youtubeQuery: 'hip+flexor+lunge+stretch',
  },
  {
    name: 'Pigeon Pose (tappetino)',
    icon: '\uD83D\uDC26',
    duration: '',
    target: 'Glutei, piriforme, flessori anca',
    description: 'Da quadrupede sul tappetino: ginocchio destro avanti verso polso destro, piede verso fianco sinistro. Gamba sinistra estesa dietro. Abbassa busto verso pavimento. 30-45s/lato. Se troppo intenso: "Figure 4" sdraiato sul tappetino.',
    youtubeQuery: 'pigeon+pose+beginner+tutorial',
  },
  {
    name: 'Butterfly Stretch (tappetino)',
    icon: '\uD83E\uDD8B',
    duration: '',
    target: 'Adduttori, flessori anca',
    description: 'Seduto sul tappetino, piedi uniti, ginocchia aperte. Premi ginocchia verso pavimento con i gomiti. Schiena dritta. 30-45s. Piega busto avanti per approfondire.',
    youtubeQuery: 'butterfly+stretch+tutorial',
  },
  {
    name: 'Spinal Twist (tappetino)',
    icon: '\uD83C\uDF00',
    duration: '',
    target: 'Obliqui, colonna, glutei, lombari',
    description: 'Sdraiato sul tappetino, braccia a T. Piega ginocchio destro, portalo verso lato sinistro. Mano sinistra lo guida. Guarda verso mano destra. Spalle a contatto col tappetino. 20-30s/lato.',
    youtubeQuery: 'supine+spinal+twist+stretch',
  },
  {
    name: 'Cobra Stretch (tappetino)',
    icon: '\uD83D\uDC0D',
    duration: '',
    target: 'Addominali, petto, flessori anca',
    description: 'Pancia a terra, mani sotto spalle. Spingi busto su, braccia semi-dritte. Fianchi restano a terra. Sguardo avanti. Non forzare la schiena bassa. 15-20s.',
    youtubeQuery: 'cobra+stretch+yoga+tutorial',
  },
  {
    name: 'Downward Dog (tappetino)',
    icon: '\uD83D\uDC15',
    duration: '',
    target: 'Catena posteriore completa',
    description: 'Da quadrupede: solleva fianchi formando V rovesciata. Mani larghe spalle, piedi larghi anche. Talloni verso pavimento. Testa rilassata. Pedala i piedi per sciogliere polpacci. 30-45s.',
    youtubeQuery: 'downward+dog+tutorial+beginner',
  },
  {
    name: 'Wrist Circles & Stretch',
    icon: '\uD83E\uDD1A',
    duration: '',
    target: 'Polsi, avambracci (pre-Aikido/Shaolin)',
    description: 'Intreccia dita, ruota polsi in cerchi: 10/direzione. Poi: braccio davanti palmo su, tira dita verso te 15s. Palmo gi\u00F9, tira gi\u00F9 15s. Entrambi i polsi. Fondamentale prima di qualsiasi lavoro isometrico.',
    youtubeQuery: 'wrist+stretches+warmup',
  },
];

// ---------------------------------------------------------------------------
// Chair Exercises (CH)
// ---------------------------------------------------------------------------

export const CHAIR_EXERCISES: Exercise[] = [
  {
    name: 'Seated Knee Lifts (Marcia)',
    icon: '\uD83E\uDDB5',
    duration: '',
    target: 'Core basso, flessori anca',
    description: 'Seduto dritto sul bordo, piedi piatti. Core attivo: solleva un ginocchio verso il petto senza inclinarti. Abbassa lento, alterna. Schiena dritta, spalle rilassate. 12-16 reps \u00D7 3. Intensifica: pausa 2s in cima.',
    youtubeQuery: 'seated+knee+lifts+chair+exercise',
  },
  {
    name: 'Seated Torso Twist',
    icon: '\uD83D\uDD04',
    duration: '',
    target: 'Obliqui, mobilit\u00E0 spinale',
    description: 'Mani dietro testa, gomiti aperti. Ruota busto a destra/sinistra dal CORE \u2014 i fianchi restano fermi. Espira nella rotazione, inspira al centro. 45s alternando \u00D7 3.',
    youtubeQuery: 'seated+torso+twist+chair',
  },
  {
    name: 'Seated Lean Back Hold',
    icon: '\u2197\uFE0F',
    duration: '',
    target: 'Retto addominale, endurance',
    description: 'Bordo sedia, braccia incrociate. Inclina busto INDIETRO pochi gradi \u2014 schiena dritta, NON arrotondata. Addominali si accendono. Respira normalmente. 15-20s \u00D7 3. Progredisci a 30s.',
    youtubeQuery: 'seated+lean+back+hold+core',
  },
  {
    name: 'Seated Side Bend',
    icon: '\uD83D\uDCD0',
    duration: '',
    target: 'Obliqui laterali, intercostali',
    description: "Una mano dietro testa. Piega LATERALMENTE (no rotazione), l'altra mano scende lungo la sedia. Senti allungamento lato opposto. 45s alternando \u00D7 3.",
    youtubeQuery: 'seated+side+bend+exercise',
  },
  {
    name: 'Seated Bicycle Crunch',
    icon: '\uD83D\uDD00',
    duration: '',
    target: 'Core completo, coordinazione',
    description: 'Mani dietro testa. Ginocchio sinistro su + gomito destro verso di esso. Alterna in modo controllato \u2014 qualit\u00E0 > velocit\u00E0. 30-60s \u00D7 3.',
    youtubeQuery: 'seated+bicycle+crunch+chair',
  },
  {
    name: 'Seated V-Sit Hold',
    icon: '\u270C\uFE0F',
    duration: '',
    target: 'Core profondo, trasverso',
    description: 'Mani sui bordi sedia. Inclina indietro, solleva ENTRAMBI i piedi da terra. Ginocchia piegate ok. Core contratto, respira. 15-30s \u00D7 3. Progredisci estendendo le gambe.',
    youtubeQuery: 'seated+v+sit+hold',
  },
  {
    name: 'Palms Press isometrico',
    icon: '\uD83D\uDE4F',
    duration: '',
    target: 'Petto, spalle, core',
    description: 'Palmi uniti a preghiera, gomiti fuori. Pressione crescente 2-3s \u2192 massimale 10s \u2192 rilascio 2-3s. Respira normalmente. 5 reps. Varia altezze: petto, fronte, ombelico.',
    youtubeQuery: 'isometric+palms+press',
  },
  {
    name: 'Seated Cat-Cow',
    icon: '\uD83D\uDC31',
    duration: '',
    target: 'Mobilit\u00E0 spinale, rilassamento',
    description: 'Mani su ginocchia. INSPIRA: petto avanti, inarca (Cow). ESPIRA: arrotonda schiena, mento al petto (Cat). Fluido col respiro. 45s.',
    youtubeQuery: 'seated+cat+cow+stretch',
  },
];

// ---------------------------------------------------------------------------
// Aikido Exercises (AK)
// ---------------------------------------------------------------------------

export const AIKIDO_EXERCISES: Exercise[] = [
  {
    name: 'Nikyo Undo (Stretch polso interno)',
    icon: '\uD83E\uDD1A',
    duration: '',
    category: 'Polsi \u2014 Solo',
    description: "In piedi in posizione naturale (shizentai). Afferra il dorso della mano sinistra con la destra, piegando il polso sinistro verso l'interno dell'avambraccio. Porta delicatamente le mani verso l'alto vicino al corpo, gomiti bassi e aderenti. Sentirai lo stretch sulla parte esterna del polso e dell'avambraccio. Non forzare mai. 8 ripetizioni per mano, lentamente e con mente presente.",
    progression: 'Presa leggera \u2192 aumenta pressione nelle settimane. Fai prima di ogni sessione Shaolin.',
    muscles: 'Polsi, estensori avambraccio, tendini',
    youtubeQuery: 'aikido+nikyo+undo+wrist+exercise',
  },
  {
    name: 'Kote Gaeshi Undo (Stretch polso esterno)',
    icon: '\u270B',
    duration: '',
    category: 'Polsi \u2014 Solo',
    description: "In shizentai. Mano destra afferra la base del pollice sinistro, ruotando il polso sinistro verso l'esterno e verso il basso. Il movimento \u00E8 una rotazione dell'intero polso, non solo una piegatura. Lo stretch agisce sull'interno del polso e dell'avambraccio. 8 ripetizioni per mano. Lento e controllato \u2014 i polsi sono fragili.",
    progression: 'Quotidiano! Essenziale per flessibilit\u00E0 polsi',
    muscles: 'Polsi, flessori avambraccio, tendini',
    youtubeQuery: 'aikido+kote+gaeshi+undo+wrist',
  },
  {
    name: 'Sankyo Undo (Stretch polso torsione)',
    icon: '\uD83E\uDEF3',
    duration: '',
    category: 'Polsi \u2014 Solo',
    description: "Mani unite davanti al centro del corpo (hara, 3cm sotto ombelico). Mano destra sopra la sinistra, palmo sinistro rivolto a sinistra. Ad ogni conteggio porta le mani verso l'alto vicino al corpo, gomiti in basso. Lo stretch agisce sulla torsione del polso. 8 ripetizioni per mano. Mantieni consapevolezza della postura.",
    progression: "Pratica con \"mente estesa\" \u2014 visualizza energia che scorre dalle dita",
    muscles: 'Polsi, avambracci, struttura della presa',
    youtubeQuery: 'aikido+sankyo+undo+wrist',
  },
  {
    name: 'Funakogi Undo (Rematore)',
    icon: '\uD83D\uDEA3',
    duration: '',
    category: 'Movimento corpo \u2014 Solo',
    description: "In hanmi (un piede avanti, 60% peso davanti). Sposta i fianchi AVANTI piegando il ginocchio anteriore \u2192 le mani si estendono dai fianchi in avanti con dita rivolte verso il basso \u2192 i fianchi tornano INDIETRO \u2192 le mani tornano ai fianchi. Immagina di remare una barca. Il movimento parte SEMPRE dai fianchi, le braccia sono estensioni passive. 8-10 reps per lato, poi cambia piede avanzato.",
    progression: 'Sett 1-2: timing fianchi\u2192mani. Sett 3+: fluidit\u00E0 e potenza dal centro',
    muscles: 'Core, fianchi, spalle, coordinazione mente-corpo',
    youtubeQuery: 'aikido+funakogi+undo+rowing',
  },
  {
    name: 'Ikkyo Undo (Movimento del taglio)',
    icon: '\uD83D\uDE4C',
    duration: '',
    category: 'Movimento corpo \u2014 Solo',
    description: "In hanmi. Fianchi avanti \u2192 braccia oscillano in avanti e VERSO L'ALTO fino all'altezza degli occhi, mani aperte. Poi le mani scendono potenti verso i fianchi (come un taglio di spada discendente) mentre i fianchi tornano indietro. La fase DISCENDENTE \u00E8 la pi\u00F9 importante: rilassata ma potente. 8-10 reps per lato.",
    progression: "Concentrati sulla discesa: \u00E8 il fondamento della tecnica Ikkyo dell'Aikido",
    muscles: 'Spalle, core, coordinazione, tempismo',
    youtubeQuery: 'aikido+ikkyo+undo+exercise',
  },
  {
    name: 'Zengo Undo (Avanti-indietro con pivot)',
    icon: '\uD83D\uDD01',
    duration: '',
    category: 'Movimento corpo \u2014 Solo',
    description: "Identico a Ikkyo Undo ma IN DUE DIREZIONI. Esegui il movimento verso avanti, poi pivota di 180\u00B0 sulla pianta del piede anteriore e ripeti nella direzione opposta. Il pivot deve essere fluido e centrato \u2014 il cardine \u00E8 il tuo hara. Le braccia seguono naturalmente la rotazione del corpo. 8 reps.",
    progression: 'Allena la rotazione centrata \u2014 imagina di gestire due avversari',
    muscles: 'Core, equilibrio, coordinazione rotazionale, propriocezione',
    youtubeQuery: 'aikido+zengo+undo',
  },
  {
    name: 'Tekubi Kosa Undo (Incrocio polsi)',
    icon: '\u2716\uFE0F',
    duration: '',
    category: 'Movimento corpo \u2014 Solo',
    description: 'In piedi, posizione naturale, braccia rilassate lungo i fianchi. Rilassa e oscilla le braccia partendo dalle DITA fino a incrociare i polsi davanti al basso ventre (punto "one point"). Rilascia immediatamente e torna alla posizione iniziale. 5 ripetizioni con polso sinistro davanti, poi 5 con destro davanti. Il movimento \u00E8 GUIDATO DALLA GRAVIT\u00C0 \u2014 non forzare, lascia le braccia oscillare naturalmente.',
    progression: 'Cerca il ritmo naturale \u2014 non tirare le braccia',
    muscles: 'Polsi, spalle, rilassamento muscolare',
    youtubeQuery: 'aikido+tekubi+kosa+undo',
  },
  {
    name: 'Ude Furi Undo (Oscillazione braccia)',
    icon: '\uD83C\uDF0A',
    duration: '',
    category: 'Movimento corpo \u2014 Solo',
    description: 'In piedi naturale. Ruota il busto a destra e sinistra usando il centro del corpo \u2014 le braccia sono completamente rilassate e "volano" a livello delle spalle per inerzia della rotazione. Come un albero i cui rami oscillano col vento. Le braccia NON hanno tensione propria. Il movimento viene SOLO dalla rotazione del centro. 8-10 reps.',
    progression: 'Se le braccia sono rigide, non stai facendo bene. Cerca totale rilassamento',
    muscles: 'Spalle, rotazione spinale, rilassamento profondo',
    youtubeQuery: 'aikido+ude+furi+undo+arm+swing',
  },
  {
    name: 'Tai Sabaki (Footwork base)',
    icon: '\uD83D\uDC63',
    duration: '',
    category: 'Footwork \u2014 Solo',
    description: "Pratica i tre spostamenti fondamentali dell'Aikido da solo: 1) TENKAN: un piede avanti, pivota di 180\u00B0 sulla pianta del piede anteriore. 2) IRIMI: passo deciso avanti verso un avversario immaginario. 3) IRIMI-TENKAN: passo avanti + pivot. Ogni movimento lento, centro basso e stabile. 5-8 reps per tipo, per lato.",
    progression: 'Sett 1-2: singoli movimenti. Sett 3+: combinazioni fluide',
    muscles: 'Gambe, core, equilibrio, agilit\u00E0, propriocezione',
    youtubeQuery: 'aikido+tai+sabaki+footwork+solo+practice',
  },
  {
    name: 'Koho Tento Undo (Roll indietro \u2014 tappetino)',
    icon: '\uD83D\uDD03',
    duration: '',
    category: 'Ukemi \u2014 Solo',
    description: "Seduto sul tappetino yoga, gambe piegate o incrociate. Rotola all'indietro portando le ginocchia verso il petto, mento leggermente abbassato. Le mani battono il tappetino durante il rotolamento per assorbire l'impatto. Usa lo slancio per tornare in posizione seduta. 8-10 reps. Superficie morbida obbligatoria (tappetino yoga).",
    progression: 'Base per imparare le cadute \u2014 inizia piano, non usare il collo per spingerti',
    muscles: 'Core, schiena, coordinazione, fiducia nel proprio corpo',
    youtubeQuery: 'aikido+koho+tento+undo+backward+roll',
  },
  {
    name: 'Furitama (Vibrazione/Meditazione Ki)',
    icon: '\uD83D\uDD14',
    duration: '',
    category: 'Meditazione \u2014 Solo',
    description: "In piedi, piedi larghezza spalle. Unisci le mani davanti al basso ventre con le dita intrecciate. Vibra/scuoti le mani e il corpo molto rapidamente per 30-60 secondi. Poi fermati completamente e resta immobile, sentendo l'energia nel corpo. Respira profondamente per 1-2 minuti. Questa \u00E8 una pratica di centratura (misogi) usata da O-Sensei all'inizio di ogni sessione. Calma la mente e centra il Ki nel hara.",
    progression: "Fallo all'inizio e alla fine della pratica Aikido",
    muscles: 'Sistema nervoso, centratura mentale, rilassamento',
    youtubeQuery: 'aikido+furitama+meditation+exercise',
  },
];

// ---------------------------------------------------------------------------
// Shaolin Exercises (SH)
// ---------------------------------------------------------------------------

export const SHAOLIN_EXERCISES: Exercise[] = [
  {
    name: 'Horse Stance (Ma Bu / \u9A6C\u6B65)',
    icon: '\uD83D\uDC0E',
    duration: '',
    category: 'Fondamentale',
    description: "La posizione regina dello Shaolin. Piedi larghi il DOPPIO delle spalle, punte fuori ~30\u00B0. Abbassa i fianchi come seduto su sedia invisibile \u2014 schiena DRITTA, immagina di scivolare lungo un palo. Ginocchia spinte aggressivamente verso FUORI sopra le punte dei piedi, MAI verso l'interno. Tensione brutale in glutei e interno cosce. Respira normalmente. Sguardo avanti.",
    progression: 'Sett 1-2: 3\u00D720s alta (1/4) \u2192 Sett 3-4: 3\u00D730s media \u2192 Sett 5+: 3\u00D745s+ profonda',
    muscles: 'Quadricipiti, glutei, adduttori, core, stabilizzatori anca',
    youtubeQuery: 'shaolin+horse+stance+ma+bu+tutorial',
  },
  {
    name: 'Palmi Uniti \u2014 Pressione (\u5408\u638C)',
    icon: '\uD83D\uDE4F',
    duration: '',
    category: 'Isometrico Braccia',
    description: 'Palmi uniti a preghiera davanti al petto, gomiti verso fuori, spalle abbassate. Aumenta pressione tra i palmi gradualmente per 2-3 secondi, poi MASSIMA tensione per 10s. Respira normalmente \u2014 NON trattenere il fiato. Rilascio graduale in 2-3s. L\'opposizione crea tensione in petto, spalle e braccia senza movimento visibile.',
    progression: 'Varia angoli: petto (pettorali), sopra testa (deltoidi), ombelico (core)',
    muscles: 'Pettorali, deltoidi, tricipiti',
    youtubeQuery: 'isometric+prayer+press+exercise',
  },
  {
    name: 'Mani Intrecciate \u2014 Tira',
    icon: '\uD83E\uDD1D',
    duration: '',
    category: 'Isometrico Schiena',
    description: 'Intreccia le dita davanti al petto/sterno. Cerca di TIRARE le mani in direzioni opposte con forza massimale. Le mani non si staccheranno, ma la tensione si scarica su schiena, bicipiti e avambracci. 10s, respira, rilascio graduale 2-3s. 3-5 ripetizioni.',
    progression: 'Varia: petto (dorsali), fronte (trapezio), ombelico (lombari)',
    muscles: 'Dorsali, bicipiti, avambracci, romboidi',
    youtubeQuery: 'isometric+interlocked+fingers+pull+exercise',
  },
  {
    name: 'Pugno vs Palmo \u2014 Rotazione',
    icon: '\u270A',
    duration: '',
    category: 'Isometrico Avambracci',
    description: "Chiudi mano destra a pugno. Avvolgilo con la mano sinistra. Il pugno tenta di RUOTARE in senso orario, la mano resiste in senso antiorario. Tensione massimale 10s. Inverti direzione. Cambia mano. Sviluppa una presa d'acciaio e avambracci forti.",
    progression: 'Da 10s a 20s gradualmente. Varia anche pugno che spinge su/gi\u00F9',
    muscles: 'Avambracci, muscoli presa, polsi',
    youtubeQuery: 'isometric+fist+rotation+forearm',
  },
  {
    name: 'Iron Bridge (tappetino)',
    icon: '\uD83C\uDF09',
    duration: '',
    category: 'Core & Schiena',
    description: 'Sdraiato sul tappetino, piedi piatti a terra larghezza anche. Braccia lungo i fianchi, palmi a terra. Spingi attraverso i talloni e solleva fianchi fino a creare linea dritta spalle-fianchi-ginocchia. STRINGI i glutei in alto. Non iperestendere la schiena bassa. Respira normalmente durante il hold.',
    progression: '20s \u2192 30s \u2192 45s. Avanzato: solleva un piede e tieni su una gamba',
    muscles: 'Glutei, lombari, core posteriore, femorali',
    youtubeQuery: 'glute+bridge+hold+isometric',
  },
  {
    name: 'Wall Push (Spinta al Muro)',
    icon: '\uD83E\uDDF1',
    duration: '',
    category: 'Isometrico Petto',
    description: 'Davanti a un muro solido, mani appoggiate a livello petto, braccia quasi estese. Spingi il muro come se volessi spostarlo. Tensione massimale in 2-3s, mantieni 10s. Corpo leggermente inclinato avanti. Respira lentamente durante lo sforzo. Non trattenere il fiato.',
    progression: 'Varia: braccia dritte (petto), piegate a 90\u00B0 (petto medio), mani sopra testa (spalle)',
    muscles: 'Pettorali, deltoidi anteriori, tricipiti, core',
    youtubeQuery: 'wall+push+isometric+chest',
  },
  {
    name: 'Towel Pull Apart',
    icon: '\uD83E\uDDE3',
    duration: '',
    category: 'Isometrico Schiena',
    description: "Tieni un asciugamano (o cintura) teso davanti a te con entrambe le mani, braccia dritte a larghezza spalle. Tira le mani verso l'ESTERNO come se volessi strapparlo. Lavoro intenso tra le scapole e nei deltoidi posteriori. 10s tensione massimale \u00D7 3-5 reps.",
    progression: 'Varia: braccia davanti (dorsali), sopra testa (trapezio), dietro schiena (romboidi)',
    muscles: 'Dorsali, romboidi, deltoidi posteriori, trapezio',
    youtubeQuery: 'isometric+towel+pull+apart',
  },
  {
    name: 'Neck Isometrics',
    icon: '\uD83E\uDD92',
    duration: '',
    category: 'Collo',
    description: 'Mano sulla FRONTE: premi la testa in avanti contro la mano che resiste. 8s. Mano sulla TEMPIA destra: premi lateralmente. 8s. Poi sinistra. 8s. Mani intrecciate DIETRO la testa: premi indietro. 8s. ZERO movimento visibile \u2014 solo tensione isometrica. MAI fare scatti o movimenti bruschi col collo.',
    progression: 'Inizia al 50% della forza, progredisci a 80% max. Mai 100% sul collo',
    muscles: 'Sternocleidomastoideo, trapezio superiore, cervicali',
    youtubeQuery: 'isometric+neck+exercises+tutorial',
  },
];

// ---------------------------------------------------------------------------
// Isometric Exercises (ISO)
// ---------------------------------------------------------------------------

export const ISOMETRIC_EXERCISES: Exercise[] = [
  {
    name: 'Wall Sit (Sedia al Muro)',
    icon: '\uD83E\uDDF1',
    duration: '',
    category: 'Gambe, Core',
    description: 'Schiena piatta contro il muro, ginocchia a 90\u00B0. Peso sui talloni.',
    progression: '3 \u00D7 30s \u2192 45s \u2192 60s. Non appoggiare le mani sulle cosce.',
    muscles: 'Quadricipiti, glutei, ischiocrurali',
    youtubeQuery: 'wall+sit+exercise',
  },
  {
    name: 'Plank Frontale',
    icon: '\uD83D\uDCCF',
    duration: '',
    category: 'Core Totale',
    description: 'In appoggio su avambracci e punte dei piedi. Gomiti sotto le spalle. Corpo in linea retta da testa a talloni.',
    progression: '3 \u00D7 30s \u2192 45s \u2192 60s. Attiva i glutei pesantemente.',
    muscles: 'Retto addominale, trasverso, spalle',
    youtubeQuery: 'front+plank+perfect+form',
  },
  {
    name: 'Superman Hold',
    icon: '\uD83E\uDDB8',
    duration: '',
    category: 'Catena Posteriore',
    description: 'Sdraiato prono sul tappetino. Solleva braccia (dritte avanti) e gambe tese contemporaneamente da terra. Lo sguardo \u00E8 verso il basso.',
    progression: '3 \u00D7 15s \u2192 20s \u2192 30s.',
    muscles: 'Lombari, glutei, spalle, ischiocrurali',
    youtubeQuery: 'superman+hold+exercise',
  },
  {
    name: 'Glute Bridge Hold',
    icon: '\uD83C\uDF09',
    duration: '',
    category: 'Glutei & Lombari',
    description: "Supino sul tappetino, ginocchia piegate, piedi a terra. Spingi il bacino verso l'alto contraendo i glutei. Linea retta ginocchia-spalle.",
    progression: '3 \u00D7 20s \u2192 30s \u2192 45s. Concentra la stretta in alto.',
    muscles: 'Glutei, ischiocrurali, core basilare',
    youtubeQuery: 'glute+bridge+hold',
  },
  {
    name: 'Hollow Body Hold',
    icon: '\uD83C\uDF19',
    duration: '',
    category: 'Core Profondo',
    description: 'Supino sul tappetino, braccia stese indietro e gambe stese avanti. Solleva testa, spalle e gambe. Schiena bassa APPIATTITA a terra.',
    progression: '3 \u00D7 15s \u2192 20s \u2192 30s. Esercizio fondamentale della ginnastica.',
    muscles: "Addominali (tutti), flessori dell'anca",
    youtubeQuery: 'hollow+body+hold+gymnastics',
  },
  {
    name: 'Side Plank',
    icon: '\uD83D\uDCD0',
    duration: '',
    category: 'Obliqui & Flessibilit\u00E0',
    description: 'Sul fianco sul tappetino, appoggio sull\'avambraccio e sul lato del piede. Solleva il bacino formando una linea dritta.',
    progression: "2 \u00D7 20s/lato \u2192 30s \u2192 45s. Usa il ginocchio se troppo difficile all'inizio.",
    muscles: 'Obliqui interni/esterni, stabilizzatori spalla',
    youtubeQuery: 'side+plank+exercise',
  },
  {
    name: 'Affondo Isometrico (Split Squat Hold)',
    icon: '\uD83E\uDDB5',
    duration: '',
    category: 'Forza Gambe',
    description: 'In posizione di affondo asimmetrico, scendi finch\u00E9 il ginocchio posteriore NON sfiora il pavimento. Mantieni il petto alto e il peso sul tallone anteriore. Brucia maledettamente.',
    progression: '3 \u00D7 30s/gamba \u2192 45s \u2192 60s.',
    muscles: 'Quadricipiti, glutei, core stabilizzatore',
    youtubeQuery: 'isometric+lunge+hold',
  },
  {
    name: 'Towel Row Hold',
    icon: '\uD83E\uDDE3',
    duration: '',
    category: 'Dorso e Tirata',
    description: 'Siediti a terra. Passa un asciugamano forte stretto dietro le piante dei piedi. Afferralo con due mani e tira verso di te con tutta la forza del dorso (come per fare un rematore), mentre opponendo resistenza inamovibile coi piedi.',
    progression: 'Tensione massimale estrema per 10-15s. Ripeti 5 volte.',
    muscles: 'Dorsali, bicipiti, presa, avambracci',
    youtubeQuery: 'isometric+towel+row',
  },
  {
    name: 'Tuck L-Sit Hold',
    icon: '\uD83E\uDE91',
    duration: '',
    category: 'Core Estremo',
    description: 'Seduto a terra, gambe incrociate o piegate al petto. Mani piatte a terra di fianco alle cosce. Spingi forte in basso staccando il sedere da terra. Se riesci, solleva anche i piedi da terra rimanendo sospeso.',
    progression: 'Da 5 a 20 secondi. Ripeti 4 volte.',
    muscles: 'Addominali bassi, tricipiti, deltoidi anteriori',
    youtubeQuery: 'tuck+l+sit+tutorial',
  },
  {
    name: 'Calf Raise Hold',
    icon: '\uD83E\uDDBF',
    duration: '',
    category: 'Endurance',
    description: 'In piedi sulla punta di un gradino e sollevati il pi\u00F9 in alto possibile sui talloni (punte dei piedi in estensione massima). Blocca la posizione l\u00EC, senza pi\u00F9 scendere o molleggiare.',
    progression: '1 \u00D7 60s continui o fino al cedimento muscolare totale.',
    muscles: 'Gastrocnemio e soleo (Polpacci)',
    youtubeQuery: 'isometric+calf+raise+hold',
  },
  {
    name: 'V-Sit Hold',
    icon: '\u270C\uFE0F',
    duration: '',
    category: 'Bilanciamento',
    description: 'Seduto a terra, inclina il busto indietro a 45 gradi e solleva le gambe tese avanti in modo da formare una V col corpo. Braccia protese in avanti per stabilit\u00E0.',
    progression: '3 \u00D7 20s \u2192 30s \u2192 45s.',
    muscles: 'Retto addominale, ileo-psoas',
    youtubeQuery: 'v+sit+hold+exercise',
  },
];

// ---------------------------------------------------------------------------
// Craving Exercises (CR)
// ---------------------------------------------------------------------------

export const CRAVING_EXERCISES: Exercise[] = [
  {
    name: 'Sprint sul Posto',
    icon: '\uD83C\uDFC3',
    duration: '60 sec',
    why: "L'attivit\u00E0 aerobica intensa riduce il craving fino al 50%. L'effetto persiste per 50 minuti dopo l'esercizio.",
    steps: 'Corri sul posto il pi\u00F9 veloce possibile per 60 secondi. Ginocchia alte, braccia attive. Poi 30s camminata di recupero. Se serve, ripeti.',
    youtubeQuery: 'high+knees+running+in+place',
  },
  {
    name: 'Respirazione 4-7-8',
    icon: '\uD83C\uDF2C\uFE0F',
    duration: '90 sec',
    why: 'Attiva il sistema nervoso parasimpatico (calma), riduce ansia e tensione muscolare legate al craving di nicotina.',
    steps: 'Inspira dal NASO per 4 secondi \u2192 Trattieni per 7 secondi \u2192 Espira dalla BOCCA lentamente per 8 secondi. Ripeti 3 cicli. Concentrati SOLO sul conteggio.',
    youtubeQuery: '4+7+8+breathing+technique',
  },
  {
    name: 'Burpees Express',
    icon: '\u26A1',
    duration: '2 min',
    why: "Intensit\u00E0 massimale redirige completamente l'attenzione e rilascia endorfine che competono col desiderio di nicotina.",
    steps: 'Max burpees in 2 minuti. Troppo intenso? Squat jump. In piedi \u2192 mani a terra \u2192 piedi indietro \u2192 push-up (opz.) \u2192 piedi avanti \u2192 salto.',
    youtubeQuery: 'burpees+tutorial+beginner',
  },
  {
    name: 'Corda per Saltare',
    icon: '\uD83E\uDE22',
    duration: '3 min',
    why: 'Cardio + coordinazione = zero spazio mentale residuo per il craving. Occupa tutta la mente e il corpo.',
    steps: 'Salta a ritmo veloce per 3 minuti. Piedi alternati, doppio salto. Senza corda: simula il gesto con polsi che ruotano.',
    youtubeQuery: 'jump+rope+3+minutes',
  },
  {
    name: 'Horse Stance Shaolin',
    icon: '\uD83D\uDC0E',
    duration: '30-60 sec',
    why: 'La tensione muscolare intensa e prolungata nelle gambe compete col segnale di craving nel cervello. Il bruciore domina.',
    steps: "Horse Stance pi\u00F9 profonda possibile e TIENI. Concentra TUTTA l'attenzione sul bruciore dei quadricipiti. Quando pensi di non farcela, tieni ancora 5 secondi.",
    youtubeQuery: 'horse+stance+hold+challenge',
  },
  {
    name: 'Push-ups a Esaurimento',
    icon: '\uD83D\uDCAA',
    duration: 'Fino al cedimento',
    why: 'La fatica muscolare acuta fino al cedimento resetta il circuito di ricompensa del cervello.',
    steps: 'Push-ups sul tappetino fino a non riuscirne un altro. Pausa 30s. Seconda serie al cedimento. Craving scomparso.',
    youtubeQuery: 'push+ups+to+failure',
  },
  {
    name: 'Scalinate',
    icon: '\uD83E\uDE9C',
    duration: '2-3 min',
    why: 'Salire le scale \u00E8 il modo pi\u00F9 rapido per alzare il battito e spegnere il craving.',
    steps: 'Su e gi\u00F9 per le scale 5 volte veloce. Senza scale: step-ups su sedia stabile alternando gambe.',
    youtubeQuery: 'stair+climbing+exercise',
  },
  {
    name: 'Isometria Anti-Craving (discreto, ovunque)',
    icon: '\uD83E\uDDF1',
    duration: '60 sec',
    why: 'Anche 5 min di isometria riducono significativamente il desiderio. Perfetto in ufficio o in pubblico \u2014 nessuno nota nulla.',
    steps: 'Sequenza rapida senza muoverti: Palmi uniti\u2192spingi 10s. Mani intrecciate\u2192tira 10s. Contrai glutei 10s. Contrai addominali 10s. Stringi pugni con tutta la forza 10s. Spingi piedi a terra 10s.',
    youtubeQuery: 'isometric+exercises+at+desk',
  },
];

// ---------------------------------------------------------------------------
// Bike Exercises (BI)
// ---------------------------------------------------------------------------

export const BIKE_EXERCISES: Exercise[] = [
  {
    name: 'Recupero Attivo (Pedalata Assistita)',
    icon: '\uD83D\uDEB2',
    duration: '',
    category: 'Passeggiata',
    description: "Sfrutta l'assistenza del motore al massimo per far girare le gambe senza accumulare acido lattico. Cadenza alta (agile) ma zero sforzo sui pedali.",
    progression: '30-60 min a battito cardiaco bassissimo (meno di 110 bpm). Ideale per scaricare le gambe.',
    muscles: 'Recupero muscolare, mobilit\u00E0 ginocchia',
    youtubeQuery: 'e-bike+active+recovery+ride',
  },
  {
    name: 'Zone 2 Endurance (Ibrida)',
    icon: '\uD83D\uDEB2',
    duration: '',
    category: 'Aerobico',
    description: "Assistenza bassa (Eco) in pianura. L'obiettivo \u00E8 tenere i battiti cardiaci costanti (120-135 bpm) senza mai andare in affanno, usando l'assistenza per spianare le salite.",
    progression: '60-120 min. Costruisce la base aerobica e brucia grassi preservando energie.',
    muscles: 'Sistema cardiovascolare, fat burn',
    youtubeQuery: 'e-bike+zone+2+training',
  },
  {
    name: 'HIIT Sprint (Muscolare)',
    icon: '\uD83D\uDEB2',
    duration: '',
    category: 'Intervalli',
    description: "Spegni l'assistenza (o tienila al minimo). Fai 30 secondi di scatto alla massima potenza (rapporto duro), poi 1 minuto di pedalata lenta con assistenza alta per recuperare.",
    progression: '8-12 cicli. Riscaldamento di 10 min. Altamente tassante.',
    muscles: 'Potenza esplosiva, polpacci, VO2 Max',
    youtubeQuery: 'cycling+hiit+sprints+workout',
  },
  {
    name: 'Salita Fuori Sella (Muscolare)',
    icon: '\uD83D\uDEB2',
    duration: '',
    category: 'Forza Pura',
    description: "In salita, spegni l'assistenza. Alzati sui pedali e spingi con tutto il peso del corpo da un lato all'altro. Usa un rapporto molto duro.",
    progression: "4-6 ripetizioni da 1-2 minuti. Usa l'assistenza per tornare a casa senza affaticare ulteriormente.",
    muscles: 'Glutei, core, quadricipiti massimali',
    youtubeQuery: 'cycling+out+of+saddle+climb',
  },
];
