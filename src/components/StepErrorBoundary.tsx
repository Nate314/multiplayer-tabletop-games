import { Component, type ReactNode } from 'react';

type StepErrorBoundaryProps = { children: ReactNode };
type StepErrorBoundaryState = { failed: boolean };

// Callers reset it by changing its key
export default class StepErrorBoundary extends Component<StepErrorBoundaryProps, StepErrorBoundaryState> {
  state: StepErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): StepErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <p className="history-move">This step could not be shown</p>;
    return this.props.children;
  }
}
