import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface State {
  error: Error | null;
}

// A render error anywhere would otherwise leave a blank white page.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const staleBuild = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(this.state.error.message);
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-alt p-6">
        <div className="max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-lg">
          <p className="text-lg font-bold text-ink-900">{staleBuild ? 'Cholo was updated' : 'This screen hit a problem'}</p>
          <p className="mt-2 text-sm text-ink-500">
            {staleBuild ? 'Reload to get the latest version.' : 'Reload to try again. If it keeps happening, contact support from your account page.'}
          </p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 h-11 w-full rounded-xl bg-cholo-700 font-semibold text-white hover:bg-cholo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 focus-visible:ring-offset-2">
            Reload
          </button>
        </div>
      </main>
    );
  }
}
