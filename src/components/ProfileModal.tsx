import React, { useState } from 'react';
import { Cloud, LogIn, LogOut, RotateCcw, X } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { WeightUnit } from '../types/workout';
import { computeGamification } from '../utils/workoutMath';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const {
    user,
    syncStatus,
    profile,
    logs,
    signInWithGoogle,
    signOutUser,
    updateProfile,
    resetDemoData,
  } = useVault();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [goal, setGoal] = useState(profile.goal);
  const [unit, setUnit] = useState<WeightUnit>(profile.weightUnit);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const gamification = computeGamification(logs);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      displayName: displayName.trim() || 'Vault Athlete',
      goal: goal.trim() || 'Strength & Hypertrophy',
      weightUnit: unit,
    });
    setSavedMsg(true);
    window.setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Athlete Profile & Account"
    >
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-white/15 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Atmospheric Banner */}
        <div className="relative h-32 w-full bg-zinc-950">
          <img
            src="/src/assets/images/hero_gym_banner_1795253172585.jpg"
            alt="Workout Vault training studio"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile dialog"
            className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 text-zinc-200 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 -mt-8 relative space-y-5">
          {/* Avatar + Identity */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-3.5">
              <img
                src={user?.photoURL || '/src/assets/images/athlete_avatar_1795253172934.jpg'}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-zinc-900 bg-zinc-800"
              />
              <div>
                <h2 className="text-lg font-bold text-white">{profile.displayName}</h2>
                <p className="text-xs text-zinc-400 font-mono">
                  Level {gamification.level} · {gamification.rank} · {gamification.xp} XP
                </p>
              </div>
            </div>

            <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
              <Cloud className={`w-3.5 h-3.5 ${syncStatus === 'synced' ? 'text-[#00FF88]' : 'text-zinc-500'}`} />
              <span>{user ? 'Cloud Synced' : 'Local Mode'}</span>
            </div>
          </div>

          {/* Google Account Sync Card */}
          <div className="rounded-xl bg-zinc-950 border border-white/10 p-4 space-y-3">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#00FF88]">Signed in with Google</div>
                  <div className="text-xs text-zinc-300 truncate mt-0.5">{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-medium text-zinc-200 hover:text-white shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">Sync Across Devices</div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Sign in with Google to back up plans, workout history, and custom exercises to Firebase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-xs font-semibold hover:bg-[#00FF88]/90 shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Google Sign In
                </button>
              </div>
            )}
            {authError && <p className="text-xs text-rose-400">{authError}</p>}
          </div>

          {/* Profile Preferences Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="prof-name" className="block text-xs text-zinc-400 mb-1">
                Athlete Display Name
              </label>
              <input
                id="prof-name"
                type="text"
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div>
              <label htmlFor="prof-goal" className="block text-xs text-zinc-400 mb-1">
                Primary Training Goal
              </label>
              <input
                id="prof-goal"
                type="text"
                maxLength={120}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div>
              <span className="block text-xs text-zinc-400 mb-1.5">Preferred Weight Unit</span>
              <div className="inline-flex rounded-xl bg-zinc-950 p-1 border border-white/10">
                {(['kg', 'lbs'] as WeightUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                      unit === u ? 'bg-[#00FF88] text-zinc-950' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => void resetDemoData()}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Weekly Template
              </button>

              <div className="flex items-center gap-3">
                {savedMsg && <span className="text-xs text-[#00FF88]">Saved</span>}
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00FF88] text-zinc-950 text-sm font-semibold hover:bg-[#00FF88]/90"
                >
                  Save Profile
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
