import {
  AchievementDef,
  DayPlan,
  GamificationSummary,
  LoggedExercise,
  MuscleGroup,
  MuscleRecoveryStatus,
  OverloadSuggestion,
  PersonalRecord,
  PlannedExercise,
  Weekday,
  WEEKDAYS,
  WorkoutLog,
} from '../types/workout';

const ALL_MUSCLES: MuscleGroup[] = [
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

export function calculateE1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function calculateSessionVolumeKg(entries: LoggedExercise[]): number {
  let total = 0;
  for (const entry of entries) {
    for (const set of entry.sets) {
      if (set.completed && set.weight > 0 && set.reps > 0) {
        total += set.weight * set.reps;
      }
    }
  }
  return Math.round(total);
}

export function formatWeight(kgValue: number, unit: 'kg' | 'lbs'): string {
  if (unit === 'kg') return `${Math.round(kgValue * 10) / 10} kg`;
  return `${Math.round(kgValue * 2.20462 * 10) / 10} lbs`;
}

export function computePersonalRecords(logs: WorkoutLog[]): Record<string, PersonalRecord> {
  const records: Record<string, PersonalRecord> = {};
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  for (const log of sorted) {
    for (const entry of log.entries) {
      const completedSets = entry.sets.filter((s) => s.completed && s.reps > 0);
      if (completedSets.length === 0) continue;

      let entryVolume = 0;
      let topWeight = 0;
      let topReps = 0;
      let topRepsWeight = 0;
      let bestE1RM = 0;

      for (const s of completedSets) {
        entryVolume += s.weight * s.reps;
        if (s.weight > topWeight) topWeight = s.weight;
        if (s.reps > topReps || (s.reps === topReps && s.weight > topRepsWeight)) {
          topReps = s.reps;
          topRepsWeight = s.weight;
        }
        const e1rm = calculateE1RM(s.weight, s.reps);
        if (e1rm > bestE1RM) bestE1RM = e1rm;
      }

      const existing = records[entry.exerciseId];
      if (!existing) {
        records[entry.exerciseId] = {
          exerciseId: entry.exerciseId,
          exerciseName: entry.name,
          maxWeight: topWeight,
          maxReps: topReps,
          maxRepsWeight: topRepsWeight,
          maxVolume: Math.round(entryVolume),
          bestE1RM,
          lastDate: log.date,
        };
      } else {
        existing.maxWeight = Math.max(existing.maxWeight, topWeight);
        if (topReps > existing.maxReps) {
          existing.maxReps = topReps;
          existing.maxRepsWeight = topRepsWeight;
        }
        existing.maxVolume = Math.max(existing.maxVolume, Math.round(entryVolume));
        existing.bestE1RM = Math.max(existing.bestE1RM, bestE1RM);
        if (log.date >= existing.lastDate) {
          existing.lastDate = log.date;
        }
      }
    }
  }

  return records;
}

export function detectNewPRs(
  entries: LoggedExercise[],
  previousLogs: WorkoutLog[]
): string[] {
  const prevRecords = computePersonalRecords(previousLogs);
  const prs: string[] = [];

  for (const entry of entries) {
    const completed = entry.sets.filter((s) => s.completed && s.reps > 0);
    if (completed.length === 0) continue;

    const topWeight = Math.max(...completed.map((s) => s.weight));
    const bestE1RM = Math.max(...completed.map((s) => calculateE1RM(s.weight, s.reps)));
    const totalVol = completed.reduce((acc, s) => acc + s.weight * s.reps, 0);

    const prev = prevRecords[entry.exerciseId];
    if (!prev) {
      if (topWeight > 0) {
        prs.push(`${entry.name}: First logged benchmark (${topWeight}kg)`);
      }
      continue;
    }

    if (topWeight > prev.maxWeight) {
      prs.push(`${entry.name}: New Weight PR (${topWeight}kg)`);
    } else if (bestE1RM > prev.bestE1RM) {
      prs.push(`${entry.name}: New E1RM PR (${bestE1RM}kg)`);
    } else if (totalVol > prev.maxVolume && totalVol > 0) {
      prs.push(`${entry.name}: New Volume PR (${Math.round(totalVol)}kg)`);
    }
  }

  return prs;
}

export function computeProgressiveOverload(
  exerciseId: string,
  planned: Pick<PlannedExercise, 'sets' | 'reps' | 'weight'>,
  logs: WorkoutLog[]
): OverloadSuggestion {
  const matchingEntries: { date: string; entry: LoggedExercise }[] = [];
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  for (const log of sorted) {
    const found = log.entries.find((e) => e.exerciseId === exerciseId);
    if (found) {
      matchingEntries.push({ date: log.date, entry: found });
    }
  }

  if (matchingEntries.length === 0) {
    return {
      exerciseId,
      shouldIncrease: false,
      suggestedWeight: planned.weight,
      currentWeight: planned.weight,
      reason: 'Log your first session to establish a progression baseline.',
      trendPercent: 0,
      previousBestText: 'No prior data',
      lastWorkoutDate: null,
    };
  }

  const latest = matchingEntries[0];
  const latestSets = latest.entry.sets.filter((s) => s.completed);
  const latestTopSet = latestSets.reduce(
    (best, s) => (calculateE1RM(s.weight, s.reps) > calculateE1RM(best.weight, best.reps) ? s : best),
    latestSets[0] || { setNumber: 1, weight: planned.weight, reps: 0, completed: false }
  );

  const hitAllSets = latestSets.length >= planned.sets;
  const hitAllReps = latestSets.every((s) => s.reps >= planned.reps);
  const workingWeight = latestTopSet.weight || planned.weight;
  const increment = workingWeight >= 60 ? 2.5 : 1.25;

  let trendPercent = 0;
  if (matchingEntries.length >= 2) {
    const prevSets = matchingEntries[1].entry.sets.filter((s) => s.completed);
    const prevE1RM = Math.max(0, ...prevSets.map((s) => calculateE1RM(s.weight, s.reps)));
    const currE1RM = Math.max(0, ...latestSets.map((s) => calculateE1RM(s.weight, s.reps)));
    if (prevE1RM > 0) {
      trendPercent = Math.round(((currE1RM - prevE1RM) / prevE1RM) * 1000) / 10;
    }
  }

  const shouldIncrease = hitAllSets && hitAllReps && workingWeight > 0 && workingWeight >= planned.weight;
  const suggestedWeight = shouldIncrease ? Math.round((workingWeight + increment) * 4) / 4 : planned.weight;

  return {
    exerciseId,
    shouldIncrease,
    suggestedWeight,
    currentWeight: workingWeight,
    reason: shouldIncrease
      ? `Target ${planned.sets}x${planned.reps} hit cleanly on ${latest.date}. Increase by +${increment}kg.`
      : workingWeight < planned.weight
      ? `Last session was ${workingWeight}kg — target today is ${planned.weight}kg.`
      : `Match ${planned.sets}x${planned.reps} at ${workingWeight}kg before adding weight.`,
    trendPercent,
    previousBestText: `${latestTopSet.weight}kg x ${latestTopSet.reps} reps`,
    lastWorkoutDate: latest.date,
  };
}

export function computeMuscleRecovery(
  logs: WorkoutLog[],
  nowMs: number = Date.now()
): { muscles: MuscleRecoveryStatus[]; overallScore: number } {
  const results: MuscleRecoveryStatus[] = ALL_MUSCLES.map((muscle) => {
    let latestMs: number | null = null;
    let recentSets = 0;

    for (const log of logs) {
      const logTime = new Date(`${log.date}T12:00:00Z`).getTime();
      const hoursAgo = Math.max(0, (nowMs - logTime) / (1000 * 60 * 60));

      const matchedEntries = log.entries.filter((e) => e.targetMuscle === muscle);
      const trainedInList = log.musclesTrained.includes(muscle);

      if (matchedEntries.length > 0 || trainedInList) {
        if (latestMs === null || logTime > latestMs) {
          latestMs = logTime;
        }
        if (hoursAgo <= 72) {
          const setsCount =
            matchedEntries.length > 0
              ? matchedEntries.reduce((sum, e) => sum + e.sets.filter((s) => s.completed).length, 0)
              : 3;
          recentSets += setsCount;
        }
      }
    }

    if (latestMs === null) {
      return {
        muscle,
        recoveryPercent: 100,
        status: 'Green',
        hoursSinceTrained: null,
        recentSets: 0,
      };
    }

    const hoursSince = Math.max(0, Math.round((nowMs - latestMs) / (1000 * 60 * 60)));
    // Full recovery curves: 72 hours base minus extra fatigue penalty for high recent volume
    const fatiguePenalty = Math.min(25, recentSets * 1.5);
    const baseRecovery = Math.min(100, (hoursSince / 72) * 100);
    const recoveryPercent = Math.max(10, Math.min(100, Math.round(baseRecovery - (hoursSince < 48 ? fatiguePenalty * 0.5 : 0))));

    const status =
      recoveryPercent >= 80 ? 'Green' : recoveryPercent >= 45 ? 'Yellow' : 'Red';

    return {
      muscle,
      recoveryPercent,
      status,
      hoursSinceTrained: hoursSince,
      recentSets,
    };
  });

  const overallScore = Math.round(
    results.reduce((sum, m) => sum + m.recoveryPercent, 0) / results.length
  );

  return { muscles: results, overallScore };
}

export function getRankForLevel(level: number): string {
  if (level >= 20) return 'Apex Titan';
  if (level >= 12) return 'Vault Vanguard';
  if (level >= 7) return 'Barbell Tactician';
  if (level >= 3) return 'Iron Apprentice';
  return 'Initiate';
}

export function computeTrainingStreak(logs: WorkoutLog[]): number {
  if (logs.length === 0) return 0;
  const uniqueDates = Array.from(new Set(logs.map((l) => l.date))).sort((a, b) =>
    b.localeCompare(a)
  );

  let streak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const curr = new Date(`${uniqueDates[i]}T12:00:00Z`).getTime();
    const next = new Date(`${uniqueDates[i + 1]}T12:00:00Z`).getTime();
    const diffDays = Math.round((curr - next) / (1000 * 60 * 60 * 24));
    if (diffDays <= 2) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function computeGamification(
  logs: WorkoutLog[],
  baseXpBonus: number = 0
): GamificationSummary {
  const totalWorkouts = logs.length;
  const totalVolume = logs.reduce((sum, l) => sum + l.totalVolumeKg, 0);
  const streak = computeTrainingStreak(logs);
  const totalPRs = logs.reduce((sum, l) => sum + l.prsHit.length, 0);

  const achievements: AchievementDef[] = [
    {
      id: 'first-workout',
      title: 'First Workout',
      description: 'Complete and log your first training session.',
      xpReward: 100,
      unlocked: totalWorkouts >= 1,
      progressText: `${Math.min(1, totalWorkouts)} / 1`,
    },
    {
      id: '1000kg-lifted',
      title: '1000kg Lifted',
      description: 'Accumulate 1,000 kg of total training volume.',
      xpReward: 150,
      unlocked: totalVolume >= 1000,
      progressText: `${Math.min(1000, Math.round(totalVolume))} / 1000 kg`,
    },
    {
      id: '7-day-streak',
      title: '7 Day Streak',
      description: 'Maintain an active training rhythm across 7 sessions.',
      xpReward: 250,
      unlocked: streak >= 7,
      progressText: `${Math.min(7, streak)} / 7`,
    },
    {
      id: 'consistency-master',
      title: 'Consistency Master',
      description: 'Complete 12+ logged workouts and hit 3+ personal records.',
      xpReward: 400,
      unlocked: totalWorkouts >= 12 && totalPRs >= 3,
      progressText: `${Math.min(12, totalWorkouts)} / 12 sessions`,
    },
    {
      id: '100-workouts',
      title: '100 Workouts',
      description: 'Log 100 complete workouts inside Workout Vault.',
      xpReward: 1000,
      unlocked: totalWorkouts >= 100,
      progressText: `${Math.min(100, totalWorkouts)} / 100`,
    },
  ];

  const workoutXp = logs.reduce((sum, l) => sum + (l.xpEarned || 150), 0);
  const achievementXp = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.xpReward, 0);
  const xp = workoutXp + achievementXp + baseXpBonus;

  const xpPerLevel = 500;
  const level = Math.floor(xp / xpPerLevel) + 1;
  const xpInCurrentLevel = xp % xpPerLevel;
  const progressPercent = Math.round((xpInCurrentLevel / xpPerLevel) * 100);

  return {
    xp,
    level,
    rank: getRankForLevel(level),
    xpInCurrentLevel,
    xpForNextLevel: xpPerLevel,
    progressPercent,
    achievements,
  };
}

export interface CalendarCell {
  date: string;
  dayOfMonth: number;
  status: 'completed' | 'missed' | 'upcoming' | 'rest' | 'outside';
  workoutTitle?: string;
}

export function computeCalendarMonth(
  plans: Record<Weekday, DayPlan>,
  logs: WorkoutLog[],
  year: number,
  monthZeroIndexed: number,
  todayISO: string = new Date().toISOString().slice(0, 10)
): { cells: CalendarCell[]; consistencyScore: number; completedCount: number; scheduledCount: number } {
  const firstDay = new Date(Date.UTC(year, monthZeroIndexed, 1));
  const daysInMonth = new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
  // Monday = 0 ... Sunday = 6
  const startOffset = (firstDay.getUTCDay() + 6) % 7;

  const logsByDate = new Map<string, WorkoutLog>();
  for (const log of logs) {
    logsByDate.set(log.date, log);
  }

  const cells: CalendarCell[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ date: `pad-${i}`, dayOfMonth: 0, status: 'outside' });
  }

  let completedCount = 0;
  let scheduledUpToToday = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(monthZeroIndexed + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const iso = `${year}-${mm}-${dd}`;
    const d = new Date(`${iso}T12:00:00Z`);
    const weekdayIndex = (d.getUTCDay() + 6) % 7;
    const weekdayKey = WEEKDAYS[weekdayIndex];
    const plan = plans[weekdayKey];
    const log = logsByDate.get(iso);

    if (log) {
      completedCount += 1;
      scheduledUpToToday += 1;
      cells.push({
        date: iso,
        dayOfMonth: day,
        status: 'completed',
        workoutTitle: log.title,
      });
    } else if (!plan || plan.category === 'Rest Day' || plan.exercises.length === 0) {
      cells.push({
        date: iso,
        dayOfMonth: day,
        status: 'rest',
        workoutTitle: 'Rest Day',
      });
    } else if (iso < todayISO) {
      scheduledUpToToday += 1;
      cells.push({
        date: iso,
        dayOfMonth: day,
        status: 'missed',
        workoutTitle: plan.title,
      });
    } else {
      cells.push({
        date: iso,
        dayOfMonth: day,
        status: 'upcoming',
        workoutTitle: plan.title,
      });
    }
  }

  const consistencyScore =
    scheduledUpToToday === 0
      ? 0
      : Math.min(100, Math.round((completedCount / scheduledUpToToday) * 100));

  return {
    cells,
    consistencyScore,
    completedCount,
    scheduledCount: scheduledUpToToday,
  };
}

export function computeDashboardStats(
  logs: WorkoutLog[],
  plans: Record<Weekday, DayPlan>
) {
  const totalWorkouts = logs.length;
  const streak = computeTrainingStreak(logs);
  const totalVolumeKg = logs.reduce((sum, l) => sum + l.totalVolumeKg, 0);

  const muscleCounts: Record<string, number> = {};
  for (const log of logs) {
    for (const entry of log.entries) {
      const setsDone = entry.sets.filter((s) => s.completed).length;
      muscleCounts[entry.targetMuscle] = (muscleCounts[entry.targetMuscle] || 0) + setsDone;
    }
  }

  const sortedMuscles = Object.entries(muscleCounts).sort((a, b) => b[1] - a[1]);
  const mostTrainedMuscle = sortedMuscles[0]?.[0] || 'None yet';

  const plannedTrainingDays = WEEKDAYS.filter(
    (d) => plans[d] && plans[d].category !== 'Rest Day' && plans[d].exercises.length > 0
  ).length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);
  const recent7DaysCount = logs.filter((l) => l.date >= cutoff).length;
  const weeklyConsistency =
    logs.length === 0 || plannedTrainingDays === 0
      ? 0
      : Math.min(100, Math.round((recent7DaysCount / plannedTrainingDays) * 100));

  return {
    totalWorkouts,
    streak,
    totalVolumeKg,
    mostTrainedMuscle,
    weeklyConsistency,
    muscleBreakdown: sortedMuscles.map(([muscle, sets]) => ({ muscle, sets })),
  };
}
