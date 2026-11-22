import {
  AchievementDef,
  DayPlan,
  Equipment,
  Exercise,
  GamificationSummary,
  LoggedExercise,
  MuscleGroup,
  MuscleRecoveryStatus,
  MuscleVolumeLandmark,
  OverloadSuggestion,
  PersonalRecord,
  PlannedExercise,
  RecoveryPhaseLabel,
  TrainingSymmetryReport,
  VolumeLandmarkZone,
  Weekday,
  WEEKDAYS,
  WorkoutLog,
} from '../types/workout';
import { EXERCISE_LIBRARY } from '../data/exercises';

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

export function getLocalDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDateISO(dateISO: string, deltaDays: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + deltaDays));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getTodaysWorkoutLog(
  logs: WorkoutLog[],
  todayISO: string = getLocalDateISO()
): WorkoutLog | undefined {
  return logs.find((l) => l.date === todayISO);
}

export function hasLoggedWorkoutOnDate(
  logs: WorkoutLog[],
  dateISO: string = getLocalDateISO()
): boolean {
  return logs.some((l) => l.date === dateISO);
}

export function calculateE1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function isDumbbellExercise(exerciseName: string, equipment?: Equipment): boolean {
  if (equipment === 'Dumbbell') return true;
  return /\bdumbbell\b|\bdb\b/i.test(exerciseName);
}

export function getDefaultDumbbellCount(exerciseId: string, exerciseName: string): 1 | 2 {
  const text = `${exerciseId} ${exerciseName}`.toLowerCase();
  if (
    /\b(one-arm|single-arm|single-dumbbell|goblet|concentration|russian-twist|side-bend|pullover|sumo-squat|svend-plate|suitcase|single-leg-dumbbell-calf|overhead-tricep-extension|overhead-extension)\b/.test(
      text
    )
  ) {
    return 1;
  }
  return 2;
}

export function getEffectiveEntryWeight(weightPerUnit: number, dumbbellCount?: 1 | 2): number {
  const mult = dumbbellCount === 2 ? 2 : 1;
  return Math.round(weightPerUnit * mult * 10) / 10;
}

export function calculateSessionVolumeKg(entries: LoggedExercise[]): number {
  let total = 0;
  for (const entry of entries) {
    const mult = entry.dumbbellCount === 2 ? 2 : 1;
    for (const set of entry.sets) {
      if (set.completed && set.weight > 0 && set.reps > 0) {
        total += set.weight * mult * set.reps;
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
        const effWeight = getEffectiveEntryWeight(s.weight, entry.dumbbellCount);
        entryVolume += effWeight * s.reps;
        if (effWeight > topWeight) topWeight = effWeight;
        if (s.reps > topReps || (s.reps === topReps && effWeight > topRepsWeight)) {
          topReps = s.reps;
          topRepsWeight = effWeight;
        }
        const e1rm = calculateE1RM(effWeight, s.reps);
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

    const topPerUnit = Math.max(...completed.map((s) => s.weight));
    const topWeight = Math.max(
      ...completed.map((s) => getEffectiveEntryWeight(s.weight, entry.dumbbellCount))
    );
    const bestE1RM = Math.max(
      ...completed.map((s) =>
        calculateE1RM(getEffectiveEntryWeight(s.weight, entry.dumbbellCount), s.reps)
      )
    );
    const totalVol = completed.reduce(
      (acc, s) => acc + getEffectiveEntryWeight(s.weight, entry.dumbbellCount) * s.reps,
      0
    );
    const weightLabel =
      entry.dumbbellCount === 2 ? `${topPerUnit}kg×2 = ${topWeight}kg` : `${topWeight}kg`;

    const prev = prevRecords[entry.exerciseId];
    if (!prev) {
      if (topWeight > 0) {
        prs.push(`${entry.name}: First logged benchmark (${weightLabel})`);
      }
      continue;
    }

    if (topWeight > prev.maxWeight) {
      prs.push(`${entry.name}: New Weight PR (${weightLabel})`);
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
    previousBestText:
      latest.entry.dumbbellCount === 2
        ? `${latestTopSet.weight}kg×2 x ${latestTopSet.reps} reps`
        : `${latestTopSet.weight}kg x ${latestTopSet.reps} reps`,
    lastWorkoutDate: latest.date,
  };
}

/**
 * Muscle-specific physiological SRA (Stimulus-Recovery-Adaptation) parameters.
 * `tauHours`: exponential recovery time constant reflecting muscle cross-sectional size,
 *             fiber composition, and typical eccentric mechanical damage profile.
 * `sraWindowHours`: typical recovery window (hours to >=80% readiness for moderate volume).
 */
export const MUSCLE_SRA_PARAMS: Record<
  MuscleGroup,
  { tauHours: number; sraWindowHours: number }
> = {
  Cardio: { tauHours: 18, sraWindowHours: 24 },
  Core: { tauHours: 24, sraWindowHours: 36 },
  Calves: { tauHours: 24, sraWindowHours: 36 },
  Forearms: { tauHours: 24, sraWindowHours: 36 },
  Biceps: { tauHours: 30, sraWindowHours: 48 },
  Triceps: { tauHours: 30, sraWindowHours: 48 },
  Shoulders: { tauHours: 32, sraWindowHours: 48 },
  Chest: { tauHours: 40, sraWindowHours: 60 },
  Back: { tauHours: 40, sraWindowHours: 60 },
  Glutes: { tauHours: 42, sraWindowHours: 60 },
  Quads: { tauHours: 48, sraWindowHours: 72 },
  Hamstrings: { tauHours: 48, sraWindowHours: 72 },
};

function getRpeFatigueMultiplier(rpe?: number): number {
  if (typeof rpe !== 'number' || Number.isNaN(rpe)) return 1.0;
  if (rpe >= 9.5) return 1.25; // Near/at failure increases EIMD & CNS stress
  if (rpe >= 8.5) return 1.1;
  if (rpe >= 7.0) return 1.0;
  return 0.78; // Submaximal / RIR 3+
}

function getLogTimestampMs(log: WorkoutLog): number {
  if (log.createdAt) {
    const parsed = Date.parse(log.createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return new Date(`${log.date}T12:00:00Z`).getTime();
}

function buildExerciseMap(extraExercises?: Exercise[]): Map<string, Exercise> {
  const map = new Map<string, Exercise>();
  for (const ex of EXERCISE_LIBRARY) {
    map.set(ex.id, ex);
  }
  if (extraExercises) {
    for (const ex of extraExercises) {
      map.set(ex.id, ex);
    }
  }
  return map;
}

export function computeMuscleRecovery(
  logs: WorkoutLog[],
  nowMs: number = Date.now(),
  extraExercises?: Exercise[]
): { muscles: MuscleRecoveryStatus[]; overallScore: number } {
  const exerciseMap = buildExerciseMap(extraExercises);
  const SRA_HORIZON_HOURS = 240; // 10 days decay window

  const results: MuscleRecoveryStatus[] = ALL_MUSCLES.map((muscle) => {
    const params = MUSCLE_SRA_PARAMS[muscle];
    let latestMs: number | null = null;
    let directSets96h = 0;
    let indirectSets96h = 0;
    const sessionImpulses: { residual0: number; tauEff: number }[] = [];

    for (const log of logs) {
      const logTime = getLogTimestampMs(log);
      const hoursAgo = Math.max(0, (nowMs - logTime) / (1000 * 60 * 60));

      let sessionDirectSets = 0;
      let sessionIndirectSets = 0;
      let sessionRpeWeightedLoad = 0;

      if (log.entries.length > 0) {
        for (const entry of log.entries) {
          const completedSets = entry.sets.filter((s) => s.completed);
          if (completedSets.length === 0) continue;

          const def = exerciseMap.get(entry.exerciseId);
          const isPrimary = entry.targetMuscle === muscle;
          const isSecondary =
            !isPrimary &&
            Boolean(def?.secondaryMuscles?.includes(muscle));

          if (!isPrimary && !isSecondary) continue;

          const roleWeight = isPrimary ? 1.0 : 0.5;
          if (isPrimary) {
            sessionDirectSets += completedSets.length;
          } else {
            sessionIndirectSets += completedSets.length;
          }

          for (const set of completedSets) {
            sessionRpeWeightedLoad += roleWeight * getRpeFatigueMultiplier(set.rpe);
          }
        }
      } else if (log.musclesTrained.includes(muscle)) {
        sessionDirectSets = 3;
        sessionRpeWeightedLoad = 3;
      }

      if (sessionDirectSets === 0 && sessionIndirectSets === 0) continue;

      if (latestMs === null || logTime > latestMs) {
        latestMs = logTime;
      }

      if (hoursAgo <= 96) {
        directSets96h += sessionDirectSets;
        indirectSets96h += sessionIndirectSets;
      }

      if (hoursAgo <= SRA_HORIZON_HOURS && sessionRpeWeightedLoad > 0) {
        // Dose-response acute fatigue curve + volume-modulated recovery time constant
        const initialFatigue = Math.min(
          0.92,
          0.88 * (1 - Math.exp(-0.38 * sessionRpeWeightedLoad))
        );
        const tauEff =
          params.tauHours * (1 + Math.min(0.35, sessionRpeWeightedLoad * 0.02));
        const residual = initialFatigue * Math.exp(-hoursAgo / tauEff);
        if (residual > 0.005) {
          sessionImpulses.push({ residual0: residual, tauEff });
        }
      }
    }

    const recentEffectiveSets =
      Math.round((directSets96h + 0.5 * indirectSets96h) * 10) / 10;

    if (latestMs === null) {
      return {
        muscle,
        recoveryPercent: 100,
        status: 'Green',
        hoursSinceTrained: null,
        recentSets: 0,
        directSets: 0,
        indirectSets: 0,
        hoursToReady: 0,
        sraWindowHours: params.sraWindowHours,
        phaseLabel: 'Fresh',
      };
    }

    const hoursSince = Math.max(0, Math.round((nowMs - latestMs) / (1000 * 60 * 60)));

    const capacityAtDelta = (deltaHours: number): number => {
      let capacity = 1;
      for (const imp of sessionImpulses) {
        const dec = imp.residual0 * Math.exp(-deltaHours / imp.tauEff);
        capacity *= 1 - Math.min(0.95, dec);
      }
      return capacity;
    };

    const currentCapacity = capacityAtDelta(0);
    const recoveryPercent = Math.max(
      5,
      Math.min(100, Math.round(currentCapacity * 100))
    );

    const status =
      recoveryPercent >= 80 ? 'Green' : recoveryPercent >= 50 ? 'Yellow' : 'Red';

    let hoursToReady = 0;
    if (recoveryPercent < 80) {
      for (let h = 1; h <= 168; h++) {
        if (Math.round(capacityAtDelta(h) * 100) >= 80) {
          hoursToReady = h;
          break;
        }
      }
    }

    let phaseLabel: RecoveryPhaseLabel = 'Fresh';
    if (recoveryPercent < 50) {
      phaseLabel = 'Acute Repair';
    } else if (recoveryPercent < 80) {
      phaseLabel = 'Protein Synthesis';
    } else if (hoursSince <= params.sraWindowHours + 36) {
      phaseLabel = 'Supercompensation';
    } else {
      phaseLabel = 'Fresh';
    }

    return {
      muscle,
      recoveryPercent,
      status,
      hoursSinceTrained: hoursSince,
      recentSets: recentEffectiveSets,
      directSets: directSets96h,
      indirectSets: indirectSets96h,
      hoursToReady,
      sraWindowHours: params.sraWindowHours,
      phaseLabel,
    };
  });

  const overallScore = Math.round(
    results.reduce((sum, m) => sum + m.recoveryPercent, 0) / results.length
  );

  return { muscles: results, overallScore };
}

const VOLUME_LANDMARK_TARGETS: Record<
  MuscleGroup,
  { mv: number; mev: number; mavLow: number; mavHigh: number; mrv: number }
> = {
  Chest: { mv: 4, mev: 8, mavLow: 12, mavHigh: 20, mrv: 22 },
  Back: { mv: 6, mev: 10, mavLow: 14, mavHigh: 22, mrv: 25 },
  Shoulders: { mv: 4, mev: 6, mavLow: 12, mavHigh: 20, mrv: 26 },
  Quads: { mv: 6, mev: 8, mavLow: 12, mavHigh: 18, mrv: 20 },
  Hamstrings: { mv: 4, mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  Glutes: { mv: 2, mev: 4, mavLow: 8, mavHigh: 16, mrv: 20 },
  Calves: { mv: 4, mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  Biceps: { mv: 4, mev: 6, mavLow: 12, mavHigh: 20, mrv: 24 },
  Triceps: { mv: 4, mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  Forearms: { mv: 2, mev: 4, mavLow: 8, mavHigh: 14, mrv: 18 },
  Core: { mv: 0, mev: 4, mavLow: 8, mavHigh: 16, mrv: 20 },
  Cardio: { mv: 2, mev: 3, mavLow: 4, mavHigh: 8, mrv: 12 },
};

export function computeWeeklyVolumeLandmarks(
  logs: WorkoutLog[],
  todayISO: string = getLocalDateISO(),
  extraExercises?: Exercise[]
): MuscleVolumeLandmark[] {
  const cutoffISO = shiftDateISO(todayISO, -6);
  const exerciseMap = buildExerciseMap(extraExercises);

  const directCounts: Record<MuscleGroup, number> = {
    Chest: 0,
    Back: 0,
    Shoulders: 0,
    Quads: 0,
    Hamstrings: 0,
    Glutes: 0,
    Calves: 0,
    Biceps: 0,
    Triceps: 0,
    Forearms: 0,
    Core: 0,
    Cardio: 0,
  };
  const indirectCounts: Record<MuscleGroup, number> = { ...directCounts };

  for (const log of logs) {
    if (log.date < cutoffISO || log.date > todayISO) continue;
    for (const entry of log.entries) {
      const done = entry.sets.filter((s) => s.completed).length;
      if (done === 0) continue;
      directCounts[entry.targetMuscle] += done;
      const def = exerciseMap.get(entry.exerciseId);
      if (def?.secondaryMuscles) {
        for (const sec of def.secondaryMuscles) {
          if (sec !== entry.targetMuscle) {
            indirectCounts[sec] += done;
          }
        }
      }
    }
  }

  return ALL_MUSCLES.map((muscle) => {
    const directSets = directCounts[muscle];
    const indirectSets = indirectCounts[muscle];
    const weeklyEffectiveSets = Math.round((directSets + 0.5 * indirectSets) * 10) / 10;
    const t = VOLUME_LANDMARK_TARGETS[muscle];

    let zone: VolumeLandmarkZone = 'Optimal MAV';
    if (weeklyEffectiveSets < t.mv) {
      zone = 'Under MV';
    } else if (weeklyEffectiveSets < t.mev) {
      zone = 'Below MEV';
    } else if (weeklyEffectiveSets <= t.mavHigh) {
      zone = 'Optimal MAV';
    } else if (weeklyEffectiveSets <= t.mrv) {
      zone = 'High (Near MRV)';
    } else {
      zone = 'Over MRV';
    }

    return {
      muscle,
      weeklyEffectiveSets,
      directSets,
      indirectSets,
      mv: t.mv,
      mev: t.mev,
      mavLow: t.mavLow,
      mavHigh: t.mavHigh,
      mrv: t.mrv,
      zone,
    };
  });
}

export function computeTrainingSymmetry(logs: WorkoutLog[]): TrainingSymmetryReport {
  const counts: Record<MuscleGroup, number> = {
    Chest: 0,
    Back: 0,
    Shoulders: 0,
    Quads: 0,
    Hamstrings: 0,
    Glutes: 0,
    Calves: 0,
    Biceps: 0,
    Triceps: 0,
    Forearms: 0,
    Core: 0,
    Cardio: 0,
  };

  for (const log of logs) {
    for (const entry of log.entries) {
      const done = entry.sets.filter((s) => s.completed).length;
      if (done > 0) {
        counts[entry.targetMuscle] += done;
      }
    }
  }

  const pushSets = counts.Chest + counts.Shoulders + counts.Triceps;
  const pullSets = counts.Back + counts.Biceps;
  const quadSets = counts.Quads;
  const posteriorSets = counts.Hamstrings + counts.Glutes;
  const upperSets =
    counts.Chest + counts.Back + counts.Shoulders + counts.Biceps + counts.Triceps + counts.Forearms;
  const lowerSets = counts.Quads + counts.Hamstrings + counts.Glutes + counts.Calves;

  const pushPullRatio =
    pushSets > 0 && pullSets > 0 ? Math.round((pushSets / pullSets) * 100) / 100 : null;
  const quadPosteriorRatio =
    quadSets > 0 && posteriorSets > 0
      ? Math.round((quadSets / posteriorSets) * 100) / 100
      : null;
  const upperLowerRatio =
    upperSets > 0 && lowerSets > 0 ? Math.round((upperSets / lowerSets) * 100) / 100 : null;

  const insights: TrainingSymmetryReport['insights'] = [];

  if (pushSets === 0 && pullSets === 0) {
    insights.push({
      id: 'push-pull',
      title: 'Push / Pull Balance',
      detail: 'Log upper-body sessions to track pressing vs. pulling volume balance.',
      status: 'no-data',
    });
  } else if (pushPullRatio === null) {
    insights.push({
      id: 'push-pull',
      title: 'Push / Pull Imbalance',
      detail:
        pushSets > 0
          ? `${pushSets} Push sets logged with 0 Pull sets — add rows or pulldowns to protect shoulder posture.`
          : `${pullSets} Pull sets logged with 0 Push sets — add pressing work for balanced upper development.`,
      status: 'warning',
    });
  } else if (pushPullRatio >= 0.8 && pushPullRatio <= 1.2) {
    insights.push({
      id: 'push-pull',
      title: `Push / Pull Balanced (${pushPullRatio}:1)`,
      detail: `${pushSets} Push sets vs. ${pullSets} Pull sets — optimal postural & scapular equilibrium.`,
      status: 'balanced',
    });
  } else {
    insights.push({
      id: 'push-pull',
      title: `Push / Pull Skew (${pushPullRatio}:1)`,
      detail:
        pushPullRatio > 1.2
          ? `Pressing exceeds pulling (${pushSets} vs ${pullSets} sets). Add horizontal rows or face pulls.`
          : `Pulling exceeds pressing (${pullSets} vs ${pushSets} sets). Add chest/overhead press volume.`,
      status: 'warning',
    });
  }

  if (quadSets === 0 && posteriorSets === 0) {
    insights.push({
      id: 'quad-post',
      title: 'Quad / Posterior Chain Balance',
      detail: 'Log lower-body sessions to evaluate anterior vs. posterior leg development.',
      status: 'no-data',
    });
  } else if (quadPosteriorRatio === null) {
    insights.push({
      id: 'quad-post',
      title: 'Lower-Body Skew',
      detail:
        quadSets > 0
          ? `${quadSets} Quad sets with 0 Hamstring/Glute sets — add RDLs or leg curls for knee health.`
          : `${posteriorSets} Posterior sets with 0 Quad sets — add squat or leg press patterns.`,
      status: 'warning',
    });
  } else if (quadPosteriorRatio >= 0.7 && quadPosteriorRatio <= 1.3) {
    insights.push({
      id: 'quad-post',
      title: `Quad / Posterior Balanced (${quadPosteriorRatio}:1)`,
      detail: `${quadSets} Quad sets vs. ${posteriorSets} Hamstring/Glute sets — healthy knee & hip stability.`,
      status: 'balanced',
    });
  } else {
    insights.push({
      id: 'quad-post',
      title: `Quad / Posterior Skew (${quadPosteriorRatio}:1)`,
      detail:
        quadPosteriorRatio > 1.3
          ? `Quad-dominant (${quadSets} vs ${posteriorSets} sets). Balance with hinge & hamstring curl volume.`
          : `Posterior-dominant (${posteriorSets} vs ${quadSets} sets). Add knee-flexion quad work.`,
      status: 'warning',
    });
  }

  return {
    pushSets,
    pullSets,
    pushPullRatio,
    quadSets,
    posteriorSets,
    quadPosteriorRatio,
    upperSets,
    lowerSets,
    upperLowerRatio,
    insights,
  };
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
  todayISO: string = getLocalDateISO()
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
  const cutoff = getLocalDateISO(sevenDaysAgo);
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
