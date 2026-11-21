import React, { useEffect, useState } from 'react';
import { ExternalLink, Pause, Play } from 'lucide-react';
import { Exercise } from '../types/workout';
import { loadLocalMediaObjectUrl } from '../utils/mediaStorage';
import { sanitizeSafeUrl } from '../utils/validation';

interface ExerciseDemoPlayerProps {
  exercise: Exercise;
  hideExternalLink?: boolean;
}

export const ExerciseDemoPlayer: React.FC<ExerciseDemoPlayerProps> = ({
  exercise,
  hideExternalLink = false,
}) => {
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (exercise.mediaLocalId) {
      void loadLocalMediaObjectUrl(exercise.mediaLocalId).then((url) => {
        if (active && url) {
          createdUrl = url;
          setLocalMediaUrl(url);
        }
      });
    } else {
      setLocalMediaUrl(null);
    }

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [exercise.mediaLocalId, exercise.id]);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setPhase((p) => (p + 0.06) % (Math.PI * 2));
    }, 40);
    return () => window.clearInterval(interval);
  }, [playing]);

  const safeRemoteUrl = sanitizeSafeUrl(exercise.mediaUrl || '');
  const resolvedMedia = localMediaUrl || safeRemoteUrl;

  if (resolvedMedia && exercise.mediaType === 'video') {
    return (
      <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-white/10 aspect-video">
        <video
          src={resolvedMedia}
          controls
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (resolvedMedia && exercise.mediaType === 'image') {
    return (
      <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-white/10 aspect-video">
        <img
          src={resolvedMedia}
          alt={exercise.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Animated biomechanical MuscleWiki movement preview with MuscleWiki link
  const oscillation = (Math.sin(phase) + 1) / 2; // 0..1
  const repPhaseLabel = oscillation > 0.55 ? 'Concentric Drive' : oscillation < 0.2 ? 'Peak Stretch' : 'Controlled Eccentric';

  return (
    <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-white/10 aspect-video flex flex-col justify-between p-4">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>MuscleWiki Movement Guide · {exercise.equipment}</span>
        <span className="font-mono text-[#00FF88]">{repPhaseLabel}</span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 260 120" className="w-full max-w-[260px] h-28" aria-label={`${exercise.name} movement demonstration`}>
          {/* Floor / Bench reference */}
          <line x1="30" y1="104" x2="230" y2="104" stroke="#27272A" strokeWidth="2" />

          {exercise.animationStyle === 'press' && (
            <g>
              {/* Bench */}
              <rect x="65" y="78" width="130" height="8" rx="3" fill="#27272A" />
              <rect x="85" y="86" width="8" height="18" fill="#3F3F46" />
              <rect x="167" y="86" width="8" height="18" fill="#3F3F46" />
              {/* Athlete Torso & Head */}
              <circle cx="80" cy="68" r="7" fill="#52525B" />
              <rect x="88" y="69" width="66" height="9" rx="4" fill="#3F3F46" />
              {/* Moving Bar + Arms */}
              <line
                x1="120"
                y1="71"
                x2="120"
                y2={64 - oscillation * 34}
                stroke="#A855F7"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <line
                x1="78"
                y1={64 - oscillation * 34}
                x2="162"
                y2={64 - oscillation * 34}
                stroke="#00FF88"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <rect x="74" y={54 - oscillation * 34} width="6" height="20" rx="2" fill="#E4E4E7" />
              <rect x="160" y={54 - oscillation * 34} width="6" height="20" rx="2" fill="#E4E4E7" />
            </g>
          )}

          {exercise.animationStyle === 'squat' && (
            <g>
              {/* Squatting Stick Figure + Barbell */}
              {(() => {
                const hipY = 58 + oscillation * 24;
                const shoulderY = 30 + oscillation * 22;
                return (
                  <>
                    <line x1="115" y1="103" x2="125" y2="78" stroke="#52525B" strokeWidth="4" strokeLinecap="round" />
                    <line x1="125" y1="78" x2="112" y2={hipY} stroke="#00FF88" strokeWidth="4.5" strokeLinecap="round" />
                    <line x1="112" y1={hipY} x2="132" y2={shoulderY} stroke="#A855F7" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="135" cy={shoulderY - 10} r="6.5" fill="#71717A" />
                    {/* Barbell */}
                    <line x1="95" y1={shoulderY + 2} x2="165" y2={shoulderY + 2} stroke="#E4E4E7" strokeWidth="3" />
                    <rect x="92" y={shoulderY - 6} width="5" height="16" rx="1.5" fill="#00FF88" />
                    <rect x="163" y={shoulderY - 6} width="5" height="16" rx="1.5" fill="#00FF88" />
                  </>
                );
              })()}
            </g>
          )}

          {(exercise.animationStyle === 'hinge' || exercise.animationStyle === 'pull') && (
            <g>
              {(() => {
                const lift = oscillation * 28;
                return (
                  <>
                    <line x1="115" y1="103" x2="122" y2="76" stroke="#52525B" strokeWidth="4" strokeLinecap="round" />
                    <line x1="122" y1="76" x2="110" y2="56" stroke="#71717A" strokeWidth="4.5" strokeLinecap="round" />
                    <line
                      x1="110"
                      y1="56"
                      x2={145 - oscillation * 22}
                      y2={48 - lift * 0.45}
                      stroke="#00FF88"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <circle cx={150 - oscillation * 22} cy={40 - lift * 0.45} r="6.5" fill="#71717A" />
                    <line
                      x1={142 - oscillation * 22}
                      y1={48 - lift * 0.45}
                      x2="136"
                      y2={94 - lift}
                      stroke="#A855F7"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <line x1="96" y1={94 - lift} x2="176" y2={94 - lift} stroke="#E4E4E7" strokeWidth="3" />
                    <circle cx="96" cy={94 - lift} r="9" fill="none" stroke="#00FF88" strokeWidth="2.5" />
                    <circle cx="176" cy={94 - lift} r="9" fill="none" stroke="#00FF88" strokeWidth="2.5" />
                  </>
                );
              })()}
            </g>
          )}

          {(exercise.animationStyle === 'curl' ||
            exercise.animationStyle === 'extension' ||
            exercise.animationStyle === 'raise' ||
            exercise.animationStyle === 'core' ||
            exercise.animationStyle === 'cardio') && (
            <g>
              {(() => {
                const angle = -0.3 + oscillation * 1.4;
                const handX = 130 + Math.cos(angle) * 32;
                const handY = 64 - Math.sin(angle) * 32;
                return (
                  <>
                    <circle cx="122" cy="24" r="7" fill="#71717A" />
                    <line x1="122" y1="32" x2="122" y2="74" stroke="#52525B" strokeWidth="6" strokeLinecap="round" />
                    <line x1="122" y1="74" x2="112" y2="103" stroke="#52525B" strokeWidth="4.5" strokeLinecap="round" />
                    <line x1="122" y1="74" x2="134" y2="103" stroke="#52525B" strokeWidth="4.5" strokeLinecap="round" />
                    <line x1="122" y1="40" x2="130" y2="64" stroke="#A855F7" strokeWidth="4" strokeLinecap="round" />
                    <line x1="130" y1="64" x2={handX} y2={handY} stroke="#00FF88" strokeWidth="4" strokeLinecap="round" />
                    <circle cx={handX} cy={handY} r="5.5" fill="#E4E4E7" />
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {playing ? 'Pause Loop' : 'Play Loop'}
        </button>

        {!hideExternalLink && !exercise.isCustom && (
          <a
            href={exercise.muscleWikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00FF88]/15 border border-[#00FF88]/40 text-xs font-semibold text-[#00FF88] hover:bg-[#00FF88]/25 transition-colors whitespace-nowrap"
          >
            View on MuscleWiki
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};
