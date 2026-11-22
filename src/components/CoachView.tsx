import React, { useMemo, useState } from 'react';
import {
  Bot,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';
import {
  AiGeneratedProgram,
  CoachAnalysis,
  DayPlan,
  PlanCategory,
  PlannedExercise,
  Weekday,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from '../types/workout';
import { computeMuscleRecovery } from '../utils/workoutMath';

interface ChatMessage {
  role: 'user' | 'coach';
  text: string;
}

interface CoachViewProps {
  onOpenPlanner?: () => void;
}

const VALID_CATEGORIES: PlanCategory[] = [
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

const QUICK_COACH_PROMPTS = [
  'How do I break a bench press plateau?',
  'Best 4-day hypertrophy split?',
  'When should I take a deload week?',
  'Lower-back friendly leg swap ideas',
];

export const CoachView: React.FC<CoachViewProps> = ({ onOpenPlanner }) => {
  const { plans, logs, allExercises, profile, updateDayPlan, applyPlansBatch } = useVault();

  // Left Mode Switch: Audit vs Custom AI Program Architect
  const [coachMode, setCoachMode] = useState<'architect' | 'audit'>('architect');

  // Training Audit State
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<Record<number, boolean>>({});

  // AI Custom Program Architect State
  const [programGoal, setProgramGoal] = useState(profile.goal || 'Hypertrophy & Progressive Strength');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipmentAccess, setEquipmentAccess] = useState('Full Commercial Gym');
  const [focusNotes, setFocusNotes] = useState('');
  const [generatingProgram, setGeneratingProgram] = useState(false);
  const [generatedProgram, setGeneratedProgram] = useState<AiGeneratedProgram | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [programApplied, setProgramApplied] = useState(false);

  // Consultation Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'coach',
      text: 'Welcome to your AI Workout Coach. Build a custom 7-day program with the Program Architect, run a weekly training audit, or ask me directly about progressive overload, exercise swaps, or recovery.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const recovery = useMemo(() => computeMuscleRecovery(logs), [logs]);

  const handleGenerateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingProgram(true);
    setProgramError(null);
    setProgramApplied(false);

    try {
      const compactCatalog = allExercises.slice(0, 320).map((ex) => ({
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        equipment: ex.equipment,
      }));

      const res = await fetch('/api/coach/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-plan',
          goal: programGoal,
          daysPerWeek,
          equipment: equipmentAccess,
          focusNotes,
          weightUnit: profile.weightUnit,
          availableExercises: compactCatalog,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to build AI training program.');
      }

      if (!data.program || !Array.isArray(data.program.days)) {
        throw new Error('AI Coach returned an incomplete program format. Please retry.');
      }

      setGeneratedProgram(data.program as AiGeneratedProgram);
    } catch (err) {
      setProgramError(err instanceof Error ? err.message : 'Unable to generate AI program.');
    } finally {
      setGeneratingProgram(false);
    }
  };

  const handleApplyProgramToPlanner = async () => {
    if (!generatedProgram) return;

    const exerciseById = new Map(allExercises.map((ex) => [ex.id, ex]));
    const nextPlans = {} as Record<Weekday, DayPlan>;

    for (const day of WEEKDAYS) {
      const aiDay = generatedProgram.days.find(
        (d) => String(d.day).toLowerCase() === day
      );

      if (!aiDay) {
        nextPlans[day] = {
          day,
          category: 'Rest Day',
          title: 'Rest & Recovery',
          exercises: [],
        };
        continue;
      }

      const category: PlanCategory = VALID_CATEGORIES.includes(aiDay.category)
        ? aiDay.category
        : aiDay.exercises?.length
        ? 'Full Body'
        : 'Rest Day';

      const mappedExercises: PlannedExercise[] = (aiDay.exercises || [])
        .map((item, idx) => {
          const libEx = exerciseById.get(item.exerciseId);
          if (!libEx) return null;
          return {
            id: `${day}-${libEx.id}-${Date.now().toString(36)}-${idx}`,
            exerciseId: libEx.id,
            name: libEx.name,
            targetMuscle: libEx.muscleGroup,
            sets: Math.max(1, Math.min(12, Math.round(Number(item.sets) || 3))),
            reps: Math.max(1, Math.min(50, Math.round(Number(item.reps) || 10))),
            weight:
              libEx.equipment === 'Bodyweight'
                ? 0
                : Math.max(0, Math.min(500, Math.round((Number(item.weight) || 0) * 10) / 10)),
            restSeconds: Math.max(30, Math.min(300, Math.round(Number(item.restSeconds) || 90))),
            tempo: String(item.tempo || '2-0-1-0').slice(0, 20),
            notes: String(item.notes || libEx.instructions[0] || '').slice(0, 280),
          } satisfies PlannedExercise;
        })
        .filter((x): x is PlannedExercise => x !== null);

      nextPlans[day] = {
        day,
        category: mappedExercises.length === 0 ? 'Rest Day' : category,
        title: String(aiDay.title || `${category} Session`).slice(0, 95),
        exercises: mappedExercises,
      };
    }

    await applyPlansBatch(nextPlans);
    setProgramApplied(true);
  };

  const handleRunAudit = async () => {
    setCoachMode('audit');
    setLoadingAnalysis(true);
    setAnalysisError(null);
    setAppliedChanges({});

    try {
      const compactPlan = WEEKDAYS.map((d) => ({
        day: d,
        category: plans[d].category,
        title: plans[d].title,
        exercises: plans[d].exercises.map(
          (e) => `${e.name} (${e.sets}x${e.reps} @ ${e.weight}${profile.weightUnit})`
        ),
      }));

      const res = await fetch('/api/coach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          goal: profile.goal,
          weightUnit: profile.weightUnit,
          weeklyPlans: compactPlan,
          recentLogs: logs.slice(0, 6),
          recoverySummary: recovery,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI coaching report.');
      }
      setAnalysis(data.analysis as CoachAnalysis);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Unable to reach AI Coach.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleApplySuggestion = async (idx: number) => {
    if (!analysis) return;
    const change = analysis.suggestedChanges[idx];
    if (!change || !WEEKDAYS.includes(change.day)) return;
    const targetPlan = plans[change.day];

    await updateDayPlan(change.day, {
      ...targetPlan,
      category: change.category || targetPlan.category,
      title: change.category === 'Rest Day' ? 'Coach Recommended Recovery Day' : targetPlan.title,
      exercises:
        change.category === 'Rest Day'
          ? []
          : targetPlan.exercises.map((ex) => ({
              ...ex,
              sets: change.volumeAdjustment?.toLowerCase().includes('reduce')
                ? Math.max(2, ex.sets - 1)
                : change.volumeAdjustment?.toLowerCase().includes('increase')
                ? Math.min(6, ex.sets + 1)
                : ex.sets,
            })),
    });

    setAppliedChanges((prev) => ({ ...prev, [idx]: true }));
  };

  const sendCoachPrompt = async (rawPrompt: string) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed || sendingChat) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setChatInput('');
    setSendingChat(true);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          message: trimmed,
          context: {
            goal: profile.goal,
            recoveryScore: recovery.overallScore,
            fatiguedMuscles: recovery.muscles.filter((m) => m.status === 'Red').map((m) => m.muscle),
            recentWorkouts: logs.slice(0, 4).map((l) => `${l.date}: ${l.title} (${l.totalVolumeKg}kg)`),
            plannedDays: WEEKDAYS.filter((d) => plans[d].exercises.length > 0).map(
              (d) => `${d}: ${plans[d].title} (${plans[d].exercises.length} exercises)`
            ),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Coach unavailable.');
      setMessages((prev) => [...prev, { role: 'coach', text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'coach',
          text: err instanceof Error ? err.message : 'Unable to reach AI Coach right now.',
        },
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCoachPrompt(chatInput);
  };

  const exerciseNameById = useMemo(
    () => new Map(allExercises.map((e) => [e.id, e.name])),
    [allExercises]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white">
            AI Workout Coach
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Generate personalized 7-day programs, audit volume balance, and get instant coaching guidance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCoachMode('architect')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              coachMode === 'architect'
                ? 'bg-[#00FF88] text-zinc-950 border-[#00FF88]'
                : 'bg-zinc-900 text-zinc-200 border-white/10 hover:border-white/25'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Program Architect
          </button>

          <button
            type="button"
            onClick={() => void handleRunAudit()}
            disabled={loadingAnalysis}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              coachMode === 'audit'
                ? 'bg-[#A855F7] text-white border-[#A855F7]'
                : 'bg-zinc-900 text-zinc-200 border-white/10 hover:border-[#A855F7]/50'
            }`}
          >
            {loadingAnalysis ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loadingAnalysis ? 'Auditing...' : 'Run Training Audit'}
          </button>
        </div>
      </div>

      {analysisError && coachMode === 'audit' && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-300">
          {analysisError}
        </div>
      )}

      {programError && coachMode === 'architect' && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-300">
          {programError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: AI Program Architect or Structured Audit */}
        <div className="lg:col-span-7 space-y-4">
          {coachMode === 'architect' ? (
            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-[#00FF88]" />
                  AI Custom Program Architect
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Tell the coach your schedule, equipment, and goal — it builds a full Monday–Sunday plan directly from the Vault exercise library.
                </p>
              </div>

              <form onSubmit={handleGenerateProgram} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="ai-goal" className="block text-xs text-zinc-400 mb-1">
                      Primary Training Goal
                    </label>
                    <input
                      id="ai-goal"
                      type="text"
                      maxLength={120}
                      value={programGoal}
                      onChange={(e) => setProgramGoal(e.target.value)}
                      placeholder="e.g. Lean muscle hypertrophy, 5K + strength"
                      className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                    />
                  </div>

                  <div>
                    <label htmlFor="ai-days" className="block text-xs text-zinc-400 mb-1">
                      Days / Week
                    </label>
                    <select
                      id="ai-days"
                      value={daysPerWeek}
                      onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                      className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                    >
                      {[2, 3, 4, 5, 6].map((d) => (
                        <option key={d} value={d}>
                          {d} Training Days
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ai-equipment" className="block text-xs text-zinc-400 mb-1">
                      Equipment Available
                    </label>
                    <select
                      id="ai-equipment"
                      value={equipmentAccess}
                      onChange={(e) => setEquipmentAccess(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                    >
                      <option value="Full Commercial Gym">Full Commercial Gym</option>
                      <option value="Barbell, Rack & Dumbbells">Barbell, Rack &amp; Dumbbells</option>
                      <option value="Dumbbells & Kettlebells Only">Dumbbells &amp; Kettlebells Only</option>
                      <option value="Bodyweight Home Setup">Bodyweight Home Setup</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ai-focus" className="block text-xs text-zinc-400 mb-1">
                      Focus Areas / Injuries (Optional)
                    </label>
                    <input
                      id="ai-focus"
                      type="text"
                      maxLength={200}
                      value={focusNotes}
                      onChange={(e) => setFocusNotes(e.target.value)}
                      placeholder="e.g. Extra upper chest, protect lower back"
                      className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#00FF88]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generatingProgram}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-semibold hover:bg-[#00FF88]/90 disabled:opacity-50 transition-colors"
                >
                  {generatingProgram ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  {generatingProgram ? 'Architecting 7-Day Program...' : 'Build Custom AI Program'}
                </button>
              </form>

              {generatedProgram && (
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white">{generatedProgram.programTitle}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                        {generatedProgram.rationale}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleApplyProgramToPlanner()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-xs font-bold hover:bg-[#00FF88]/90 whitespace-nowrap"
                      >
                        <CalendarCheck className="w-4 h-4" />
                        {programApplied ? 'Applied to Planner' : 'Apply to Planner'}
                      </button>
                      {programApplied && onOpenPlanner && (
                        <button
                          type="button"
                          onClick={onOpenPlanner}
                          className="px-3 py-2 rounded-xl bg-zinc-800 text-white text-xs font-medium hover:bg-zinc-700 whitespace-nowrap"
                        >
                          View Planner
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {WEEKDAYS.map((day) => {
                      const d = generatedProgram.days.find(
                        (item) => String(item.day).toLowerCase() === day
                      );
                      return (
                        <div
                          key={day}
                          className="rounded-xl bg-zinc-950/80 border border-white/10 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white">
                              {WEEKDAY_LABELS[day]}
                            </span>
                            <span className="font-mono text-[#00FF88]">
                              {d?.category || 'Rest Day'}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-400 truncate">
                            {d?.title || 'Rest & Recovery'}
                          </div>
                          {d?.exercises && d.exercises.length > 0 ? (
                            <ul className="space-y-1 pt-1 border-t border-white/5 text-[11px] text-zinc-300">
                              {d.exercises.map((ex, i) => (
                                <li key={i} className="flex items-center justify-between gap-2">
                                  <span className="truncate">
                                    {exerciseNameById.get(ex.exerciseId) || ex.exerciseId}
                                  </span>
                                  <span className="font-mono text-zinc-400 shrink-0">
                                    {ex.sets}×{ex.reps}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-zinc-500">Recovery &amp; light mobility</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : !analysis ? (
            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-8 text-center space-y-3">
              <Bot className="w-10 h-10 text-[#A855F7] mx-auto" />
              <h2 className="text-lg font-semibold text-white">Ready to Audit Your Program</h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Click &ldquo;Run Training Audit&rdquo; to evaluate your current weekly split, detect under-trained muscles, and receive volume or recovery day adjustments.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-6 space-y-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <span className="text-xs font-mono text-[#00FF88]">
                    Readiness Verdict: {analysis.readinessVerdict}
                  </span>
                  <h2 className="text-lg font-semibold text-white mt-1">Program Review</h2>
                </div>
              </div>

              <p className="text-sm text-zinc-200 leading-relaxed">{analysis.summary}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-zinc-950/80 border border-white/10 p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-[#A855F7]">Detected Weak Points</h3>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {analysis.weakPoints?.map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-zinc-950/80 border border-white/10 p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-[#00FF88]">Recovery Guidance</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {analysis.recoveryRecommendation}
                  </p>
                </div>
              </div>

              {analysis.suggestedChanges?.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-sm font-semibold text-white">Suggested Plan Adjustments</h3>
                  {analysis.suggestedChanges.map((change, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-zinc-950/80 border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-mono text-[#00FF88]">
                          {WEEKDAY_LABELS[change.day] || change.day}
                          {change.volumeAdjustment ? ` · ${change.volumeAdjustment}` : ''}
                        </div>
                        <p className="text-sm text-zinc-200 mt-0.5">{change.action}</p>
                      </div>

                      {WEEKDAYS.includes(change.day) && (
                        <button
                          type="button"
                          disabled={appliedChanges[idx]}
                          onClick={() => void handleApplySuggestion(idx)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00FF88]/15 border border-[#00FF88]/40 text-xs font-semibold text-[#00FF88] hover:bg-[#00FF88]/25 disabled:opacity-60 whitespace-nowrap shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {appliedChanges[idx] ? 'Applied' : 'Apply to Planner'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Direct Coach Q&A */}
        <div className="lg:col-span-5 rounded-2xl bg-zinc-900/65 border border-white/10 flex flex-col h-[560px]">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Coach Consultation</h2>
            <span className="text-[11px] font-mono text-zinc-400">
              Readiness: {recovery.overallScore}%
            </span>
          </div>

          {/* Quick Question Prompts */}
          <div className="px-4 py-2.5 border-b border-white/10 flex flex-wrap gap-1.5">
            {QUICK_COACH_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={sendingChat}
                onClick={() => void sendCoachPrompt(q)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-950 border border-white/10 text-zinc-300 hover:border-[#00FF88]/50 hover:text-white transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-xl p-3 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-[#00FF88]/15 border border-[#00FF88]/30 text-white ml-6'
                    : 'bg-zinc-950/90 border border-white/10 text-zinc-200 mr-6'
                }`}
              >
                {msg.text}
              </div>
            ))}
            {sendingChat && (
              <div className="text-xs text-zinc-400 font-mono flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A855F7]" />
                Coach is analyzing your question...
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="p-3 border-t border-white/10 flex gap-2">
            <input
              type="text"
              aria-label="Ask AI Coach a question"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about progression, deloads, or swaps..."
              className="flex-1 rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#00FF88]"
            />
            <button
              type="submit"
              disabled={sendingChat || !chatInput.trim()}
              aria-label="Send message to AI Coach"
              className="px-3.5 py-2 rounded-xl bg-[#00FF88] text-zinc-950 font-semibold hover:bg-[#00FF88]/90 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
