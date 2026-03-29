export const TRAINING_TRANSLATIONS_EN: Record<string, {
    name?: string;
    description?: string;
    why?: string;
    steps?: string;
    progression?: string;
    muscles?: string;
    target?: string;
    category?: string;
    title?: string;
}> = {
    // DAYS
    "Lunedì": { name: "Monday" },
    "Martedì": { name: "Tuesday" },
    "Mercoledì": { name: "Wednesday" },
    "Giovedì": { name: "Thursday" },
    "Venerdì": { name: "Friday" },
    "Sabato": { name: "Saturday" },
    "Domenica": { name: "Sunday" },

    // PLANS TITLES
    "Core & Isometria Shaolin": { title: "Core & Shaolin Isometrics" },
    "Cardio Corda & Gambe": { title: "Jump Rope Cardio & Legs" },
    "Upper Body, Aikido & Shaolin": { title: "Upper Body, Aikido & Shaolin" },
    "Cardio Cyclette & Core": { title: "Stationary Bike Cardio & Core" },
    "Full Body Isometrico": { title: "Full Body Isometric" },
    "Endurance, Forza & Tai Chi Attivo": { title: "Endurance, Strength & Active Tai Chi" },
    "Mobilità, Aikido & Recovery": { title: "Mobility, Aikido & Recovery" },
    "Cardio Cyclette & Gambe": { title: "Stationary Bike Cardio & Legs" },
    "Upper Body & Pull": { title: "Upper Body & Pull" },
    "Corda + Core Sedia": { title: "Jump Rope + Chair Core" },
    "Pull & Isometria": { title: "Pull & Isometrics" },
    "Cardio Leggero & Tai Chi": { title: "Light Cardio & Tai Chi" },

    // PLAN EXERCISE NAMES (used in plan arrays)
    "Stretching risveglio (sez. 🧘)": { name: "Morning Stretch (sec. 🧘)" },
    "Plank frontale (tappetino)": { name: "Front Plank (mat)" },
    "Horse Stance (Ma Bu)": { name: "Horse Stance (Ma Bu)" },
    "Hollow Body Hold (tappetino)": { name: "Hollow Body Hold (mat)" },
    "Wall Sit": { name: "Wall Sit" },
    "Superman Hold (tappetino)": { name: "Superman Hold (mat)" },
    "Respirazione diaframmatica": { name: "Diaphragmatic Breathing" },
    "Stretching risveglio": { name: "Morning Stretch" },
    "Corda per saltare": { name: "Jump Rope" },
    "Squat isometrico": { name: "Isometric Squat" },
    "Affondi statici": { name: "Static Lunges" },
    "Respirazione box": { name: "Box Breathing" },
    "Aiki Taiso solo warmup (sez. 🥋)": { name: "Aiki Taiso Solo Warmup (sec. 🥋)" },
    "Push-up Hold metà (tappetino)": { name: "Mid Push-up Hold (mat)" },
    "Dead Hang (barra)": { name: "Dead Hang (bar)" },
    "Palmi uniti pressione Shaolin": { name: "Shaolin Palms Press" },
    "Mani intrecciate — tira": { name: "Interlocked Hands — pull" },
    "Plank laterale (tappetino)": { name: "Side Plank (mat)" },
    "Cyclette HIIT": { name: "Stationary Bike HIIT" },
    "Plank tocco spalla (tappetino)": { name: "Shoulder Tap Plank (mat)" },
    "Boat Pose Hold (tappetino)": { name: "Boat Pose Hold (mat)" },
    "Glute Bridge Hold (tappetino)": { name: "Glute Bridge Hold (mat)" },
    "Aiki Taiso solo warmup": { name: "Aiki Taiso Solo Warmup" },
    "Horse Stance profonda": { name: "Deep Horse Stance" },
    "Push-up Hold basso (tappetino)": { name: "Low Push-up Hold (mat)" },
    "Dead Hang": { name: "Dead Hang" },
    "Hollow Body (tappetino)": { name: "Hollow Body (mat)" },
    "Meditazione Ki / Furitama": { name: "Ki Meditation / Furitama" },
    "Stretching completo (tappetino)": { name: "Full Stretch (mat)" },
    "Circuito Shaolin (sez. 🐉)": { name: "Shaolin Circuit (sec. 🐉)" },
    "Pull-ups (o negatives)": { name: "Pull-ups (or negatives)" },
    "Push-ups varianti": { name: "Push-ups Variations" },
    "Squat jump": { name: "Jump Squat" },
    "Plank front + laterale (tappetino)": { name: "Front + Side Plank (mat)" },
    "Horse Stance challenge": { name: "Horse Stance Challenge" },
    "📱 MadMuscles — Tai Chi (peso)": { name: "📱 MadMuscles — Tai Chi (weights)" },
    "Stretching defaticante (tappetino)": { name: "Cooldown Stretch (mat)" },
    "Bici all'aperto": { name: "Outdoor Bike" },
    "Aiki Taiso completo (sez. 🥋)": { name: "Full Aiki Taiso (sec. 🥋)" },
    "Stretching profondo (tappetino)": { name: "Deep Stretch (mat)" },
    "📱 Yoga Go — Tai Chi (relax)": { name: "📱 Yoga Go — Tai Chi (relax)" },
    "Squat profondi": { name: "Deep Squats" },
    "Affondi alternati": { name: "Alternating Lunges" },
    "Horse Stance": { name: "Horse Stance" },
    "Stretching gambe (tappetino)": { name: "Leg Stretch (mat)" },
    "Pull-ups (o Australian)": { name: "Pull-ups (or Australian)" },
    "Isometrici braccia Shaolin": { name: "Shaolin Arm Isometrics" },
    "Stretching spalle + polsi": { name: "Shoulders + Wrists Stretch" },
    "Seated Knee-to-Elbow (sez. 🪑)": { name: "Seated Knee-to-Elbow (sec. 🪑)" },
    "Seated Torso Rotation": { name: "Seated Torso Rotation" },
    "Plank (tappetino)": { name: "Plank (mat)" },
    "Stretching (tappetino)": { name: "Stretch (mat)" },
    "Pull-ups": { name: "Pull-ups" },
    "Push-up isometrico (tappetino)": { name: "Isometric Push-up (mat)" },
    "Wall Sit una gamba": { name: "Single Leg Wall Sit" },
    "Pressione palmi Shaolin": { name: "Shaolin Palms Press" },
    "Cyclette moderata": { name: "Moderate Stationary Bike" },
    "Corda leggera": { name: "Light Jump Rope" },

    // EXERCISES (Catalog)
    // Stretching
    "Neck Rolls": {
        name: "Neck Rolls",
        target: "Neck, trapezius",
        description: "Standing or seated, straight back. Rotate head slowly in a full circle: chin to chest → ear to shoulder → head slightly back → other side. 5 rotations per direction, slow movements. Never force it."
    },
    "Lateral Neck Stretch": {
        name: "Lateral Neck Stretch",
        target: "SCM, upper trapezius",
        description: "Standing or seated. Tilt left ear toward left shoulder. Left hand gently deepens the stretch on the head. Right arm extends downward. 15-20s per side. Do not lift the shoulder to the ear."
    },
    "Shoulder Rolls": {
        name: "Shoulder Rolls",
        target: "Deltoids, trapezius, rhomboids",
        description: "Standing, arms relaxed at sides. Lift shoulders to ears, roll back and down making large circles. 10 rotations back, then 10 forward."
    },
    "Cross-Body Shoulder Stretch": {
        name: "Cross-Body Shoulder Stretch",
        target: "Posterior deltoid",
        description: "Right arm straight across chest. With left hand, press the right arm toward you above the elbow. Keep shoulder low, do not lift it. 20-30s per side."
    },
    "Overhead Triceps Stretch": {
        name: "Overhead Triceps Stretch",
        target: "Triceps, lateral lats",
        description: "Right arm overhead, bend elbow: hand reaches the back between shoulder blades. Left hand presses right elbow downward. 20s per side."
    },
    "Cat-Cow (tappetino)": {
        name: "Cat-Cow (mat)",
        target: "Spine, spinal mobility, core",
        description: "On all fours on the mat, hands under shoulders, knees under hips. INHALE: arch back, belly toward floor, look up (Cow). EXHALE: round back toward ceiling, chin to chest (Cat). Alternate fluidly, each phase lasts a full breath. 10-12 reps."
    },
    "Child's Pose (tappetino)": {
        name: "Child's Pose (mat)",
        target: "Back, hips, ankles, shoulders",
        description: "Kneeling on mat, sit on heels. Arms forward, torso between thighs, forehead on floor. Breathe into lower back. 30-45s. Lateral variation: move hands right to stretch left side and vice versa."
    },
    "Standing Forward Fold": {
        name: "Standing Forward Fold",
        target: "Hamstrings, lower back, calves",
        description: "Standing, hinge forward from hips (not back). Arms hang toward floor. Knees slightly bent if hamstrings are tight. Let torso safely dangle. 20-30s."
    },
    "Standing Quad Stretch": {
        name: "Standing Quad Stretch",
        target: "Quadriceps, hip flexors",
        description: "Standing (lean on a wall). Bend right knee, grab right foot behind with hand. Pull heel to glute, knees close together. Push hip forward to intensify. 20-30s/leg."
    },
    "Hip Flexor Lunge (tappetino)": {
        name: "Hip Flexor Lunge (mat)",
        target: "Psoas, hip flexors, quadriceps",
        description: "Low lunge on mat: right knee on floor, left foot forward at 90°. Push hips forward/down. Stretch in front thigh and back leg. Arms on hips or overhead. 20-30s/side."
    },
    "Pigeon Pose (tappetino)": {
        name: "Pigeon Pose (mat)",
        target: "Glutes, piriformis, hip flexors",
        description: "From all fours on mat: bring right knee forward near right wrist, foot toward left hip. Left leg extended behind. Lower torso toward floor. 30-45s/side. If too intense: 'Figure 4' lying on mat."
    },
    "Butterfly Stretch (tappetino)": {
        name: "Butterfly Stretch (mat)",
        target: "Adductors, hip flexors",
        description: "Seated on mat, feet back to back, knees open. Press knees toward floor with elbows. Straight back. 30-45s. Fold torso forward to deepen."
    },
    "Spinal Twist (tappetino)": {
        name: "Spinal Twist (mat)",
        target: "Obliques, spine, glutes, lumbars",
        description: "Lying on mat, arms in a T. Bend right knee, bring it over to left side. Left hand guides it. Look toward right hand. Keep shoulders touching the mat. 20-30s/side."
    },
    "Cobra Stretch (tappetino)": {
        name: "Cobra Stretch (mat)",
        target: "Abs, chest, hip flexors",
        description: "Face down, hands under shoulders. Push torso up, arms semi-straight. Hips stay on the floor. Look forward. Don't force lower back. 15-20s."
    },
    "Downward Dog (tappetino)": {
        name: "Downward Dog (mat)",
        target: "Complete posterior chain",
        description: "From all fours: lift hips forming an inverted V. Hands shoulder-width, feet hip-width. Heels toward floor. Head relaxed. Pedal feet to loosen calves. 30-45s."
    },
    "Wrist Circles & Stretch": {
        name: "Wrist Circles & Stretch",
        target: "Wrists, forearms (pre-Aikido/Shaolin)",
        description: "Interlace fingers, rotate wrists in circles: 10/direction. Then: arm in front palm up, pull fingers toward you 15s. Palm down, pull down 15s. Both wrists. Fundamental before any isometric work."
    },

    // Chair
    "Seated Knee Lifts (Marcia)": {
        name: "Seated Knee Lifts (Marching)",
        target: "Lower core, hip flexors",
        description: "Sit straight on the edge, feet flat. Core engaged: lift one knee toward chest without leaning. Lower slowly, alternate. Straight back, relaxed shoulders. 12-16 reps × 3. Intensify: pause 2s at the top."
    },
    "Seated Torso Twist": {
        name: "Seated Torso Twist",
        target: "Obliques, spinal mobility",
        description: "Hands behind head, elbows wide. Rotate torso right/left from the CORE — hips remain still. Exhale on rotation, inhale centered. 45s alternating × 3."
    },
    "Seated Lean Back Hold": {
        name: "Seated Lean Back Hold",
        target: "Rectus abdominis, endurance",
        description: "Edge of chair, arms crossed. Lean torso BACK visibly — straight back, NOT rounded. Abs fire up. Breathe normally. 15-20s × 3. Progress to 30s."
    },
    "Seated Side Bend": {
        name: "Seated Side Bend",
        target: "Lateral obliques, intercostals",
        description: "One hand behind head. Bend LATERALLY (no rotation), the other hand runs down the chair. Feel stretch on opposite side. 45s alternating × 3."
    },
    "Seated Bicycle Crunch": {
        name: "Seated Bicycle Crunch",
        target: "Full core, coordination",
        description: "Hands behind head. Left knee up + right elbow toward it. Alternate in a controlled way — quality > speed. 30-60s × 3."
    },
    "Seated V-Sit Hold": {
        name: "Seated V-Sit Hold",
        target: "Deep core, transverse",
        description: "Hands on chair edges. Lean back, lift BOTH feet off the ground. Bent knees ok. Core contracted, breathe. 15-30s × 3. Progress by extending legs."
    },
    "Palms Press isometrico": {
        name: "Isometric Palms Press",
        target: "Chest, shoulders, core",
        description: "Palms pressed in prayer, elbows out. Gradual pressure 2-3s → maximal 10s → release 2-3s. Breathe normally. 5 reps. Vary heights: chest, forehead, navel."
    },
    "Seated Cat-Cow": {
        name: "Seated Cat-Cow",
        target: "Spinal mobility, relaxation",
        description: "Hands on knees. INHALE: chest forward, arch (Cow). EXHALE: round back, chin to chest (Cat). Fluid with breath. 45s."
    },

    // Aikido
    "Nikyo Undo (Stretch polso interno)": {
        name: "Nikyo Undo (Inner Wrist Stretch)",
        category: "Wrists — Solo",
        description: "Standing in natural stance (shizentai). Grab back of left hand with right, bending left wrist inward toward forearm. Gently bring hands upward near the body, elbows low and close. You'll feel the stretch on the outer wrist and forearm. Never force it. 8 reps per hand, slow and mindful.",
        progression: "Light grip → increase pressure in weeks. Do before every Shaolin session.",
        muscles: "Wrists, forearm extensors, tendons"
    },
    "Kote Gaeshi Undo (Stretch polso esterno)": {
        name: "Kote Gaeshi Undo (Outer Wrist Stretch)",
        category: "Wrists — Solo",
        description: "In shizentai. Right hand grabs base of left thumb, rotating left wrist outward and downward. The movement is a full wrist rotation, not just bending. Stretch works the inner wrist and forearm. 8 reps per hand. Slow and controlled — wrists are fragile.",
        progression: "Daily! Essential for wrist flexibility",
        muscles: "Wrists, forearm flexors, tendons"
    },
    "Sankyo Undo (Stretch polso torsione)": {
        name: "Sankyo Undo (Twist Wrist Stretch)",
        category: "Wrists — Solo",
        description: "Hands united in front of body center (hara). Right hand over left, left palm facing left. On each count, bring hands upward near body, elbows down. Stretch twists the wrist. 8 reps per hand. Maintain posture awareness.",
        progression: "Practice with 'extended mind' — visualize energy flowing from fingers",
        muscles: "Wrists, forearms, grip structure"
    },
    "Funakogi Undo (Rematore)": {
        name: "Funakogi Undo (Rowing)",
        category: "Body Movement — Solo",
        description: "In hanmi (one foot forward, 60% weight front). Shift hips FORWARD bending front knee → hands extend from hips forward, fingers pointing down → hips shift BACK → hands return to hips. Imagine rowing a boat. Movement ALWAYS starts from hips, arms are passive extensions. 8-10 reps per side, then switch front foot.",
        progression: "Wk 1-2: hips→hands timing. Wk 3+: fluidity and power from center",
        muscles: "Core, hips, shoulders, mind-body coordination"
    },
    "Ikkyo Undo (Movimento del taglio)": {
        name: "Ikkyo Undo (Cutting Movement)",
        category: "Body Movement — Solo",
        description: "In hanmi. Hips forward → arms swing forward and UPWARD to eye level, open hands. Then hands descend powerfully to hips (like a downward sword cut) as hips shift back. The DOWNWARD phase is the most important: relaxed but powerful. 8-10 reps per side.",
        progression: "Focus on the descent: it’s the foundation of Aikido's Ikkyo technique",
        muscles: "Shoulders, core, coordination, timing"
    },
    "Zengo Undo (Avanti-indietro con pivot)": {
        name: "Zengo Undo (Forward-back with pivot)",
        category: "Body Movement — Solo",
        description: "Identical to Ikkyo Undo but IN TWO DIRECTIONS. Perform the forward movement, then pivot 180° on front foot ball and repeat in opposite direction. Pivot must be smooth and centered — the hinge is your hara. Arms naturally follow body rotation. 8 reps.",
        progression: "Train centered rotation — imagine handling two opponents",
        muscles: "Core, balance, rotational coordination, proprioception"
    },
    "Tekubi Kosa Undo (Incrocio polsi)": {
        name: "Tekubi Kosa Undo (Wrist Crossing)",
        category: "Body Movement — Solo",
        description: "Standing, natural stance, arms relaxed at sides. Relax and swing arms starting from FINGERS until crossing wrists in front of lower belly ('one point'). Release immediately and return to start. 5 reps left wrist front, 5 right front. Movement is GUIDED BY GRAVITY — do not force, let arms swing naturally.",
        progression: "Find the natural rhythm — don't pull the arms",
        muscles: "Wrists, shoulders, muscular relaxation"
    },
    "Ude Furi Undo (Oscillazione braccia)": {
        name: "Ude Furi Undo (Arm Swing)",
        category: "Body Movement — Solo",
        description: "Natural standing. Rotate torso left and right using body center — arms are completely relaxed and 'fly' at shoulder level by rotation inertia. Like a tree whose branches swing with the wind. Arms have NO tension of their own. Movement comes ONLY from center rotation. 8-10 reps.",
        progression: "If arms are stiff, you're doing it wrong. Seek total relaxation",
        muscles: "Shoulders, spinal rotation, deep relaxation"
    },
    "Tai Sabaki (Footwork base)": {
        name: "Tai Sabaki (Basic Footwork)",
        category: "Footwork — Solo",
        description: "Practice the 3 fundamental Aikido movements solo: 1) TENKAN: one foot forward, pivot 180° on front foot ball. 2) IRIMI: firm step forward toward an imaginary opponent. 3) IRIMI-TENKAN: step forward + pivot. Every movement slow, center low and stable. 5-8 reps per type, per side.",
        progression: "Wk 1-2: single movements. Wk 3+: fluid combinations",
        muscles: "Legs, core, balance, agility, proprioception"
    },
    "Koho Tento Undo (Roll indietro — tappetino)": {
        name: "Koho Tento Undo (Back Roll — mat)",
        category: "Ukemi — Solo",
        description: "Seated on mat, legs bent or crossed. Roll backward bringing knees to chest, chin slightly tucked. Hands slap the mat during the roll to absorb impact. Use momentum to return to seated. 8-10 reps. Soft surface mandatory (yoga mat).",
        progression: "Base for learning falls — start slow, don't use neck to push",
        muscles: "Core, back, coordination, body confidence"
    },
    "Furitama (Vibrazione/Meditazione Ki)": {
        name: "Furitama (Ki Vibration/Meditation)",
        category: "Meditation — Solo",
        description: "Standing, feet shoulder width. Unite hands in front of lower belly with fingers interlaced. Vibrate/shake hands and body very rapidly for 30-60 seconds. Then stop completely and remain motionless, feeling energy in the body. Breathe deeply for 1-2 mins. This is a centering practice (misogi) used by O-Sensei. Calms mind and centers Ki in the hara.",
        progression: "Do at start and end of Aikido practice",
        muscles: "Nervous system, mental centering, relaxation"
    },

    // Shaolin
    "Horse Stance (Ma Bu / 马步)": {
        name: "Horse Stance (Ma Bu / 马步)",
        category: "Fundamental",
        description: "The queen stance of Shaolin. Feet TWICE shoulder width, toes out ~30°. Lower hips like sitting on an invisible chair — back STRAIGHT, imagine sliding down a pole. Knees aggressively pushed OUT over toes, NEVER inward. Brutal tension in glutes and inner thighs. Breathe normally. Look forward.",
        progression: "Wk 1-2: 3×20s high (1/4) → Wk 3-4: 3×30s mid → Wk 5+: 3×45s+ deep",
        muscles: "Quads, glutes, adductors, core, hip stabilizers"
    },
    "Palmi Uniti — Pressione (合掌)": {
        name: "United Palms — Press (合掌)",
        category: "Arm Isometric",
        description: "Palms pressed in prayer before chest, elbows out, shoulders down. Gradually increase pressure between palms for 2-3 seconds, then MAX tension for 10s. Breathe normally — DO NOT hold breath. Release gradually over 2-3s. Opposition creates tension in chest, shoulders, arms without visible movement.",
        progression: "Vary angles: chest (pecs), overhead (deltoids), navel (core)",
        muscles: "Pectorals, deltoids, triceps"
    },
    "Mani Intrecciate — Tira": {
        name: "Interlocked Hands — Pull",
        category: "Back Isometric",
        description: "Interlace fingers before chest/sternum. Try to PULL hands apart with maximal force. The hands won't separate, but tension is placed on back, biceps, and forearms. 10s, breathe, gradual release 2-3s. 3-5 reps.",
        progression: "Vary: chest (lats), forehead (traps), navel (lumbars)",
        muscles: "Lats, biceps, forearms, rhomboids"
    },
    "Pugno vs Palmo — Rotazione": {
        name: "Fist vs Palm — Rotation",
        category: "Forearm Isometric",
        description: "Clench right fist. Wrap it with left hand. Fist tries to ROTATE clockwise, palm resists counterclockwise. Maximum tension 10s. Reverse direction. Switch hand. Develops a steel grip and strong forearms.",
        progression: "From 10s to 20s gradually. Vary fist pushing up/down too",
        muscles: "Forearms, grip muscles, wrists"
    },
    "Iron Bridge (tappetino)": {
        name: "Iron Bridge (mat)",
        category: "Core & Back",
        description: "Lying on mat, feet flat hip-width. Arms at sides, palms down. Push through heels and lift hips to form a straight line shoulder-hips-knees. SQUEEZE glutes at the top. Don't hyperextend lower back. Breathe normally during hold.",
        progression: "20s → 30s → 45s. Advanced: lift one foot and hold single leg",
        muscles: "Glutes, lumbars, posterior core, hamstrings"
    },
    "Wall Push (Spinta al Muro)": {
        name: "Wall Push",
        category: "Chest Isometric",
        description: "Facing a solid wall, hands placed at chest level, arms almost straight. Push the wall as if you want to move it. Maximal tension in 2-3s, hold 10s. Body slightly leaning forward. Breathe slowly during effort. Don't hold breath.",
        progression: "Vary: straight arms (chest), bent 90° (mid chest), hands overhead (shoulders)",
        muscles: "Pectorals, anterior deltoids, triceps, core"
    },
    "Towel Pull Apart": {
        name: "Towel Pull Apart",
        category: "Back Isometric",
        description: "Hold a towel (or belt) taut in front of you with both hands, arms straight at shoulder width. Pull hands OUTWARD as if to tear it apart. Intense work between shoulder blades and rear deltoids. 10s maximal tension × 3-5 reps.",
        progression: "Vary: arms forward (lats), overhead (traps), behind back (rhomboids)",
        muscles: "Lats, rhomboids, rear deltoids, traps"
    },
    "Neck Isometrics": {
        name: "Neck Isometrics",
        category: "Neck",
        description: "Hand on FOREHEAD: press head forward against resisting hand. 8s. Hand on right TEMPLE: press sideways. 8s. Then left. 8s. Hands interlaced BEHIND head: press backward. 8s. ZERO visible movement — only isometric tension. NEVER use jerky movements with neck.",
        progression: "Start at 50% force, progress to 80% max. Never 100% on the neck",
        muscles: "SCM, upper trapezius, cervicals"
    },

    // Isometric 
    "Wall Sit (Sedia al Muro)": {
        name: "Wall Sit",
        category: "Legs, Core",
        description: "Flat back against wall, knees at 90°. Weight on heels.",
        progression: "3 × 30s → 45s → 60s. Do not rest hands on thighs.",
        muscles: "Quads, glutes, hamstrings"
    },
    "Plank Frontale": {
        name: "Front Plank",
        category: "Total Core",
        description: "Rest on forearms and toes. Elbows under shoulders. Body in a straight line from head to heels.",
        progression: "3 × 30s → 45s → 60s. Squeeze glutes heavily.",
        muscles: "Rectus abdominis, transverse, shoulders"
    },
    "Superman Hold": {
        name: "Superman Hold",
        category: "Posterior Chain",
        description: "Prone on the mat. Lift arms (straight forward) and straight legs off the floor simultaneously. Gaze is downward.",
        progression: "3 × 15s → 20s → 30s.",
        muscles: "Lumbars, glutes, shoulders, hamstrings"
    },
    "Glute Bridge Hold": {
        name: "Glute Bridge Hold",
        category: "Glutes & Lumbars",
        description: "Supine on mat, knees bent, feet flat. Push pelvis up while squeezing glutes. Straight line knees-shoulders.",
        progression: "3 × 20s → 30s → 45s. Focus on the top squeeze.",
        muscles: "Glutes, hamstrings, basic core"
    },
    "Hollow Body Hold": {
        name: "Hollow Body Hold",
        category: "Deep Core",
        description: "Supine on mat, arms extended back and legs straight forward. Lift head, shoulders, and legs. Lower back FLATTENED to ground.",
        progression: "3 × 15s → 20s → 30s. Fundamental gymnastics exercise.",
        muscles: "Abs (all), hip flexors"
    },
    "Side Plank": {
        name: "Side Plank",
        category: "Obliques & Flexibility",
        description: "On side on mat, resting on forearm and side of foot. Lift pelvis forming a straight line.",
        progression: "2 × 20s/side → 30s → 45s. Use knee if too hard initially.",
        muscles: "Internal/external obliques, shoulder stabilizers"
    },
    "Affondo Isometrico (Split Squat Hold)": {
        name: "Isometric Lunge (Split Squat Hold)",
        category: "Leg Strength",
        description: "In asymmetric lunge position, lower until back knee ALMOST touches the floor. Keep chest high and weight on front heel. Ignites a deep burn.",
        progression: "3 × 30s/leg → 45s → 60s.",
        muscles: "Quads, glutes, stabilizing core"
    },
    "Towel Row Hold": {
        name: "Towel Row Hold",
        category: "Back and Pull",
        description: "Sit on the floor. Loop a strong towel behind soles of feet. Grab it with two hands and pull towards you with full back strength (like a row), while opposing immovable resistance with feet.",
        progression: "Extreme maximal tension for 10-15s. Repeat 5 times.",
        muscles: "Lats, biceps, grip, forearms"
    },
    "Tuck L-Sit Hold": {
        name: "Tuck L-Sit Hold",
        category: "Extreme Core",
        description: "Sit on floor, legs crossed or tucked to chest. Palms flat next to thighs. Push down hard lifting your butt off the floor. If possible, lift feet off the ground too, hovering.",
        progression: "From 5 to 20 seconds. Repeat 4 times.",
        muscles: "Lower abs, triceps, anterior deltoids"
    },
    "Calf Raise Hold": {
        name: "Calf Raise Hold",
        category: "Endurance",
        description: "Stand on the edge of a step and raise as high as possible on toes (max extension). Lock the position there, without dropping or bouncing.",
        progression: "1 × 60s continuous or until total muscular failure.",
        muscles: "Gastrocnemius and soleus (Calves)"
    },
    "V-Sit Hold": {
        name: "V-Sit Hold",
        category: "Balance",
        description: "Sit on floor, lean torso back 45 degrees and lift straight legs forward to form a V. Arms reaching forward for stability.",
        progression: "3 × 20s → 30s → 45s.",
        muscles: "Rectus abdominis, iliopsoas"
    },

    // Craving
    "Sprint sul Posto": {
        name: "Sprint in Place",
        why: "Intense aerobic activity reduces craving up to 50%. The effect lasts for 50 mins after exercise.",
        steps: "Run in place as fast as possible for 60 seconds. High knees, active arms. Then 30s recovery walk. Repeat if needed."
    },
    "Respirazione 4-7-8": {
        name: "4-7-8 Breathing",
        why: "Activates parasympathetic nervous system (calm), reduces anxiety and muscle tension tied to nicotine craving.",
        steps: "Inhale through NOSE for 4 seconds → Hold for 7 seconds → Exhale through MOUTH slowly for 8 seconds. Repeat 3 cycles. Focus ONLY on counting."
    },
    "Burpees Express": {
        name: "Express Burpees",
        why: "Maximal intensity completely redirects focus and releases endorphins that compete with nicotine desire.",
        steps: "Max burpees in 2 minutes. Too intense? Jump squats. Stand → hands to floor → kick back → push-up (opt) → jump forward → stand jump."
    },
    "Corda per Saltare": {
        name: "Jump Rope",
        why: "Cardio + coordination = zero leftover mental space for craving. Occupies your whole mind and body.",
        steps: "Jump at a fast pace for 3 minutes. Alternate feet, double unders. No rope: mime the motion swirling wrists."
    },
    "Horse Stance Shaolin": {
        name: "Shaolin Horse Stance",
        why: "Intense, prolonged muscular tension in legs competes with the craving signal in the brain. The burn takes over.",
        steps: "Deepest Horse Stance possible and HOLD. Focus ALL attention on the burning quads. When you think you're done, hold 5 more seconds."
    },
    "Push-ups a Esaurimento": {
        name: "Push-ups to Failure",
        why: "Acute muscular fatigue to failure resets the brain's reward loop.",
        steps: "Push-ups on mat until you literally cannot do another. 30s pause. Second set to failure. Craving gone."
    },
    "Scalinate": {
        name: "Stairways",
        why: "Climbing stairs is the fastest way to spike heart rate and kill the craving.",
        steps: "Up and down stairs 5 times quickly. No stairs: step-ups on a stable chair alternating legs."
    },
    "Isometria Anti-Craving (discreto, ovunque)": {
        name: "Anti-Craving Isometrics (stealthy)",
        why: "Even 5 mins of isometrics drastically reduces desire. Perfect in office or public — nobody notices a thing.",
        steps: "Quick zero-movement sequence: Palms pressed→push 10s. Hands interlaced→pull 10s. Squeeze glutes 10s. Flex abs 10s. Clench fists max force 10s. Push feet into floor 10s."
    },

    // Bike
    "Recupero Attivo (Pedalata Assistita)": {
        name: "Active Recovery (E-Bike Assist)",
        category: "Scenic Ride",
        description: "Use max motor assist to spin legs without lactic acid build-up. High cadence but zero effort on pedals.",
        progression: "30-60 min at very low heart rate (under 110 bpm). Ideal for flushing the legs.",
        muscles: "Muscle recovery, knee mobility"
    },
    "Zone 2 Endurance (Ibrida)": {
        name: "Zone 2 Endurance (Hybrid)",
        category: "Aerobic",
        description: "Low assist (Eco) on flats. Goal is keeping heart rate steady (120-135 bpm) without gasping, using assist to flatten hills.",
        progression: "60-120 mins. Builds aerobic base and burns fat preserving energy.",
        muscles: "Cardiovascular system, fat burn"
    },
    "HIIT Sprint (Muscolare)": {
        name: "HIIT Sprint (Muscular)",
        category: "Intervals",
        description: "Turn off assist (or keep minimum). 30 seconds all-out sprint (hard gear), then 1 minute slow spin with high assist to recover.",
        progression: "8-12 cycles. 10 min warmup. Highly taxing.",
        muscles: "Explosive power, calves, VO2 Max"
    },
    "Salita Fuori Sella (Muscolare)": {
        name: "Out of Saddle Climb (Muscular)",
        category: "Pure Strength",
        description: "Uphill, turn off assist. Stand on pedals and push with full body weight side to side. Use a very hard gear.",
        progression: "4-6 reps of 1-2 mins. Use assist to ride back home without further fatigue.",
        muscles: "Glutes, core, maximal quads"
    }
};
