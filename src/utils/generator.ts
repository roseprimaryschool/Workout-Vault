import { EXERCISE_LIBRARY } from '../data/exercises';
import {
  DayPlan,
  Exercise,
  GeneratorStyle,
  PlanCategory,
  PlannedExercise,
  Weekday,
} from '../types/workout';

function makePlanned(
  exercise: Exercise,
  sets: number,
  reps: number,
  weight: number,
  restSeconds: number,
  tempo: string,
  suffix: string
): PlannedExercise {
  return {
    id: `gen-${exercise.id}-${suffix}-${Math.random().toString(36).slice(2, 6)}`,
    exerciseId: exercise.id,
    name: exercise.name,
    targetMuscle: exercise.muscleGroup,
    sets,
    reps,
    weight,
    restSeconds,
    tempo,
    notes: exercise.instructions[0] || '',
  };
}

function findEx(id: string): Exercise {
  return EXERCISE_LIBRARY.find((e) => e.id === id) || EXERCISE_LIBRARY[0];
}

function makeDay(
  day: Weekday,
  category: PlanCategory,
  title: string,
  items: [string, number, number, number, number, string][]
): DayPlan {
  return {
    day,
    category,
    title,
    exercises: items.map(([id, sets, reps, weight, rest, tempo], idx) =>
      makePlanned(findEx(id), sets, reps, weight, rest, tempo, `${day}-${idx}`)
    ),
  };
}

export function generateWeeklySplit(style: GeneratorStyle): Record<Weekday, DayPlan> {
  switch (style) {
    case 'Push Pull Legs':
      return {
        monday: makeDay('monday', 'Push', 'Push A — Chest & Shoulders', [
          ['barbell-bench-press', 4, 6, 80, 150, '3-1-1-0'],
          ['incline-dumbbell-press', 3, 10, 28, 90, '2-0-1-0'],
          ['overhead-barbell-press', 3, 8, 50, 120, '2-0-1-0'],
          ['dumbbell-lateral-raise', 4, 15, 12, 60, '2-1-2-0'],
          ['tricep-rope-pushdown', 3, 12, 25, 60, '2-0-1-1'],
        ]),
        tuesday: makeDay('tuesday', 'Pull', 'Pull A — Lats & Rear Delts', [
          ['barbell-deadlift', 3, 5, 125, 180, '1-0-1-0'],
          ['pull-up', 4, 8, 0, 120, '2-1-1-0'],
          ['seated-cable-row', 3, 12, 60, 90, '2-1-1-0'],
          ['cable-face-pull', 3, 15, 22, 60, '2-1-1-1'],
          ['barbell-bicep-curl', 3, 10, 32.5, 75, '2-0-1-0'],
        ]),
        wednesday: makeDay('wednesday', 'Legs', 'Legs A — Quad Dominant', [
          ['barbell-back-squat', 4, 6, 105, 180, '3-1-1-0'],
          ['romanian-deadlift', 3, 8, 90, 120, '3-1-1-0'],
          ['leg-press', 3, 12, 160, 90, '3-0-1-0'],
          ['standing-calf-raise', 4, 15, 65, 60, '2-2-1-1'],
        ]),
        thursday: makeDay('thursday', 'Push', 'Push B — Upper Chest & Triceps', [
          ['incline-dumbbell-press', 4, 10, 30, 90, '2-1-1-0'],
          ['cable-chest-fly', 3, 14, 17.5, 60, '2-1-1-1'],
          ['dumbbell-lateral-raise', 4, 15, 12, 60, '2-1-2-0'],
          ['overhead-tricep-extension', 3, 12, 25, 60, '2-1-1-0'],
        ]),
        friday: makeDay('friday', 'Pull', 'Pull B — Mid-Back & Arms', [
          ['barbell-bent-over-row', 4, 8, 75, 105, '2-1-1-0'],
          ['lat-pulldown', 3, 12, 60, 90, '2-1-1-0'],
          ['incline-dumbbell-curl', 3, 12, 14, 60, '3-0-1-0'],
          ['farmer-carry', 3, 40, 32, 90, '40m'],
        ]),
        saturday: makeDay('saturday', 'Legs', 'Legs B — Posterior & Glutes', [
          ['barbell-hip-thrust', 4, 10, 115, 120, '2-1-1-1'],
          ['bulgarian-split-squat', 3, 10, 20, 90, '2-0-1-0'],
          ['lying-leg-curl', 3, 12, 50, 75, '3-1-1-0'],
          ['hanging-leg-raise', 3, 12, 0, 60, '2-1-2-0'],
        ]),
        sunday: makeDay('sunday', 'Rest Day', 'Full Recovery & Walking', []),
      };

    case 'Upper Lower':
      return {
        monday: makeDay('monday', 'Upper', 'Upper Strength', [
          ['barbell-bench-press', 4, 6, 82.5, 150, '3-1-1-0'],
          ['barbell-bent-over-row', 4, 6, 77.5, 120, '2-1-1-0'],
          ['overhead-barbell-press', 3, 8, 50, 120, '2-0-1-0'],
          ['lat-pulldown', 3, 10, 60, 90, '2-1-1-0'],
        ]),
        tuesday: makeDay('tuesday', 'Lower', 'Lower Strength', [
          ['barbell-back-squat', 4, 5, 110, 180, '3-1-1-0'],
          ['romanian-deadlift', 3, 8, 95, 120, '3-1-1-0'],
          ['standing-calf-raise', 4, 15, 70, 60, '2-2-1-1'],
          ['hanging-leg-raise', 3, 12, 0, 60, '2-1-2-0'],
        ]),
        wednesday: makeDay('wednesday', 'Rest Day', 'Recovery & Mobility', []),
        thursday: makeDay('thursday', 'Upper', 'Upper Hypertrophy', [
          ['incline-dumbbell-press', 4, 10, 30, 90, '2-0-1-0'],
          ['seated-cable-row', 4, 12, 62.5, 90, '2-1-1-0'],
          ['dumbbell-lateral-raise', 4, 15, 12, 60, '2-1-2-0'],
          ['barbell-bicep-curl', 3, 12, 32.5, 60, '2-0-1-0'],
          ['tricep-rope-pushdown', 3, 12, 25, 60, '2-0-1-1'],
        ]),
        friday: makeDay('friday', 'Lower', 'Lower Hypertrophy', [
          ['barbell-hip-thrust', 4, 10, 120, 120, '2-1-1-1'],
          ['leg-press', 3, 12, 170, 90, '3-0-1-0'],
          ['lying-leg-curl', 3, 12, 50, 75, '3-1-1-0'],
          ['bulgarian-split-squat', 3, 10, 20, 90, '2-0-1-0'],
        ]),
        saturday: makeDay('saturday', 'Cardio', 'Zone 2 & Core Conditioning', [
          ['assault-bike-intervals', 5, 1, 0, 90, '20s/60s'],
          ['cable-woodchopper', 3, 12, 18, 60, '2-1-2-0'],
        ]),
        sunday: makeDay('sunday', 'Rest Day', 'Rest & Sleep Optimization', []),
      };

    case 'Full Body':
      return {
        monday: makeDay('monday', 'Full Body', 'Full Body A — Squat & Press', [
          ['barbell-back-squat', 3, 6, 100, 150, '3-1-1-0'],
          ['barbell-bench-press', 3, 8, 77.5, 120, '3-1-1-0'],
          ['lat-pulldown', 3, 10, 60, 90, '2-1-1-0'],
          ['dumbbell-lateral-raise', 3, 15, 10, 60, '2-1-2-0'],
        ]),
        tuesday: makeDay('tuesday', 'Rest Day', 'Active Recovery Walk', []),
        wednesday: makeDay('wednesday', 'Full Body', 'Full Body B — Hinge & Pull', [
          ['barbell-deadlift', 3, 5, 120, 180, '1-0-1-0'],
          ['overhead-barbell-press', 3, 8, 47.5, 120, '2-0-1-0'],
          ['seated-cable-row', 3, 12, 60, 90, '2-1-1-0'],
          ['hanging-leg-raise', 3, 12, 0, 60, '2-1-2-0'],
        ]),
        thursday: makeDay('thursday', 'Rest Day', 'Mobility & Recovery', []),
        friday: makeDay('friday', 'Full Body', 'Full Body C — Unilateral & Arms', [
          ['bulgarian-split-squat', 3, 10, 20, 90, '2-0-1-0'],
          ['incline-dumbbell-press', 3, 10, 28, 90, '2-0-1-0'],
          ['pull-up', 3, 8, 0, 105, '2-1-1-0'],
          ['barbell-bicep-curl', 3, 12, 30, 60, '2-0-1-0'],
          ['tricep-rope-pushdown', 3, 12, 22.5, 60, '2-0-1-1'],
        ]),
        saturday: makeDay('saturday', 'Cardio', 'Conditioning Intervals', [
          ['kettlebell-swing', 4, 15, 24, 75, '1-0-1-0'],
          ['assault-bike-intervals', 5, 1, 0, 90, '20s/60s'],
        ]),
        sunday: makeDay('sunday', 'Rest Day', 'Complete Rest', []),
      };

    case 'Powerbuilding':
      return {
        monday: makeDay('monday', 'Push', 'Heavy Bench & Shoulder Volume', [
          ['barbell-bench-press', 5, 4, 90, 180, '2-1-1-0'],
          ['incline-dumbbell-press', 4, 10, 30, 90, '2-0-1-0'],
          ['dumbbell-lateral-raise', 4, 15, 12, 60, '2-1-2-0'],
          ['overhead-tricep-extension', 3, 12, 25, 60, '2-1-1-0'],
        ]),
        tuesday: makeDay('tuesday', 'Legs', 'Heavy Squat & Posterior Volume', [
          ['barbell-back-squat', 5, 4, 120, 180, '3-1-1-0'],
          ['romanian-deadlift', 3, 8, 95, 120, '3-1-1-0'],
          ['leg-press', 3, 12, 180, 90, '3-0-1-0'],
          ['standing-calf-raise', 4, 15, 70, 60, '2-2-1-1'],
        ]),
        wednesday: makeDay('wednesday', 'Rest Day', 'CNS Recovery', []),
        thursday: makeDay('thursday', 'Pull', 'Heavy Deadlift & Back Hypertrophy', [
          ['barbell-deadlift', 4, 3, 140, 210, '1-0-1-0'],
          ['barbell-bent-over-row', 4, 8, 80, 105, '2-1-1-0'],
          ['lat-pulldown', 3, 12, 62.5, 90, '2-1-1-0'],
          ['incline-dumbbell-curl', 3, 12, 14, 60, '3-0-1-0'],
        ]),
        friday: makeDay('friday', 'Upper', 'Upper Pump & Weak Points', [
          ['overhead-barbell-press', 4, 6, 52.5, 120, '2-0-1-0'],
          ['cable-chest-fly', 4, 14, 17.5, 60, '2-1-1-1'],
          ['seated-cable-row', 4, 12, 65, 90, '2-1-1-0'],
          ['cable-face-pull', 4, 15, 22.5, 60, '2-1-1-1'],
        ]),
        saturday: makeDay('saturday', 'Lower', 'Glutes, Carries & Core', [
          ['barbell-hip-thrust', 4, 8, 130, 120, '2-1-1-1'],
          ['lying-leg-curl', 3, 12, 52.5, 75, '3-1-1-0'],
          ['farmer-carry', 3, 40, 36, 90, '40m'],
          ['hanging-leg-raise', 3, 12, 0, 60, '2-1-2-0'],
        ]),
        sunday: makeDay('sunday', 'Rest Day', 'Rest Day', []),
      };

    case 'Strength':
      return {
        monday: makeDay('monday', 'Legs', 'Primary Squat & Press', [
          ['barbell-back-squat', 5, 5, 115, 180, '3-1-1-0'],
          ['barbell-bench-press', 5, 5, 85, 180, '2-1-1-0'],
          ['barbell-bent-over-row', 4, 6, 80, 120, '2-1-1-0'],
        ]),
        tuesday: makeDay('tuesday', 'Rest Day', 'Rest & Mobility', []),
        wednesday: makeDay('wednesday', 'Pull', 'Primary Deadlift & Overhead', [
          ['barbell-deadlift', 4, 4, 135, 210, '1-0-1-0'],
          ['overhead-barbell-press', 5, 5, 52.5, 150, '2-0-1-0'],
          ['pull-up', 4, 6, 0, 120, '2-1-1-0'],
        ]),
        thursday: makeDay('thursday', 'Rest Day', 'Rest Day', []),
        friday: makeDay('friday', 'Full Body', 'Heavy Compound Synthesis', [
          ['barbell-back-squat', 3, 3, 122.5, 180, '3-1-1-0'],
          ['barbell-bench-press', 3, 3, 90, 180, '2-1-1-0'],
          ['romanian-deadlift', 3, 6, 100, 150, '3-1-1-0'],
          ['farmer-carry', 3, 40, 36, 90, '40m'],
        ]),
        saturday: makeDay('saturday', 'Core', 'Core &GPP Conditioning', [
          ['kettlebell-swing', 4, 15, 24, 75, '1-0-1-0'],
          ['hanging-leg-raise', 3, 10, 0, 75, '2-1-2-0'],
        ]),
        sunday: makeDay('sunday', 'Rest Day', 'Rest Day', []),
      };

    case 'Hypertrophy':
      return {
        monday: makeDay('monday', 'Push', 'Chest & Side Delts Hypertrophy', [
          ['incline-dumbbell-press', 4, 10, 30, 90, '3-1-1-0'],
          ['cable-chest-fly', 4, 15, 17.5, 60, '2-1-1-1'],
          ['dumbbell-lateral-raise', 5, 15, 12, 60, '2-1-2-0'],
          ['overhead-tricep-extension', 4, 12, 25, 60, '3-1-1-0'],
        ]),
        tuesday: makeDay('tuesday', 'Pull', 'Lats, Traps & Biceps Stretch', [
          ['lat-pulldown', 4, 12, 62.5, 90, '3-1-1-0'],
          ['seated-cable-row', 4, 12, 65, 90, '2-1-1-0'],
          ['cable-face-pull', 4, 15, 22.5, 60, '2-1-1-1'],
          ['incline-dumbbell-curl', 4, 12, 14, 60, '3-0-1-0'],
        ]),
        wednesday: makeDay('wednesday', 'Legs', 'Quad & Calf Focus', [
          ['leg-press', 4, 12, 180, 105, '3-1-1-0'],
          ['bulgarian-split-squat', 3, 12, 20, 90, '3-0-1-0'],
          ['lying-leg-curl', 4, 12, 50, 75, '3-1-1-0'],
          ['standing-calf-raise', 5, 15, 70, 60, '2-2-1-1'],
        ]),
        thursday: makeDay('thursday', 'Rest Day', 'Growth & Recovery', []),
        friday: makeDay('friday', 'Upper', 'Upper Chest, Back & Arms', [
          ['barbell-bench-press', 4, 8, 80, 120, '3-1-1-0'],
          ['barbell-bent-over-row', 4, 10, 72.5, 105, '2-1-1-0'],
          ['dumbbell-lateral-raise', 4, 15, 12, 60, '2-1-2-0'],
          ['barbell-bicep-curl', 3, 12, 32.5, 60, '2-0-1-0'],
          ['tricep-rope-pushdown', 3, 15, 25, 60, '2-0-1-1'],
        ]),
        saturday: makeDay('saturday', 'Lower', 'Glute & Hamstring Emphasis', [
          ['barbell-hip-thrust', 4, 12, 115, 120, '2-1-1-1'],
          ['romanian-deadlift', 4, 10, 90, 120, '3-1-1-0'],
          ['hanging-leg-raise', 4, 12, 0, 60, '2-1-2-0'],
        ]),
        sunday: makeDay('sunday', 'Rest Day', 'Rest Day', []),
      };

    case 'Home Workouts':
      return {
        monday: makeDay('monday', 'Push', 'Home Push — Bodyweight & DB', [
          ['push-up', 4, 15, 0, 75, '3-1-1-0'],
          ['incline-dumbbell-press', 4, 12, 22.5, 90, '2-0-1-0'],
          ['dumbbell-lateral-raise', 4, 15, 10, 60, '2-1-2-0'],
        ]),
        tuesday: makeDay('tuesday', 'Pull', 'Home Pull & Hinge', [
          ['pull-up', 4, 8, 0, 120, '2-1-1-0'],
          ['kettlebell-swing', 4, 20, 20, 75, '1-0-1-0'],
          ['incline-dumbbell-curl', 3, 12, 12, 60, '3-0-1-0'],
        ]),
        wednesday: makeDay('wednesday', 'Core', 'Home Core & Conditioning', [
          ['hanging-leg-raise', 4, 12, 0, 60, '2-1-2-0'],
          ['farmer-carry', 4, 40, 24, 75, '40m'],
        ]),
        thursday: makeDay('thursday', 'Legs', 'Home Lower Unilateral', [
          ['bulgarian-split-squat', 4, 12, 18, 90, '3-0-1-0'],
          ['kettlebell-swing', 4, 20, 24, 75, '1-0-1-0'],
        ]),
        friday: makeDay('friday', 'Full Body', 'Home Full Body Circuit', [
          ['push-up', 3, 18, 0, 60, '2-0-1-0'],
          ['pull-up', 3, 8, 0, 90, '2-1-1-0'],
          ['bulgarian-split-squat', 3, 10, 16, 75, '2-0-1-0'],
          ['dumbbell-lateral-raise', 3, 15, 10, 60, '2-1-2-0'],
        ]),
        saturday: makeDay('saturday', 'Cardio', 'Active Kettlebell Conditioning', [
          ['kettlebell-swing', 5, 20, 20, 60, '1-0-1-0'],
        ]),
        sunday: makeDay('sunday', 'Rest Day', 'Rest & Mobility', []),
      };
  }
}
