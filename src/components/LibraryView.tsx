import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import {
  Difficulty,
  Equipment,
  Exercise,
  ExerciseType,
  MuscleGroup,
  Weekday,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from '../types/workout';
import { saveLocalMediaBlob } from '../utils/mediaStorage';
import { computePersonalRecords } from '../utils/workoutMath';
import { mwMuscleUrl } from '../data/exercises';
import { ExerciseDemoPlayer } from './ExerciseDemoPlayer';
import { MuscleAnatomyDiagram } from './MuscleAnatomyDiagram';

const MUSCLE_GROUPS: ('All' | MuscleGroup)[] = [
  'All',
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

const EQUIPMENT_LIST: ('All' | Equipment)[] = [
  'All',
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Kettlebell',
  'Cardio',
];

const DIFFICULTIES: ('All' | Difficulty)[] = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const EXERCISE_TYPES: ('All' | ExerciseType)[] = [
  'All',
  'Strength',
  'Hypertrophy',
  'Power',
  'Cardio',
  'Mobility',
];

export const LibraryView: React.FC = () => {
  const {
    allExercises,
    logs,
    plans,
    updateDayPlan,
    addCustomExercise,
    deleteCustomExercise,
  } = useVault();

  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<'All' | MuscleGroup>('All');
  const [equipmentFilter, setEquipmentFilter] = useState<'All' | Equipment>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | Difficulty>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | ExerciseType>('All');

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [assignDay, setAssignDay] = useState<Weekday>('monday');
  const [assignedFeedback, setAssignedFeedback] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(48);

  // Custom Exercise Creator state
  const [showCreator, setShowCreator] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('Chest');
  const [customEquipment, setCustomEquipment] = useState<Equipment>('Dumbbell');
  const [customDifficulty, setCustomDifficulty] = useState<Difficulty>('Intermediate');
  const [customType, setCustomType] = useState<ExerciseType>('Hypertrophy');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customCues, setCustomCues] = useState('');
  const [customMediaUrl, setCustomMediaUrl] = useState('');
  const [customMediaType, setCustomMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const records = useMemo(() => computePersonalRecords(logs), [logs]);

  const muscleCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allExercises.length };
    for (const ex of allExercises) {
      counts[ex.muscleGroup] = (counts[ex.muscleGroup] || 0) + 1;
    }
    return counts;
  }, [allExercises]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allExercises.filter((ex) => {
      if (muscleFilter !== 'All' && ex.muscleGroup !== muscleFilter) return false;
      if (equipmentFilter !== 'All' && ex.equipment !== equipmentFilter) return false;
      if (difficultyFilter !== 'All' && ex.difficulty !== difficultyFilter) return false;
      if (typeFilter !== 'All' && ex.exerciseType !== typeFilter) return false;
      if (
        q &&
        !ex.name.toLowerCase().includes(q) &&
        !ex.muscleGroup.toLowerCase().includes(q) &&
        !ex.equipment.toLowerCase().includes(q) &&
        !ex.secondaryMuscles.some((m) => m.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [allExercises, search, muscleFilter, equipmentFilter, difficultyFilter, typeFilter]);

  const handleAssignToPlan = async () => {
    if (!selectedExercise) return;
    const plan = plans[assignDay];
    await updateDayPlan(assignDay, {
      ...plan,
      category: plan.category === 'Rest Day' ? 'Full Body' : plan.category,
      title: plan.category === 'Rest Day' ? `${WEEKDAY_LABELS[assignDay]} Training` : plan.title,
      exercises: [
        ...plan.exercises,
        {
          id: `${assignDay}-${selectedExercise.id}-${Date.now().toString(36)}`,
          exerciseId: selectedExercise.id,
          name: selectedExercise.name,
          targetMuscle: selectedExercise.muscleGroup,
          sets: 3,
          reps: 10,
          weight: selectedExercise.equipment === 'Bodyweight' ? 0 : 40,
          restSeconds: 90,
          tempo: '2-0-1-0',
          notes: selectedExercise.coachingCues || selectedExercise.instructions[0] || '',
        },
      ],
    });
    setAssignedFeedback(`Added to ${WEEKDAY_LABELS[assignDay]}`);
    window.setTimeout(() => setAssignedFeedback(null), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    if (file.type.startsWith('video/')) {
      setCustomMediaType('video');
    } else if (file.type.startsWith('image/')) {
      setCustomMediaType('image');
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customName.trim().length < 2) {
      setFormError('Exercise name must be at least 2 characters.');
      return;
    }

    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    let mediaLocalId: string | undefined;

    if (uploadedFile) {
      mediaLocalId = `media-${id}`;
      await saveLocalMediaBlob(mediaLocalId, uploadedFile);
    }

    const newExercise: Exercise = {
      id,
      name: customName.trim(),
      muscleGroup: customMuscle,
      secondaryMuscles: [],
      equipment: customEquipment,
      difficulty: customDifficulty,
      exerciseType: customType,
      instructions: customInstructions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      muscleWikiSlug: '',
      muscleWikiUrl: `https://musclewiki.com`,
      animationStyle: 'press',
      isCustom: true,
      notes: customNotes.trim(),
      coachingCues: customCues.trim(),
      mediaType: uploadedFile
        ? customMediaType
        : customMediaUrl.trim()
        ? customMediaType === 'none'
          ? 'video'
          : customMediaType
        : 'none',
      mediaUrl: customMediaUrl.trim(),
      mediaLocalId,
    };

    await addCustomExercise(newExercise);
    setShowCreator(false);
    setCustomName('');
    setCustomInstructions('');
    setCustomNotes('');
    setCustomCues('');
    setCustomMediaUrl('');
    setCustomMediaType('none');
    setUploadedFile(null);
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white">
            Exercise Library
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Browse MuscleWiki demonstrations, inspect muscle anatomy, or create custom movements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreator(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-semibold hover:bg-[#00FF88]/90 transition-colors whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Custom Exercise
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl bg-zinc-900/65 backdrop-blur-xl border border-white/10 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search exercises"
              placeholder="Search exercises, muscles, equipment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-white/10 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          <select
            aria-label="Filter by equipment"
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value as 'All' | Equipment)}
            className="rounded-xl bg-zinc-950 border border-white/10 px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[#00FF88]"
          >
            {EQUIPMENT_LIST.map((eq) => (
              <option key={eq} value={eq}>
                {eq === 'All' ? 'All Equipment' : eq}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by difficulty"
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as 'All' | Difficulty)}
            className="rounded-xl bg-zinc-950 border border-white/10 px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[#00FF88]"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d === 'All' ? 'All Difficulties' : d}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by exercise type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'All' | ExerciseType)}
            className="rounded-xl bg-zinc-950 border border-white/10 px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[#00FF88]"
          >
            {EXERCISE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All Types' : t}
              </option>
            ))}
          </select>
        </div>

        {/* Muscle Group Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMuscleFilter(m);
                setVisibleCount(48);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                muscleFilter === m
                  ? 'bg-[#00FF88] text-zinc-950 font-semibold'
                  : 'bg-zinc-950/70 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              {m} ({muscleCounts[m] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Results Count + MuscleWiki Directory Link */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-zinc-400 font-mono">
          Showing {filtered.length} of {allExercises.length} exercises
        </span>
        <a
          href={muscleFilter === 'All' ? 'https://musclewiki.com/exercises' : mwMuscleUrl(muscleFilter)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-[#00FF88] hover:underline"
        >
          {muscleFilter === 'All'
            ? 'Browse full MuscleWiki exercise directory'
            : `Browse ${muscleFilter} exercises on MuscleWiki`}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Exercise Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/50 border border-white/10 p-10 text-center space-y-3">
          <p className="text-sm text-zinc-300">No exercises match your current filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setMuscleFilter('All');
              setEquipmentFilter('All');
              setDifficultyFilter('All');
              setTypeFilter('All');
            }}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-medium text-white hover:bg-zinc-700"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.slice(0, visibleCount).map((ex) => {
            const pr = records[ex.id];
            return (
              <article
                key={ex.id}
                className="rounded-2xl bg-zinc-900/65 backdrop-blur-xl border border-white/10 hover:border-white/25 transition-colors p-4 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-400">
                      {ex.muscleGroup} · {ex.equipment} · {ex.difficulty}
                    </div>
                    <h2 className="text-base font-semibold text-white mt-1 truncate">
                      {ex.name}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {ex.exerciseType}
                      {ex.isCustom ? ' · Custom Exercise' : ''}
                    </p>
                  </div>

                  {/* Small Muscle Anatomy Visual */}
                  <div className="shrink-0 rounded-xl bg-zinc-950/70 border border-white/5 p-1.5">
                    <MuscleAnatomyDiagram
                      mode="exercise"
                      primaryMuscle={ex.muscleGroup}
                      secondaryMuscles={ex.secondaryMuscles}
                      compact
                    />
                  </div>
                </div>

                {pr && (
                  <div className="text-xs font-mono text-zinc-400 pt-2 border-t border-white/5">
                    Best: <span className="text-[#00FF88]">{pr.maxWeight}kg</span> · E1RM {pr.bestE1RM}kg
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedExercise(ex)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-medium text-white hover:border-[#00FF88]/50 transition-colors"
                  >
                    Demo & Details
                  </button>

                  <div className="flex items-center gap-2">
                    {!ex.isCustom ? (
                      <a
                        href={ex.muscleWikiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#00FF88] hover:underline whitespace-nowrap"
                      >
                        MuscleWiki
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void deleteCustomExercise(ex.id)}
                        aria-label={`Delete custom exercise ${ex.name}`}
                        className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
            })}
          </div>

          {filtered.length > visibleCount && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 48)}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-xs font-semibold text-white hover:border-[#00FF88] hover:text-[#00FF88] transition-colors"
              >
                Show More ({Math.min(48, filtered.length - visibleCount)} more of {filtered.length})
              </button>
              <button
                type="button"
                onClick={() => setVisibleCount(filtered.length)}
                className="px-4 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Show All {filtered.length}
              </button>
            </div>
          )}
        </>
      )}

      {/* Exercise Detail & MuscleWiki Demonstration Modal */}
      {selectedExercise && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={selectedExercise.name}
        >
          <div className="w-full max-w-3xl rounded-2xl bg-zinc-900 border border-white/15 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-zinc-400">
                  {selectedExercise.muscleGroup}
                  {selectedExercise.secondaryMuscles.length > 0
                    ? ` + ${selectedExercise.secondaryMuscles.join(', ')}`
                    : ''}{' '}
                  · {selectedExercise.equipment} · {selectedExercise.difficulty}
                </div>
                <h2 className="text-xl md:text-2xl font-bold font-display text-white mt-1">
                  {selectedExercise.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExercise(null)}
                aria-label="Close exercise details"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              <div className="md:col-span-2">
                <ExerciseDemoPlayer exercise={selectedExercise} hideExternalLink />
              </div>
              <div className="rounded-xl bg-zinc-950 border border-white/10 p-3 flex flex-col items-center justify-center">
                <MuscleAnatomyDiagram
                  mode="exercise"
                  primaryMuscle={selectedExercise.muscleGroup}
                  secondaryMuscles={selectedExercise.secondaryMuscles}
                />
                <div className="text-[11px] text-zinc-400 mt-2 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#00FF88]" /> Primary
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#A855F7]" /> Secondary
                  </span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Execution Instructions</h3>
              {selectedExercise.instructions.length > 0 ? (
                <ol className="space-y-1.5 text-sm text-zinc-300 list-decimal list-inside">
                  {selectedExercise.instructions.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-zinc-400">
                  {selectedExercise.notes || 'Perform with controlled tempo and full range of motion.'}
                </p>
              )}
            </div>

            {(selectedExercise.coachingCues || selectedExercise.notes) && (
              <div className="rounded-xl bg-zinc-950/80 border border-white/10 p-3.5 space-y-1">
                <div className="text-xs font-semibold text-[#A855F7]">Coaching Cues & Notes</div>
                {selectedExercise.coachingCues && (
                  <p className="text-sm text-zinc-200">{selectedExercise.coachingCues}</p>
                )}
                {selectedExercise.notes && (
                  <p className="text-xs text-zinc-400">{selectedExercise.notes}</p>
                )}
              </div>
            )}

            {/* Add to Weekly Plan + View on MuscleWiki */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
                  aria-label="Select weekday to assign exercise"
                  value={assignDay}
                  onChange={(e) => setAssignDay(e.target.value as Weekday)}
                  className="rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {WEEKDAY_LABELS[d]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleAssignToPlan()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-xs font-semibold hover:bg-[#00FF88]/90"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Add to Day
                </button>
                {assignedFeedback && (
                  <span className="text-xs text-[#00FF88] font-medium">{assignedFeedback}</span>
                )}
              </div>

              {!selectedExercise.isCustom && (
                <a
                  href={selectedExercise.muscleWikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 border border-white/15 text-xs font-semibold text-white hover:border-[#00FF88] hover:text-[#00FF88] transition-colors"
                >
                  View on MuscleWiki
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Exercise Creator Modal */}
      {showCreator && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create Custom Exercise"
        >
          <form
            onSubmit={handleCreateCustom}
            className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-white/15 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Create Custom Exercise</h2>
              <button
                type="button"
                onClick={() => setShowCreator(false)}
                aria-label="Close custom exercise creator"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <div>
              <label htmlFor="ce-name" className="block text-xs text-zinc-400 mb-1">
                Exercise Name *
              </label>
              <input
                id="ce-name"
                type="text"
                required
                maxLength={100}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Landmine Single-Arm Press"
                className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="ce-muscle" className="block text-xs text-zinc-400 mb-1">
                  Primary Muscle
                </label>
                <select
                  id="ce-muscle"
                  value={customMuscle}
                  onChange={(e) => setCustomMuscle(e.target.value as MuscleGroup)}
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                >
                  {MUSCLE_GROUPS.filter((m) => m !== 'All').map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ce-equip" className="block text-xs text-zinc-400 mb-1">
                  Equipment
                </label>
                <select
                  id="ce-equip"
                  value={customEquipment}
                  onChange={(e) => setCustomEquipment(e.target.value as Equipment)}
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                >
                  {EQUIPMENT_LIST.filter((e) => e !== 'All').map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ce-diff" className="block text-xs text-zinc-400 mb-1">
                  Difficulty
                </label>
                <select
                  id="ce-diff"
                  value={customDifficulty}
                  onChange={(e) => setCustomDifficulty(e.target.value as Difficulty)}
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                >
                  {DIFFICULTIES.filter((d) => d !== 'All').map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ce-type" className="block text-xs text-zinc-400 mb-1">
                  Type
                </label>
                <select
                  id="ce-type"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as ExerciseType)}
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                >
                  {EXERCISE_TYPES.filter((t) => t !== 'All').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ce-file" className="block text-xs text-zinc-400 mb-1">
                  Upload Demonstration Video or Image
                </label>
                <label
                  htmlFor="ce-file"
                  className="flex items-center justify-center gap-2 rounded-xl bg-zinc-950 border border-dashed border-white/15 hover:border-[#00FF88] px-3 py-2.5 text-xs text-zinc-300 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-[#00FF88]" />
                  <span className="truncate">
                    {uploadedFile ? uploadedFile.name : 'Choose local video/image'}
                  </span>
                </label>
                <input
                  id="ce-file"
                  type="file"
                  accept="video/*,image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </div>

              <div>
                <label htmlFor="ce-url" className="block text-xs text-zinc-400 mb-1">
                  Or External HTTPS Media URL
                </label>
                <input
                  id="ce-url"
                  type="url"
                  maxLength={2000}
                  value={customMediaUrl}
                  onChange={(e) => setCustomMediaUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ce-cues" className="block text-xs text-zinc-400 mb-1">
                Coaching Cues
              </label>
              <input
                id="ce-cues"
                type="text"
                maxLength={500}
                value={customCues}
                onChange={(e) => setCustomCues(e.target.value)}
                placeholder="Drive elbow at 45 degrees, brace ribs down"
                className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div>
              <label htmlFor="ce-instructions" className="block text-xs text-zinc-400 mb-1">
                Step-by-Step Instructions (one step per line)
              </label>
              <textarea
                id="ce-instructions"
                rows={3}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="1. Stagger stance&#10;2. Press bar upward smoothly"
                className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div>
              <label htmlFor="ce-notes" className="block text-xs text-zinc-400 mb-1">
                Personal Notes
              </label>
              <textarea
                id="ce-notes"
                rows={2}
                maxLength={1000}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreator(false)}
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
          </form>
        </div>
      )}
    </div>
  );
};
