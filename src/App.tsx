import { Routes, Route, Navigate } from "react-router-dom";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectJobSpecsPage } from "./pages/ProjectJobSpecsPage";
import { JobRunsPage } from "./pages/JobRunsPage";
import { JobSpecEditorPage } from "./pages/JobSpecEditorPage";
import { AppShell } from "./components/AppShell";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectJobSpecsPage />} />
        <Route
          path="/projects/:projectId/job-specs/new"
          element={<JobSpecEditorPage />}
        />
        <Route
          path="/projects/:projectId/job-specs/:jobSpecId/edit"
          element={<JobSpecEditorPage />}
        />
        <Route
          path="/projects/:projectId/job-specs/:jobSpecId"
          element={<JobRunsPage />}
        />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </AppShell>
  );
}

