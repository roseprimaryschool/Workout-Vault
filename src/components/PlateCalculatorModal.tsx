import React, { useMemo, useState } from 'react';
import { Calculator, Flame, Layers, X } from 'lucide-react';
import { WeightUnit } from '../types/workout';
import {
  calculateBarbellPlates,
  computeTrainingZones,
  generateWarmupRamp,
} from '../utils/plateCalc';
import { calculateE1RM } from '../utils/workoutMath';

interface PlateCalculatorModalProps {
  initialWeight?: number;
  initialReps?: number;
  unit: WeightUnit;
  exerciseName?: string;
  onClose: () => void;
  onApplyWeight?: (weight: number) => void;
}

export const PlateCalculatorModal: React.FC<PlateCalculatorModalProps> = ({
  initialWeight = 80,
  initialReps = 6,
  unit,
  exerciseName = 'Barbell Lift',
  onClose,
  onApplyWeight,
}) => {
  const [weight, setWeight] = useState(
    initialWeight > 0 ? initialWeight : unit === 'kg' ? 60 : 135
  );
  const [reps, setReps] = useState(Math.max(1, initialReps));

  const platesResult = useMemo(
    () => calculateBarbellPlates(weight, unit),
    [weight, unit]
  );
  const warmupRamp = useMemo(
    () => generateWarmupRamp(weight, unit),
    [weight, unit]
  );
  const estimated1RM = useMemo(() => calculateE1RM(weight, reps), [weight, reps]);
  const zones = useMemo(
    () => computeTrainingZones(estimated1RM, unit),
    [estimated1RM, unit]
  );

  // Flatten per-side plates for visual barbell sleeve rendering
  const sleevePlates = useMemo(() => {
    const items: { plate: number; colorClass: string; heightClass: string }[] = [];
    for (const group of platesResult.platesPerSide) {
      for (let i = 0; i < group.countPerSide; i++) {
        items.push({
          plate: group.plate,
          colorClass: group.colorClass,
          heightClass: group.heightClass,
        });
      }
    }
    return items;
  }, [platesResult]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Plate Loader and Warm-Up Calculator"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 border border-white/15 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-[#00FF88]">{exerciseName}</p>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              <Calculator className="w-5 h-5 text-[#A855F7]" />
              Plate Loader, Warm-Up Ramp &amp; 1RM Zones
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plate calculator"
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Weight & Reps Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="calc-weight" className="block text-xs text-zinc-400 mb-1">
              Target Working Weight ({unit})
            </label>
            <input
              id="calc-weight"
              type="number"
              step={unit === 'kg' ? 1.25 : 2.5}
              min={0}
              max={1000}
              value={weight}
              onChange={(e) => setWeight(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>
          <div>
            <label htmlFor="calc-reps" className="block text-xs text-zinc-400 mb-1">
              Target Reps (for E1RM Zones)
            </label>
            <input
              id="calc-reps"
              type="number"
              min={1}
              max={30}
              value={reps}
              onChange={(e) => setReps(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>
        </div>

        {/* Visual Barbell Sleeve Diagram */}
        <div className="rounded-xl bg-zinc-950 border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00FF88]" />
              Per-Side Plate Load ({platesResult.barWeight}{unit} Olympic Bar)
            </span>
            <span className="font-mono text-white font-semibold">
              Loaded: {platesResult.achievableWeight} {unit}
            </span>
          </div>

          <div className="h-24 flex items-center justify-center px-2 overflow-x-auto">
            {/* Left Sleeve */}
            <div className="flex items-center flex-row-reverse gap-1">
              {sleevePlates.map((p, idx) => (
                <div
                  key={`l-${idx}`}
                  className={`w-4 ${p.heightClass} rounded-sm ${p.colorClass} flex items-center justify-center text-[9px] font-mono font-bold`}
                  title={`${p.plate}${unit}`}
                >
                  <span className="-rotate-90 whitespace-nowrap">{p.plate}</span>
                </div>
              ))}
            </div>
            <div className="w-3 h-7 bg-zinc-400 rounded-sm mx-0.5" />
            <div className="w-24 sm:w-36 h-2.5 bg-zinc-500 rounded-full" />
            <div className="w-3 h-7 bg-zinc-400 rounded-sm mx-0.5" />
            {/* Right Sleeve */}
            <div className="flex items-center gap-1">
              {sleevePlates.map((p, idx) => (
                <div
                  key={`r-${idx}`}
                  className={`w-4 ${p.heightClass} rounded-sm ${p.colorClass} flex items-center justify-center text-[9px] font-mono font-bold`}
                  title={`${p.plate}${unit}`}
                >
                  <span className="-rotate-90 whitespace-nowrap">{p.plate}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs font-mono text-zinc-300 text-center">
            {platesResult.platesPerSide.length === 0
              ? `Empty barbell only (${platesResult.barWeight}${unit})`
              : `Each side: ${platesResult.platesPerSide
                  .map((p) => `${p.countPerSide} × ${p.plate}${unit}`)
                  .join(' + ')}`}
            {platesResult.remainder > 0 && (
              <span className="text-amber-400 ml-2">
                (±{platesResult.remainder}{unit} fractional micro-plate)
              </span>
            )}
          </div>
        </div>

        {/* Warm-up Ramp + 1RM Training Zones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-zinc-950 border border-white/10 p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-[#00FF88] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              Warm-Up Ramp Sets
            </h3>
            <div className="space-y-1.5">
              {warmupRamp.map((set, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0"
                >
                  <span className="text-zinc-300">{set.stage}</span>
                  <span className="font-mono text-white">
                    {set.weight}{unit} × {set.reps} reps
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-950 border border-white/10 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#A855F7]">Training Intensity Zones</h3>
              <span className="text-xs font-mono text-zinc-400">
                Est. 1RM: <strong className="text-white">{estimated1RM}{unit}</strong>
              </span>
            </div>
            <div className="space-y-1.5">
              {zones.map((z) => (
                <div
                  key={z.zone}
                  className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0 gap-2"
                >
                  <span className="text-zinc-300 truncate">{z.zone}</span>
                  <span className="font-mono text-zinc-400 shrink-0">{z.weightRange}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-700"
          >
            Close
          </button>
          {onApplyWeight && (
            <button
              type="button"
              onClick={() => {
                onApplyWeight(platesResult.achievableWeight);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-semibold hover:bg-[#00FF88]/90"
            >
              Use {platesResult.achievableWeight} {unit}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
