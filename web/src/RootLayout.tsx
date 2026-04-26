import { Outlet } from "@tanstack/react-router";
import { useEffect, type ReactNode, Component, type ErrorInfo } from "react";
import { initTelegram, tg } from "./lib/telegram";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    tg?.showAlert("Something went wrong");
  }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 24 }}>An error occurred. Reopen the app.</div>;
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => { initTelegram(); }, []);
  return <ErrorBoundary><Outlet /></ErrorBoundary>;
}
