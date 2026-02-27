const getBase = () => (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getBase()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  projects: {
    list: () => request<{ id: string; name: string; description: string }[]>("/api/projects"),
    create: (body: { name: string; description: string }) =>
      request<{ id: string; name: string; description: string }>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; description?: string }) =>
      request<{ id: string; name: string; description: string }>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  },
  jobSpecs: {
    list: () =>
      request<{ id: string; projectId: string; name: string; description: string; sampleSources?: unknown; rules?: unknown }[]>(
        "/api/job-specs"
      ),
    listByProject: (projectId: string) =>
      request<{ id: string; projectId: string; name: string; description: string; sampleSources?: unknown; rules?: unknown }[]>(
        `/api/projects/${projectId}/job-specs`
      ),
    get: (id: string) =>
      request<{ id: string; projectId: string; name: string; description: string; sampleSources?: unknown; rules?: unknown }>(
        `/api/job-specs/${id}`
      ),
    create: (projectId: string, body: { name: string; description: string; sampleSources: unknown; rules: unknown }) =>
      request<{ id: string; projectId: string; name: string; description: string; sampleSources?: unknown; rules?: unknown }>(
        `/api/projects/${projectId}/job-specs`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    update: (id: string, body: Partial<{ name: string; description: string; sampleSources: unknown; rules: unknown }>) =>
      request<{ id: string; projectId: string; name: string; description: string; sampleSources?: unknown; rules?: unknown }>(
        `/api/job-specs/${id}`,
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    delete: (id: string) => request<void>(`/api/job-specs/${id}`, { method: "DELETE" }),
  },
  jobRuns: {
    list: () =>
      request<{ id: string; jobSpecId: string; runAt: string; status: string }[]>("/api/job-runs"),
    listBySpec: (jobSpecId: string) =>
      request<{ id: string; jobSpecId: string; runAt: string; status: string }[]>(
        `/api/job-specs/${jobSpecId}/job-runs`
      ),
    create: (jobSpecId: string, body?: { runAt?: string; status?: string; result?: unknown }) =>
      request<{ id: string; jobSpecId: string; runAt: string; status: string }>(
        `/api/job-specs/${jobSpecId}/job-runs`,
        { method: "POST", body: JSON.stringify(body ?? {}) }
      ),
  },
  runResult: {
    get: (runId: string) =>
      request<{ unmatchedA: unknown[]; unmatchedB: unknown[]; autoMatched: unknown[]; manualMatched: unknown[] }>(
        `/api/job-runs/${runId}/result`
      ),
    set: (runId: string, result: { unmatchedA: unknown[]; unmatchedB: unknown[]; autoMatched: unknown[]; manualMatched: unknown[] }) =>
      request<void>(`/api/job-runs/${runId}/result`, { method: "PUT", body: JSON.stringify(result) }),
    ensure: (runId: string, jobSpec: unknown) =>
      request<void>(`/api/job-runs/${runId}/ensure-result`, { method: "POST", body: JSON.stringify(jobSpec) }),
  },
  manualMatch: {
    run: (runId: string, leftRowId: string, rightRowId: string) =>
      request<void>(`/api/job-runs/${runId}/manual-match`, {
        method: "POST",
        body: JSON.stringify({ leftRowId, rightRowId }),
      }),
    jobSpec: (jobSpecId: string, leftRunId: string, leftRowId: string, rightRunId: string, rightRowId: string) =>
      request<void>(`/api/job-specs/${jobSpecId}/manual-match`, {
        method: "POST",
        body: JSON.stringify({ leftRunId, leftRowId, rightRunId, rightRowId }),
      }),
  },
  aggregated: {
    get: (jobSpecId: string) =>
      request<{
        unmatchedA: { runId: string; row: unknown }[];
        unmatchedB: { runId: string; row: unknown }[];
        autoMatched: unknown[];
        manualMatched: unknown[];
      }>(`/api/job-specs/${jobSpecId}/aggregated-result`),
  },
  runJob: (jobSpecId: string, fileA: File, fileB: File) => {
    const base = getBase();
    const form = new FormData();
    form.append("fileA", fileA);
    form.append("fileB", fileB);
    return fetch(`${base}/api/job-specs/${jobSpecId}/run`, { method: "POST", body: form });
  },
};

/** True when using the backend API (explicit VITE_API_URL or production same-origin). */
export function isApiConfigured(): boolean {
  const url = (import.meta.env.VITE_API_URL ?? "").trim();
  return url.length > 0 || import.meta.env.PROD;
}
