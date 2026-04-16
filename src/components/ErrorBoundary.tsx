import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center flex flex-col items-center gap-3">
            <p className="text-sm text-white/40">something went wrong</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-xs text-white/50 hover:bg-white/8 hover:text-white/70 transition-colors cursor-pointer"
            >
              try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
