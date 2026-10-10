import { Component } from "react";
import { ErrorState } from "./ui/ErrorState";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-16">
          <ErrorState
            title="This page hit an unexpected error"
            message={
              this.state.error.message ||
              "An unexpected client-side error occurred."
            }
            onRetry={this.handleRetry}
            retryLabel="Reload section"
          />
        </div>
      );
    }
    return this.props.children;
  }
}
