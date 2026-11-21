import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Workout Vault ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900/90 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold font-display">Something went wrong</h2>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Workout Vault encountered an unexpected error. Your local workout data remains safe.
            </p>
            <div className="text-xs font-mono bg-zinc-950/80 border border-white/10 rounded-lg p-3 text-zinc-400 break-words max-h-32 overflow-auto">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00FF88] text-zinc-950 font-semibold text-sm hover:bg-[#00FF88]/90 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Workout Vault
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
