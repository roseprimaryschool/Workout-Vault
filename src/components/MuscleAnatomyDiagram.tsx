import React from 'react';
import { MuscleGroup, MuscleRecoveryStatus } from '../types/workout';

interface ExerciseModeProps {
  mode: 'exercise';
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  compact?: boolean;
}

interface RecoveryModeProps {
  mode: 'recovery';
  recoveryStatuses: MuscleRecoveryStatus[];
  selectedMuscle?: MuscleGroup | null;
  onSelectMuscle?: (muscle: MuscleGroup) => void;
}

type MuscleAnatomyDiagramProps = ExerciseModeProps | RecoveryModeProps;

export const MuscleAnatomyDiagram: React.FC<MuscleAnatomyDiagramProps> = (props) => {
  const getMuscleFill = (muscle: MuscleGroup): string => {
    if (props.mode === 'exercise') {
      if (props.primaryMuscle === muscle) return '#00FF88';
      if (props.secondaryMuscles?.includes(muscle)) return '#A855F7';
      return '#27272A';
    }
    const found = props.recoveryStatuses.find((m) => m.muscle === muscle);
    if (!found) return '#27272A';
    if (found.status === 'Green') return '#00FF88';
    if (found.status === 'Yellow') return '#F59E0B';
    return '#EF4444';
  };

  const getMuscleOpacity = (muscle: MuscleGroup): number => {
    if (props.mode === 'exercise') {
      if (props.primaryMuscle === muscle) return 0.95;
      if (props.secondaryMuscles?.includes(muscle)) return 0.72;
      return 0.45;
    }
    if (props.selectedMuscle && props.selectedMuscle === muscle) return 1;
    return 0.85;
  };

  const handleClick = (muscle: MuscleGroup) => {
    if (props.mode === 'recovery' && props.onSelectMuscle) {
      props.onSelectMuscle(muscle);
    }
  };

  const isCompact = props.mode === 'exercise' && props.compact;

  const clickableClass =
    props.mode === 'recovery'
      ? 'cursor-pointer transition-opacity hover:opacity-100'
      : '';

  return (
    <div
      className={`flex items-center justify-center gap-3 ${isCompact ? 'w-20 h-16' : 'w-full'}`}
      aria-label="Muscle anatomy diagram"
    >
      {/* Anterior View */}
      <svg
        viewBox="0 0 120 220"
        className={isCompact ? 'h-16 w-auto' : 'h-56 w-auto'}
        role="img"
        aria-label="Anterior muscle anatomy"
      >
        {/* Silhouette Head & Neck */}
        <circle cx="60" cy="20" r="11" fill="#18181B" stroke="#3F3F46" strokeWidth="1.2" />
        <rect x="54" y="31" width="12" height="8" rx="3" fill="#18181B" stroke="#3F3F46" strokeWidth="1" />

        {/* Shoulders (Delts) */}
        <path
          d="M36 42 C28 43 24 51 25 60 L35 58 Z"
          fill={getMuscleFill('Shoulders')}
          fillOpacity={getMuscleOpacity('Shoulders')}
          className={clickableClass}
          onClick={() => handleClick('Shoulders')}
        />
        <path
          d="M84 42 C92 43 96 51 95 60 L85 58 Z"
          fill={getMuscleFill('Shoulders')}
          fillOpacity={getMuscleOpacity('Shoulders')}
          className={clickableClass}
          onClick={() => handleClick('Shoulders')}
        />

        {/* Chest (Pectorals) */}
        <path
          d="M37 41 L59 42 L59 64 C49 65 40 62 36 56 Z"
          fill={getMuscleFill('Chest')}
          fillOpacity={getMuscleOpacity('Chest')}
          className={clickableClass}
          onClick={() => handleClick('Chest')}
        />
        <path
          d="M83 41 L61 42 L61 64 C71 65 80 62 84 56 Z"
          fill={getMuscleFill('Chest')}
          fillOpacity={getMuscleOpacity('Chest')}
          className={clickableClass}
          onClick={() => handleClick('Chest')}
        />

        {/* Biceps */}
        <rect
          x="23"
          y="61"
          width="9"
          height="24"
          rx="4"
          fill={getMuscleFill('Biceps')}
          fillOpacity={getMuscleOpacity('Biceps')}
          className={clickableClass}
          onClick={() => handleClick('Biceps')}
        />
        <rect
          x="88"
          y="61"
          width="9"
          height="24"
          rx="4"
          fill={getMuscleFill('Biceps')}
          fillOpacity={getMuscleOpacity('Biceps')}
          className={clickableClass}
          onClick={() => handleClick('Biceps')}
        />

        {/* Forearms */}
        <rect
          x="20"
          y="87"
          width="8"
          height="26"
          rx="3.5"
          fill={getMuscleFill('Forearms')}
          fillOpacity={getMuscleOpacity('Forearms')}
          className={clickableClass}
          onClick={() => handleClick('Forearms')}
        />
        <rect
          x="92"
          y="87"
          width="8"
          height="26"
          rx="3.5"
          fill={getMuscleFill('Forearms')}
          fillOpacity={getMuscleOpacity('Forearms')}
          className={clickableClass}
          onClick={() => handleClick('Forearms')}
        />

        {/* Core (Abdominals & Obliques) */}
        <rect
          x="46"
          y="66"
          width="28"
          height="38"
          rx="6"
          fill={getMuscleFill('Core')}
          fillOpacity={getMuscleOpacity('Core')}
          className={clickableClass}
          onClick={() => handleClick('Core')}
        />

        {/* Quads */}
        <path
          d="M40 108 L58 108 L56 156 L42 156 Z"
          fill={getMuscleFill('Quads')}
          fillOpacity={getMuscleOpacity('Quads')}
          className={clickableClass}
          onClick={() => handleClick('Quads')}
        />
        <path
          d="M62 108 L80 108 L78 156 L64 156 Z"
          fill={getMuscleFill('Quads')}
          fillOpacity={getMuscleOpacity('Quads')}
          className={clickableClass}
          onClick={() => handleClick('Quads')}
        />

        {/* Anterior Shins / Calves accent */}
        <rect
          x="43"
          y="162"
          width="11"
          height="36"
          rx="4"
          fill={getMuscleFill('Calves')}
          fillOpacity={getMuscleOpacity('Calves') * 0.7}
          className={clickableClass}
          onClick={() => handleClick('Calves')}
        />
        <rect
          x="66"
          y="162"
          width="11"
          height="36"
          rx="4"
          fill={getMuscleFill('Calves')}
          fillOpacity={getMuscleOpacity('Calves') * 0.7}
          className={clickableClass}
          onClick={() => handleClick('Calves')}
        />

        {!isCompact && (
          <text x="60" y="214" textAnchor="middle" fill="#71717A" fontSize="9" fontFamily="JetBrains Mono">
            FRONT
          </text>
        )}
      </svg>

      {/* Posterior View */}
      <svg
        viewBox="0 0 120 220"
        className={isCompact ? 'h-16 w-auto' : 'h-56 w-auto'}
        role="img"
        aria-label="Posterior muscle anatomy"
      >
        <circle cx="60" cy="20" r="11" fill="#18181B" stroke="#3F3F46" strokeWidth="1.2" />
        <rect x="54" y="31" width="12" height="8" rx="3" fill="#18181B" stroke="#3F3F46" strokeWidth="1" />

        {/* Rear Delts */}
        <path
          d="M36 42 C28 43 24 51 25 60 L35 58 Z"
          fill={getMuscleFill('Shoulders')}
          fillOpacity={getMuscleOpacity('Shoulders')}
          className={clickableClass}
          onClick={() => handleClick('Shoulders')}
        />
        <path
          d="M84 42 C92 43 96 51 95 60 L85 58 Z"
          fill={getMuscleFill('Shoulders')}
          fillOpacity={getMuscleOpacity('Shoulders')}
          className={clickableClass}
          onClick={() => handleClick('Shoulders')}
        />

        {/* Back (Traps & Lats) */}
        <path
          d="M37 40 L83 40 L76 86 L60 92 L44 86 Z"
          fill={getMuscleFill('Back')}
          fillOpacity={getMuscleOpacity('Back')}
          className={clickableClass}
          onClick={() => handleClick('Back')}
        />

        {/* Triceps */}
        <rect
          x="23"
          y="61"
          width="9"
          height="24"
          rx="4"
          fill={getMuscleFill('Triceps')}
          fillOpacity={getMuscleOpacity('Triceps')}
          className={clickableClass}
          onClick={() => handleClick('Triceps')}
        />
        <rect
          x="88"
          y="61"
          width="9"
          height="24"
          rx="4"
          fill={getMuscleFill('Triceps')}
          fillOpacity={getMuscleOpacity('Triceps')}
          className={clickableClass}
          onClick={() => handleClick('Triceps')}
        />

        {/* Forearms */}
        <rect
          x="20"
          y="87"
          width="8"
          height="26"
          rx="3.5"
          fill={getMuscleFill('Forearms')}
          fillOpacity={getMuscleOpacity('Forearms')}
          className={clickableClass}
          onClick={() => handleClick('Forearms')}
        />
        <rect
          x="92"
          y="87"
          width="8"
          height="26"
          rx="3.5"
          fill={getMuscleFill('Forearms')}
          fillOpacity={getMuscleOpacity('Forearms')}
          className={clickableClass}
          onClick={() => handleClick('Forearms')}
        />

        {/* Glutes */}
        <path
          d="M41 94 L59 94 L59 117 L40 115 Z"
          fill={getMuscleFill('Glutes')}
          fillOpacity={getMuscleOpacity('Glutes')}
          className={clickableClass}
          onClick={() => handleClick('Glutes')}
        />
        <path
          d="M61 94 L79 94 L80 115 L61 117 Z"
          fill={getMuscleFill('Glutes')}
          fillOpacity={getMuscleOpacity('Glutes')}
          className={clickableClass}
          onClick={() => handleClick('Glutes')}
        />

        {/* Hamstrings */}
        <path
          d="M41 120 L58 120 L56 156 L42 156 Z"
          fill={getMuscleFill('Hamstrings')}
          fillOpacity={getMuscleOpacity('Hamstrings')}
          className={clickableClass}
          onClick={() => handleClick('Hamstrings')}
        />
        <path
          d="M62 120 L79 120 L78 156 L64 156 Z"
          fill={getMuscleFill('Hamstrings')}
          fillOpacity={getMuscleOpacity('Hamstrings')}
          className={clickableClass}
          onClick={() => handleClick('Hamstrings')}
        />

        {/* Calves */}
        <path
          d="M42 161 L56 161 L54 198 L44 198 Z"
          fill={getMuscleFill('Calves')}
          fillOpacity={getMuscleOpacity('Calves')}
          className={clickableClass}
          onClick={() => handleClick('Calves')}
        />
        <path
          d="M64 161 L78 161 L76 198 L66 198 Z"
          fill={getMuscleFill('Calves')}
          fillOpacity={getMuscleOpacity('Calves')}
          className={clickableClass}
          onClick={() => handleClick('Calves')}
        />

        {!isCompact && (
          <text x="60" y="214" textAnchor="middle" fill="#71717A" fontSize="9" fontFamily="JetBrains Mono">
            BACK
          </text>
        )}
      </svg>
    </div>
  );
};
