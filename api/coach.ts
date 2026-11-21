import { GoogleGenAI, Type } from '@google/genai';

interface ReqLike {
  method?: string;
  body?: Record<string, unknown>;
}

interface ResLike {
  status: (code: number) => ResLike;
  json: (data: unknown) => void;
}

function formatCoachError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      return parsed.error.code === 503
        ? 'AI Coach is temporarily experiencing high demand. Please try again in a few seconds.'
        : parsed.error.message;
    }
  } catch {
    // Non-JSON message
  }
  return raw || fallback;
}

export default async function handler(req: ReqLike, res: ResLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
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
    const body = req.body || {};
    if (typeof body.message === 'string' && body.message.trim()) {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Athlete Context:\n${JSON.stringify(body.context || {}).slice(0, 6000)}\n\nQuestion:\n${body.message.trim().slice(0, 1000)}`,
        config: {
          systemInstruction:
            'You are the Workout Vault AI Coach. Answer concisely with actionable strength, hypertrophy, and recovery guidance.',
        },
      });
      res.status(200).json({ reply: response.text ?? '' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this athlete's weekly plan, logs, and recovery:\n${JSON.stringify(body).slice(0, 8000)}`,
      config: {
        systemInstruction:
          'You are an elite strength and conditioning coach inside Workout Vault.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            readinessVerdict: { type: Type.STRING },
            weakPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            recoveryRecommendation: { type: Type.STRING },
            suggestedChanges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
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
    });
    res.status(200).json({ analysis: JSON.parse((response.text ?? '{}').trim()) });
  } catch (err) {
    res.status(500).json({ error: formatCoachError(err, 'AI Coach error') });
  }
}
