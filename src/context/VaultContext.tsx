import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  DEFAULT_WEEKLY_PLANS,
  EXERCISE_LIBRARY,
  createSeedWorkoutLogs,
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
} from '../utils/workoutMath';

const STORAGE_KEYS = {
  PLANS: 'workout_vault_plans_v1',
  LOGS: 'workout_vault_logs_v1',
  CUSTOM: 'workout_vault_custom_exercises_v1',
  PROFILE: 'workout_vault_profile_v1',
};

interface VaultContextValue {
  user: User | null;
  authReady: boolean;
  syncStatus: 'local' | 'syncing' | 'synced';
  profile: UserProfile;
  plans: Record<Weekday, DayPlan>;
  logs: WorkoutLog[];
  allExercises: Exercise[];
  customExercises: Exercise[];
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  updateDayPlan: (day: Weekday, updated: DayPlan) => Promise<void>;
  moveExerciseBetweenDays: (
    fromDay: Weekday,
    toDay: Weekday,
    plannedId: string
  ) => Promise<void>;
  applyGeneratorSplit: (style: GeneratorStyle) => Promise<void>;
  addCustomExercise: (exercise: Exercise) => Promise<void>;
  deleteCustomExercise: (id: string) => Promise<void>;
  saveWorkoutLog: (log: WorkoutLog) => Promise<void>;
  deleteWorkoutLog: (id: string) => Promise<void>;
  activeTrackerDay: Weekday | null;
  setActiveTrackerDay: (day: Weekday | null) => void;
  resetDemoData: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

function loadLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
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
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced'>('local');

  const [plans, setPlans] = useState<Record<Weekday, DayPlan>>(() =>
    loadLocalJson(STORAGE_KEYS.PLANS, DEFAULT_WEEKLY_PLANS)
  );
  const [logs, setLogs] = useState<WorkoutLog[]>(() =>
    loadLocalJson(STORAGE_KEYS.LOGS, createSeedWorkoutLogs())
  );
  const [customExercises, setCustomExercises] = useState<Exercise[]>(() =>
    loadLocalJson(STORAGE_KEYS.CUSTOM, [])
  );
  const [profile, setProfile] = useState<UserProfile>(() =>
    loadLocalJson(STORAGE_KEYS.PROFILE, {
      uid: 'guest',
      displayName: 'Guest Athlete',
      email: '',
      weightUnit: 'kg' as WeightUnit,
      goal: 'Hypertrophy & Progressive Strength',
      xp: 790,
      streakDays: 4,
      unlockedAchievements: ['first-workout', '1000kg-lifted'],
    })
  );
  const [activeTrackerDay, setActiveTrackerDay] = useState<Weekday | null>(null);

  // Persist local cache immediately on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
    } catch {
      // Ignore storage quota errors
    }
  }, [plans]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch {
      // Ignore storage quota errors
    }
  }, [logs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(customExercises));
    } catch {
      // Ignore storage quota errors
    }
  }, [customExercises]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setSyncStatus('local');
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
          const initialProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName || profile.displayName || 'Vault Athlete',
            email: user.email || '',
            weightUnit: profile.weightUnit,
            goal: profile.goal,
            xp: profile.xp,
            streakDays: profile.streakDays,
            unlockedAchievements: profile.unlockedAchievements,
          };
          const clean = sanitizeUserProfileForFirestore(initialProfile);
          await setDoc(userRef, {
            ...clean,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Seed initial plans for new cloud user
          await Promise.all(
            WEEKDAYS.map((day) => {
              const planRef = doc(db, 'users', user.uid, 'plans', day);
              const cleanPlan = sanitizeDayPlanForFirestore(plans[day], user.uid);
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
            goal: String(d.goal || 'Strength & Hypertrophy'),
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
      collection(db, 'users', user.uid, 'plans'),
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
      collection(db, 'users', user.uid, 'logs'),
      (snap) => {
        if (cancelled) return;
        const cloudLogs: WorkoutLog[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
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
          });
        });
        if (cloudLogs.length > 0) {
          cloudLogs.sort((a, b) => b.date.localeCompare(a.date));
          setLogs(cloudLogs);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/logs`);
      }
    );

    const unsubCustom = onSnapshot(
      collection(db, 'users', user.uid, 'customExercises'),
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
            animationStyle: 'press',
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
    await signInWithPopup(auth, googleProvider);
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
        const clean = sanitizeUserProfileForFirestore({ ...next, uid: user.uid, email: user.email || next.email });
        await setDoc(
          doc(db, 'users', user.uid),
          {
            displayName: clean.displayName,
            weightUnit: clean.weightUnit,
            goal: clean.goal,
            xp: clean.xp,
            streakDays: clean.streakDays,
            unlockedAchievements: clean.unlockedAchievements,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
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

  const saveWorkoutLog = async (log: WorkoutLog) => {
    const nextLogs = [log, ...logs];
    setLogs(nextLogs);

    const gamification = computeGamification(nextLogs);
    const unlockedIds = gamification.achievements
      .filter((a) => a.unlocked)
      .map((a) => a.id);
    const nextStreak = computeTrainingStreak(nextLogs);

    const nextProfile: UserProfile = {
      ...profile,
      xp: gamification.xp,
      streakDays: nextStreak,
      unlockedAchievements: unlockedIds,
    };
    setProfile(nextProfile);

    if (user) {
      setSyncStatus('syncing');
      const path = `users/${user.uid}/logs/${log.id}`;
      try {
        const cleanLog = sanitizeWorkoutLogForFirestore(log, user.uid);
        await setDoc(doc(db, 'users', user.uid, 'logs', log.id), {
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
    setLogs((prev) => prev.filter((l) => l.id !== id));

    if (user) {
      const path = `users/${user.uid}/logs/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'logs', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const resetDemoData = async () => {
    const seedLogs = createSeedWorkoutLogs();
    setPlans(DEFAULT_WEEKLY_PLANS);
    setLogs(seedLogs);
    setCustomExercises([]);
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
        syncStatus,
        profile,
        plans,
        logs,
        allExercises,
        customExercises,
        signInWithGoogle,
        signOutUser,
        updateProfile,
        updateDayPlan,
        moveExerciseBetweenDays,
        applyGeneratorSplit,
        addCustomExercise,
        deleteCustomExercise,
        saveWorkoutLog,
        deleteWorkoutLog,
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
