import { WeightUnit } from '../types/workout';

export interface PlateCount {
  plate: number;
  countPerSide: number;
  colorClass: string;
  heightClass: string;
}

export interface PlateLoadResult {
  barWeight: number;
  targetWeight: number;
  achievableWeight: number;
  platesPerSide: PlateCount[];
  remainder: number;
}

export interface WarmupSet {
  stage: string;
  percent: number;
  weight: number;
  reps: number;
}

export interface TrainingZone {
  zone: string;
  percentRange: string;
  repRange: string;
  weightRange: string;
}

const KG_PLATES: { weight: number; colorClass: string; heightClass: string }[] = [
  { weight: 25, colorClass: 'bg-rose-500 text-white', heightClass: 'h-16' },
  { weight: 20, colorClass: 'bg-sky-500 text-white', heightClass: 'h-16' },
  { weight: 15, colorClass: 'bg-amber-400 text-zinc-950', heightClass: 'h-14' },
  { weight: 10, colorClass: 'bg-[#00FF88] text-zinc-950', heightClass: 'h-12' },
  { weight: 5, colorClass: 'bg-zinc-200 text-zinc-950', heightClass: 'h-10' },
  { weight: 2.5, colorClass: 'bg-purple-500 text-white', heightClass: 'h-8' },
  { weight: 1.25, colorClass: 'bg-zinc-500 text-white', heightClass: 'h-7' },
];

const LBS_PLATES: { weight: number; colorClass: string; heightClass: string }[] = [
  { weight: 45, colorClass: 'bg-sky-500 text-white', heightClass: 'h-16' },
  { weight: 35, colorClass: 'bg-amber-400 text-zinc-950', heightClass: 'h-14' },
  { weight: 25, colorClass: 'bg-[#00FF88] text-zinc-950', heightClass: 'h-12' },
  { weight: 10, colorClass: 'bg-zinc-200 text-zinc-950', heightClass: 'h-10' },
  { weight: 5, colorClass: 'bg-purple-500 text-white', heightClass: 'h-8' },
  { weight: 2.5, colorClass: 'bg-zinc-500 text-white', heightClass: 'h-7' },
];

export function calculateBarbellPlates(
  targetWeight: number,
  unit: WeightUnit
): PlateLoadResult {
  const barWeight = unit === 'kg' ? 20 : 45;
  const catalog = unit === 'kg' ? KG_PLATES : LBS_PLATES;

  if (targetWeight <= barWeight) {
    return {
      barWeight,
      targetWeight,
      achievableWeight: barWeight,
      platesPerSide: [],
      remainder: 0,
    };
  }

  let perSideRemaining = (targetWeight - barWeight) / 2;
  const platesPerSide: PlateCount[] = [];

  for (const item of catalog) {
    const count = Math.floor((perSideRemaining + 1e-6) / item.weight);
    if (count > 0) {
      platesPerSide.push({
        plate: item.weight,
        countPerSide: count,
        colorClass: item.colorClass,
        heightClass: item.heightClass,
      });
      perSideRemaining = Math.round((perSideRemaining - count * item.weight) * 100) / 100;
    }
  }

  const loadedPerSide = platesPerSide.reduce(
    (sum, p) => sum + p.plate * p.countPerSide,
    0
  );
  const achievableWeight = Math.round((barWeight + loadedPerSide * 2) * 100) / 100;

  return {
    barWeight,
    targetWeight,
    achievableWeight,
    platesPerSide,
    remainder: Math.round(perSideRemaining * 2 * 100) / 100,
  };
}

export function generateWarmupRamp(
  workingWeight: number,
  unit: WeightUnit
): WarmupSet[] {
  const barWeight = unit === 'kg' ? 20 : 45;
  const step = unit === 'kg' ? 2.5 : 5;
  const roundToStep = (val: number) =>
    Math.max(barWeight, Math.round(val / step) * step);

  if (workingWeight <= barWeight) {
    return [
      { stage: 'Movement Prep', percent: 100, weight: workingWeight, reps: 10 },
    ];
  }

  return [
    { stage: 'Empty Bar Primer', percent: 0, weight: barWeight, reps: 10 },
    { stage: 'Light Groove', percent: 50, weight: roundToStep(workingWeight * 0.5), reps: 6 },
    { stage: 'Potentiation', percent: 72, weight: roundToStep(workingWeight * 0.72), reps: 4 },
    { stage: 'Opener Single/Double', percent: 88, weight: roundToStep(workingWeight * 0.88), reps: 2 },
  ];
}

export function computeTrainingZones(e1rm: number, unit: WeightUnit): TrainingZone[] {
  if (e1rm <= 0) return [];
  const fmt = (pct: number) => `${Math.round(e1rm * pct)}${unit}`;
  return [
    { zone: 'Peak Neural Strength', percentRange: '90–100%', repRange: '1–3 reps', weightRange: `${fmt(0.9)} – ${fmt(1.0)}` },
    { zone: 'Maximal Strength', percentRange: '80–89%', repRange: '4–6 reps', weightRange: `${fmt(0.8)} – ${fmt(0.89)}` },
    { zone: 'Hypertrophy Sweet Spot', percentRange: '67–79%', repRange: '8–12 reps', weightRange: `${fmt(0.67)} – ${fmt(0.79)}` },
    { zone: 'Metabolic / Endurance', percentRange: '50–66%', repRange: '15+ reps', weightRange: `${fmt(0.5)} – ${fmt(0.66)}` },
  ];
}
