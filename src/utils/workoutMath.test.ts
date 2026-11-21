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
  detectNewPRs,
} from './workoutMath';
import { DEFAULT_WEEKLY_PLANS } from '../data/exercises';
import { WorkoutLog } from '../types/workout';

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
  const cal = computeCalendarMonth(
    DEFAULT_WEEKLY_PLANS,
    sampleLogs,
    2026,
    10, // November 2026
    '2026-11-21'
  );
  const nov18 = cal.cells.find((c) => c.date === '2026-11-18');
  assert.equal(nov18?.status, 'completed');
  assert.ok(cal.consistencyScore >= 0 && cal.consistencyScore <= 100);
});
