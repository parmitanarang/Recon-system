import { createContext, useContext, useState, type ReactNode } from "react";
import {
  projects as initialProjects,
  jobSpecs as initialJobSpecs,
  jobRuns as initialJobRuns,
  buildMockRunResult,
  type Project,
  type JobSpec,
  type JobRun,
  type MatchRule,
  type SampleSource,
  type RunResult,
  type MatchPair,
  type AggregatedResult
} from "../data/mock";

export interface DataContextValue {
  projects: Project[];
  jobSpecs: JobSpec[];
  jobRuns: JobRun[];
  addProject(input: { name: string; description: string }): void | Promise<void>;
  updateProject(id: string, updates: { name: string; description: string }): void | Promise<void>;
  deleteProject(id: string): void | Promise<void>;
  addJobSpec(input: {
    projectId: string;
    name: string;
    description: string;
    sampleSources: SampleSource[];
    rules: MatchRule[];
  }): void | Promise<void>;
  updateJobSpec(id: string, updates: Partial<Omit<JobSpec, "id" | "projectId">>): void | Promise<void>;
  deleteJobSpec(id: string): void | Promise<void>;
  ensureRunResult(runId: string, jobSpec: JobSpec): void | Promise<void>;
  runResults: Record<string, RunResult>;
  addManualMatch(runId: string, leftRowId: string, rightRowId: string): void | Promise<void>;
  getAggregatedResult(jobSpecId: string): AggregatedResult | Promise<AggregatedResult>;
  addManualMatchForJobSpec(
    jobSpecId: string,
    leftRunId: string,
    leftRowId: string,
    rightRunId: string,
    rightRowId: string
  ): void | Promise<void>;
  addJobRun(jobSpecId: string): string | Promise<string>;
  setRunResult(runId: string, result: RunResult): void | Promise<void>;
  runJobWithFiles?(jobSpecId: string, fileA: File, fileB: File): Promise<string | null>;
}

export const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [jobSpecs, setJobSpecs] = useState<JobSpec[]>(initialJobSpecs);
  const [jobRuns, setJobRuns] = useState<JobRun[]>(initialJobRuns);
  const [runResults, setRunResults] = useState<Record<string, RunResult>>({});
  const [jobSpecManualMatches, setJobSpecManualMatches] = useState<
    Record<string, MatchPair[]>
  >({});

  const addProject: DataContextValue["addProject"] = (input) => {
    const trimmedName = input.name.trim();
    const trimmedDescription = input.description.trim();
    if (!trimmedName) return;

    const id = trimmedName.toLowerCase().replace(/\s+/g, "-");
    setProjects((prev) => {
      if (prev.some((p) => p.id === id)) {
        const uniqueId = `${id}-${prev.length + 1}`;
        return [...prev, { id: uniqueId, name: trimmedName, description: trimmedDescription }];
      }
      return [...prev, { id, name: trimmedName, description: trimmedDescription }];
    });
  };

  const updateProject: DataContextValue["updateProject"] = (id, updates) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              name: updates.name.trim() || p.name,
              description: updates.description.trim()
            }
          : p
      )
    );
  };

  const deleteProject: DataContextValue["deleteProject"] = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setJobSpecs((prev) => prev.filter((spec) => spec.projectId !== id));
    setJobRuns((prev) =>
      prev.filter((run) => {
        const spec = jobSpecs.find((s) => s.id === run.jobSpecId);
        return spec ? spec.projectId !== id : true;
      })
    );
  };

  const addJobSpec: DataContextValue["addJobSpec"] = (input) => {
    const trimmedName = input.name.trim();
    const trimmedDescription = input.description.trim();
    if (!trimmedName) return;

    const baseId = trimmedName.toLowerCase().replace(/\s+/g, "-");
    setJobSpecs((prev) => {
      let id = baseId;
      let suffix = 1;
      while (prev.some((s) => s.id === id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      const newSpec: JobSpec = {
        id,
        projectId: input.projectId,
        name: trimmedName,
        description: trimmedDescription,
        sampleSources: input.sampleSources,
        rules: input.rules
      };

      return [...prev, newSpec];
    });
  };

  const updateJobSpec: DataContextValue["updateJobSpec"] = (id, updates) => {
    setJobSpecs((prev) =>
      prev.map((spec) =>
        spec.id === id
          ? {
              ...spec,
              ...updates,
              name: updates.name?.trim() || spec.name,
              description: updates.description?.trim() ?? spec.description
            }
          : spec
      )
    );
  };

  const deleteJobSpec: DataContextValue["deleteJobSpec"] = (id) => {
    setJobSpecs((prev) => prev.filter((spec) => spec.id !== id));
    setJobRuns((prev) => prev.filter((run) => run.jobSpecId !== id));
    setRunResults((prev) => {
      const next = { ...prev };
      const runIds = jobRuns.filter((r) => r.jobSpecId === id).map((r) => r.id);
      runIds.forEach((runId) => delete next[runId]);
      return next;
    });
    setJobSpecManualMatches((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const ensureRunResult: DataContextValue["ensureRunResult"] = (runId, jobSpec) => {
    setRunResults((prev) => {
      if (prev[runId]) return prev;
      return { ...prev, [runId]: buildMockRunResult(jobSpec) };
    });
  };

  const addManualMatch: DataContextValue["addManualMatch"] = (runId, leftRowId, rightRowId) => {
    setRunResults((prev) => {
      const result = prev[runId];
      if (!result) return prev;
      const left = result.unmatchedA.find((r) => r._id === leftRowId);
      const right = result.unmatchedB.find((r) => r._id === rightRowId);
      if (!left || !right) return prev;
      return {
        ...result,
        unmatchedA: result.unmatchedA.filter((r) => r._id !== leftRowId),
        unmatchedB: result.unmatchedB.filter((r) => r._id !== rightRowId),
        manualMatched: [...result.manualMatched, { left, right }]
      };
    });
  };

  const getAggregatedResult: DataContextValue["getAggregatedResult"] = (jobSpecId) => {
    const runs = jobRuns.filter((r) => r.jobSpecId === jobSpecId);
    const unmatchedA = runs.flatMap((r) => {
      const res = runResults[r.id];
      if (!res) return [];
      return res.unmatchedA.map((row) => ({ runId: r.id, row }));
    });
    const unmatchedB = runs.flatMap((r) => {
      const res = runResults[r.id];
      if (!res) return [];
      return res.unmatchedB.map((row) => ({ runId: r.id, row }));
    });
    const autoMatched = runs.flatMap((r) => runResults[r.id]?.autoMatched ?? []);
    const manualFromRuns = runs.flatMap((r) => runResults[r.id]?.manualMatched ?? []);
    const manualFromSpec = jobSpecManualMatches[jobSpecId] ?? [];
    const manualMatched = [...manualFromRuns, ...manualFromSpec];
    return {
      unmatchedA,
      unmatchedB,
      autoMatched,
      manualMatched
    };
  };

  const addJobRun: DataContextValue["addJobRun"] = (jobSpecId) => {
    const runId = crypto.randomUUID();
    const newRun: JobRun = {
      id: runId,
      jobSpecId,
      runAt: new Date().toISOString(),
      status: "completed"
    };
    setJobRuns((prev) => [newRun, ...prev]);
    return runId;
  };

  const setRunResult: DataContextValue["setRunResult"] = (runId, result) => {
    setRunResults((prev) => ({ ...prev, [runId]: result }));
  };

  const addManualMatchForJobSpec: DataContextValue["addManualMatchForJobSpec"] = (
    jobSpecId,
    leftRunId,
    leftRowId,
    rightRunId,
    rightRowId
  ) => {
    const leftResult = runResults[leftRunId];
    const rightResult = runResults[rightRunId];
    if (!leftResult || !rightResult) return;
    const left = leftResult.unmatchedA.find((r) => r._id === leftRowId);
    const right = rightResult.unmatchedB.find((r) => r._id === rightRowId);
    if (!left || !right) return;
    setJobSpecManualMatches((prev) => ({
      ...prev,
      [jobSpecId]: [...(prev[jobSpecId] ?? []), { left, right }]
    }));
    setRunResults((prev) => ({
      ...prev,
      [leftRunId]: {
        ...prev[leftRunId],
        unmatchedA: prev[leftRunId].unmatchedA.filter((r) => r._id !== leftRowId),
        unmatchedB: prev[leftRunId].unmatchedB,
        autoMatched: prev[leftRunId].autoMatched,
        manualMatched: prev[leftRunId].manualMatched
      },
      [rightRunId]: {
        ...prev[rightRunId],
        unmatchedA: prev[rightRunId].unmatchedA,
        unmatchedB: prev[rightRunId].unmatchedB.filter((r) => r._id !== rightRowId),
        autoMatched: prev[rightRunId].autoMatched,
        manualMatched: prev[rightRunId].manualMatched
      }
    }));
  };

  return (
    <DataContext.Provider
      value={{
        projects,
        jobSpecs,
        jobRuns,
        addProject,
        updateProject,
        deleteProject,
        addJobSpec,
        updateJobSpec,
        deleteJobSpec,
        ensureRunResult,
        runResults,
        addManualMatch,
        getAggregatedResult,
        addManualMatchForJobSpec,
        addJobRun,
        setRunResult
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
}

