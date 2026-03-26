import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "../context/DataContext";
import { ViewDataModal } from "../components/ViewDataModal";
import { DataTabView } from "../components/DataTabView";
import { RunJobModal } from "../components/RunJobModal";
import type { ArchivedRecord, DataSourceId } from "../data/mock";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

function StatusPill({ status }: { status: "completed" | "in-progress" | "failed" }) {
  const labelMap: Record<string, string> = {
    completed: "Completed",
    "in-progress": "In-progress",
    failed: "Failed"
  };

  return <span className={`status-pill status-pill-${status}`}>{labelMap[status]}</span>;
}

type TabId = "runs" | "spec" | "data" | "archived";

function sourceLabel(source: DataSourceId): string {
  return source === "sourceA" ? "Data Source 1" : "Data Source 2";
}

export function JobRunsPage() {
  const { projectId, jobSpecId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("runs");
  const [viewDataRunId, setViewDataRunId] = useState<string | null>(null);
  const [showRunJobModal, setShowRunJobModal] = useState(false);

  const { projects, jobSpecs, jobRuns, getArchivedRecords } = useData();

  const project = projects.find((p) => p.id === projectId);
  const jobSpec = jobSpecs.find((s) => s.id === jobSpecId);
  const runsForSpec = jobRuns.filter((run) => run.jobSpecId === jobSpecId);

  if (!project || !jobSpec) {
    return (
      <section>
        <button className="link-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <p className="page-subtitle">Job spec not found.</p>
      </section>
    );
  }

  const sourceA = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceA");
  const sourceB = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceB");
  const rules = jobSpec.rules ?? [];
  const [archivedRecords, setArchivedRecords] = useState<ArchivedRecord[]>([]);

  useEffect(() => {
    Promise.resolve(getArchivedRecords(jobSpec.id))
      .then((records) => setArchivedRecords(records as ArchivedRecord[]))
      .catch(() => setArchivedRecords([]));
  }, [jobSpec.id, getArchivedRecords, runRunsKey(runsForSpec)]);

  return (
    <section>
      <button className="link-button" onClick={() => navigate(-1)}>
        ← Job Specs
      </button>

      <div className="page-header">
        <div>
          <p className="breadcrumb">
            <Link to="/projects" className="breadcrumb-link">
              Projects
            </Link>{" "}
            ›{" "}
            <Link to={`/projects/${project.id}`} className="breadcrumb-link">
              {project.name}
            </Link>{" "}
            › Job Specs › Jobs
          </p>
          <h1 className="page-title">
            {jobSpec.name} – Job Runs
          </h1>
          <p className="page-subtitle">
            Monitor execution history and status of this reconciliation job spec.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowRunJobModal(true)}
        >
          Run a Job
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === "runs" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("runs")}
        >
          Job Runs
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "spec" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("spec")}
        >
          Job Spec
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "data" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("data")}
        >
          Data
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "archived" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("archived")}
        >
          Archived
        </button>
      </div>

      {activeTab === "runs" && (
        <>
          <div className="table-toolbar">
            <div className="pill-group">
              <button className="pill">Date Range</button>
              <button className="pill">Status</button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Job Run Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {runsForSpec.map((run) => (
                  <tr key={run.id}>
                    <td className="mono">{run.id}</td>
                    <td>{formatDateTime(run.runAt)}</td>
                    <td>
                      <StatusPill status={run.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => setViewDataRunId(run.id)}
                      >
                        View Data
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "spec" && (
        <div className="job-spec-definition">
          <div className="definition-section">
            <h2 className="definition-heading">Name & description</h2>
            <dl className="definition-list">
              <dt>Name</dt>
              <dd>{jobSpec.name}</dd>
              <dt>Description</dt>
              <dd>{jobSpec.description || "—"}</dd>
            </dl>
          </div>

          <div className="definition-section">
            <h2 className="definition-heading">Sample data sources</h2>
            <div className="definition-sources">
              <div className="definition-source-card">
                <h3 className="definition-source-title">Data Source 1</h3>
                {sourceA ? (
                  <>
                    <p className="definition-file">{sourceA.fileName}</p>
                    <p className="definition-columns">
                      {sourceA.columns.length} column{sourceA.columns.length === 1 ? "" : "s"}:{" "}
                      {sourceA.columns.join(", ")}
                    </p>
                  </>
                ) : (
                  <p className="definition-empty">No sample uploaded</p>
                )}
              </div>
              <div className="definition-source-card">
                <h3 className="definition-source-title">Data Source 2</h3>
                {sourceB ? (
                  <>
                    <p className="definition-file">{sourceB.fileName}</p>
                    <p className="definition-columns">
                      {sourceB.columns.length} column{sourceB.columns.length === 1 ? "" : "s"}:{" "}
                      {sourceB.columns.join(", ")}
                    </p>
                  </>
                ) : (
                  <p className="definition-empty">No sample uploaded</p>
                )}
              </div>
            </div>
          </div>

          <div className="definition-section">
            <h2 className="definition-heading">Matching rules</h2>
            {rules.length === 0 ? (
              <p className="definition-empty">No rules defined.</p>
            ) : (
              <ul className="definition-rules">
                {rules.map((rule, index) => (
                  <li key={rule.id} className="definition-rule-item">
                    <span className="definition-rule-text">
                      {sourceLabel(rule.left.source)} · <strong>{rule.left.column}</strong>
                      {" = "}
                      {sourceLabel(rule.right.source)} · <strong>{rule.right.column}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="definition-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                navigate(`/projects/${project.id}/job-specs/${jobSpec.id}/edit`)
              }
            >
              Edit job spec
            </button>
          </div>
        </div>
      )}

      {activeTab === "data" && (
        <DataTabView
          jobSpecId={jobSpec.id}
          jobSpec={jobSpec}
          runIds={runsForSpec.map((r) => r.id)}
        />
      )}

      {activeTab === "archived" && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Run Date</th>
                <th>Source</th>
                <th>Record Details</th>
              </tr>
            </thead>
            <tbody>
              {archivedRecords.map((item) => (
                <tr key={`${item.runId}-${item.source}-${item.row._id}`}>
                  <td className="mono">{item.runId}</td>
                  <td>{item.runAt ? formatDateTime(item.runAt) : "—"}</td>
                  <td>{item.sourceFileName || sourceLabel(item.source)}</td>
                  <td className="mono">{JSON.stringify(item.row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {archivedRecords.length === 0 && (
            <p className="view-data-empty" style={{ padding: 12 }}>
              No archived records yet.
            </p>
          )}
        </div>
      )}

      {showRunJobModal && jobSpec && (
        <RunJobModal jobSpec={jobSpec} onClose={() => setShowRunJobModal(false)} />
      )}

      {viewDataRunId && jobSpec && (
        <ViewDataModal
          runId={viewDataRunId}
          jobSpec={jobSpec}
          runLabel={formatDateTime(runsForSpec.find((r) => r.id === viewDataRunId)?.runAt ?? "")}
          onClose={() => setViewDataRunId(null)}
        />
      )}
    </section>
  );
}

function runRunsKey(runs: { id: string; runAt: string }[]): string {
  return runs.map((r) => `${r.id}:${r.runAt}`).join("|");
}

