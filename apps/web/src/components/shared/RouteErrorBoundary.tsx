import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Route error:', error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full mx-4 bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">
            Something went wrong loading this page.
          </h1>
          <p className="text-slate-500 mb-6 text-sm">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green-hover transition-colors text-sm font-medium"
            >
              Reload
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
