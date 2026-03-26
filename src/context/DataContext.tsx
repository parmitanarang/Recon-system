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
  type AggregatedResult,
  type DataSourceId,
  type ArchivedRecord
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
  addManualMatch(
    runId: string,
    firstSource: DataSourceId,
    firstRowId: string,
    secondSource: DataSourceId,
    secondRowId: string
  ): void | Promise<void>;
  archiveUnmatchedRecord(runId: string, source: DataSourceId, rowId: string): void | Promise<void>;
  getAggregatedResult(jobSpecId: string): AggregatedResult | Promise<AggregatedResult>;
  getArchivedRecords(jobSpecId: string): ArchivedRecord[] | Promise<ArchivedRecord[]>;
  addManualMatchForJobSpec(
    jobSpecId: string,
    firstRunId: string,
    firstSource: DataSourceId,
    firstRowId: string,
    secondRunId: string,
    secondSource: DataSourceId,
    secondRowId: string
  ): void | Promise<void>;
  addJobRun(
    jobSpecId: string,
    files?: { sourceAFileName?: string; sourceBFileName?: string }
  ): string | Promise<string>;
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

  const addManualMatch: DataContextValue["addManualMatch"] = (
    runId,
    firstSource,
    firstRowId,
    secondSource,
    secondRowId
  ) => {
    setRunResults((prev) => {
      const result = prev[runId];
      if (!result) return prev;
      const getRow = (source: DataSourceId, rowId: string) =>
        source === "sourceA"
          ? result.unmatchedA.find((r) => r._id === rowId)
          : result.unmatchedB.find((r) => r._id === rowId);
      const first = getRow(firstSource, firstRowId);
      const second = getRow(secondSource, secondRowId);
      if (!first || !second) return prev;
      return {
        ...prev,
        [runId]: {
          ...result,
          unmatchedA: result.unmatchedA.filter(
            (r) =>
              !(
                (firstSource === "sourceA" && r._id === firstRowId) ||
                (secondSource === "sourceA" && r._id === secondRowId)
              )
          ),
          unmatchedB: result.unmatchedB.filter(
            (r) =>
              !(
                (firstSource === "sourceB" && r._id === firstRowId) ||
                (secondSource === "sourceB" && r._id === secondRowId)
              )
          ),
          manualMatched: [...result.manualMatched, { left: first, right: second }]
        }
      };
    });
  };

  const archiveUnmatchedRecord: DataContextValue["archiveUnmatchedRecord"] = (
    runId,
    source,
    rowId
  ) => {
    setRunResults((prev) => {
      const result = prev[runId];
      if (!result) return prev;
      if (source === "sourceA") {
        const row = result.unmatchedA.find((r) => r._id === rowId);
        if (!row) return prev;
        return {
          ...prev,
          [runId]: {
            ...result,
            unmatchedA: result.unmatchedA.filter((r) => r._id !== rowId),
            archivedA: [...(result.archivedA ?? []), row]
          }
        };
      }
      const row = result.unmatchedB.find((r) => r._id === rowId);
      if (!row) return prev;
      return {
        ...prev,
        [runId]: {
          ...result,
          unmatchedB: result.unmatchedB.filter((r) => r._id !== rowId),
          archivedB: [...(result.archivedB ?? []), row]
        }
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
    const archivedA = runs.flatMap((r) => {
      const res = runResults[r.id];
      if (!res) return [];
      return (res.archivedA ?? []).map((row) => ({ runId: r.id, row }));
    });
    const archivedB = runs.flatMap((r) => {
      const res = runResults[r.id];
      if (!res) return [];
      return (res.archivedB ?? []).map((row) => ({ runId: r.id, row }));
    });
    const autoMatched = runs.flatMap((r) => runResults[r.id]?.autoMatched ?? []);
    const manualFromRuns = runs.flatMap((r) => runResults[r.id]?.manualMatched ?? []);
    const manualFromSpec = jobSpecManualMatches[jobSpecId] ?? [];
    const manualMatched = [...manualFromRuns, ...manualFromSpec];
    return {
      unmatchedA,
      unmatchedB,
      archivedA,
      archivedB,
      autoMatched,
      manualMatched
    };
  };

  const getArchivedRecords: DataContextValue["getArchivedRecords"] = (jobSpecId) => {
    const runs = jobRuns
      .filter((r) => r.jobSpecId === jobSpecId)
      .sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());
    return runs.flatMap((run) => {
      const res = runResults[run.id];
      if (!res) return [];
      const fromA: ArchivedRecord[] = (res.archivedA ?? []).map((row) => ({
        runId: run.id,
        runAt: run.runAt,
        source: "sourceA",
        sourceFileName: run.sourceAFileName,
        row
      }));
      const fromB: ArchivedRecord[] = (res.archivedB ?? []).map((row) => ({
        runId: run.id,
        runAt: run.runAt,
        source: "sourceB",
        sourceFileName: run.sourceBFileName,
        row
      }));
      return [...fromA, ...fromB];
    });
  };

  const addJobRun: DataContextValue["addJobRun"] = (jobSpecId, files) => {
    const runId = crypto.randomUUID();
    const newRun: JobRun = {
      id: runId,
      jobSpecId,
      runAt: new Date().toISOString(),
      status: "completed",
      sourceAFileName: files?.sourceAFileName,
      sourceBFileName: files?.sourceBFileName
    };
    setJobRuns((prev) => [newRun, ...prev]);
    return runId;
  };

  const setRunResult: DataContextValue["setRunResult"] = (runId, result) => {
    setRunResults((prev) => ({ ...prev, [runId]: result }));
  };

  const addManualMatchForJobSpec: DataContextValue["addManualMatchForJobSpec"] = (
    jobSpecId,
    firstRunId,
    firstSource,
    firstRowId,
    secondRunId,
    secondSource,
    secondRowId
  ) => {
    const firstResult = runResults[firstRunId];
    const secondResult = runResults[secondRunId];
    if (!firstResult || !secondResult) return;
    const first =
      firstSource === "sourceA"
        ? firstResult.unmatchedA.find((r) => r._id === firstRowId)
        : firstResult.unmatchedB.find((r) => r._id === firstRowId);
    const second =
      secondSource === "sourceA"
        ? secondResult.unmatchedA.find((r) => r._id === secondRowId)
        : secondResult.unmatchedB.find((r) => r._id === secondRowId);
    if (!first || !second) return;
    setJobSpecManualMatches((prev) => ({
      ...prev,
      [jobSpecId]: [...(prev[jobSpecId] ?? []), { left: first, right: second }]
    }));
    setRunResults((prev) => {
      const next = { ...prev };
      const removeRow = (runId: string, source: DataSourceId, rowId: string) => {
        const current = next[runId];
        if (!current) return;
        next[runId] =
          source === "sourceA"
            ? { ...current, unmatchedA: current.unmatchedA.filter((r) => r._id !== rowId) }
            : { ...current, unmatchedB: current.unmatchedB.filter((r) => r._id !== rowId) };
      };
      removeRow(firstRunId, firstSource, firstRowId);
      removeRow(secondRunId, secondSource, secondRowId);
      return next;
    });
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
        archiveUnmatchedRecord,
        getAggregatedResult,
        getArchivedRecords,
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

