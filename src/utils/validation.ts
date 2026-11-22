import {
  DayPlan,
  Exercise,
  PlannedExercise,
  UserProfile,
  WorkoutLog,
} from '../types/workout';

// Blueprint-synchronized bounds (mirrors firebase-blueprint.json)
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  UID_MAX: 128,
  DISPLAY_NAME_MAX: 80,
  EMAIL_MAX: 160,
  GOAL_MAX: 120,
  ACHIEVEMENTS_MAX: 30,
  PLAN_TITLE_MAX: 100,
  PLAN_EXERCISES_MAX: 25,
  LOG_TITLE_MAX: 120,
  LOG_ENTRIES_MAX: 30,
  LOG_MUSCLES_MAX: 15,
  LOG_PRS_MAX: 20,
  CUSTOM_NAME_MAX: 100,
  CUSTOM_SECONDARY_MAX: 8,
  CUSTOM_INSTRUCTIONS_MAX: 12,
  CUSTOM_NOTES_MAX: 1000,
  CUSTOM_CUES_MAX: 500,
  CUSTOM_MEDIA_URL_MAX: 2000,
} as const;

export function sanitizeSafeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, BLUEPRINT_LIMITS.CUSTOM_MEDIA_URL_MAX);
    }
  } catch {
    return '';
  }
  return '';
}

export function sanitizeRemoteHttpUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('blob:')) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, BLUEPRINT_LIMITS.CUSTOM_MEDIA_URL_MAX);
    }
  } catch {
    return '';
  }
  return '';
}

export function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function sanitizePlannedExercise(ex: PlannedExercise): PlannedExercise {
  return {
    id: clampString(ex.id || 'ex', 64),
    exerciseId: clampString(ex.exerciseId, 80),
    name: clampString(ex.name, 100),
    targetMuscle: ex.targetMuscle,
    sets: Math.max(1, Math.min(20, Math.round(ex.sets || 3))),
    reps: Math.max(1, Math.min(200, Math.round(ex.reps || 10))),
    weight: Math.max(0, Math.min(1000, Math.round((ex.weight || 0) * 10) / 10)),
    restSeconds: Math.max(10, Math.min(600, Math.round(ex.restSeconds || 90))),
    tempo: clampString(ex.tempo || '2-0-1-0', 20),
    notes: clampString(ex.notes || '', 300),
  };
}

export function sanitizeDayPlanForFirestore(plan: DayPlan, userId: string) {
  return {
    userId: clampString(userId, BLUEPRINT_LIMITS.UID_MAX),
    day: plan.day,
    category: plan.category,
    title: clampString(plan.title || `${plan.category} Session`, BLUEPRINT_LIMITS.PLAN_TITLE_MAX),
    exercises: plan.exercises
      .slice(0, BLUEPRINT_LIMITS.PLAN_EXERCISES_MAX)
      .map(sanitizePlannedExercise),
  };
}

export function sanitizeWorkoutLogForFirestore(log: WorkoutLog, userId: string) {
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const validDate = BLUEPRINT_LIMITS.DATE_PATTERN.test(log.date)
    ? log.date
    : localToday;

  const sanitizedEntries = log.entries.slice(0, BLUEPRINT_LIMITS.LOG_ENTRIES_MAX).map((entry) => ({
    exerciseId: clampString(entry.exerciseId, 80),
    name: clampString(entry.name, 100),
    targetMuscle: entry.targetMuscle,
    sets: entry.sets.slice(0, 25).map((s, idx) => {
      const baseSet: {
        setNumber: number;
        weight: number;
        reps: number;
        completed: boolean;
        rpe?: number;
      } = {
        setNumber: Math.max(1, Math.round(s.setNumber || idx + 1)),
        weight: Math.max(0, Math.min(1000, Math.round((s.weight || 0) * 10) / 10)),
        reps: Math.max(0, Math.min(200, Math.round(s.reps || 0))),
        completed: Boolean(s.completed),
      };
      if (typeof s.rpe === 'number' && Number.isFinite(s.rpe) && s.rpe >= 6 && s.rpe <= 10) {
        baseSet.rpe = Math.round(s.rpe * 10) / 10;
      }
      return baseSet;
    }),
  }));

  return {
    userId: clampString(userId, BLUEPRINT_LIMITS.UID_MAX),
    date: validDate,
    day: clampString(String(log.day), 20),
    category: clampString(String(log.category), 40),
    title: clampString(log.title || 'Training Session', BLUEPRINT_LIMITS.LOG_TITLE_MAX),
    durationSeconds: Math.max(0, Math.min(43200, Math.round(log.durationSeconds))),
    totalVolumeKg: Math.max(0, Math.min(500000, Math.round(log.totalVolumeKg))),
    xpEarned: Math.max(0, Math.min(5000, Math.round(log.xpEarned))),
    musclesTrained: log.musclesTrained.slice(0, BLUEPRINT_LIMITS.LOG_MUSCLES_MAX),
    entries: sanitizedEntries,
    prsHit: log.prsHit.slice(0, BLUEPRINT_LIMITS.LOG_PRS_MAX).map((p) => clampString(p, 120)),
  };
}

export function sanitizeCustomExerciseForFirestore(ex: Exercise, userId: string) {
  return {
    userId: clampString(userId, BLUEPRINT_LIMITS.UID_MAX),
    name: clampString(ex.name, BLUEPRINT_LIMITS.CUSTOM_NAME_MAX),
    muscleGroup: clampString(ex.muscleGroup, 40),
    secondaryMuscles: ex.secondaryMuscles.slice(0, BLUEPRINT_LIMITS.CUSTOM_SECONDARY_MAX),
    equipment: clampString(ex.equipment, 40),
    difficulty: ex.difficulty,
    exerciseType: ex.exerciseType,
    instructions: ex.instructions
      .slice(0, BLUEPRINT_LIMITS.CUSTOM_INSTRUCTIONS_MAX)
      .map((s) => clampString(s, 300)),
    notes: clampString(ex.notes || '', BLUEPRINT_LIMITS.CUSTOM_NOTES_MAX),
    coachingCues: clampString(ex.coachingCues || '', BLUEPRINT_LIMITS.CUSTOM_CUES_MAX),
    mediaType: ex.mediaType || 'none',
    mediaUrl: sanitizeRemoteHttpUrl(ex.mediaUrl || ''),
  };
}

export function sanitizeUserProfileForFirestore(profile: UserProfile) {
  return {
    uid: clampString(profile.uid, BLUEPRINT_LIMITS.UID_MAX),
    displayName: clampString(profile.displayName || 'Athlete', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
    email: clampString(profile.email || '', BLUEPRINT_LIMITS.EMAIL_MAX),
    weightUnit: profile.weightUnit === 'lbs' ? 'lbs' : 'kg',
    goal: clampString(profile.goal || 'Build Strength & Consistency', BLUEPRINT_LIMITS.GOAL_MAX),
    xp: Math.max(0, Math.min(10000000, Math.round(profile.xp))),
    streakDays: Math.max(0, Math.min(3650, Math.round(profile.streakDays))),
    unlockedAchievements: profile.unlockedAchievements
      .slice(0, BLUEPRINT_LIMITS.ACHIEVEMENTS_MAX)
      .map((a) => clampString(a, 64)),
  };
}
