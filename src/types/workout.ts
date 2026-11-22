export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export type PlanCategory =
  | 'Push'
  | 'Pull'
  | 'Legs'
  | 'Upper'
  | 'Lower'
  | 'Full Body'
  | 'Cardio'
  | 'Core'
  | 'Rest Day';

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Core'
  | 'Cardio';

export type Equipment =
  | 'Barbell'
  | 'Dumbbell'
  | 'Cable'
  | 'Machine'
  | 'Bodyweight'
  | 'Kettlebell'
  | 'Cardio';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export type ExerciseType = 'Strength' | 'Hypertrophy' | 'Cardio' | 'Mobility' | 'Power';

export type WeightUnit = 'kg' | 'lbs';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  difficulty: Difficulty;
  exerciseType: ExerciseType;
  instructions: string[];
  muscleWikiSlug: string;
  muscleWikiUrl: string;
  videoUrl?: string;
  isCustom?: boolean;
  notes?: string;
  coachingCues?: string;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  mediaLocalId?: string;
}

export interface PlannedExercise {
  id: string;
  exerciseId: string;
  name: string;
  targetMuscle: MuscleGroup;
  sets: number;
  reps: number;
  weight: number;
  restSeconds: number;
  tempo: string;
  notes: string;
}

export interface DayPlan {
  day: Weekday;
  category: PlanCategory;
  title: string;
  exercises: PlannedExercise[];
  updatedAt?: string;
}

export interface LoggedSet {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
  rpe?: number;
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  targetMuscle: MuscleGroup;
  sets: LoggedSet[];
  dumbbellCount?: 1 | 2;
}

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD
  day: Weekday | string;
  category: PlanCategory | string;
  title: string;
  durationSeconds: number;
  totalVolumeKg: number;
  xpEarned: number;
  musclesTrained: MuscleGroup[];
  entries: LoggedExercise[];
  prsHit: string[];
  createdAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  weightUnit: WeightUnit;
  goal: string;
  xp: number;
  streakDays: number;
  unlockedAchievements: string[];
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  maxReps: number;
  maxRepsWeight: number;
  maxVolume: number;
  bestE1RM: number;
  lastDate: string;
}

export interface OverloadSuggestion {
  exerciseId: string;
  shouldIncrease: boolean;
  suggestedWeight: number;
  currentWeight: number;
  reason: string;
  trendPercent: number;
  previousBestText: string;
  lastWorkoutDate: string | null;
}

export type RecoveryZoneStatus = 'Green' | 'Yellow' | 'Red';

export type RecoveryPhaseLabel =
  | 'Acute Repair'
  | 'Protein Synthesis'
  | 'Supercompensation'
  | 'Fresh';

export interface MuscleRecoveryStatus {
  muscle: MuscleGroup;
  recoveryPercent: number;
  status: RecoveryZoneStatus;
  hoursSinceTrained: number | null;
  recentSets: number;
  directSets?: number;
  indirectSets?: number;
  hoursToReady?: number;
  sraWindowHours?: number;
  phaseLabel?: RecoveryPhaseLabel;
}

export type VolumeLandmarkZone =
  | 'Under MV'
  | 'Below MEV'
  | 'Optimal MAV'
  | 'High (Near MRV)'
  | 'Over MRV';

export interface MuscleVolumeLandmark {
  muscle: MuscleGroup;
  weeklyEffectiveSets: number;
  directSets: number;
  indirectSets: number;
  mv: number;
  mev: number;
  mavLow: number;
  mavHigh: number;
  mrv: number;
  zone: VolumeLandmarkZone;
}

export interface TrainingSymmetryReport {
  pushSets: number;
  pullSets: number;
  pushPullRatio: number | null;
  quadSets: number;
  posteriorSets: number;
  quadPosteriorRatio: number | null;
  upperSets: number;
  lowerSets: number;
  upperLowerRatio: number | null;
  insights: {
    id: string;
    title: string;
    detail: string;
    status: 'balanced' | 'warning' | 'no-data';
  }[];
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  unlocked: boolean;
  progressText: string;
}

export interface GamificationSummary {
  xp: number;
  level: number;
  rank: string;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  achievements: AchievementDef[];
}

export type GeneratorStyle =
  | 'Push Pull Legs'
  | 'Upper Lower'
  | 'Full Body'
  | 'Powerbuilding'
  | 'Strength'
  | 'Hypertrophy'
  | 'Home Workouts';

export interface CoachAnalysis {
  summary: string;
  weakPoints: string[];
  recoveryRecommendation: string;
  suggestedChanges: {
    day: Weekday;
    action: string;
    category?: PlanCategory;
    volumeAdjustment?: string;
  }[];
  readinessVerdict: string;
}

export interface AiGeneratedProgramExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
  restSeconds: number;
  tempo: string;
  notes: string;
}

export interface AiGeneratedProgramDay {
  day: Weekday;
  category: PlanCategory;
  title: string;
  exercises: AiGeneratedProgramExercise[];
}

export interface AiGeneratedProgram {
  programTitle: string;
  rationale: string;
  days: AiGeneratedProgramDay[];
}
