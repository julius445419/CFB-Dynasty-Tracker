import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-[40px] p-8 space-y-6 shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">
                Something went <span className="text-red-500">wrong</span>
              </h2>
              <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                {isFirestoreError ? "We encountered a database permission issue." : "The application encountered an unexpected error."}
              </p>
            </div>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900 text-left">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Error Details</p>
              <p className="text-xs font-mono text-zinc-400 break-all leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 py-3 bg-zinc-800 text-white font-black rounded-2xl border border-zinc-700 hover:bg-zinc-700 transition-all uppercase tracking-widest text-[10px]"
              >
                <RefreshCw size={14} />
                Reload
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 py-3 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-500 transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-orange-600/20"
              >
                <Home size={14} />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
