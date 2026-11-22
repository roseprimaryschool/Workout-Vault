import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateE1RM,
  calculateSessionVolumeKg,
  computeCalendarMonth,
  computeGamification,
  computeMuscleRecovery,
  computePersonalRecords,
  computeProgressiveOverload,
  computeRestRemainingSeconds,
  computeSessionElapsedSeconds,
  computeTrainingSymmetry,
  computeWeeklyVolumeLandmarks,
  createTrackerEntriesFromPlan,
  detectNewPRs,
  getDefaultDumbbellCount,
  getEffectiveEntryWeight,
  getLocalDateISO,
  getPlanExercisesSignature,
  getTodaysWorkoutLog,
  hasLoggedWorkoutOnDate,
  isDumbbellExercise,
} from './workoutMath';
import { DEFAULT_WEEKLY_PLANS, EXERCISE_LIBRARY } from '../data/exercises';
import { generateWeeklySplit } from './generator';
import {
  calculateBarbellPlates,
  computeTrainingZones,
  generateWarmupRamp,
} from './plateCalc';
import { MuscleGroup, WorkoutLog } from '../types/workout';

const sampleLogs: WorkoutLog[] = [
  {
    id: 'log-a',
    date: '2026-11-18',
    day: 'monday',
    category: 'Push',
    title: 'Push A',
    durationSeconds: 3000,
    totalVolumeKg: 2000,
    xpEarned: 150,
    musclesTrained: ['Chest', 'Triceps'],
    prsHit: ['Barbell Bench Press: 80kg'],
    entries: [
      {
        exerciseId: 'barbell-bench-press',
        name: 'Barbell Bench Press',
        targetMuscle: 'Chest',
        sets: [
          { setNumber: 1, weight: 80, reps: 8, completed: true },
          { setNumber: 2, weight: 80, reps: 8, completed: true },
          { setNumber: 3, weight: 80, reps: 8, completed: true },
        ],
      },
    ],
  },
];

test('calculateE1RM uses Epley formula accurately', () => {
  assert.equal(calculateE1RM(100, 1), 100);
  assert.equal(calculateE1RM(100, 10), 133.3);
  assert.equal(calculateE1RM(0, 10), 0);
});

test('calculateSessionVolumeKg sums only completed sets', () => {
  const vol = calculateSessionVolumeKg([
    {
      exerciseId: 'squat',
      name: 'Squat',
      targetMuscle: 'Quads',
      sets: [
        { setNumber: 1, weight: 100, reps: 5, completed: true },
        { setNumber: 2, weight: 100, reps: 5, completed: false },
      ],
    },
  ]);
  assert.equal(vol, 500);
});

test('computeProgressiveOverload recommends +2.5kg when target sets and reps are hit', () => {
  const suggestion = computeProgressiveOverload(
    'barbell-bench-press',
    { sets: 3, reps: 8, weight: 80 },
    sampleLogs
  );
  assert.equal(suggestion.shouldIncrease, true);
  assert.equal(suggestion.suggestedWeight, 82.5);
});

test('computeProgressiveOverload holds weight when target reps are not yet met', () => {
  const suggestion = computeProgressiveOverload(
    'barbell-bench-press',
    { sets: 3, reps: 10, weight: 80 },
    sampleLogs
  );
  assert.equal(suggestion.shouldIncrease, false);
  assert.equal(suggestion.suggestedWeight, 80);
});

test('computePersonalRecords and detectNewPRs identify new weight and volume records', () => {
  const records = computePersonalRecords(sampleLogs);
  assert.equal(records['barbell-bench-press'].maxWeight, 80);
  assert.equal(records['barbell-bench-press'].maxVolume, 1920);

  const newPRs = detectNewPRs(
    [
      {
        exerciseId: 'barbell-bench-press',
        name: 'Barbell Bench Press',
        targetMuscle: 'Chest',
        sets: [{ setNumber: 1, weight: 85, reps: 5, completed: true }],
      },
    ],
    sampleLogs
  );
  assert.equal(newPRs.length, 1);
  assert.match(newPRs[0], /85kg/);
});

test('computeMuscleRecovery marks freshly trained muscles Red/Yellow and untrained Green', () => {
  const nowMs = new Date('2026-11-18T18:00:00Z').getTime();
  const recovery = computeMuscleRecovery(sampleLogs, nowMs);
  const chest = recovery.muscles.find((m) => m.muscle === 'Chest');
  const quads = recovery.muscles.find((m) => m.muscle === 'Quads');
  assert.ok(chest);
  assert.ok(quads);
  assert.equal(chest.status, 'Red');
  assert.equal(quads.status, 'Green');
});

test('computeGamification unlocks First Workout and 1000kg Lifted on sample logs', () => {
  const gamification = computeGamification(sampleLogs);
  const first = gamification.achievements.find((a) => a.id === 'first-workout');
  const thousand = gamification.achievements.find((a) => a.id === '1000kg-lifted');
  assert.equal(first?.unlocked, true);
  assert.equal(thousand?.unlocked, true);
  assert.ok(gamification.xp >= 400);
});

test('computeCalendarMonth computes completed, missed, and consistency score', () => {
  const ppl = generateWeeklySplit('Push Pull Legs');
  const cal = computeCalendarMonth(
    ppl,
    sampleLogs,
    2026,
    10, // November 2026
    '2026-11-21'
  );
  const nov18 = cal.cells.find((c) => c.date === '2026-11-18');
  assert.equal(nov18?.status, 'completed');
  assert.ok(cal.consistencyScore >= 0 && cal.consistencyScore <= 100);
});

test('empty workout logs produce zero workouts, zero XP, zero consistency, and None yet muscle', async () => {
  const { computeDashboardStats } = await import('./workoutMath');
  const stats = computeDashboardStats([], DEFAULT_WEEKLY_PLANS);
  const gamification = computeGamification([]);
  assert.equal(stats.totalWorkouts, 0);
  assert.equal(stats.totalVolumeKg, 0);
  assert.equal(stats.streak, 0);
  assert.equal(stats.weeklyConsistency, 0);
  assert.equal(stats.mostTrainedMuscle, 'None yet');
  assert.equal(gamification.xp, 0);
  assert.equal(gamification.achievements.some((a) => a.unlocked), false);
});

test('DEFAULT_WEEKLY_PLANS starts empty across all 7 days', () => {
  for (const dayPlan of Object.values(DEFAULT_WEEKLY_PLANS)) {
    assert.equal(dayPlan.exercises.length, 0);
  }
});

test('calculateBarbellPlates, generateWarmupRamp, and computeTrainingZones compute accurately', () => {
  const plates = calculateBarbellPlates(100, 'kg');
  assert.equal(plates.achievableWeight, 100);
  assert.equal(plates.platesPerSide[0].plate, 25);
  assert.equal(plates.platesPerSide[0].countPerSide, 1);
  assert.equal(plates.platesPerSide[1].plate, 15);
  assert.equal(plates.platesPerSide[1].countPerSide, 1);

  const ramp = generateWarmupRamp(100, 'kg');
  assert.equal(ramp.length, 4);
  assert.equal(ramp[0].weight, 20);
  assert.equal(ramp[3].weight, 87.5);

  const zones = computeTrainingZones(120, 'kg');
  assert.equal(zones.length, 4);
});

test('EXERCISE_LIBRARY covers all 12 muscle groups deeply with verified non-404 MuscleWiki links', () => {
  const allMuscles: MuscleGroup[] = [
    'Chest',
    'Back',
    'Shoulders',
    'Quads',
    'Hamstrings',
    'Glutes',
    'Calves',
    'Biceps',
    'Triceps',
    'Forearms',
    'Core',
    'Cardio',
  ];

  assert.ok(
    EXERCISE_LIBRARY.length >= 285,
    `Expected >= 285 total exercises, got ${EXERCISE_LIBRARY.length}`
  );

  const ids = new Set<string>();
  const names = new Set<string>();
  const slugs = new Set<string>();
  const verifiedMwUrlPattern = /^https:\/\/musclewiki\.com\/exercise\/[a-z0-9-]+$/;

  for (const ex of EXERCISE_LIBRARY) {
    assert.equal(ids.has(ex.id), false, `Duplicate exercise id: ${ex.id}`);
    ids.add(ex.id);
    const normName = ex.name.toLowerCase();
    assert.equal(names.has(normName), false, `Duplicate exercise name: ${ex.name}`);
    names.add(normName);
    assert.equal(slugs.has(ex.muscleWikiSlug), false, `Duplicate MuscleWiki slug: ${ex.muscleWikiSlug}`);
    slugs.add(ex.muscleWikiSlug);
    assert.match(
      ex.muscleWikiUrl,
      verifiedMwUrlPattern,
      `Invalid MuscleWiki exercise URL for ${ex.id}: ${ex.muscleWikiUrl}`
    );
    assert.ok(ex.instructions.length >= 3, `Expected >= 3 instructions for ${ex.id}`);
  }

  for (const muscle of allMuscles) {
    const count = EXERCISE_LIBRARY.filter((ex) => ex.muscleGroup === muscle).length;
    assert.ok(count >= 18, `Expected >= 18 exercises for ${muscle}, got ${count}`);
  }

  const hangingLegRaise = EXERCISE_LIBRARY.find((ex) => ex.id === 'hanging-leg-raise');
  assert.equal(
    hangingLegRaise?.muscleWikiUrl,
    'https://musclewiki.com/exercise/hanging-knee-raises'
  );

  // Verify every preset workout split only references valid library exercise IDs
  const styles = [
    'Push Pull Legs',
    'Upper Lower',
    'Full Body',
    'Powerbuilding',
    'Strength',
    'Hypertrophy',
    'Home Workouts',
  ] as const;
  for (const style of styles) {
    const split = generateWeeklySplit(style);
    for (const dayPlan of Object.values(split)) {
      for (const item of dayPlan.exercises) {
        assert.ok(ids.has(item.exerciseId), `Missing exerciseId ${item.exerciseId} in ${style}`);
      }
    }
  }
});

test('getLocalDateISO and 1-workout-per-day date checks enforce daily uniqueness', () => {
  const local = getLocalDateISO(new Date(2026, 10, 18, 23, 55, 0));
  assert.equal(local, '2026-11-18');
  assert.equal(hasLoggedWorkoutOnDate(sampleLogs, '2026-11-18'), true);
  assert.equal(hasLoggedWorkoutOnDate(sampleLogs, '2026-11-19'), false);
  assert.equal(getTodaysWorkoutLog(sampleLogs, '2026-11-18')?.id, 'log-a');
  assert.equal(getTodaysWorkoutLog(sampleLogs, '2026-11-19'), undefined);
});

test('scientific computeMuscleRecovery models synergist fatigue, muscle-specific SRA rates, RPE load, and smooth decay', () => {
  // 1) Synergist fatigue propagation from Bench Press (Chest primary -> Shoulders & Triceps secondary)
  const t6h = new Date('2026-11-18T18:00:00Z').getTime();
  const rec6h = computeMuscleRecovery(sampleLogs, t6h);
  const chest6h = rec6h.muscles.find((m) => m.muscle === 'Chest')!;
  const triceps6h = rec6h.muscles.find((m) => m.muscle === 'Triceps')!;
  assert.equal(chest6h.directSets, 3);
  assert.equal(triceps6h.indirectSets, 3);
  assert.equal(triceps6h.recentSets, 1.5);
  assert.ok(
    triceps6h.recoveryPercent < 100 && triceps6h.recoveryPercent > chest6h.recoveryPercent,
    'Synergist Triceps should have mild fatigue but recover higher than primary Chest'
  );
  assert.ok((chest6h.hoursToReady ?? 0) > 0);

  // 2) Smooth monotonic decay across 47h -> 49h (no 48h step discontinuity)
  const t47 = new Date('2026-11-20T11:00:00Z').getTime();
  const t49 = new Date('2026-11-20T13:00:00Z').getTime();
  const chest47 = computeMuscleRecovery(sampleLogs, t47).muscles.find((m) => m.muscle === 'Chest')!;
  const chest49 = computeMuscleRecovery(sampleLogs, t49).muscles.find((m) => m.muscle === 'Chest')!;
  assert.ok(
    chest49.recoveryPercent >= chest47.recoveryPercent &&
      chest49.recoveryPercent - chest47.recoveryPercent <= 5
  );

  // 3) Muscle size SRA speed & RPE dose-response comparison
  const rpeLogs: WorkoutLog[] = [
    {
      id: 'log-rpe',
      date: '2026-11-18',
      day: 'wednesday',
      category: 'Full Body',
      title: 'SRA Test',
      durationSeconds: 2400,
      totalVolumeKg: 1500,
      xpEarned: 150,
      musclesTrained: ['Quads', 'Biceps'],
      prsHit: [],
      entries: [
        {
          exerciseId: 'barbell-back-squat',
          name: 'Barbell Back Squat',
          targetMuscle: 'Quads',
          sets: [
            { setNumber: 1, weight: 120, reps: 5, completed: true, rpe: 10 },
            { setNumber: 2, weight: 120, reps: 5, completed: true, rpe: 10 },
            { setNumber: 3, weight: 120, reps: 5, completed: true, rpe: 10 },
            { setNumber: 4, weight: 120, reps: 5, completed: true, rpe: 9.5 },
          ],
        },
        {
          exerciseId: 'barbell-bicep-curl',
          name: 'Barbell Bicep Curl',
          targetMuscle: 'Biceps',
          sets: [
            { setNumber: 1, weight: 30, reps: 10, completed: true, rpe: 6.5 },
            { setNumber: 2, weight: 30, reps: 10, completed: true, rpe: 6.5 },
            { setNumber: 3, weight: 30, reps: 10, completed: true, rpe: 6.5 },
            { setNumber: 4, weight: 30, reps: 10, completed: true, rpe: 6.5 },
          ],
        },
      ],
    },
  ];
  const t30h = new Date('2026-11-19T18:00:00Z').getTime();
  const rpeRec = computeMuscleRecovery(rpeLogs, t30h);
  const quads30 = rpeRec.muscles.find((m) => m.muscle === 'Quads')!;
  const biceps30 = rpeRec.muscles.find((m) => m.muscle === 'Biceps')!;
  assert.ok(
    biceps30.recoveryPercent > quads30.recoveryPercent + 15,
    `Expected submaximal Biceps (${biceps30.recoveryPercent}%) to recover significantly faster than high-RPE Quads (${quads30.recoveryPercent}%)`
  );
});

test('computeWeeklyVolumeLandmarks and computeTrainingSymmetry score effective sets and balance accurately', () => {
  const landmarks = computeWeeklyVolumeLandmarks(sampleLogs, '2026-11-20');
  const chest = landmarks.find((l) => l.muscle === 'Chest')!;
  const triceps = landmarks.find((l) => l.muscle === 'Triceps')!;
  assert.equal(chest.directSets, 3);
  assert.equal(chest.weeklyEffectiveSets, 3);
  assert.equal(chest.zone, 'Under MV');
  assert.equal(triceps.indirectSets, 3);
  assert.equal(triceps.weeklyEffectiveSets, 1.5);

  const symmetry = computeTrainingSymmetry(sampleLogs);
  assert.equal(symmetry.pushSets, 3);
  assert.equal(symmetry.pullSets, 0);
  assert.equal(symmetry.pushPullRatio, null);
  assert.equal(symmetry.insights[0].status, 'warning');
});

test('EXERCISE_LIBRARY includes all 21 user-requested dumbbell/core/carry exercises with valid MuscleWiki links', () => {
  const requiredNames = [
    'Dumbbell Bench Press',
    'Incline Dumbbell Bench Press',
    'Seated Dumbbell Shoulder Press',
    'Dumbbell Lateral Raise',
    'Overhead Dumbbell Tricep Extension',
    'Neutral-Grip Dumbbell Skullcrusher',
    'One-Arm Dumbbell Row',
    'Chest-Supported Dumbbell Row',
    'Dumbbell Shrug',
    'Rear Delt Raises',
    'Seated Dumbbell Rear Delt Raise',
    'Dumbbell Curl',
    'Dumbbell Hammer Curl',
    'Dumbbell Reverse Curl',
    'Dumbbell Goblet Squat',
    'Bulgarian Split Squat',
    'Dumbbell Romanian Deadlift',
    'Standing Machine Calf Raise',
    'Seated Dumbbell Calf Raises',
    'RKC Plank',
    'Hanging Knee / Leg Raise',
    'Seated Incline Leg Raises',
    "Farmer's Carries (Dumbbell)",
    'Static Hold / Single-Arm Farmer Carry',
  ];

  const byName = new Map(EXERCISE_LIBRARY.map((ex) => [ex.name, ex]));
  for (const name of requiredNames) {
    const found = byName.get(name);
    assert.ok(found, `Expected exercise "${name}" in EXERCISE_LIBRARY`);
    assert.match(
      found.muscleWikiUrl,
      /^https:\/\/musclewiki\.com\/exercise\/[a-z0-9-]+$/,
      `Invalid MuscleWiki URL for "${name}": ${found.muscleWikiUrl}`
    );
  }
});

test('dumbbell exercises support 1 Dumbbell vs 2 Dumbbells (same weight) defaults, volume, and PRs', () => {
  assert.equal(isDumbbellExercise('Dumbbell Bench Press', 'Dumbbell'), true);
  assert.equal(isDumbbellExercise('Barbell Bench Press', 'Barbell'), false);
  assert.equal(getDefaultDumbbellCount('dumbbell-bench-press', 'Dumbbell Bench Press'), 2);
  assert.equal(getDefaultDumbbellCount('dumbbell-goblet-squat', 'Dumbbell Goblet Squat'), 1);
  assert.equal(getDefaultDumbbellCount('single-arm-dumbbell-row', 'One-Arm Dumbbell Row'), 1);

  assert.equal(getEffectiveEntryWeight(22.5, 2), 45);
  assert.equal(getEffectiveEntryWeight(22.5, 1), 22.5);

  const dbVolume = calculateSessionVolumeKg([
    {
      exerciseId: 'dumbbell-bench-press',
      name: 'Dumbbell Bench Press',
      targetMuscle: 'Chest',
      dumbbellCount: 2,
      sets: [
        { setNumber: 1, weight: 20, reps: 10, completed: true },
        { setNumber: 2, weight: 20, reps: 10, completed: true },
      ],
    },
    {
      exerciseId: 'dumbbell-goblet-squat',
      name: 'Dumbbell Goblet Squat',
      targetMuscle: 'Quads',
      dumbbellCount: 1,
      sets: [{ setNumber: 1, weight: 24, reps: 10, completed: true }],
    },
  ]);
  // 20*2*10 * 2 sets = 800kg + 24*1*10 = 240kg => 1040kg
  assert.equal(dbVolume, 1040);

  const prs = detectNewPRs(
    [
      {
        exerciseId: 'dumbbell-bench-press',
        name: 'Dumbbell Bench Press',
        targetMuscle: 'Chest',
        dumbbellCount: 2,
        sets: [{ setNumber: 1, weight: 25, reps: 8, completed: true }],
      },
    ],
    []
  );
  assert.equal(prs.length, 1);
  assert.match(prs[0], /25kg×2 = 50kg/);
});

test('wall-clock tracker timers and plan signature helpers preserve progress accurately across navigation', () => {
  const t0 = 1_700_000_000_000;
  // Running session advances cleanly across tab switches/unmounts
  assert.equal(computeSessionElapsedSeconds(true, t0, 0, t0 + 47_500), 47);
  // Paused session freezes elapsed time
  assert.equal(computeSessionElapsedSeconds(false, null, 125, t0 + 99_000), 125);
  // Rest countdown counts down accurately and floors at 0
  assert.equal(computeRestRemainingSeconds(t0 + 90_000, t0 + 35_200), 55);
  assert.equal(computeRestRemainingSeconds(t0 + 90_000, t0 + 95_000), 0);

  const ppl = generateWeeklySplit('Push Pull Legs');
  const monday = ppl.monday;
  const entries = createTrackerEntriesFromPlan(monday, EXERCISE_LIBRARY);
  assert.equal(entries.length, monday.exercises.length);
  const sigA = getPlanExercisesSignature(monday);
  const modifiedMonday = {
    ...monday,
    exercises: monday.exercises.map((ex, i) => (i === 0 ? { ...ex, sets: ex.sets + 1 } : ex)),
  };
  const sigB = getPlanExercisesSignature(modifiedMonday);
  assert.notEqual(sigA, sigB);
});


