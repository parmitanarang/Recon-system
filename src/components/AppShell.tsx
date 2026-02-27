import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-logo-dot" />
          <span className="app-title">Reconciliation system</span>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

