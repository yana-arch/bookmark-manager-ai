import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-lg text-center bg-slate-800 p-8 rounded-lg shadow-xl">
                <h1 className="text-2xl font-bold text-red-500 mb-4">Oops! Something went wrong.</h1>
                <p className="text-slate-300 mb-6">
                    An unexpected error occurred. Please try refreshing the page.
                </p>
                <details className="text-left bg-slate-700 p-3 rounded-md text-xs text-slate-400">
                    <summary className="cursor-pointer font-medium">Error Details</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words">
                        {this.state.error?.toString()}
                    </pre>
                </details>
                <button 
                    onClick={() => window.location.reload()}
                    className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                >
                    Refresh Page
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
