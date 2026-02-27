import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type {
  Project,
  JobSpec,
  JobRun,
  RunResult,
  AggregatedResult,
  SampleSource,
  MatchRule
} from "../data/mock";
import { DataContext } from "./DataContext";

export function ApiDataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobSpecs, setJobSpecs] = useState<JobSpec[]>([]);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [runResults, setRunResults] = useState<Record<string, RunResult>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, s, r] = await Promise.all([
        api.projects.list(),
        api.jobSpecs.list(),
        api.jobRuns.list()
      ]);
      setProjects(p as Project[]);
      setJobSpecs(s as JobSpec[]);
      setJobRuns(r as JobRun[]);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addProject = useCallback(
    async (input: { name: string; description: string }) => {
      await api.projects.create(input);
      await load();
    },
    [load]
  );

  const updateProject = useCallback(
    async (id: string, updates: { name: string; description: string }) => {
      await api.projects.update(id, updates);
      await load();
    },
    [load]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await api.projects.delete(id);
      await load();
    },
    [load]
  );

  const addJobSpec = useCallback(
    async (input: {
      projectId: string;
      name: string;
      description: string;
      sampleSources: SampleSource[];
      rules: MatchRule[];
    }) => {
      await api.jobSpecs.create(input.projectId, {
        name: input.name,
        description: input.description,
        sampleSources: input.sampleSources,
        rules: input.rules
      });
      await load();
    },
    [load]
  );

  const updateJobSpec = useCallback(
    async (id: string, updates: Partial<Omit<JobSpec, "id" | "projectId">>) => {
      await api.jobSpecs.update(id, updates);
      await load();
    },
    [load]
  );

  const deleteJobSpec = useCallback(
    async (id: string) => {
      await api.jobSpecs.delete(id);
      await load();
    },
    [load]
  );

  const ensureRunResult = useCallback(
    async (runId: string, jobSpec: JobSpec) => {
      if (runResults[runId]) return;
      try {
        await api.runResult.ensure(runId, jobSpec);
        const result = await api.runResult.get(runId);
        setRunResults((prev) => ({ ...prev, [runId]: result as RunResult }));
      } catch {
        setRunResults((prev) => ({ ...prev, [runId]: { unmatchedA: [], unmatchedB: [], autoMatched: [], manualMatched: [] } }));
      }
    },
    [runResults]
  );

  const addManualMatch = useCallback(
    async (runId: string, leftRowId: string, rightRowId: string) => {
      await api.manualMatch.run(runId, leftRowId, rightRowId);
      const result = await api.runResult.get(runId);
      setRunResults((prev) => ({ ...prev, [runId]: result as RunResult }));
    },
    []
  );

  const getAggregatedResult = useCallback(async (jobSpecId: string): Promise<AggregatedResult> => {
    return api.aggregated.get(jobSpecId) as Promise<AggregatedResult>;
  }, []);

  const addManualMatchForJobSpec = useCallback(
    async (
      jobSpecId: string,
      leftRunId: string,
      leftRowId: string,
      rightRunId: string,
      rightRowId: string
    ) => {
      await api.manualMatch.jobSpec(jobSpecId, leftRunId, leftRowId, rightRunId, rightRowId);
      await load();
      setRunResults((prev) => ({ ...prev }));
    },
    [load]
  );

  const addJobRun = useCallback(
    async (jobSpecId: string): Promise<string> => {
      const run = await api.jobRuns.create(jobSpecId);
      await load();
      return run.id;
    },
    [load]
  );

  const setRunResult = useCallback(
    async (runId: string, result: RunResult) => {
      await api.runResult.set(runId, result);
      setRunResults((prev) => ({ ...prev, [runId]: result }));
    },
    []
  );

  const runJobWithFiles = useCallback(
    async (jobSpecId: string, fileA: File, fileB: File): Promise<string | null> => {
      const res = await api.runJob(jobSpecId, fileA, fileB);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Run failed");
      }
      const run = await res.json();
      await load();
      return run.id;
    },
    [load]
  );

  const value = {
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
    setRunResult,
    runJobWithFiles
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        Loading…
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
