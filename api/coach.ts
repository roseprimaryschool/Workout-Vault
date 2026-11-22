import { GenerateContentParameters, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

interface ReqLike {
  method?: string;
  url?: string;
  body?: unknown;
}

interface ResLike {
  status: (code: number) => ResLike;
  json: (data: unknown) => void;
}

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
        return 'AI Coach key is missing or invalid. Check GEMINI_API_KEY in Vercel environment variables.';
      }
      return parsed.error.message;
    }
  } catch {
    // Non-JSON message
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

async function generateWithFallback(
  ai: GoogleGenAI,
  buildParams: (model: string) => GenerateContentParameters
) {
  let lastError: unknown;
  for (const model of COACH_MODELS) {
    const attempts = model === COACH_MODELS[0] ? 1 : 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const params = buildParams(model);
        const timeoutMs = model === COACH_MODELS[0] ? 12000 : 15000;
        return await ai.models.generateContent({
          ...params,
          config: {
            ...params.config,
            abortSignal: AbortSignal.timeout(timeoutMs),
          },
        });
      } catch (err) {
        lastError = err;
        if (!isTransientError(err)) throw err;
        await sleep(300 * attempt);
      }
    }
  }
  throw lastError;
}

export default async function handler(req: ReqLike, res: ResLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        'GEMINI_API_KEY is missing in Vercel Environment Variables. Add GEMINI_API_KEY in Vercel Project → Settings → Environment Variables, then redeploy.',
    });
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  try {
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const body = (rawBody || {}) as Record<string, unknown>;
    const url = req.url || '';

    if (url.includes('generate-plan') || body.action === 'generate-plan') {
      const exerciseCatalog = Array.isArray(body.availableExercises)
        ? body.availableExercises.slice(0, 320)
        : [];
      const catalogLines = exerciseCatalog
        .map((ex: Record<string, unknown>) =>
          `${String(ex?.exerciseId || '')} | ${String(ex?.name || '')} | ${String(ex?.muscleGroup || '')} | ${String(ex?.equipment || '')}`
        )
        .join('\n')
        .slice(0, 18500);
      const prompt = `Build a complete 7-day (monday through sunday) training program for this athlete.
Primary Goal: ${String(body.goal || 'Hypertrophy & Strength').slice(0, 120)}
Training Days Per Week: ${Math.max(2, Math.min(6, Number(body.daysPerWeek) || 4))}
Equipment Access: ${String(body.equipment || 'Full Commercial Gym').slice(0, 80)}
Weight Unit: ${body.weightUnit === 'lbs' ? 'lbs' : 'kg'}
Additional Focus Notes: ${String(body.focusNotes || 'Balanced full-body development').slice(0, 300)}

Available Exercise Catalog (exerciseId | name | muscleGroup | equipment — ONLY choose exerciseId values from this list):
${catalogLines}

Rules:
- Populate the "days" array with ALL 7 days: monday, tuesday, wednesday, thursday, friday, saturday, sunday.
- Match the requested number of active training days; make remaining days category "Rest Day" with empty exercises array [].
- Category MUST be one of: Push, Pull, Legs, Upper, Lower, Full Body, Cardio, Core, Rest Day.
- Each active day should have 3 to 5 exercises using exact exerciseId values from the catalog.
- Provide practical starting weights (0 for Bodyweight), sets (2-5), reps (5-20), restSeconds (60-180), tempo (e.g. "3-1-1-0"), and 1 concise coaching note.`;

      const response = await generateWithFallback(ai, (model) => ({
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
      res.status(200).json({ program: parseModelJson(response.text, { programTitle: 'Custom AI Split', rationale: '', days: [] }) });
      return;
    }

    if (url.includes('chat') || body.action === 'chat' || (typeof body.message === 'string' && body.message.trim())) {
      const msgText = String(body.message || '').trim();
      if (!msgText) {
        res.status(400).json({ error: 'Coach message cannot be empty.' });
        return;
      }
      const response = await generateWithFallback(ai, (model) => ({
        model,
        contents: `Athlete Context:\n${JSON.stringify(body.context || {}).slice(0, 6000)}\n\nQuestion:\n${msgText.slice(0, 1000)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are the Workout Vault AI Coach. Answer training, progressive overload, recovery, and exercise selection questions concisely in 2-4 crisp bullet points or a short paragraph.',
        },
      }));
      res.status(200).json({ reply: response.text ?? '' });
      return;
    }

    const response = await generateWithFallback(ai, (model) => ({
      model,
      contents: `Analyze this athlete's weekly plan, logs, and recovery:\n${JSON.stringify(body).slice(0, 8000)}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are an elite strength and conditioning coach inside Workout Vault.',
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
            weakPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
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
    res.status(200).json({ analysis: parseModelJson(response.text, {}) });
  } catch (err) {
    res.status(500).json({ error: formatCoachError(err, 'AI Coach error') });
  }
}
