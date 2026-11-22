import React, { useState } from 'react';
import {
  BarChart3,
  Bot,
  CalendarDays,
  Dumbbell,
  PlayCircle,
  User,
} from 'lucide-react';
import { AnalyticsView } from './components/AnalyticsView';
import { AuthGate } from './components/AuthGate';
import { CoachView } from './components/CoachView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LibraryView } from './components/LibraryView';
import { PlannerView } from './components/PlannerView';
import { ProfileModal } from './components/ProfileModal';
import { TrackerView } from './components/TrackerView';
import { VaultProvider, useVault } from './context/VaultContext';
import { Weekday } from './types/workout';

type NavTab = 'planner' | 'library' | 'tracker' | 'analytics' | 'coach';

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'planner', label: 'Planner', icon: CalendarDays },
  { id: 'library', label: 'Library', icon: Dumbbell },
  { id: 'tracker', label: 'Tracker', icon: PlayCircle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'coach', label: 'AI Coach', icon: Bot },
];

const VaultShell: React.FC = () => {
  const { user, authReady, profile, setActiveTrackerDay } = useVault();
  const [activeTab, setActiveTab] = useState<NavTab>('planner');
  const [showProfile, setShowProfile] = useState(false);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-300 flex items-center justify-center p-6">
        <div className="text-sm font-mono text-zinc-400">Loading Workout Vault...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const handleStartWorkoutFromPlanner = (day: Weekday) => {
    setActiveTrackerDay(day);
    setActiveTab('tracker');
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 h-16 bg-[#09090B]/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('planner')}
            className="text-lg font-bold font-display tracking-tight text-white whitespace-nowrap shrink-0 hover:text-[#00FF88] transition-colors"
          >
            Workout Vault
          </button>

          {/* Zone 2: 5 Concise Single-Line Nav Links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'text-[#00FF88] border-[#00FF88]'
                      : 'text-zinc-400 border-transparent hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (Account / Profile) */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              aria-label="Open account and profile"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-white hover:border-[#00FF88]/50 transition-colors whitespace-nowrap shrink-0"
            >
              <User className="w-3.5 h-3.5 text-[#00FF88]" />
              <span>{user ? profile.displayName.split(' ')[0] : 'Account'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10">
        {activeTab === 'planner' && (
          <PlannerView
            onStartWorkout={handleStartWorkoutFromPlanner}
            onOpenCoach={() => setActiveTab('coach')}
          />
        )}
        {activeTab === 'library' && <LibraryView />}
        {activeTab === 'tracker' && (
          <TrackerView onOpenPlanner={() => setActiveTab('planner')} />
        )}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'coach' && (
          <CoachView onOpenPlanner={() => setActiveTab('planner')} />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (Thumb Zone, <= 15% viewport height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#09090B]/95 backdrop-blur-xl border-t border-white/10 grid grid-cols-5 items-center"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${
                active ? 'text-[#00FF88]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <VaultProvider>
        <VaultShell />
      </VaultProvider>
    </ErrorBoundary>
  );
}
