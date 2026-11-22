import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GenerateContentParameters, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

const COACH_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('high demand') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('TimeoutError') ||
    msg.includes('AbortError') ||
    msg.includes('aborted') ||
    msg.includes('timed out')
  );
}

function formatCoachError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      if (parsed.error.code === 503) {
        return 'AI Coach is temporarily experiencing high demand. Please retry in a few seconds.';
      }
      if (parsed.error.code === 400 || parsed.error.code === 403) {
        return 'AI Coach key is missing or invalid. Check GEMINI_API_KEY in Settings > Secrets.';
      }
      return parsed.error.message;
    }
  } catch {
    // Non-JSON message
  }
  if (raw.includes('GEMINI_API_KEY')) {
    return 'GEMINI_API_KEY is not configured in server environment / Secrets.';
  }
  return raw || fallback;
}

function parseModelJson<T>(raw: string | undefined, fallbackObj: T): T {
  const cleaned = (raw ?? '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return fallbackObj;
  return JSON.parse(cleaned) as T;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithFallback(
  buildParams: (model: string) => GenerateContentParameters
) {
  const ai = getGeminiClient();
  let lastError: unknown;

  for (const model of COACH_MODELS) {
    const attempts = model === COACH_MODELS[0] ? 1 : 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const params = buildParams(model);
        const timeoutMs = model === COACH_MODELS[0] ? 15000 : 20000;
        return await ai.models.generateContent({
          ...params,
          config: {
            ...params.config,
            abortSignal: AbortSignal.timeout(timeoutMs),
          },
        });
      } catch (err) {
        lastError = err;
        if (!isTransientError(err)) {
          throw err;
        }
        await sleep(300 * attempt);
      }
    }
  }

  throw lastError;
}

app.post('/api/coach/analyze', async (req, res) => {
  try {
    const { goal, weightUnit, weeklyPlans, recentLogs, recoverySummary } = req.body || {};
    if (!weeklyPlans || !recoverySummary) {
      res.status(400).json({ error: 'Missing weeklyPlans or recoverySummary payload.' });
      return;
    }

    const prompt = `Analyze this athlete's current training week, recovery status, and workout history.
Athlete Goal: ${String(goal || 'Strength and Hypertrophy')}
Preferred Unit: ${weightUnit === 'lbs' ? 'lbs' : 'kg'}

Weekly Split Overview:
${JSON.stringify(weeklyPlans).slice(0, 5000)}

Recent Workout Logs:
${JSON.stringify((recentLogs || []).slice(0, 8)).slice(0, 5000)}

Muscle Recovery Status (0-100%, Red=Fatigued, Yellow=Recovering, Green=Recovered):
${JSON.stringify(recoverySummary).slice(0, 3000)}

Provide concise, evidence-based strength & hypertrophy coaching:
1. Summary of progress and split balance (if weeklyPlans is empty, recommend a clean starting structure).
2. Specific weak points or under-trained muscle groups.
3. Recovery day recommendation based on fatigued muscles.
4. Up to 3 concrete suggested changes referencing valid weekday IDs (monday..sunday).`;

    const response = await generateWithFallback((model) => ({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are an elite evidence-based strength and conditioning coach inside Workout Vault. Keep advice specific, actionable, and concise.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: [
            'summary',
            'readinessVerdict',
            'weakPoints',
            'recoveryRecommendation',
            'suggestedChanges',
          ],
          properties: {
            summary: { type: Type.STRING },
            readinessVerdict: { type: Type.STRING },
            weakPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recoveryRecommendation: { type: Type.STRING },
            suggestedChanges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['day', 'action', 'category', 'volumeAdjustment'],
                properties: {
                  day: { type: Type.STRING },
                  action: { type: Type.STRING },
                  category: { type: Type.STRING },
                  volumeAdjustment: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    }));

    const parsed = parseModelJson(response.text, {});
    res.json({ analysis: parsed });
  } catch (error) {
    console.error('AI Coach analyze error:', error);
    res.status(500).json({ error: formatCoachError(error, 'Unable to generate AI Coach analysis.') });
  }
});

app.post('/api/coach/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Coach message cannot be empty.' });
      return;
    }

    const response = await generateWithFallback((model) => ({
      model,
      contents: `Athlete Context:\n${JSON.stringify(context || {}).slice(0, 6000)}\n\nQuestion:\n${message.trim().slice(0, 1000)}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are the Workout Vault AI Coach. Answer training, progressive overload, recovery, and exercise selection questions concisely in 2-4 crisp bullet points or a short paragraph.',
      },
    }));

    res.json({ reply: response.text ?? 'No coaching reply generated.' });
  } catch (error) {
    console.error('AI Coach chat error:', error);
    res.status(500).json({ error: formatCoachError(error, 'Unable to reach AI Coach.') });
  }
});

app.post('/api/coach/generate-plan', async (req, res) => {
  try {
    const { goal, daysPerWeek, equipment, focusNotes, weightUnit, availableExercises } =
      req.body || {};

    const exerciseCatalog = Array.isArray(availableExercises)
      ? availableExercises.slice(0, 320)
      : [];

    const catalogLines = exerciseCatalog
      .map((ex: Record<string, unknown>) =>
        `${String(ex?.exerciseId || '')} | ${String(ex?.name || '')} | ${String(ex?.muscleGroup || '')} | ${String(ex?.equipment || '')}`
      )
      .join('\n')
      .slice(0, 18500);

    const prompt = `Build a complete 7-day (monday through sunday) training program for this athlete.
Primary Goal: ${String(goal || 'Hypertrophy & Strength').slice(0, 120)}
Training Days Per Week: ${Math.max(2, Math.min(6, Number(daysPerWeek) || 4))}
Equipment Access: ${String(equipment || 'Full Commercial Gym').slice(0, 80)}
Weight Unit: ${weightUnit === 'lbs' ? 'lbs' : 'kg'}
Additional Focus Notes: ${String(focusNotes || 'Balanced full-body development').slice(0, 300)}

Available Exercise Catalog (exerciseId | name | muscleGroup | equipment — ONLY choose exerciseId values from this list):
${catalogLines}

Rules:
- Populate the "days" array with ALL 7 days: monday, tuesday, wednesday, thursday, friday, saturday, sunday.
- Match the requested number of active training days; make remaining days category "Rest Day" with empty exercises array [].
- Category MUST be one of: Push, Pull, Legs, Upper, Lower, Full Body, Cardio, Core, Rest Day.
- Each active day should have 3 to 5 exercises using exact exerciseId values from the catalog.
- Provide practical starting weights (0 for Bodyweight), sets (2-5), reps (5-20), restSeconds (60-180), tempo (e.g. "3-1-1-0"), and 1 concise coaching note.`;

    const response = await generateWithFallback((model) => ({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are an elite strength & hypertrophy program architect. Return clean structured JSON strictly matching the schema, always including the full 7-day days array using only provided exerciseId values.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['programTitle', 'rationale', 'days'],
          properties: {
            programTitle: { type: Type.STRING },
            rationale: { type: Type.STRING },
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['day', 'category', 'title', 'exercises'],
                properties: {
                  day: { type: Type.STRING },
                  category: { type: Type.STRING },
                  title: { type: Type.STRING },
                  exercises: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      required: [
                        'exerciseId',
                        'sets',
                        'reps',
                        'weight',
                        'restSeconds',
                        'tempo',
                        'notes',
                      ],
                      properties: {
                        exerciseId: { type: Type.STRING },
                        sets: { type: Type.INTEGER },
                        reps: { type: Type.INTEGER },
                        weight: { type: Type.NUMBER },
                        restSeconds: { type: Type.INTEGER },
                        tempo: { type: Type.STRING },
                        notes: { type: Type.STRING },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }));

    const parsed = parseModelJson(response.text, {
      programTitle: 'Custom AI Split',
      rationale: '',
      days: [],
    });
    res.json({ program: parsed });
  } catch (error) {
    console.error('AI Coach generate-plan error:', error);
    res.status(500).json({ error: formatCoachError(error, 'Unable to generate custom AI program.') });
  }
});

async function startServer() {
  const isProd =
    process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Workout Vault server running on http://localhost:${PORT}`);
  });
}

startServer();
