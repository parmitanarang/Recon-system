export type Project = {
  id: string;
  name: string;
  description: string;
};

export type DataSourceId = "sourceA" | "sourceB";

export type SampleSource = {
  sourceId: DataSourceId;
  fileName: string;
  columns: string[];
};

export type MatchRule = {
  id: string;
  left: {
    source: DataSourceId;
    column: string;
  };
  right: {
    source: DataSourceId;
    column: string;
  };
};

export type JobSpec = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  sampleSources?: SampleSource[];
  rules?: MatchRule[];
};

export type JobRunStatus = "completed" | "in-progress" | "failed";

export type JobRun = {
  id: string;
  jobSpecId: string;
  runAt: string;
  status: JobRunStatus;
};

/** A single data row from a source; keys are column names, _id is internal id */
export type DataRow = Record<string, string> & { _id: string };

export type MatchPair = {
  left: DataRow;
  right: DataRow;
};

export type RunResult = {
  unmatchedA: DataRow[];
  unmatchedB: DataRow[];
  autoMatched: MatchPair[];
  manualMatched: MatchPair[];
};

/** Row from a run, used when aggregating across runs (Data tab). */
export type UnmatchedRowWithRun = {
  runId: string;
  row: DataRow;
};

export type AggregatedResult = {
  unmatchedA: UnmatchedRowWithRun[];
  unmatchedB: UnmatchedRowWithRun[];
  autoMatched: MatchPair[];
  manualMatched: MatchPair[];
};

/** Build mock run result for a job spec (for Phase 3 UI). */
export function buildMockRunResult(jobSpec: JobSpec): RunResult {
  const colsA = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceA")?.columns ?? [];
  const colsB = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceB")?.columns ?? [];

  const makeRow = (cols: string[], prefix: string, n: number): DataRow => {
    const row: DataRow = { _id: `${prefix}-${n}-${Math.random().toString(36).slice(2)}` };
    cols.forEach((c) => {
      row[c] = `${c}_${prefix}_${n}`;
    });
    return row;
  };

  const unmatchedA: DataRow[] = colsA.length
    ? [1, 2, 3].map((n) => makeRow(colsA, "unmatchedA", n))
    : [];
  const unmatchedB: DataRow[] = colsB.length
    ? [1, 2, 3].map((n) => makeRow(colsB, "unmatchedB", n))
    : [];
  const autoMatched: MatchPair[] =
    colsA.length && colsB.length
      ? [1, 2].map((n) => ({
          left: makeRow(colsA, "autoLeft", n),
          right: makeRow(colsB, "autoRight", n)
        }))
      : [];
  return {
    unmatchedA,
    unmatchedB,
    autoMatched,
    manualMatched: []
  };
}

export const projects: Project[] = [
  {
    id: "load-money",
    name: "Load Money",
    description: "Load money reconciliation"
  },
  {
    id: "pixel-repayments",
    name: "Pixel Repayments",
    description: "Load money reconciliation"
  },
  {
    id: "project-3",
    name: "Project 3",
    description: "Project description goes here"
  }
];

export const jobSpecs: JobSpec[] = [
  {
    id: "load-money-pixel-cards",
    projectId: "load-money",
    name: "Load Money Pixel cards Recon",
    description: "Pixel cards load money reconciliation"
  },
  {
    id: "load-money-upi",
    projectId: "load-money",
    name: "Load Money UPI Recon",
    description: "UPI load money reconciliation"
  },
  {
    id: "load-money-vision-cards",
    projectId: "load-money",
    name: "Load Money Vision+ Cards Recon",
    description: "HDFC Vision+ cards load money reconciliation"
  }
];

export const jobRuns: JobRun[] = [
  {
    id: "61998b97-32a5-4b4c-b983-bf4cc3aebb6a",
    jobSpecId: "load-money-pixel-cards",
    runAt: "2025-04-02T07:01:55Z",
    status: "completed"
  },
  {
    id: "52998b97-32a5-4b4c-b983-bf4cc3aebb9a",
    jobSpecId: "load-money-pixel-cards",
    runAt: "2025-04-01T04:01:50Z",
    status: "in-progress"
  },
  {
    id: "41998b97-32a5-4b4c-b983-bf4cc3aebb10a",
    jobSpecId: "load-money-pixel-cards",
    runAt: "2025-03-30T09:11:24Z",
    status: "failed"
  }
];

