import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

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

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
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

app.post('/api/coach/analyze', async (req, res) => {
  try {
    const { goal, weightUnit, weeklyPlans, recentLogs, recoverySummary } = req.body || {};
    if (!weeklyPlans || !recoverySummary) {
      res.status(400).json({ error: 'Missing weeklyPlans or recoverySummary payload.' });
      return;
    }

    const ai = getGeminiClient();
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
1. Summary of progress and split balance.
2. Specific weak points or under-trained muscle groups.
3. Recovery day recommendation based on fatigued muscles.
4. Up to 3 concrete suggested changes referencing valid weekday IDs (monday..sunday).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an elite evidence-based strength and conditioning coach inside Workout Vault. Keep advice specific, actionable, and concise.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
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

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
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

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Athlete Context:\n${JSON.stringify(context || {}).slice(0, 6000)}\n\nQuestion:\n${message.trim().slice(0, 1000)}`,
      config: {
        systemInstruction:
          'You are the Workout Vault AI Coach. Answer training, progressive overload, recovery, and exercise selection questions concisely in 2-4 crisp bullet points or a short paragraph.',
      },
    });

    res.json({ reply: response.text ?? 'No coaching reply generated.' });
  } catch (error) {
    console.error('AI Coach chat error:', error);
    res.status(500).json({ error: formatCoachError(error, 'Unable to reach AI Coach.') });
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
