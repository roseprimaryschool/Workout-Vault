import React, { useMemo, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { CoachAnalysis, WEEKDAYS, WEEKDAY_LABELS } from '../types/workout';
import { computeMuscleRecovery } from '../utils/workoutMath';

interface ChatMessage {
  role: 'user' | 'coach';
  text: string;
}

export const CoachView: React.FC = () => {
  const { plans, logs, profile, updateDayPlan } = useVault();

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<Record<number, boolean>>({});

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'coach',
      text: 'Welcome to your AI Workout Coach. Run a full weekly audit above or ask me about progressive overload, exercise swaps, or recovery adjustments.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const recovery = useMemo(() => computeMuscleRecovery(logs), [logs]);

  const handleRunAudit = async () => {
    setLoadingAnalysis(true);
    setAnalysisError(null);
    setAppliedChanges({});

    try {
      const compactPlan = WEEKDAYS.map((d) => ({
        day: d,
        category: plans[d].category,
        title: plans[d].title,
        exercises: plans[d].exercises.map((e) => `${e.name} (${e.sets}x${e.reps} @ ${e.weight}${profile.weightUnit})`),
      }));

      const res = await fetch('/api/coach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || sendingChat) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setChatInput('');
    setSendingChat(true);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          context: {
            goal: profile.goal,
            recoveryScore: recovery.overallScore,
            fatiguedMuscles: recovery.muscles.filter((m) => m.status === 'Red').map((m) => m.muscle),
            recentWorkouts: logs.slice(0, 4).map((l) => `${l.date}: ${l.title} (${l.totalVolumeKg}kg)`),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white">
            AI Workout Coach
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Reviews your weekly split, volume progression, weak points, and muscle recovery status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleRunAudit()}
          disabled={loadingAnalysis}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A855F7] text-white text-sm font-semibold hover:bg-[#A855F7]/90 disabled:opacity-50 transition-colors whitespace-nowrap self-start md:self-auto"
        >
          {loadingAnalysis ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loadingAnalysis ? 'Analyzing Training Data...' : 'Run Full Training Audit'}
        </button>
      </div>

      {analysisError && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-300">
          {analysisError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Structured Training Audit */}
        <div className="lg:col-span-7 space-y-4">
          {!analysis ? (
            <div className="rounded-2xl bg-zinc-900/65 border border-white/10 p-8 text-center space-y-3">
              <Bot className="w-10 h-10 text-[#A855F7] mx-auto" />
              <h2 className="text-lg font-semibold text-white">Ready to Audit Your Program</h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Click &ldquo;Run Full Training Audit&rdquo; to evaluate your current weekly split, detect under-trained muscles, and receive volume or recovery day adjustments.
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
                    {analysis.weakPoints.map((w, i) => (
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
        <div className="lg:col-span-5 rounded-2xl bg-zinc-900/65 border border-white/10 flex flex-col h-[520px]">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Coach Consultation</h2>
            <span className="text-[11px] font-mono text-zinc-400">
              Readiness: {recovery.overallScore}%
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-xl p-3 text-sm leading-relaxed ${
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
                Coach is reviewing your logs...
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
