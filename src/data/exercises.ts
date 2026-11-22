import { DayPlan, Exercise, Weekday } from '../types/workout';
import { LOWER_CORE_CARDIO_EXERCISES } from './exercisesLowerCore';
import { UPPER_BODY_EXERCISES } from './exercisesUpper';
import { MUSCLEWIKI_CATEGORY_SLUGS, mwExerciseUrl, mwMuscleUrl } from './muscleWiki';

export { MUSCLEWIKI_CATEGORY_SLUGS, mwExerciseUrl, mwMuscleUrl };

export const EXERCISE_LIBRARY: Exercise[] = [
  ...UPPER_BODY_EXERCISES,
  ...LOWER_CORE_CARDIO_EXERCISES,
];

export const DEFAULT_WEEKLY_PLANS: Record<Weekday, DayPlan> = {
  monday: {
    day: 'monday',
    category: 'Rest Day',
    title: 'Open Day',
    exercises: [],
  },
  tuesday: {
    day: 'tuesday',
    category: 'Rest Day',
    title: 'Open Day',
    exercises: [],
  },
  wednesday: {
    day: 'wednesday',
    category: 'Rest Day',
    title: 'Open Day',
    exercises: [],
  },
  thursday: {
    day: 'thursday',
    category: 'Rest Day',
    title: 'Open Day',
    exercises: [],
  },
  friday: {
    day: 'friday',
    category: 'Rest Day',
    title: 'Open Day',
    exercises: [],
  },
  saturday: {
    day: 'saturday',
    category: 'Rest Day',
    title: 'Open Day',
    exercises: [],
  },
  sunday: {
    day: 'sunday',
    category: 'Rest Day',
    title: 'Open Day',
    exercises: [],
  },
};
