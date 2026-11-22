import React, { useEffect, useState } from 'react';
import { Dumbbell, ExternalLink, Film, ShieldCheck } from 'lucide-react';
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

  if (exercise.isCustom) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-white/10 p-5 flex flex-col justify-between gap-4 min-h-[210px]">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-300">
            <Film className="w-4 h-4 text-[#A855F7]" />
            Custom Exercise Media
          </span>
          <span className="font-mono text-zinc-500">{exercise.equipment}</span>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-white">No video or image uploaded yet</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Follow your custom coaching cues and execution steps below during training.
          </p>
        </div>
        <div className="text-[11px] text-zinc-500 pt-2 border-t border-white/10">
          Target: {exercise.muscleGroup} · {exercise.difficulty} · {exercise.exerciseType}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-white/10 p-5 flex flex-col justify-between gap-4 min-h-[210px]">
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
          <ShieldCheck className="w-4 h-4 text-[#00FF88]" />
          MuscleWiki HD Movement Guide
        </span>
        <span className="font-mono text-[#A855F7]">{exercise.equipment}</span>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-200">
            <Dumbbell className="w-3.5 h-3.5 text-[#00FF88]" />
            Primary: {exercise.muscleGroup}
          </span>
          {exercise.secondaryMuscles.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-400">
              Secondary: {exercise.secondaryMuscles.join(', ')}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-400">
            {exercise.difficulty} · {exercise.exerciseType}
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Open the exact MuscleWiki page for <span className="text-zinc-200 font-medium">{exercise.name}</span> to watch multi-angle male &amp; female form demonstration videos.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
        <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[260px]">
          /exercise/{exercise.muscleWikiSlug}
        </span>

        {!hideExternalLink && (
          <a
            href={exercise.muscleWikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-xs font-semibold hover:bg-[#00FF88]/90 transition-colors whitespace-nowrap"
          >
            Watch Video on MuscleWiki
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};
