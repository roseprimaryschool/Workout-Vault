import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  Lock,
  Trophy,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { MuscleGroup } from '../types/workout';
import {
  calculateE1RM,
  computeCalendarMonth,
  computeDashboardStats,
  computeGamification,
  computeMuscleRecovery,
  computePersonalRecords,
} from '../utils/workoutMath';
import { MuscleAnatomyDiagram } from './MuscleAnatomyDiagram';

type AnalyticsTab = 'overview' | 'recovery' | 'calendar' | 'history' | 'achievements';

export const AnalyticsView: React.FC = () => {
  const { logs, plans, profile, allExercises } = useVault();
  const [subTab, setSubTab] = useState<AnalyticsTab>('overview');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [selectedHistoryExId, setSelectedHistoryExId] = useState<string>('barbell-bench-press');

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const stats = useMemo(() => computeDashboardStats(logs, plans), [logs, plans]);
  const gamification = useMemo(() => computeGamification(logs), [logs]);
  const recovery = useMemo(() => computeMuscleRecovery(logs), [logs]);
  const personalRecords = useMemo(() => computePersonalRecords(logs), [logs]);
  const calendar = useMemo(
    () => computeCalendarMonth(plans, logs, calYear, calMonth),
    [plans, logs, calYear, calMonth]
  );

  // Build recent 6 workouts volume chart data
  const volumeChartData = useMemo(() => {
    const recent = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
    const maxVol = Math.max(1000, ...recent.map((l) => l.totalVolumeKg));
    return recent.map((l) => ({
      label: l.date.slice(5),
      title: l.title,
      volume: l.totalVolumeKg,
      pct: Math.round((l.totalVolumeKg / maxVol) * 100),
    }));
  }, [logs]);

  // Exercise History entries for selected exercise
  const exerciseHistoryRows = useMemo(() => {
    const rows: { date: string; setsText: string; topWeight: number; bestReps: number; e1rm: number; volume: number }[] = [];
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    for (const log of sorted) {
      const entry = log.entries.find((e) => e.exerciseId === selectedHistoryExId);
      if (!entry) continue;
      const done = entry.sets.filter((s) => s.completed);
      if (done.length === 0) continue;
      const topWeight = Math.max(...done.map((s) => s.weight));
      const bestReps = Math.max(...done.map((s) => s.reps));
      const e1rm = Math.max(...done.map((s) => calculateE1RM(s.weight, s.reps)));
      const volume = Math.round(done.reduce((sum, s) => sum + s.weight * s.reps, 0));
      rows.push({
        date: log.date,
        setsText: done.map((s) => `${s.weight}x${s.reps}`).join(', '),
        topWeight,
        bestReps,
        e1rm,
        volume,
      });
    }
    return rows;
  }, [logs, selectedHistoryExId]);

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  return (
    <div className="space-y-6">
      {/* Header + Gamification XP Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white">
            Progress & Recovery Analytics
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Strength trends, muscle recovery readiness, workout calendar, personal records, and XP rank.
          </p>
        </div>

        {/* Gamification Level & Experience Bar */}
        <div className="rounded-2xl bg-zinc-900/80 border border-white/10 px-4 py-3 min-w-[270px]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-white">
              Level {gamification.level} · <span className="text-[#00FF88]">{gamification.rank}</span>
            </span>
            <span className="font-mono text-zinc-400">{gamification.xp.toLocaleString()} XP</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-950 overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#00FF88] to-[#A855F7] transition-all duration-500"
              style={{ width: `${gamification.progressPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">
            {gamification.xpInCurrentLevel} / {gamification.xpForNextLevel} XP to Level{' '}
            {gamification.level + 1}
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10">
        {(
          [
            ['overview', 'Dashboard'],
            ['recovery', 'Muscle Recovery'],
            ['calendar', 'Workout Calendar'],
            ['history', 'Exercise History & PRs'],
            ['achievements', 'Achievements'],
          ] as [AnalyticsTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === id
                ? 'bg-[#00FF88] text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW DASHBOARD */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-4">
              <div className="text-xs text-zinc-400">Total Workouts Completed</div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-white mt-1.5">
                {stats.totalWorkouts}
              </div>
              <div className="text-xs text-[#00FF88] mt-1 font-mono">
                {Math.round(stats.totalVolumeKg).toLocaleString()} {profile.weightUnit} total lifted
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-4">
              <div className="text-xs text-zinc-400">Weekly Consistency</div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-[#00FF88] mt-1.5">
                {stats.weeklyConsistency}%
              </div>
              <div className="text-xs text-zinc-400 mt-1">Last 7 days adherence</div>
            </div>

            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-4">
              <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Training Streak
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-white mt-1.5">
                {stats.streak} {stats.streak === 1 ? 'session' : 'sessions'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Active momentum</div>
            </div>

            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-4">
              <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#A855F7]" />
                Most Trained Muscle
              </div>
              <div className="text-2xl md:text-3xl font-bold font-display text-white mt-1.5 truncate">
                {stats.mostTrainedMuscle}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                Recovery readiness: {recovery.overallScore}%
              </div>
            </div>
          </div>

          {/* Volume Chart + Muscle Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl bg-zinc-900/65 border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Session Volume Progression</h2>
                  <p className="text-xs text-zinc-400">Total weight lifted per logged workout ({profile.weightUnit})</p>
                </div>
              </div>

              {volumeChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-zinc-500">
                  Log a workout in the Tracker to visualize volume progression.
                </div>
              ) : (
                <div className="h-52 flex items-end gap-3 pt-4">
                  {volumeChartData.map((bar, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[11px] font-mono text-zinc-300">
                        {bar.volume}
                      </span>
                      <div className="w-full max-w-[48px] bg-zinc-950 rounded-t-lg h-36 flex items-end overflow-hidden border border-white/5">
                        <div
                          className="w-full bg-gradient-to-t from-[#00FF88]/70 to-[#00FF88] rounded-t-lg transition-all duration-500"
                          style={{ height: `${Math.max(8, bar.pct)}%` }}
                          title={`${bar.title}: ${bar.volume} kg`}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">{bar.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Muscle Distribution */}
            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-5 space-y-4">
              <h2 className="text-base font-semibold text-white">Muscle Set Distribution</h2>
              {stats.muscleBreakdown.length === 0 ? (
                <p className="text-xs text-zinc-500">No logged sets yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats.muscleBreakdown.slice(0, 6).map((item) => {
                    const topSets = stats.muscleBreakdown[0]?.sets || 1;
                    const widthPct = Math.round((item.sets / topSets) * 100);
                    return (
                      <div key={item.muscle} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-200">{item.muscle}</span>
                          <span className="font-mono text-zinc-400">{item.sets} sets</span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-950 overflow-hidden">
                          <div
                            className="h-full bg-[#A855F7]"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MUSCLE RECOVERY HEATMAP */}
      {subTab === 'recovery' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl bg-zinc-900/65 border border-white/10 p-6 flex flex-col items-center justify-between space-y-4">
            <div className="w-full flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Muscle Recovery Heatmap</h2>
                <p className="text-xs text-zinc-400">Click any muscle group to inspect readiness</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-400">Recovery Score</div>
                <div className="text-2xl font-bold font-mono text-[#00FF88]">
                  {recovery.overallScore}%
                </div>
              </div>
            </div>

            <div className="py-2 w-full">
              <MuscleAnatomyDiagram
                mode="recovery"
                recoveryStatuses={recovery.muscles}
                selectedMuscle={selectedMuscle}
                onSelectMuscle={(m) => setSelectedMuscle(m)}
              />
            </div>

            <div className="w-full flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-white/10 text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00FF88]" />
                Green · Ready
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Yellow · Recovering
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Red · Fatigued
              </span>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl bg-zinc-900/65 border border-white/10 p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">Muscle Readiness Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recovery.muscles.map((m) => {
                const statusBadge =
                  m.status === 'Green'
                    ? 'text-[#00FF88]'
                    : m.status === 'Yellow'
                    ? 'text-amber-400'
                    : 'text-rose-400';
                const barColor =
                  m.status === 'Green'
                    ? 'bg-[#00FF88]'
                    : m.status === 'Yellow'
                    ? 'bg-amber-400'
                    : 'bg-rose-500';

                return (
                  <button
                    key={m.muscle}
                    type="button"
                    onClick={() => setSelectedMuscle(m.muscle)}
                    className={`p-3.5 rounded-xl bg-zinc-950/75 border text-left transition-colors ${
                      selectedMuscle === m.muscle
                        ? 'border-white/40'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-white">{m.muscle}</span>
                      <span className={`font-mono text-xs font-semibold ${statusBadge}`}>
                        {m.status} · {m.recoveryPercent}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-900 mt-2 overflow-hidden">
                      <div
                        className={`h-full ${barColor}`}
                        style={{ width: `${m.recoveryPercent}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-1.5">
                      {m.hoursSinceTrained === null
                        ? 'Fresh · Not trained recently'
                        : `Last trained ${m.hoursSinceTrained}h ago · ${m.recentSets} recent sets`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WORKOUT CALENDAR */}
      {subTab === 'calendar' && (
        <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-5 h-5 text-[#00FF88]" />
              <div>
                <h2 className="text-lg font-semibold text-white">{monthLabel}</h2>
                <p className="text-xs text-zinc-400 font-mono">
                  Monthly Consistency Score: <span className="text-[#00FF88]">{calendar.consistencyScore}%</span> ({calendar.completedCount} completed / {calendar.scheduledCount} scheduled)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="p-2 rounded-xl bg-zinc-950 border border-white/10 text-zinc-300 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="p-2 rounded-xl bg-zinc-950 border border-white/10 text-zinc-300 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono text-zinc-500">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendar.cells.map((cell) => {
              if (cell.status === 'outside') {
                return <div key={cell.date} className="h-16 rounded-xl bg-transparent" />;
              }

              const styles =
                cell.status === 'completed'
                  ? 'bg-[#00FF88]/15 border-[#00FF88]/40 text-white'
                  : cell.status === 'missed'
                  ? 'bg-rose-500/10 border-rose-500/25 text-zinc-300'
                  : cell.status === 'upcoming'
                  ? 'bg-zinc-950/90 border-white/10 text-zinc-300'
                  : 'bg-zinc-950/35 border-white/5 text-zinc-500';

              return (
                <div
                  key={cell.date}
                  title={cell.workoutTitle || cell.status}
                  className={`h-16 sm:h-20 rounded-xl border p-2 flex flex-col justify-between ${styles}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold">{cell.dayOfMonth}</span>
                    {cell.status === 'completed' && (
                      <span className="text-[10px] font-mono text-[#00FF88]">Done</span>
                    )}
                    {cell.status === 'missed' && (
                      <span className="text-[10px] font-mono text-rose-400">Missed</span>
                    )}
                  </div>
                  <span className="text-[10px] truncate opacity-80 hidden sm:block">
                    {cell.workoutTitle}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: EXERCISE HISTORY & PERSONAL BESTS */}
      {subTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Exercise History Lookup */}
          <div className="lg:col-span-7 rounded-2xl bg-zinc-900/65 border border-white/10 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">Exercise History</h2>
              <select
                aria-label="Select exercise for history"
                value={selectedHistoryExId}
                onChange={(e) => setSelectedHistoryExId(e.target.value)}
                className="rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00FF88]"
              >
                {allExercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            {personalRecords[selectedHistoryExId] && (
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-zinc-950 border border-white/10 text-xs">
                <div>
                  <div className="text-zinc-500">Best Weight</div>
                  <div className="font-mono text-sm font-bold text-[#00FF88] mt-0.5">
                    {personalRecords[selectedHistoryExId].maxWeight} {profile.weightUnit}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Best E1RM</div>
                  <div className="font-mono text-sm font-bold text-white mt-0.5">
                    {personalRecords[selectedHistoryExId].bestE1RM} {profile.weightUnit}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Last Workout</div>
                  <div className="font-mono text-sm font-bold text-zinc-200 mt-0.5">
                    {personalRecords[selectedHistoryExId].lastDate}
                  </div>
                </div>
              </div>
            )}

            {exerciseHistoryRows.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">
                No logged sessions for this exercise yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 font-mono">
                      <th className="py-2 pr-3">DATE</th>
                      <th className="py-2 pr-3">SETS PERFORMED</th>
                      <th className="py-2 pr-3 text-right">TOP</th>
                      <th className="py-2 pr-3 text-right">E1RM</th>
                      <th className="py-2 text-right">VOLUME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {exerciseHistoryRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="py-2.5 pr-3 text-zinc-300">{row.date}</td>
                        <td className="py-2.5 pr-3 text-zinc-400">{row.setsText}</td>
                        <td className="py-2.5 pr-3 text-right text-white">{row.topWeight}</td>
                        <td className="py-2.5 pr-3 text-right text-[#00FF88]">{row.e1rm}</td>
                        <td className="py-2.5 text-right text-zinc-300">{row.volume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Personal Best Tracker Leaderboard */}
          <div className="lg:col-span-5 rounded-2xl bg-zinc-900/65 border border-white/10 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#A855F7]" />
              <h2 className="text-base font-semibold text-white">Personal Best Tracker</h2>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {Object.values(personalRecords).length === 0 ? (
                <p className="text-sm text-zinc-400 py-8 text-center">
                  No personal records yet. Log your first workout in the Tracker to record benchmarks.
                </p>
              ) : (
                Object.values(personalRecords).map((pr) => (
                  <div
                    key={pr.exerciseId}
                    className="p-3 rounded-xl bg-zinc-950/75 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {pr.exerciseName}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        Max Reps: {pr.maxReps} · Max Vol: {pr.maxVolume} {profile.weightUnit}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold font-mono text-[#00FF88]">
                        {pr.maxWeight} {profile.weightUnit}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500">
                        E1RM {pr.bestE1RM}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACHIEVEMENTS & GAMIFICATION */}
      {subTab === 'achievements' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gamification.achievements.map((ach) => (
            <div
              key={ach.id}
              className={`rounded-2xl p-5 border transition-colors flex flex-col justify-between gap-4 ${
                ach.unlocked
                  ? 'bg-[#00FF88]/10 border-[#00FF88]/35'
                  : 'bg-zinc-900/50 border-white/10 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{ach.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{ach.description}</p>
                </div>
                {ach.unlocked ? (
                  <Award className="w-6 h-6 text-[#00FF88] shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 text-zinc-600 shrink-0" />
                )}
              </div>

              <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-white/10">
                <span className={ach.unlocked ? 'text-[#00FF88]' : 'text-zinc-500'}>
                  {ach.unlocked ? 'Unlocked' : ach.progressText}
                </span>
                <span className="text-[#A855F7]">+{ach.xpReward} XP</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
