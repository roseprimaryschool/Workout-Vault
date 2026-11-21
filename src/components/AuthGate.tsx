import React, { useState } from 'react';
import { ArrowRight, CalendarDays, Dumbbell, Loader2, ShieldAlert, TrendingUp } from 'lucide-react';
import { useVault } from '../context/VaultContext';

export const AuthGate: React.FC = () => {
  const { signInWithGoogle, signInWithGoogleRedirect, authError } = useVault();
  const [signingIn, setSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || authError;

  const handlePopupSignIn = async () => {
    setSigningIn(true);
    setLocalError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleRedirectSignIn = async () => {
    setSigningIn(true);
    setLocalError(null);
    try {
      await signInWithGoogleRedirect();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to start redirect sign-in.');
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Atmospheric Banner */}
        <div className="relative h-40 w-full bg-zinc-950">
          <img
            src="/src/assets/images/hero_gym_banner_1795253172585.jpg"
            alt="Workout Vault training studio"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <span className="text-xs font-mono text-[#00FF88] tracking-wide uppercase">
              Cloud-Synced Training OS
            </span>
            <h1 className="text-2xl font-bold font-display tracking-tight text-white mt-0.5">
              Workout Vault
            </h1>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Sign in with your Google account to save your Monday–Sunday training split, track real sessions, and sync progress across devices.
          </p>

          {/* Concise Capability Highlights */}
          <div className="space-y-3 text-xs text-zinc-300">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-4 h-4 text-[#00FF88] shrink-0" />
              <span>Drag-and-drop weekly workout planner with auto-save</span>
            </div>
            <div className="flex items-center gap-3">
              <Dumbbell className="w-4 h-4 text-[#A855F7] shrink-0" />
              <span>MuscleWiki exercise library, custom movements &amp; recovery heatmap</span>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-[#00FF88] shrink-0" />
              <span>Live set tracker, progressive overload &amp; AI workout coach</span>
            </div>
          </div>

          {displayError && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-200 flex items-start gap-2.5 leading-relaxed"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <button
              type="button"
              disabled={signingIn}
              onClick={() => void handlePopupSignIn()}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-bold hover:bg-[#00FF88]/90 disabled:opacity-60 transition-colors"
            >
              {signingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {signingIn ? 'Signing in...' : 'Continue with Google'}
            </button>

            <button
              type="button"
              disabled={signingIn}
              onClick={() => void handleRedirectSignIn()}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white hover:border-white/25 disabled:opacity-50 transition-colors"
            >
              Having popup issues? Use Redirect Sign-In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
