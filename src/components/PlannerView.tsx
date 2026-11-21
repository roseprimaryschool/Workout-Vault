import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bot,
  Calculator,
  CalendarPlus,
  Copy,
  Dumbbell,
  GripVertical,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { DEFAULT_WEEKLY_PLANS } from '../data/exercises';
import {
  DayPlan,
  Exercise,
  GeneratorStyle,
  PlanCategory,
  PlannedExercise,
  Weekday,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from '../types/workout';
import { computeProgressiveOverload } from '../utils/workoutMath';
import { PlateCalculatorModal } from './PlateCalculatorModal';

const CATEGORY_COLORS: Record<PlanCategory, { dot: string; text: string; border: string; bg: string }> = {
  Push: { dot: 'bg-[#00FF88]', text: 'text-[#00FF88]', border: 'border-[#00FF88]/25', bg: 'bg-[#00FF88]/10' },
  Pull: { dot: 'bg-sky-400', text: 'text-sky-400', border: 'border-sky-400/25', bg: 'bg-sky-400/10' },
  Legs: { dot: 'bg-amber-400', text: 'text-amber-400', border: 'border-amber-400/25', bg: 'bg-amber-400/10' },
  Upper: { dot: 'bg-purple-400', text: 'text-purple-400', border: 'border-purple-400/25', bg: 'bg-purple-400/10' },
  Lower: { dot: 'bg-orange-400', text: 'text-orange-400', border: 'border-orange-400/25', bg: 'bg-orange-400/10' },
  'Full Body': { dot: 'bg-teal-400', text: 'text-teal-400', border: 'border-teal-400/25', bg: 'bg-teal-400/10' },
  Cardio: { dot: 'bg-rose-400', text: 'text-rose-400', border: 'border-rose-400/25', bg: 'bg-rose-400/10' },
  Core: { dot: 'bg-indigo-400', text: 'text-indigo-400', border: 'border-indigo-400/25', bg: 'bg-indigo-400/10' },
  'Rest Day': { dot: 'bg-zinc-500', text: 'text-zinc-400', border: 'border-zinc-700', bg: 'bg-zinc-800/50' },
};

const PLAN_CATEGORIES: PlanCategory[] = [
  'Push',
  'Pull',
  'Legs',
  'Upper',
  'Lower',
  'Full Body',
  'Cardio',
  'Core',
  'Rest Day',
];

const GENERATOR_STYLES: { style: GeneratorStyle; subtitle: string; days: string }[] = [
  { style: 'Push Pull Legs', subtitle: 'Balanced 6-day hypertrophy & strength rotation', days: '6 training days · 1 rest' },
  { style: 'Upper Lower', subtitle: '4-day athletic split with conditioning day', days: '5 active days · 2 rest' },
  { style: 'Full Body', subtitle: '3-day compound foundation + weekend conditioning', days: '4 active days · 3 rest' },
  { style: 'Powerbuilding', subtitle: 'Heavy barbell compounds paired with hypertrophy accessories', days: '5 training days · 2 rest' },
  { style: 'Strength', subtitle: 'Low-rep neural strength progression on core lifts', days: '4 training days · 3 rest' },
  { style: 'Hypertrophy', subtitle: 'High-volume controlled-tempo muscle growth split', days: '5 training days · 2 rest' },
  { style: 'Home Workouts', subtitle: 'Dumbbell, kettlebell & bodyweight zero-machine routine', days: '6 active days · 1 rest' },
];

interface PlannerViewProps {
  onStartWorkout: (day: Weekday) => void;
  onOpenCoach?: () => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({ onStartWorkout, onOpenCoach }) => {
  const {
    plans,
    logs,
    allExercises,
    profile,
    syncStatus,
    updateDayPlan,
    moveExerciseBetweenDays,
    applyGeneratorSplit,
    applyPlansBatch,
  } = useVault();

  const [dragPayload, setDragPayload] = useState<{ fromDay: Weekday; plannedId: string } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<Weekday | null>(null);

  // Modals & Popovers
  const [editingDay, setEditingDay] = useState<Weekday | null>(null);
  const [cloneTargetDay, setCloneTargetDay] = useState<Weekday>('thursday');
  const [editingExercise, setEditingExercise] = useState<{ day: Weekday; item: PlannedExercise } | null>(null);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [addTargetDay, setAddTargetDay] = useState<Weekday | null>(null);
  const [addSearch, setAddSearch] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [confirmClearWeek, setConfirmClearWeek] = useState(false);

  const totalWeeklyExercises = useMemo(
    () => WEEKDAYS.reduce((sum, d) => sum + plans[d].exercises.length, 0),
    [plans]
  );

  const handleDropOnDay = async (toDay: Weekday) => {
    setDragOverDay(null);
    if (!dragPayload) return;
    await moveExerciseBetweenDays(dragPayload.fromDay, toDay, dragPayload.plannedId);
    setDragPayload(null);
  };

  const handleAddExerciseToDay = async (day: Weekday, ex: Exercise) => {
    const plan = plans[day];
    const newPlanned: PlannedExercise = {
      id: `${day}-${ex.id}-${Date.now().toString(36)}`,
      exerciseId: ex.id,
      name: ex.name,
      targetMuscle: ex.muscleGroup,
      sets: 3,
      reps: 10,
      weight: ex.equipment === 'Bodyweight' ? 0 : 40,
      restSeconds: 90,
      tempo: '2-0-1-0',
      notes: ex.instructions[0] || '',
    };
    const nextPlan: DayPlan = {
      ...plan,
      category: plan.category === 'Rest Day' ? 'Full Body' : plan.category,
      title:
        plan.category === 'Rest Day' || plan.title === 'Open Day'
          ? `${WEEKDAY_LABELS[day]} Training`
          : plan.title,
      exercises: [...plan.exercises, newPlanned],
    };
    await updateDayPlan(day, nextPlan);
    setAddTargetDay(null);
    setAddSearch('');
  };

  const handleReorderExercise = async (day: Weekday, index: number, direction: -1 | 1) => {
    const plan = plans[day];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= plan.exercises.length) return;
    const nextList = [...plan.exercises];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIdx, 0, moved);
    await updateDayPlan(day, { ...plan, exercises: nextList });
  };

  const handleRemoveExercise = async (day: Weekday, plannedId: string) => {
    const plan = plans[day];
    await updateDayPlan(day, {
      ...plan,
      exercises: plan.exercises.filter((e) => e.id !== plannedId),
    });
  };

  const handleCloneDayTo = async (sourceDay: Weekday, destinationDay: Weekday) => {
    if (sourceDay === destinationDay) return;
    const source = plans[sourceDay];
    const clonedExercises: PlannedExercise[] = source.exercises.map((ex, i) => ({
      ...ex,
      id: `${destinationDay}-${ex.exerciseId}-${Date.now().toString(36)}-${i}`,
    }));
    await updateDayPlan(destinationDay, {
      day: destinationDay,
      category: source.category,
      title: source.title,
      exercises: clonedExercises,
    });
    setEditingDay(null);
  };

  const handleClearEntireWeek = async () => {
    await applyPlansBatch(DEFAULT_WEEKLY_PLANS);
    setConfirmClearWeek(false);
  };

  const handleSaveEditedExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExercise) return;
    const { day, item } = editingExercise;
    const plan = plans[day];
    await updateDayPlan(day, {
      ...plan,
      exercises: plan.exercises.map((ex) => (ex.id === item.id ? item : ex)),
    });
    setEditingExercise(null);
  };

  const filteredAddExercises = allExercises.filter(
    (ex) =>
      ex.name.toLowerCase().includes(addSearch.toLowerCase()) ||
      ex.muscleGroup.toLowerCase().includes(addSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white">
            Weekly Workout Planner
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Build your Monday–Sunday split from scratch, drag exercises between days, or let AI design a plan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-mono text-zinc-400 mr-1">
            {syncStatus === 'synced'
              ? 'Cloud synced'
              : syncStatus === 'syncing'
              ? 'Syncing...'
              : 'Auto-saved locally'}
          </span>

          {totalWeeklyExercises > 0 && (
            confirmClearWeek ? (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 px-2.5 py-1.5">
                <span className="text-xs text-rose-200">Clear all 7 days?</span>
                <button
                  type="button"
                  onClick={() => void handleClearEntireWeek()}
                  className="px-2 py-1 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-400"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearWeek(false)}
                  className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearWeek(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-medium text-zinc-300 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear Week
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setShowGenerator(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm font-medium text-zinc-100 hover:border-[#A855F7]/50 hover:text-white transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-[#A855F7]" />
            Quick Split Generator
          </button>
        </div>
      </div>

      {/* Empty Week Onboarding Banner */}
      {totalWeeklyExercises === 0 && (
        <div className="rounded-2xl bg-zinc-900/75 border border-[#00FF88]/25 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">
              Your Weekly Planner is Clean &amp; Ready
            </h2>
            <p className="text-xs text-zinc-400">
              All 7 days start empty. Click &ldquo;Add Exercise&rdquo; on any day card, pick a template in Quick Split Generator, or ask the AI Program Architect to build your week.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowGenerator(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/15 text-xs font-semibold text-white hover:border-[#00FF88]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00FF88]" />
              Browse Templates
            </button>
            {onOpenCoach && (
              <button
                type="button"
                onClick={onOpenCoach}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#A855F7] text-white text-xs font-semibold hover:bg-[#A855F7]/90"
              >
                <Bot className="w-3.5 h-3.5" />
                Build with AI Coach
              </button>
            )}
          </div>
        </div>
      )}

      {/* Color-Coded Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400 pb-2 border-b border-white/10">
        {(['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Cardio', 'Rest Day'] as PlanCategory[]).map(
          (cat) => (
            <div key={cat} className="inline-flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat].dot}`} />
              <span>{cat}</span>
            </div>
          )
        )}
      </div>

      {/* 7-Day Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {WEEKDAYS.map((day) => {
          const plan = plans[day];
          const color = CATEGORY_COLORS[plan.category] || CATEGORY_COLORS['Full Body'];
          const isDropTarget = dragOverDay === day;

          return (
            <section
              key={day}
              data-testid={`planner-day-${day}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDay(day);
              }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => {
                e.preventDefault();
                void handleDropOnDay(day);
              }}
              className={`rounded-2xl bg-zinc-900/65 backdrop-blur-xl border transition-all flex flex-col justify-between p-4 ${
                isDropTarget
                  ? 'border-[#00FF88] ring-1 ring-[#00FF88]/40 bg-zinc-900/90'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                {/* Day Card Header */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                      <span className={color.text}>{plan.category}</span>
                      <span className="text-zinc-600" aria-hidden="true">·</span>
                      <span className="text-zinc-400 font-mono">
                        {plan.exercises.length} {plan.exercises.length === 1 ? 'exercise' : 'exercises'}
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-white mt-1 truncate">
                      {WEEKDAY_LABELS[day]}
                    </h2>
                    <p className="text-xs text-zinc-400 truncate">{plan.title}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingDay(day);
                      setCloneTargetDay(WEEKDAYS.find((d) => d !== day) || 'monday');
                    }}
                    aria-label={`Configure ${WEEKDAY_LABELS[day]} settings`}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Exercises List */}
                <div className="py-2 divide-y divide-white/5 min-h-[140px]">
                  {plan.exercises.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center px-3 rounded-xl border border-dashed border-white/10 text-zinc-500 text-xs my-1">
                      <p>
                        {plan.category === 'Rest Day'
                          ? 'Empty day. Click Add Exercise or drop one here.'
                          : 'No exercises assigned yet.'}
                      </p>
                    </div>
                  ) : (
                    plan.exercises.map((item, idx) => {
                      const overload = computeProgressiveOverload(item.exerciseId, item, logs);
                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDragPayload({ fromDay: day, plannedId: item.id })}
                          onDragEnd={() => {
                            setDragPayload(null);
                            setDragOverDay(null);
                          }}
                          className="group py-2.5 px-1.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <GripVertical className="w-4 h-4 text-zinc-600 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setEditingExercise({ day, item: { ...item } })}
                                  className="text-left text-sm font-medium text-zinc-100 hover:text-[#00FF88] transition-colors truncate block max-w-full"
                                >
                                  {item.name}
                                </button>
                                <div className="text-xs text-zinc-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-1.5">
                                  <span>{item.sets}x{item.reps}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {item.weight > 0 ? `${item.weight}${profile.weightUnit}` : 'BW'}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{item.restSeconds}s rest</span>
                                </div>
                                {overload.shouldIncrease && overload.suggestedWeight > item.weight && (
                                  <p className="text-[11px] text-[#00FF88] mt-1 font-medium">
                                    Ready: try {overload.suggestedWeight}{profile.weightUnit}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => void handleReorderExercise(day, idx, -1)}
                                aria-label={`Move ${item.name} up`}
                                className="p-1 rounded-md text-zinc-500 hover:text-white disabled:opacity-25"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === plan.exercises.length - 1}
                                onClick={() => void handleReorderExercise(day, idx, 1)}
                                aria-label={`Move ${item.name} down`}
                                className="p-1 rounded-md text-zinc-500 hover:text-white disabled:opacity-25"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <select
                                aria-label={`Move ${item.name} to another day`}
                                value={day}
                                onChange={(e) =>
                                  void moveExerciseBetweenDays(day, e.target.value as Weekday, item.id)
                                }
                                className="bg-zinc-950 border border-white/10 rounded-md text-[11px] text-zinc-300 px-1 py-0.5 ml-0.5 focus:outline-none focus:border-[#00FF88]"
                              >
                                {WEEKDAYS.map((d) => (
                                  <option key={d} value={d}>
                                    {WEEKDAY_LABELS[d].slice(0, 3)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => void handleRemoveExercise(day, item.id)}
                                aria-label={`Remove ${item.name} from ${WEEKDAY_LABELS[day]}`}
                                className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Day Card Footer Actions */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAddTargetDay(day)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-medium text-zinc-200 hover:border-white/25 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Exercise
                </button>

                {plan.exercises.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onStartWorkout(day)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-xs font-semibold hover:bg-[#00FF88]/90 transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Edit Day Settings & Clone Modal */}
      {editingDay && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Configure ${WEEKDAY_LABELS[editingDay]}`}
        >
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {WEEKDAY_LABELS[editingDay]} Settings
              </h3>
              <button
                type="button"
                onClick={() => setEditingDay(null)}
                aria-label="Close day settings"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="day-category" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Split Category
                </label>
                <select
                  id="day-category"
                  value={plans[editingDay].category}
                  onChange={(e) =>
                    void updateDayPlan(editingDay, {
                      ...plans[editingDay],
                      category: e.target.value as PlanCategory,
                    })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                >
                  {PLAN_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="day-title" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Session Focus Title
                </label>
                <input
                  id="day-title"
                  type="text"
                  maxLength={100}
                  value={plans[editingDay].title}
                  onChange={(e) =>
                    void updateDayPlan(editingDay, {
                      ...plans[editingDay],
                      title: e.target.value,
                    })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>

              {/* Duplicate Day To Another Day */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <label htmlFor="clone-day" className="block text-xs font-medium text-zinc-400">
                  Duplicate {WEEKDAY_LABELS[editingDay]}&apos;s Workout To
                </label>
                <div className="flex gap-2">
                  <select
                    id="clone-day"
                    value={cloneTargetDay}
                    onChange={(e) => setCloneTargetDay(e.target.value as Weekday)}
                    className="flex-1 rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                  >
                    {WEEKDAYS.filter((d) => d !== editingDay).map((d) => (
                      <option key={d} value={d}>
                        {WEEKDAY_LABELS[d]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCloneDayTo(editingDay, cloneTargetDay)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-white hover:bg-zinc-700"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#00FF88]" />
                    Clone Day
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditingDay(null)}
                className="px-4 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-semibold hover:bg-[#00FF88]/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workout Builder: Edit Planned Exercise Sets/Reps/Weight/Rest/Tempo/Notes */}
      {editingExercise && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editingExercise.item.name}`}
        >
          <form
            onSubmit={handleSaveEditedExercise}
            className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-white/15 p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#00FF88] font-medium">
                  Workout Builder · {WEEKDAY_LABELS[editingExercise.day]}
                </p>
                <h3 className="text-lg font-semibold text-white mt-0.5">
                  {editingExercise.item.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingExercise(null)}
                aria-label="Close workout builder"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="wb-sets" className="block text-xs text-zinc-400 mb-1">
                  Sets
                </label>
                <input
                  id="wb-sets"
                  type="number"
                  min={1}
                  max={20}
                  value={editingExercise.item.sets}
                  onChange={(e) =>
                    setEditingExercise({
                      ...editingExercise,
                      item: { ...editingExercise.item, sets: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>

              <div>
                <label htmlFor="wb-reps" className="block text-xs text-zinc-400 mb-1">
                  Reps
                </label>
                <input
                  id="wb-reps"
                  type="number"
                  min={1}
                  max={200}
                  value={editingExercise.item.reps}
                  onChange={(e) =>
                    setEditingExercise({
                      ...editingExercise,
                      item: { ...editingExercise.item, reps: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>

              <div>
                <label htmlFor="wb-weight" className="block text-xs text-zinc-400 mb-1">
                  Weight ({profile.weightUnit})
                </label>
                <input
                  id="wb-weight"
                  type="number"
                  step="0.5"
                  min={0}
                  max={1000}
                  value={editingExercise.item.weight}
                  onChange={(e) =>
                    setEditingExercise({
                      ...editingExercise,
                      item: { ...editingExercise.item, weight: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>

              <div>
                <label htmlFor="wb-rest" className="block text-xs text-zinc-400 mb-1">
                  Rest (sec)
                </label>
                <input
                  id="wb-rest"
                  type="number"
                  min={10}
                  max={600}
                  step={5}
                  value={editingExercise.item.restSeconds}
                  onChange={(e) =>
                    setEditingExercise({
                      ...editingExercise,
                      item: { ...editingExercise.item, restSeconds: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label htmlFor="wb-tempo" className="block text-xs text-zinc-400 mb-1">
                  Tempo (Eccentric-Pause-Concentric-Top)
                </label>
                <input
                  id="wb-tempo"
                  type="text"
                  maxLength={20}
                  value={editingExercise.item.tempo}
                  onChange={(e) =>
                    setEditingExercise({
                      ...editingExercise,
                      item: { ...editingExercise.item, tempo: e.target.value },
                    })
                  }
                  placeholder="3-1-1-0"
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="wb-notes" className="block text-xs text-zinc-400 mb-1">
                Coaching Notes &amp; Cues
              </label>
              <textarea
                id="wb-notes"
                rows={3}
                maxLength={300}
                value={editingExercise.item.notes}
                onChange={(e) =>
                  setEditingExercise({
                    ...editingExercise,
                    item: { ...editingExercise.item, notes: e.target.value },
                  })
                }
                className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowPlateCalc(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-medium text-[#A855F7] hover:border-[#A855F7]/50"
              >
                <Calculator className="w-3.5 h-3.5" />
                Plate &amp; Warm-Up Calc
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingExercise(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-semibold hover:bg-[#00FF88]/90"
                >
                  Save Exercise
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Plate Loader & Warm-Up Modal */}
      {showPlateCalc && editingExercise && (
        <PlateCalculatorModal
          initialWeight={editingExercise.item.weight}
          initialReps={editingExercise.item.reps}
          unit={profile.weightUnit}
          exerciseName={editingExercise.item.name}
          onClose={() => setShowPlateCalc(false)}
          onApplyWeight={(nextWeight) =>
            setEditingExercise((prev) =>
              prev ? { ...prev, item: { ...prev.item, weight: nextWeight } } : null
            )
          }
        />
      )}

      {/* Add Exercise Picker Modal */}
      {addTargetDay && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Add exercise to ${WEEKDAY_LABELS[addTargetDay]}`}
        >
          <div className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-white/15 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Add Exercise to {WEEKDAY_LABELS[addTargetDay]}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAddTargetDay(null);
                  setAddSearch('');
                }}
                aria-label="Close exercise picker"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="search"
              placeholder="Search by exercise or muscle group..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#00FF88]"
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredAddExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => void handleAddExerciseToDay(addTargetDay, ex)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/70 border border-white/10 hover:border-[#00FF88]/50 text-left transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{ex.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {ex.muscleGroup} · {ex.equipment} · {ex.difficulty}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00FF88] shrink-0">
                    <CalendarPlus className="w-4 h-4" />
                    Assign
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Workout Split Generator Modal */}
      {showGenerator && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quick Workout Generator"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 border border-white/15 p-6 space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-[#00FF88]" />
                  Quick Workout Generator
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Populate your Monday–Sunday planner with a proven training split.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerator(false)}
                aria-label="Close generator"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1">
              {GENERATOR_STYLES.map((item) => (
                <button
                  key={item.style}
                  type="button"
                  onClick={async () => {
                    await applyGeneratorSplit(item.style);
                    setShowGenerator(false);
                  }}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 hover:border-[#00FF88] text-left transition-all group flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white group-hover:text-[#00FF88] transition-colors">
                        {item.style}
                      </span>
                      <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-[#00FF88] transition-colors" />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.subtitle}</p>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">{item.days}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
