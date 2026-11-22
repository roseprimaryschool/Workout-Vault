import {
  Difficulty,
  Equipment,
  Exercise,
  ExerciseType,
  MuscleGroup,
} from '../types/workout';

export type MwMuscleSlug =
  | 'chest'
  | 'lats'
  | 'traps-middle'
  | 'traps'
  | 'lowerback'
  | 'shoulders'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abdominals'
  | 'lower-abdominals'
  | 'obliques'
  | 'cardio';

export type MwEquipmentSlug =
  | 'barbell'
  | 'dumbbells'
  | 'cables'
  | 'machine'
  | 'bodyweight'
  | 'kettlebells';

export const MUSCLEWIKI_CATEGORY_SLUGS: Record<MuscleGroup, MwMuscleSlug> = {
  Chest: 'chest',
  Back: 'lats',
  Shoulders: 'shoulders',
  Quads: 'quads',
  Hamstrings: 'hamstrings',
  Glutes: 'glutes',
  Calves: 'calves',
  Biceps: 'biceps',
  Triceps: 'triceps',
  Forearms: 'forearms',
  Core: 'abdominals',
  Cardio: 'cardio',
};

const EQUIPMENT_TO_MW_SLUG: Record<Equipment, MwEquipmentSlug | null> = {
  Barbell: 'barbell',
  Dumbbell: 'dumbbells',
  Cable: 'cables',
  Machine: 'machine',
  Bodyweight: 'bodyweight',
  Kettlebell: 'kettlebells',
  Cardio: null,
};

// Verified MuscleWiki /exercises/<muscle>/<equipment> route availability.
// Any equipment outside this set falls back to /exercises/<muscle> so no link ever 404s.
const VALID_MW_EQUIPMENT: Record<MwMuscleSlug, MwEquipmentSlug[]> = {
  chest: ['barbell', 'dumbbells', 'cables', 'machine', 'bodyweight'],
  lats: ['barbell', 'dumbbells', 'cables', 'machine', 'bodyweight'],
  'traps-middle': ['barbell', 'dumbbells', 'cables', 'machine', 'bodyweight'],
  traps: ['barbell', 'dumbbells', 'cables', 'machine'],
  lowerback: ['barbell', 'dumbbells', 'machine', 'bodyweight'],
  shoulders: ['barbell', 'dumbbells', 'cables', 'machine', 'bodyweight', 'kettlebells'],
  quads: ['barbell', 'dumbbells', 'machine', 'bodyweight', 'kettlebells'],
  hamstrings: ['barbell', 'dumbbells', 'machine', 'bodyweight', 'kettlebells'],
  glutes: ['barbell', 'dumbbells', 'cables', 'machine', 'bodyweight', 'kettlebells'],
  calves: ['barbell', 'dumbbells', 'machine', 'bodyweight'],
  biceps: ['barbell', 'dumbbells', 'cables', 'machine', 'bodyweight'],
  triceps: ['barbell', 'dumbbells', 'cables', 'machine', 'bodyweight'],
  forearms: ['barbell', 'dumbbells', 'cables', 'bodyweight'],
  abdominals: ['bodyweight', 'cables', 'dumbbells', 'machine'],
  'lower-abdominals': ['bodyweight', 'cables'],
  obliques: ['bodyweight', 'cables', 'dumbbells', 'kettlebells'],
  cardio: [],
};

export const mwMuscleUrl = (muscle: MuscleGroup): string =>
  `https://musclewiki.com/exercises/${MUSCLEWIKI_CATEGORY_SLUGS[muscle] || 'chest'}`;

export const mwRoutePath = (mwMuscle: MwMuscleSlug, equipment: Equipment): string => {
  if (mwMuscle === 'cardio') {
    return 'exercises/cardio';
  }
  const eqSlug = EQUIPMENT_TO_MW_SLUG[equipment];
  if (eqSlug && VALID_MW_EQUIPMENT[mwMuscle].includes(eqSlug)) {
    return `exercises/${mwMuscle}/${eqSlug}`;
  }
  return `exercises/${mwMuscle}`;
};

export const mwExerciseUrl = (mwMuscle: MwMuscleSlug, equipment: Equipment): string =>
  `https://musclewiki.com/${mwRoutePath(mwMuscle, equipment)}`;

export interface ExerciseSeed {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  difficulty: Difficulty;
  exerciseType: ExerciseType;
  mwMuscle?: MwMuscleSlug;
  animationStyle: Exercise['animationStyle'];
  instructions: string[];
}

export const buildExercise = (seed: ExerciseSeed): Exercise => {
  const mwMuscle = seed.mwMuscle ?? MUSCLEWIKI_CATEGORY_SLUGS[seed.muscleGroup];
  const routePath = mwRoutePath(mwMuscle, seed.equipment);
  return {
    id: seed.id,
    name: seed.name,
    muscleGroup: seed.muscleGroup,
    secondaryMuscles: seed.secondaryMuscles,
    equipment: seed.equipment,
    difficulty: seed.difficulty,
    exerciseType: seed.exerciseType,
    muscleWikiSlug: routePath,
    muscleWikiUrl: `https://musclewiki.com/${routePath}`,
    animationStyle: seed.animationStyle,
    instructions: seed.instructions,
  };
};
