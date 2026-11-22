import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  Calculator,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Dumbbell,
  ExternalLink,
  History,
  Lock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import {
  ActiveTrackerSession,
  LoggedExercise,
  MuscleGroup,
  Weekday,
  WEEKDAYS,
  WEEKDAY_LABELS,
  WorkoutLog,
} from '../types/workout';
import {
  calculateSessionVolumeKg,
  computeMuscleRecovery,
  computePersonalRecords,
  computeProgressiveOverload,
  computeRestRemainingSeconds,
  computeSessionElapsedSeconds,
  createTrackerEntriesFromPlan,
  detectNewPRs,
  getDefaultDumbbellCount,
  getEffectiveEntryWeight,
  getLocalDateISO,
  getPlanExercisesSignature,
  getTodaysWorkoutLog,
  isDumbbellExercise,
} from '../utils/workoutMath';
import { PlateCalculatorModal } from './PlateCalculatorModal';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function playRestCompleteChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [660, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.08, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.2);
    });
  } catch {
    // Ignore autoplay/Web Audio blocks gracefully
  }
}

interface TrackerViewProps {
  onOpenPlanner?: () => void;
}

export const TrackerView: React.FC<TrackerViewProps> = ({ onOpenPlanner }) => {
  const {
    plans,
    logs,
    allExercises,
    customExercises,
    profile,
    activeTrackerDay,
    setActiveTrackerDay,
    activeTrackerSession,
    setActiveTrackerSession,
    saveWorkoutLog,
    resetTodaysWorkout,
  } = useVault();

  const todayWeekday = useMemo<Weekday>(() => {
    const idx = (new Date().getDay() + 6) % 7;
    return WEEKDAYS[idx];
  }, []);

  const todayISO = getLocalDateISO();
  const todaysLog = useMemo(
    () => getTodaysWorkoutLog(logs, todayISO),
    [logs, todayISO]
  );

  const recoveryByMuscle = useMemo(() => {
    const rec = computeMuscleRecovery(logs, Date.now(), customExercises);
    return new Map(rec.muscles.map((m) => [m.muscle, m]));
  }, [logs, customExercises]);

  const personalRecords = useMemo(() => computePersonalRecords(logs), [logs]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [completedSummary, setCompletedSummary] = useState<WorkoutLog | null>(null);
  const [copiedRecap, setCopiedRecap] = useState(false);
  const [confirmResetSession, setConfirmResetSession] = useState(false);
  const [confirmResetTodayLog, setConfirmResetTodayLog] = useState(false);
  const [isResettingToday, setIsResettingToday] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [plateCalcTarget, setPlateCalcTarget] = useState<{
    exIdx: number;
    name: string;
    weight: number;
    reps: number;
  } | null>(null);

  const prevRestRef = useRef(0);

  const selectedDay: Weekday =
    activeTrackerSession?.selectedDay ?? activeTrackerDay ?? todayWeekday;
  const sessionActive = activeTrackerSession?.sessionActive ?? false;
  const isDirty = activeTrackerSession?.isDirty ?? false;
  const chimeEnabled = activeTrackerSession?.chimeEnabled ?? true;

  const currentPlanSig = useMemo(
    () => getPlanExercisesSignature(plans[selectedDay]),
    [plans, selectedDay]
  );

  const entries = useMemo<LoggedExercise[]>(() => {
    if (activeTrackerSession) {
      return activeTrackerSession.entries;
    }
    return createTrackerEntriesFromPlan(plans[selectedDay], allExercises);
  }, [activeTrackerSession, plans, selectedDay, allExercises]);

  const elapsedSeconds = computeSessionElapsedSeconds(
    sessionActive,
    activeTrackerSession?.startedAtMs ?? null,
    activeTrackerSession?.pausedElapsedSeconds ?? 0,
    nowMs
  );
  const restRemaining = computeRestRemainingSeconds(
    activeTrackerSession?.restEndsAtMs ?? null,
    nowMs
  );

  const planUpdatedWhileSessionActive = Boolean(
    activeTrackerSession &&
      (activeTrackerSession.sessionActive || activeTrackerSession.isDirty) &&
      activeTrackerSession.planSignature !== currentPlanSig
  );

  const buildFreshSession = (
    day: Weekday,
    autoStart: boolean,
    keepChime: boolean = chimeEnabled
  ): ActiveTrackerSession => {
    const now = Date.now();
    return {
      selectedDay: day,
      entries: createTrackerEntriesFromPlan(plans[day], allExercises),
      sessionActive: autoStart,
      isDirty: autoStart,
      startedAtMs: autoStart ? now : null,
      pausedElapsedSeconds: 0,
      restEndsAtMs: null,
      chimeEnabled: keepChime,
      planSignature: getPlanExercisesSignature(plans[day]),
    };
  };

  const loadDayIntoTracker = (day: Weekday, autoStart: boolean = true) => {
    setNowMs(Date.now());
    setActiveTrackerSession(buildFreshSession(day, autoStart));
    setCompletedSummary(null);
    setCopiedRecap(false);
    setConfirmResetSession(false);
    setSaveError(null);
  };

  // Sync if launched from Planner "Start" button (without wiping an already ongoing session on the same day)
  useEffect(() => {
    if (activeTrackerDay) {
      const sameOngoingDay =
        activeTrackerSession &&
        activeTrackerSession.selectedDay === activeTrackerDay &&
        (activeTrackerSession.sessionActive || activeTrackerSession.isDirty);
      if (!sameOngoingDay) {
        loadDayIntoTracker(activeTrackerDay, true);
      }
      setActiveTrackerDay(null);
    }
  }, [activeTrackerDay]);

  // Keep idle Tracker synchronized with Planner edits
  useEffect(() => {
    if (activeTrackerDay || !activeTrackerSession || completedSummary) return;
    if (!activeTrackerSession.sessionActive && !activeTrackerSession.isDirty) {
      if (activeTrackerSession.planSignature !== currentPlanSig) {
        setActiveTrackerSession({
          ...activeTrackerSession,
          entries: createTrackerEntriesFromPlan(plans[selectedDay], allExercises),
          planSignature: currentPlanSig,
        });
      }
    }
  }, [
    selectedDay,
    plans,
    allExercises,
    currentPlanSig,
    activeTrackerDay,
    activeTrackerSession,
    completedSummary,
  ]);

  // Wall-clock 1-second UI tick while timer or rest countdown is running
  useEffect(() => {
    const hasActiveRest =
      activeTrackerSession?.restEndsAtMs !== null &&
      activeTrackerSession?.restEndsAtMs !== undefined &&
      activeTrackerSession.restEndsAtMs > Date.now();

    if (!sessionActive && !hasActiveRest) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionActive, activeTrackerSession?.restEndsAtMs]);

  // Trigger audio chime when rest hits 0 naturally
  useEffect(() => {
    if (prevRestRef.current > 0 && restRemaining === 0 && chimeEnabled && sessionActive) {
      playRestCompleteChime();
    }
    prevRestRef.current = restRemaining;
  }, [restRemaining, chimeEnabled, sessionActive]);

  const mutateSessionEntries = (
    updater: (prevEntries: LoggedExercise[]) => LoggedExercise[],
    options?: { startIfIdle?: boolean; newRestEndsAtMs?: number | null }
  ) => {
    const now = Date.now();
    setNowMs(now);
    setActiveTrackerSession((prev) => {
      const base = prev || buildFreshSession(selectedDay, false);
      const nextEntries = updater(base.entries);
      const shouldStart = options?.startIfIdle && !base.sessionActive;
      return {
        ...base,
        entries: nextEntries,
        isDirty: true,
        sessionActive: shouldStart ? true : base.sessionActive,
        startedAtMs: shouldStart
          ? now - base.pausedElapsedSeconds * 1000
          : base.startedAtMs,
        restEndsAtMs:
          options?.newRestEndsAtMs !== undefined
            ? options.newRestEndsAtMs
            : base.restEndsAtMs,
      };
    });
  };

  const handleToggleSessionTimer = () => {
    const now = Date.now();
    setNowMs(now);
    setActiveTrackerSession((prev) => {
      const base = prev || buildFreshSession(selectedDay, false);
      if (base.sessionActive) {
        const currentElapsed = computeSessionElapsedSeconds(
          true,
          base.startedAtMs,
          base.pausedElapsedSeconds,
          now
        );
        return {
          ...base,
          sessionActive: false,
          isDirty: true,
          startedAtMs: null,
          pausedElapsedSeconds: currentElapsed,
        };
      }
      return {
        ...base,
        sessionActive: true,
        isDirty: true,
        startedAtMs: now - base.pausedElapsedSeconds * 1000,
      };
    });
    setCompletedSummary(null);
  };

  const toggleSetCompleted = (exIdx: number, setIdx: number) => {
    let plannedRestMs: number | undefined;
    const targetEx = entries[exIdx];
    const targetSet = targetEx?.sets[setIdx];
    if (targetEx && targetSet && !targetSet.completed) {
      const plannedRest =
        plans[selectedDay].exercises.find((p) => p.exerciseId === targetEx.exerciseId)
          ?.restSeconds || 90;
      plannedRestMs = Date.now() + plannedRest * 1000;
    }

    mutateSessionEntries(
      (prev) =>
        prev.map((ex, i) => {
          if (i !== exIdx) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s, j) =>
              j !== setIdx ? s : { ...s, completed: !s.completed }
            ),
          };
        }),
      {
        startIfIdle: true,
        newRestEndsAtMs: plannedRestMs,
      }
    );
  };

  const updateSetField = (
    exIdx: number,
    setIdx: number,
    field: 'weight' | 'reps',
    value: number
  ) => {
    mutateSessionEntries((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j) =>
                j !== setIdx ? s : { ...s, [field]: Math.max(0, value) }
              ),
            }
      )
    );
  };

  const updateSetRpe = (exIdx: number, setIdx: number, rpeVal: string) => {
    const parsed = rpeVal ? Number(rpeVal) : undefined;
    mutateSessionEntries((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j) => {
                if (j !== setIdx) return s;
                if (parsed === undefined || Number.isNaN(parsed)) {
                  const { rpe: _omit, ...rest } = s;
                  return rest;
                }
                return { ...s, rpe: parsed };
              }),
            }
      )
    );
  };

  const applySuggestedWeight = (exIdx: number, newWeight: number) => {
    mutateSessionEntries((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => (s.completed ? s : { ...s, weight: newWeight })),
            }
      )
    );
  };

  const setExerciseDumbbellCount = (exIdx: number, count: 1 | 2) => {
    mutateSessionEntries((prev) =>
      prev.map((ex, i) => (i !== exIdx ? ex : { ...ex, dumbbellCount: count }))
    );
  };

  const matchLastSessionForExercise = (exIdx: number, exerciseId: string) => {
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    let lastEntry: LoggedExercise | undefined;
    for (const log of sorted) {
      const found = log.entries.find(
        (e) => e.exerciseId === exerciseId && e.sets.some((s) => s.completed)
      );
      if (found) {
        lastEntry = found;
        break;
      }
    }
    if (!lastEntry) return;
    const doneSets = lastEntry.sets.filter((s) => s.completed);
    if (doneSets.length === 0) return;

    mutateSessionEntries((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          ...(lastEntry.dumbbellCount === 1 || lastEntry.dumbbellCount === 2
            ? { dumbbellCount: lastEntry.dumbbellCount }
            : {}),
          sets: ex.sets.map((s, idx) => {
            if (s.completed) return s;
            const ref = doneSets[Math.min(idx, doneSets.length - 1)];
            return { ...s, weight: ref.weight, reps: ref.reps };
          }),
        };
      })
    );
  };

  const handleFinishWorkout = async () => {
    setSaveError(null);
    if (todaysLog) {
      setSaveError(
        `You already logged a workout today (${todayISO}). Reset today's workout above if you want to re-log.`
      );
      return;
    }

    const volume = calculateSessionVolumeKg(entries);
    const completedExercises = entries.filter((e) => e.sets.some((s) => s.completed));
    if (completedExercises.length === 0) return;

    const prsHit = detectNewPRs(completedExercises, logs);
    const muscles = Array.from(
      new Set(completedExercises.map((e) => e.targetMuscle))
    ) as MuscleGroup[];
    const totalCompletedSets = completedExercises.reduce(
      (sum, e) => sum + e.sets.filter((s) => s.completed).length,
      0
    );
    const xpEarned = 100 + totalCompletedSets * 10 + prsHit.length * 40;

    const log: WorkoutLog = {
      id: `log-${Date.now().toString(36)}`,
      date: todayISO,
      day: selectedDay,
      category: plans[selectedDay].category,
      title: plans[selectedDay].title || `${WEEKDAY_LABELS[selectedDay]} Session`,
      durationSeconds: Math.max(60, elapsedSeconds),
      totalVolumeKg: volume,
      xpEarned,
      musclesTrained: muscles,
      entries: completedExercises,
      prsHit,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveWorkoutLog(log);
      setActiveTrackerSession(null);
      setCompletedSummary(log);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Could not save workout. Please try again.'
      );
    }
  };

  const handleResetTodaysSavedWorkout = async () => {
    setIsResettingToday(true);
    setSaveError(null);
    try {
      await resetTodaysWorkout(todayISO);
      setConfirmResetTodayLog(false);
      setCompletedSummary(null);
      loadDayIntoTracker(selectedDay, false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Unable to reset today’s workout.'
      );
    } finally {
      setIsResettingToday(false);
    }
  };

  const handleCopyRecap = async (log: WorkoutLog) => {
    const lines = [
      `Workout Vault — ${log.title} (${log.date})`,
      `Duration: ${formatTimer(log.durationSeconds)} | Volume: ${log.totalVolumeKg.toLocaleString()} ${profile.weightUnit} | +${log.xpEarned} XP`,
      ...log.entries.map((e) => {
        const doneSets = e.sets.filter((s) => s.completed);
        const dbSuffix = e.dumbbellCount === 2 ? '×2' : '';
        return `• ${e.name}: ${doneSets
          .map((s) => `${s.weight}${profile.weightUnit}${dbSuffix}×${s.reps}${s.rpe ? `@RPE${s.rpe}` : ''}`)
          .join(', ')}`;
      }),
      ...(log.prsHit.length > 0 ? ['New PRs:', ...log.prsHit.map((p) => `  - ${p}`)] : []),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedRecap(true);
      window.setTimeout(() => setCopiedRecap(false), 2500);
    } catch {
      // Clipboard blocked
    }
  };

  const liveVolume = useMemo(() => calculateSessionVolumeKg(entries), [entries]);
  const completedSetCount = useMemo(
    () => entries.reduce((sum, e) => sum + e.sets.filter((s) => s.completed).length, 0),
    [entries]
  );

  return (
    <div className="space-y-6">
      {/* Header & Day Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white">
            Workout Tracker
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Follows your Weekly Planner lineup, set count, and targets — edit exercises or set prescriptions in the Planner.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select planned workout day"
            value={selectedDay}
            onChange={(e) => {
              const d = e.target.value as Weekday;
              loadDayIntoTracker(d, false);
            }}
            className="rounded-xl bg-zinc-900 border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF88]"
          >
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABELS[d]} — {plans[d].category}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleToggleSessionTimer}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              sessionActive
                ? 'bg-[#00FF88]/10 border-[#00FF88]/40 text-[#00FF88]'
                : 'bg-zinc-900 border-white/10 text-white hover:border-[#00FF88]/50'
            }`}
          >
            {sessionActive ? (
              <>
                <Pause className="w-4 h-4 text-[#00FF88]" />
                Pause Timer
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-[#00FF88]" />
                {elapsedSeconds > 0 ? 'Resume Timer' : 'Start Timer'}
              </>
            )}
          </button>

          {!confirmResetSession ? (
            <button
              type="button"
              onClick={() => {
                if (completedSetCount > 0 || elapsedSeconds > 10 || isDirty) {
                  setConfirmResetSession(true);
                } else {
                  loadDayIntoTracker(selectedDay, false);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-sm font-medium text-zinc-200 hover:border-amber-400/50 hover:text-amber-300"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Session
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/35 px-3 py-1.5">
              <span className="text-xs text-amber-200">Clear sets &amp; timer?</span>
              <button
                type="button"
                onClick={() => loadDayIntoTracker(selectedDay, false)}
                className="px-2.5 py-1 rounded-lg bg-amber-400 text-zinc-950 text-xs font-semibold"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetSession(false)}
                className="px-2 py-1 rounded-lg text-xs text-zinc-300 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Session Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-4">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#00FF88]" />
            Session Time
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {formatTimer(elapsedSeconds)}
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-4">
          <div className="text-xs text-zinc-400 flex items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-[#A855F7]" />
              Rest Timer
            </span>
            <button
              type="button"
              onClick={() =>
                setActiveTrackerSession((prev) => {
                  const base = prev || buildFreshSession(selectedDay, false);
                  return { ...base, chimeEnabled: !base.chimeEnabled };
                })
              }
              aria-label={chimeEnabled ? 'Mute rest chime' : 'Enable rest chime'}
              title={chimeEnabled ? 'Rest chime on' : 'Rest chime muted'}
              className="text-zinc-400 hover:text-white"
            >
              {chimeEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-[#00FF88]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-white">
              {formatTimer(restRemaining)}
            </span>
            {restRemaining > 0 && (
              <button
                type="button"
                onClick={() =>
                  setActiveTrackerSession((prev) =>
                    prev ? { ...prev, restEndsAtMs: null } : prev
                  )
                }
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-4">
          <div className="text-xs text-zinc-400">Logged Volume</div>
          <div className="text-2xl font-bold font-mono text-[#00FF88] mt-1">
            {liveVolume.toLocaleString()} {profile.weightUnit}
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-4">
          <div className="text-xs text-zinc-400">Completed Sets</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {completedSetCount}
          </div>
        </div>
      </div>

      {/* Optional Planner Sync Prompt if Planner changed while session is in progress */}
      {planUpdatedWhileSessionActive && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/35 px-4 py-3 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <span>
            Your Weekly Planner for {WEEKDAY_LABELS[selectedDay]} was updated while this session is in progress.
          </span>
          <button
            type="button"
            onClick={() => loadDayIntoTracker(selectedDay, sessionActive)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Updated Plan
          </button>
        </div>
      )}

      {/* Inline Save / Validation Error */}
      {saveError && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-500/10 border border-rose-500/35 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3"
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-rose-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Daily Limit & Reset Today's Logged Workout Banner */}
      {todaysLog && (
        <div className="rounded-2xl bg-[#00FF88]/10 border border-[#00FF88]/40 p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Trophy className="w-7 h-7 text-[#00FF88] shrink-0 mt-0.5" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-white">
                    Today&apos;s Workout Complete — {todaysLog.title}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-950/80 border border-[#00FF88]/30 text-[11px] font-mono text-[#00FF88]">
                    Daily Limit: 1 / 1 Logged
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-mono mt-1">
                  {todayISO} · Duration {formatTimer(todaysLog.durationSeconds)} · Volume{' '}
                  {todaysLog.totalVolumeKg.toLocaleString()} {profile.weightUnit} · +
                  {todaysLog.xpEarned} XP
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyRecap(todaysLog)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 text-xs font-medium text-[#00FF88] border border-[#00FF88]/30 hover:border-[#00FF88]"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedRecap ? 'Copied Recap!' : 'Copy Recap'}
              </button>

              {!confirmResetTodayLog ? (
                <button
                  type="button"
                  onClick={() => setConfirmResetTodayLog(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Today&apos;s Workout
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-500/40 px-3 py-1.5">
                  <span className="text-xs text-rose-100">Delete today&apos;s log &amp; re-log?</span>
                  <button
                    type="button"
                    disabled={isResettingToday}
                    onClick={() => void handleResetTodaysSavedWorkout()}
                    className="px-2.5 py-1 rounded-lg bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {isResettingToday ? 'Resetting...' : 'Yes, Reset'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetTodayLog(false)}
                    className="px-2 py-1 rounded-lg text-xs text-zinc-300 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {todaysLog.prsHit.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#00FF88]/20">
              <div className="text-xs font-semibold text-[#A855F7] flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                Personal Records Logged Today
              </div>
              <ul className="text-sm text-white space-y-1">
                {todaysLog.prsHit.map((pr, idx) => (
                  <li key={idx} className="font-mono text-xs">
                    · {pr}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Exercise Logging Cards (Strictly driven by Planner) */}
      {entries.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/50 border border-white/10 p-10 text-center space-y-4">
          <p className="text-sm text-zinc-300">
            {WEEKDAY_LABELS[selectedDay]} ({plans[selectedDay].category}) has no exercises scheduled in your Weekly Planner.
          </p>
          <p className="text-xs text-zinc-500">
            Exercises, set counts, reps, and starting weights are managed in the Planner so your tracker always matches your split.
          </p>
          {onOpenPlanner && (
            <button
              type="button"
              onClick={onOpenPlanner}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-semibold hover:bg-[#00FF88]/90"
            >
              <CalendarDays className="w-4 h-4" />
              Edit in Weekly Planner
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, exIdx) => {
            const plannedItem = plans[selectedDay].exercises[exIdx] ||
              plans[selectedDay].exercises.find((p) => p.exerciseId === entry.exerciseId);
            const planned = plannedItem || {
              sets: entry.sets.length,
              reps: entry.sets[0]?.reps || 10,
              weight: entry.sets[0]?.weight || 0,
              restSeconds: 90,
              tempo: '2-0-1-0',
              notes: '',
            };
            const libEx = allExercises.find((e) => e.id === entry.exerciseId);
            const isDumbbell = isDumbbellExercise(entry.name, libEx?.equipment);
            const dbCount: 1 | 2 =
              entry.dumbbellCount ||
              (isDumbbell ? getDefaultDumbbellCount(entry.exerciseId, entry.name) : 1);

            const overload = computeProgressiveOverload(entry.exerciseId, planned, logs);
            const muscleReadiness = recoveryByMuscle.get(entry.targetMuscle);
            const exPr = personalRecords[entry.exerciseId];
            const readinessTone =
              muscleReadiness?.status === 'Red'
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                : muscleReadiness?.status === 'Yellow'
                ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                : 'text-[#00FF88] bg-[#00FF88]/10 border-[#00FF88]/25';

            return (
              <section
                key={`${entry.exerciseId}-${exIdx}`}
                className="rounded-2xl bg-zinc-900/65 backdrop-blur-xl border border-white/10 p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>{entry.targetMuscle} · Previous: {overload.previousBestText}</span>
                      {muscleReadiness && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[11px] ${readinessTone}`}
                        >
                          <Activity className="w-3 h-3" />
                          {muscleReadiness.recoveryPercent}% {muscleReadiness.status === 'Green' ? 'Ready' : muscleReadiness.status === 'Yellow' ? 'Recovering' : 'Fatigued'}
                        </span>
                      )}
                      {exPr && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-white/10 font-mono text-[11px] text-zinc-300">
                          <Trophy className="w-3 h-3 text-[#A855F7]" />
                          PR {exPr.maxWeight} {profile.weightUnit} (E1RM {exPr.bestE1RM})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <h2 className="text-lg font-semibold text-white">{entry.name}</h2>
                      {libEx && !libEx.isCustom && (
                        <a
                          href={libEx.muscleWikiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#00FF88] hover:underline"
                        >
                          MuscleWiki
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 mt-1">
                      Planner Target: {planned.sets} sets × {planned.reps} reps @ {planned.weight}{' '}
                      {profile.weightUnit} · Rest {planned.restSeconds}s · Tempo {planned.tempo}
                      {planned.notes ? ` · ${planned.notes}` : ''}
                    </div>
                  </div>

                  {/* Progressive Overload Assistant, Match Last Session & Plate Loader */}
                  <div className="flex flex-wrap items-center gap-2">
                    {overload.lastWorkoutDate && (
                      <button
                        type="button"
                        onClick={() => matchLastSessionForExercise(exIdx, entry.exerciseId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-medium text-zinc-200 hover:border-[#00FF88]/50 hover:text-[#00FF88]"
                        title="Auto-fill uncompleted sets with your last logged weights and reps"
                      >
                        <History className="w-3.5 h-3.5" />
                        Match Last Session
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setPlateCalcTarget({
                          exIdx,
                          name: entry.name,
                          weight: entry.sets[0]?.weight || 60,
                          reps: entry.sets[0]?.reps || 8,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-medium text-[#A855F7] hover:border-[#A855F7]/50"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      Plates &amp; Warm-Up
                    </button>

                    <div
                      className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                        overload.shouldIncrease
                          ? 'bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]'
                          : 'bg-zinc-950 border-white/10 text-zinc-300'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      <span>{overload.reason}</span>
                    </div>
                    {overload.shouldIncrease && (
                      <button
                        type="button"
                        onClick={() => applySuggestedWeight(exIdx, overload.suggestedWeight)}
                        className="px-3 py-1.5 rounded-xl bg-[#00FF88] text-zinc-950 text-xs font-semibold hover:bg-[#00FF88]/90 whitespace-nowrap"
                      >
                        Apply {overload.suggestedWeight} {profile.weightUnit}
                      </button>
                    )}
                  </div>
                </div>

                {/* Dumbbell Setup Selector (1 Dumbbell vs 2 Dumbbells Same Weight) */}
                {isDumbbell && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-zinc-950/75 border border-white/10 px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                      <Dumbbell className="w-4 h-4 text-[#00FF88] shrink-0" />
                      <span>
                        {dbCount === 2
                          ? 'Select weight for 1 dumbbell — the 2nd dumbbell matches automatically (2× total).'
                          : 'Using 1 single dumbbell per rep (1× total).'}
                      </span>
                    </div>
                    <div
                      role="group"
                      aria-label={`${entry.name} dumbbell setup`}
                      className="inline-flex rounded-lg bg-zinc-900 border border-white/10 p-0.5 self-start sm:self-auto"
                    >
                      <button
                        type="button"
                        aria-pressed={dbCount === 1}
                        onClick={() => setExerciseDumbbellCount(exIdx, 1)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          dbCount === 1
                            ? 'bg-[#00FF88] text-zinc-950 font-semibold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        1 Dumbbell
                      </button>
                      <button
                        type="button"
                        aria-pressed={dbCount === 2}
                        onClick={() => setExerciseDumbbellCount(exIdx, 2)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          dbCount === 2
                            ? 'bg-[#00FF88] text-zinc-950 font-semibold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        2 Dumbbells (Same Weight)
                      </button>
                    </div>
                  </div>
                )}

                {/* Sets Table */}
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-zinc-500 font-mono px-2">
                    <div className="col-span-1">SET</div>
                    <div className={isDumbbell && dbCount === 2 ? 'col-span-5' : 'col-span-4'}>
                      {isDumbbell
                        ? dbCount === 2
                          ? `DB 1 + DB 2 (${profile.weightUnit.toUpperCase()})`
                          : `1 DB (${profile.weightUnit.toUpperCase()})`
                        : `WEIGHT (${profile.weightUnit.toUpperCase()})`}
                    </div>
                    <div className={isDumbbell && dbCount === 2 ? 'col-span-2' : 'col-span-3'}>REPS</div>
                    <div className="col-span-2">RPE</div>
                    <div className="col-span-2 text-right">DONE</div>
                  </div>

                  {entry.sets.map((s, setIdx) => (
                    <div
                      key={s.setNumber}
                      className={`grid grid-cols-12 gap-2 items-center rounded-xl p-2 border transition-colors ${
                        s.completed
                          ? 'bg-[#00FF88]/5 border-[#00FF88]/25'
                          : 'bg-zinc-950/70 border-white/10'
                      }`}
                    >
                      <div className="col-span-1 font-mono text-sm font-semibold text-zinc-300 pl-1">
                        {s.setNumber}
                      </div>
                      <div className={isDumbbell && dbCount === 2 ? 'col-span-5' : 'col-span-4'}>
                        {isDumbbell && dbCount === 2 ? (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              list="dumbbell-weight-presets"
                              aria-label={`${entry.name} set ${s.setNumber} dumbbell weight`}
                              value={s.weight}
                              onChange={(e) =>
                                updateSetField(exIdx, setIdx, 'weight', Number(e.target.value))
                              }
                              className="w-full sm:w-24 rounded-lg bg-zinc-900 border border-white/10 px-2.5 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
                            />
                            <div
                              className="inline-flex items-center gap-1 rounded-lg bg-zinc-900/80 border border-white/10 px-2 py-1 text-[11px] font-mono text-zinc-300 whitespace-nowrap"
                              title="Second dumbbell automatically uses the exact same weight"
                            >
                              <span className="text-[#00FF88]">+ {s.weight} {profile.weightUnit}</span>
                              <span className="text-zinc-500">
                                ({getEffectiveEntryWeight(s.weight, 2)} total)
                              </span>
                            </div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            list={isDumbbell ? 'dumbbell-weight-presets' : undefined}
                            aria-label={`${entry.name} set ${s.setNumber} weight`}
                            value={s.weight}
                            onChange={(e) =>
                              updateSetField(exIdx, setIdx, 'weight', Number(e.target.value))
                            }
                            className="w-full rounded-lg bg-zinc-900 border border-white/10 px-2.5 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
                          />
                        )}
                      </div>
                      <div className={isDumbbell && dbCount === 2 ? 'col-span-2' : 'col-span-3'}>
                        <input
                          type="number"
                          min={0}
                          aria-label={`${entry.name} set ${s.setNumber} reps`}
                          value={s.reps}
                          onChange={(e) =>
                            updateSetField(exIdx, setIdx, 'reps', Number(e.target.value))
                          }
                          className="w-full rounded-lg bg-zinc-900 border border-white/10 px-2.5 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          aria-label={`${entry.name} set ${s.setNumber} RPE`}
                          value={s.rpe ?? ''}
                          onChange={(e) => updateSetRpe(exIdx, setIdx, e.target.value)}
                          className="w-full rounded-lg bg-zinc-900 border border-white/10 px-1.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#A855F7]"
                        >
                          <option value="">—</option>
                          {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((val) => (
                            <option key={val} value={val}>
                              {val}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => toggleSetCompleted(exIdx, setIdx)}
                          aria-label={`Mark ${entry.name} set ${s.setNumber} complete`}
                          aria-pressed={s.completed}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                            s.completed
                              ? 'bg-[#00FF88] text-zinc-950'
                              : 'bg-zinc-900 border border-white/15 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            {onOpenPlanner ? (
              <button
                type="button"
                onClick={onOpenPlanner}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-sm font-medium text-zinc-200 hover:border-[#00FF88]/40 hover:text-white"
              >
                <CalendarDays className="w-4 h-4 text-[#00FF88]" />
                Change Exercises / Targets in Planner
              </button>
            ) : (
              <div className="text-xs text-zinc-500">
                Change exercises, sets, or targets in the Weekly Planner.
              </div>
            )}

            <button
              type="button"
              disabled={completedSetCount === 0 || Boolean(todaysLog)}
              onClick={() => void handleFinishWorkout()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-bold hover:bg-[#00FF88]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {todaysLog ? (
                <>
                  <Lock className="w-4 h-4" />
                  1 Workout / Day Logged — Reset Above to Re-log
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Finish &amp; Save Workout ({completedSetCount} sets)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Standard Dumbbell Rack Presets */}
      <datalist id="dumbbell-weight-presets">
        {[2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 45, 50, 55, 60].map(
          (w) => (
            <option key={w} value={w} />
          )
        )}
      </datalist>

      {/* Plate Calculator Modal */}
      {plateCalcTarget && (
        <PlateCalculatorModal
          initialWeight={plateCalcTarget.weight}
          initialReps={plateCalcTarget.reps}
          unit={profile.weightUnit}
          exerciseName={plateCalcTarget.name}
          onClose={() => setPlateCalcTarget(null)}
          onApplyWeight={(w) => applySuggestedWeight(plateCalcTarget.exIdx, w)}
        />
      )}
    </div>
  );
};
