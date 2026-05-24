import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
    // Report error to Sentry if initialized
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { extra: { errorInfo } });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
            <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              ⚠️
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado</h2>
            <p className="text-sm text-slate-600 mb-6">
              Desculpe pelo transtorno. Nossa equipe de engenharia foi notificada automaticamente e já está trabalhando para corrigir este erro.
            </p>
            <button
              onClick={() => window.location.reload()}
              type="button"
              className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition shadow-sm"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
