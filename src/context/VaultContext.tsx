import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  DEFAULT_WEEKLY_PLANS,
  EXERCISE_LIBRARY,
} from '../data/exercises';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../firebase';
import {
  DayPlan,
  Exercise,
  GeneratorStyle,
  PlannedExercise,
  UserProfile,
  Weekday,
  WEEKDAYS,
  WeightUnit,
  WorkoutLog,
} from '../types/workout';
import { generateWeeklySplit } from '../utils/generator';
import {
  sanitizeCustomExerciseForFirestore,
  sanitizeDayPlanForFirestore,
  sanitizeUserProfileForFirestore,
  sanitizeWorkoutLogForFirestore,
} from '../utils/validation';
import {
  computeGamification,
  computeTrainingStreak,
  getLocalDateISO,
  hasLoggedWorkoutOnDate,
} from '../utils/workoutMath';

const LEGACY_KEYS = [
  'workout_vault_plans_v1',
  'workout_vault_logs_v1',
  'workout_vault_custom_exercises_v1',
  'workout_vault_profile_v1',
];

function userStorageKey(uid: string, suffix: string): string {
  return `workout_vault_v2_${uid}_${suffix}`;
}

function createEmptyProfile(firebaseUser?: User | null): UserProfile {
  return {
    uid: firebaseUser?.uid || '',
    displayName: firebaseUser?.displayName || 'Vault Athlete',
    email: firebaseUser?.email || '',
    weightUnit: 'kg' as WeightUnit,
    goal: 'Hypertrophy & Progressive Strength',
    xp: 0,
    streakDays: 0,
    unlockedAchievements: [],
  };
}

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'this domain';

  if (code === 'auth/unauthorized-domain') {
    return `Domain "${hostname}" is not authorized for Firebase sign-in. Add "${hostname}" in Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the Google sign-in popup. Redirect sign-in is available below.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in popup was closed before completion. Try again or use Redirect Sign-In.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting Google sign-in. Check your connection and retry.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to sign in with Google right now.';
}

interface VaultContextValue {
  user: User | null;
  authReady: boolean;
  authError: string | null;
  clearAuthError: () => void;
  syncStatus: 'local' | 'syncing' | 'synced';
  profile: UserProfile;
  plans: Record<Weekday, DayPlan>;
  logs: WorkoutLog[];
  allExercises: Exercise[];
  customExercises: Exercise[];
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  updateDayPlan: (day: Weekday, updated: DayPlan) => Promise<void>;
  moveExerciseBetweenDays: (
    fromDay: Weekday,
    toDay: Weekday,
    plannedId: string
  ) => Promise<void>;
  applyGeneratorSplit: (style: GeneratorStyle) => Promise<void>;
  applyPlansBatch: (nextPlans: Record<Weekday, DayPlan>) => Promise<void>;
  addCustomExercise: (exercise: Exercise) => Promise<void>;
  deleteCustomExercise: (id: string) => Promise<void>;
  saveWorkoutLog: (log: WorkoutLog) => Promise<void>;
  deleteWorkoutLog: (id: string) => Promise<void>;
  resetTodaysWorkout: (dateISO?: string) => Promise<void>;
  activeTrackerDay: Weekday | null;
  setActiveTrackerDay: (day: Weekday | null) => void;
  resetDemoData: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

function loadUserJson<T>(uid: string, suffix: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(userStorageKey(uid, suffix));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced'>('local');

  const [plans, setPlans] = useState<Record<Weekday, DayPlan>>(DEFAULT_WEEKLY_PLANS);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() => createEmptyProfile(null));
  const [activeTrackerDay, setActiveTrackerDay] = useState<Weekday | null>(null);

  // Clear legacy seeded localStorage keys once so old fake data never lingers
  useEffect(() => {
    try {
      for (const key of LEGACY_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  // Complete any pending redirect auth flow (used on Vercel / mobile browsers)
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      setAuthError(formatFirebaseAuthError(err));
    });
  }, []);

  // Persist user-scoped local cache only while authenticated
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(userStorageKey(user.uid, 'plans'), JSON.stringify(plans));
    } catch {
      // Ignore storage quota errors
    }
  }, [plans, user]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(userStorageKey(user.uid, 'logs'), JSON.stringify(logs));
    } catch {
      // Ignore storage quota errors
    }
  }, [logs, user]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(userStorageKey(user.uid, 'custom'), JSON.stringify(customExercises));
    } catch {
      // Ignore storage quota errors
    }
  }, [customExercises, user]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(userStorageKey(user.uid, 'profile'), JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile, user]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setSyncStatus('local');
        setPlans(DEFAULT_WEEKLY_PLANS);
        setLogs([]);
        setCustomExercises([]);
        setProfile(createEmptyProfile(null));
      } else {
        setAuthError(null);
        setPlans(loadUserJson(firebaseUser.uid, 'plans', DEFAULT_WEEKLY_PLANS));
        setLogs(loadUserJson(firebaseUser.uid, 'logs', []));
        setCustomExercises(loadUserJson(firebaseUser.uid, 'custom', []));
        setProfile(loadUserJson(firebaseUser.uid, 'profile', createEmptyProfile(firebaseUser)));
      }
    });
    return () => unsub();
  }, []);

  // Bootstrap & listen to Firestore collections when signed in
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    setSyncStatus('syncing');

    const bootstrapUser = async () => {
      const userRef = doc(db, 'users', user.uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const initialProfile = createEmptyProfile(user);
          const clean = sanitizeUserProfileForFirestore(initialProfile);
          await setDoc(userRef, {
            ...clean,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Seed starter weekly schedule template (zero fake workout logs)
          await Promise.all(
            WEEKDAYS.map((day) => {
              const planRef = doc(db, 'users', user.uid, 'plans', day);
              const cleanPlan = sanitizeDayPlanForFirestore(DEFAULT_WEEKLY_PLANS[day], user.uid);
              return setDoc(planRef, {
                ...cleanPlan,
                updatedAt: serverTimestamp(),
              });
            })
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    };

    void bootstrapUser();

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          setProfile({
            uid: String(d.uid || user.uid),
            displayName: String(d.displayName || user.displayName || 'Vault Athlete'),
            email: String(d.email || user.email || ''),
            weightUnit: d.weightUnit === 'lbs' ? 'lbs' : 'kg',
            goal: String(d.goal || 'Hypertrophy & Progressive Strength'),
            xp: Number(d.xp || 0),
            streakDays: Number(d.streakDays || 0),
            unlockedAchievements: Array.isArray(d.unlockedAchievements)
              ? d.unlockedAchievements.map(String)
              : [],
          });
        }
        setSyncStatus('synced');
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    );

    const unsubPlans = onSnapshot(
      query(collection(db, 'users', user.uid, 'plans'), where('userId', '==', user.uid)),
      (snap) => {
        if (cancelled || snap.empty) return;
        setPlans((prev) => {
          const next = { ...prev };
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            const day = d.day as Weekday;
            if (WEEKDAYS.includes(day)) {
              next[day] = {
                day,
                category: d.category,
                title: String(d.title || ''),
                exercises: Array.isArray(d.exercises) ? (d.exercises as PlannedExercise[]) : [],
              };
            }
          });
          return next;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/plans`);
      }
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'users', user.uid, 'logs'), where('userId', '==', user.uid)),
      (snap) => {
        if (cancelled) return;
        const cloudLogs: WorkoutLog[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const createdAtIso =
            d.createdAt && typeof d.createdAt.toDate === 'function'
              ? d.createdAt.toDate().toISOString()
              : typeof d.createdAt === 'string'
              ? d.createdAt
              : undefined;
          cloudLogs.push({
            id: docSnap.id,
            date: String(d.date),
            day: String(d.day),
            category: String(d.category),
            title: String(d.title),
            durationSeconds: Number(d.durationSeconds || 0),
            totalVolumeKg: Number(d.totalVolumeKg || 0),
            xpEarned: Number(d.xpEarned || 0),
            musclesTrained: Array.isArray(d.musclesTrained) ? d.musclesTrained : [],
            entries: Array.isArray(d.entries) ? d.entries : [],
            prsHit: Array.isArray(d.prsHit) ? d.prsHit : [],
            createdAt: createdAtIso,
          });
        });
        cloudLogs.sort((a, b) => b.date.localeCompare(a.date));
        setLogs(cloudLogs);

        // If account has zero real logs, reconcile any legacy stale gamification counters
        if (cloudLogs.length === 0) {
          setProfile((prev) => {
            if (prev.xp === 0 && prev.streakDays === 0 && prev.unlockedAchievements.length === 0) {
              return prev;
            }
            return { ...prev, xp: 0, streakDays: 0, unlockedAchievements: [] };
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/logs`);
      }
    );

    const unsubCustom = onSnapshot(
      query(collection(db, 'users', user.uid, 'customExercises'), where('userId', '==', user.uid)),
      (snap) => {
        if (cancelled) return;
        const list: Exercise[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            name: String(d.name),
            muscleGroup: d.muscleGroup,
            secondaryMuscles: Array.isArray(d.secondaryMuscles) ? d.secondaryMuscles : [],
            equipment: d.equipment,
            difficulty: d.difficulty,
            exerciseType: d.exerciseType,
            instructions: Array.isArray(d.instructions) ? d.instructions : [],
            muscleWikiSlug: '',
            muscleWikiUrl: 'https://musclewiki.com',
            isCustom: true,
            notes: String(d.notes || ''),
            coachingCues: String(d.coachingCues || ''),
            mediaType: d.mediaType || 'none',
            mediaUrl: String(d.mediaUrl || ''),
          });
        });
        setCustomExercises(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/customExercises`);
      }
    );

    return () => {
      cancelled = true;
      unsubProfile();
      unsubPlans();
      unsubLogs();
      unsubCustom();
    };
  }, [authReady, user]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      // Fall back to redirect when popups are blocked or unsupported (e.g. mobile/Vercel browsers)
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          const msg = formatFirebaseAuthError(redirectErr);
          setAuthError(msg);
          throw new Error(msg);
        }
      }
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithGoogleRedirect = async () => {
    setAuthError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const updateProfile = async (patch: Partial<UserProfile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);

    if (user) {
      setSyncStatus('syncing');
      const path = `users/${user.uid}`;
      try {
        const userRef = doc(db, 'users', user.uid);
        const clean = sanitizeUserProfileForFirestore({
          ...next,
          uid: user.uid,
          email: user.email || next.email,
        });
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            ...clean,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userRef, {
            displayName: clean.displayName,
            weightUnit: clean.weightUnit,
            goal: clean.goal,
            xp: clean.xp,
            streakDays: clean.streakDays,
            unlockedAchievements: clean.unlockedAchievements,
            updatedAt: serverTimestamp(),
          });
        }
        setSyncStatus('synced');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  };

  const updateDayPlan = async (day: Weekday, updated: DayPlan) => {
    setPlans((prev) => ({ ...prev, [day]: updated }));

    if (user) {
      setSyncStatus('syncing');
      const path = `users/${user.uid}/plans/${day}`;
      try {
        const clean = sanitizeDayPlanForFirestore(updated, user.uid);
        await setDoc(doc(db, 'users', user.uid, 'plans', day), {
          ...clean,
          updatedAt: serverTimestamp(),
        });
        setSyncStatus('synced');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }
  };

  const moveExerciseBetweenDays = async (
    fromDay: Weekday,
    toDay: Weekday,
    plannedId: string
  ) => {
    if (fromDay === toDay) return;
    const sourcePlan = plans[fromDay];
    const targetPlan = plans[toDay];
    const item = sourcePlan.exercises.find((e) => e.id === plannedId);
    if (!item) return;

    const updatedSource: DayPlan = {
      ...sourcePlan,
      exercises: sourcePlan.exercises.filter((e) => e.id !== plannedId),
    };
    const updatedTarget: DayPlan = {
      ...targetPlan,
      category: targetPlan.category === 'Rest Day' ? 'Full Body' : targetPlan.category,
      title: targetPlan.category === 'Rest Day' ? 'Custom Training Day' : targetPlan.title,
      exercises: [...targetPlan.exercises, item],
    };

    setPlans((prev) => ({
      ...prev,
      [fromDay]: updatedSource,
      [toDay]: updatedTarget,
    }));

    if (user) {
      setSyncStatus('syncing');
      await Promise.all([
        updateDayPlan(fromDay, updatedSource),
        updateDayPlan(toDay, updatedTarget),
      ]);
    }
  };

  const applyGeneratorSplit = async (style: GeneratorStyle) => {
    const generated = generateWeeklySplit(style);
    setPlans(generated);

    if (user) {
      setSyncStatus('syncing');
      await Promise.all(WEEKDAYS.map((day) => updateDayPlan(day, generated[day])));
      setSyncStatus('synced');
    }
  };

  const applyPlansBatch = async (nextPlans: Record<Weekday, DayPlan>) => {
    setPlans(nextPlans);

    if (user) {
      setSyncStatus('syncing');
      await Promise.all(WEEKDAYS.map((day) => updateDayPlan(day, nextPlans[day])));
      setSyncStatus('synced');
    }
  };

  const addCustomExercise = async (exercise: Exercise) => {
    setCustomExercises((prev) => [exercise, ...prev]);

    if (user) {
      setSyncStatus('syncing');
      const path = `users/${user.uid}/customExercises/${exercise.id}`;
      try {
        const clean = sanitizeCustomExerciseForFirestore(exercise, user.uid);
        await setDoc(doc(db, 'users', user.uid, 'customExercises', exercise.id), {
          ...clean,
          createdAt: serverTimestamp(),
        });
        setSyncStatus('synced');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const deleteCustomExercise = async (id: string) => {
    setCustomExercises((prev) => prev.filter((e) => e.id !== id));

    if (user) {
      const path = `users/${user.uid}/customExercises/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'customExercises', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const recomputeProfileForLogs = async (nextLogs: WorkoutLog[]) => {
    const gamification = computeGamification(nextLogs);
    const unlockedIds = gamification.achievements
      .filter((a) => a.unlocked)
      .map((a) => a.id);
    const nextStreak = computeTrainingStreak(nextLogs);

    setProfile((prev) => ({
      ...prev,
      xp: gamification.xp,
      streakDays: nextStreak,
      unlockedAchievements: unlockedIds,
    }));

    if (user) {
      await updateProfile({
        xp: gamification.xp,
        streakDays: nextStreak,
        unlockedAchievements: unlockedIds,
      });
    }
  };

  const saveWorkoutLog = async (log: WorkoutLog) => {
    if (hasLoggedWorkoutOnDate(logs, log.date)) {
      throw new Error(
        `Only 1 workout can be logged per day (${log.date} is already logged). Reset today's workout first to re-log.`
      );
    }

    const logWithTimestamp: WorkoutLog = {
      ...log,
      createdAt: log.createdAt || new Date().toISOString(),
    };

    const nextLogs = [logWithTimestamp, ...logs];
    setLogs(nextLogs);

    const gamification = computeGamification(nextLogs);
    const unlockedIds = gamification.achievements
      .filter((a) => a.unlocked)
      .map((a) => a.id);
    const nextStreak = computeTrainingStreak(nextLogs);

    setProfile((prev) => ({
      ...prev,
      xp: gamification.xp,
      streakDays: nextStreak,
      unlockedAchievements: unlockedIds,
    }));

    if (user) {
      setSyncStatus('syncing');
      const path = `users/${user.uid}/logs/${logWithTimestamp.id}`;
      try {
        const cleanLog = sanitizeWorkoutLogForFirestore(logWithTimestamp, user.uid);
        await setDoc(doc(db, 'users', user.uid, 'logs', logWithTimestamp.id), {
          ...cleanLog,
          createdAt: serverTimestamp(),
        });
        await updateProfile({
          xp: gamification.xp,
          streakDays: nextStreak,
          unlockedAchievements: unlockedIds,
        });
        setSyncStatus('synced');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const deleteWorkoutLog = async (id: string) => {
    const nextLogs = logs.filter((l) => l.id !== id);
    setLogs(nextLogs);

    if (user) {
      setSyncStatus('syncing');
      const path = `users/${user.uid}/logs/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'logs', id));
        await recomputeProfileForLogs(nextLogs);
        setSyncStatus('synced');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    } else {
      await recomputeProfileForLogs(nextLogs);
    }
  };

  const resetTodaysWorkout = async (dateISO: string = getLocalDateISO()) => {
    const matching = logs.filter((l) => l.date === dateISO);
    if (matching.length === 0) return;
    const nextLogs = logs.filter((l) => l.date !== dateISO);
    setLogs(nextLogs);

    if (user) {
      setSyncStatus('syncing');
      try {
        await Promise.all(
          matching.map((m) => deleteDoc(doc(db, 'users', user.uid, 'logs', m.id)))
        );
        await recomputeProfileForLogs(nextLogs);
        setSyncStatus('synced');
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `users/${user.uid}/logs/${matching[0].id}`
        );
      }
    } else {
      await recomputeProfileForLogs(nextLogs);
    }
  };

  // Resets weekly schedule template without injecting fake workout logs
  const resetDemoData = async () => {
    setPlans(DEFAULT_WEEKLY_PLANS);
    if (user) {
      await Promise.all(WEEKDAYS.map((d) => updateDayPlan(d, DEFAULT_WEEKLY_PLANS[d])));
    }
  };

  const allExercises = useMemo(
    () => [...customExercises, ...EXERCISE_LIBRARY],
    [customExercises]
  );

  return (
    <VaultContext.Provider
      value={{
        user,
        authReady,
        authError,
        clearAuthError: () => setAuthError(null),
        syncStatus,
        profile,
        plans,
        logs,
        allExercises,
        customExercises,
        signInWithGoogle,
        signInWithGoogleRedirect,
        signOutUser,
        updateProfile,
        updateDayPlan,
        moveExerciseBetweenDays,
        applyGeneratorSplit,
        applyPlansBatch,
        addCustomExercise,
        deleteCustomExercise,
        saveWorkoutLog,
        deleteWorkoutLog,
        resetTodaysWorkout,
        activeTrackerDay,
        setActiveTrackerDay,
        resetDemoData,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
}
