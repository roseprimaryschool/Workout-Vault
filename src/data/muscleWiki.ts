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

export const mwMuscleUrl = (muscle: MuscleGroup): string =>
  `https://musclewiki.com/exercises/${MUSCLEWIKI_CATEGORY_SLUGS[muscle] || 'chest'}`;

export const mwExerciseUrl = (mwSlug: string): string =>
  `https://musclewiki.com/exercise/${mwSlug}`;

export interface ExerciseSeed {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  difficulty: Difficulty;
  exerciseType: ExerciseType;
  mwSlug: string;
  instructions: string[];
}

export const buildExercise = (seed: ExerciseSeed): Exercise => ({
  id: seed.id,
  name: seed.name,
  muscleGroup: seed.muscleGroup,
  secondaryMuscles: seed.secondaryMuscles,
  equipment: seed.equipment,
  difficulty: seed.difficulty,
  exerciseType: seed.exerciseType,
  muscleWikiSlug: seed.mwSlug,
  muscleWikiUrl: mwExerciseUrl(seed.mwSlug),
  instructions: seed.instructions,
});
