import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isProjects = location.pathname.startsWith("/projects");

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-logo-dot" />
          <span className="app-title">Reconciliation system</span>
        </div>
        <nav className="app-header-nav" aria-label="Primary">
          <Link
            to="/projects"
            className={isProjects ? "nav-link nav-link-active" : "nav-link"}
          >
            Projects
          </Link>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

