import { useEffect, useState } from "react";
import { useData } from "../context/DataContext";
import type { AggregatedResult, DataRow, JobSpec } from "../data/mock";

type DataViewTab = "unmatched" | "autoMatched" | "manualMatched";

interface DataTabViewProps {
  jobSpecId: string;
  jobSpec: JobSpec;
  runIds: string[];
}

type SelectedUnmatched = { runId: string; source: "sourceA" | "sourceB"; rowId: string };

const emptyAggregated: AggregatedResult = {
  unmatchedA: [],
  unmatchedB: [],
  archivedA: [],
  archivedB: [],
  autoMatched: [],
  manualMatched: []
};

export function DataTabView({ jobSpecId, jobSpec, runIds }: DataTabViewProps) {
  const {
    ensureRunResult,
    getAggregatedResult,
    addManualMatchForJobSpec,
    archiveUnmatchedRecord
  } = useData();
  const [viewTab, setViewTab] = useState<DataViewTab>("unmatched");
  const [selectedRows, setSelectedRows] = useState<SelectedUnmatched[]>([]);
  const [result, setResult] = useState<AggregatedResult>(emptyAggregated);

  useEffect(() => {
    runIds.forEach((runId) => {
      Promise.resolve(ensureRunResult(runId, jobSpec)).catch(() => {});
    });
  }, [jobSpecId, jobSpec, runIds, ensureRunResult]);

  useEffect(() => {
    Promise.resolve(getAggregatedResult(jobSpecId)).then(setResult).catch(() => setResult(emptyAggregated));
  }, [jobSpecId, getAggregatedResult]);

  // Refetch aggregated when selection changes (manual match may have been called)
  const refreshAggregated = () => {
    Promise.resolve(getAggregatedResult(jobSpecId)).then(setResult).catch(() => {});
  };
  const colsA = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceA")?.columns ?? [];
  const colsB = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceB")?.columns ?? [];

  const canArchive = selectedRows.length === 1;
  const canManualMatch = selectedRows.length === 2;

  const handleManualMatch = async () => {
    if (!canManualMatch) return;
    await Promise.resolve(
      addManualMatchForJobSpec(
        jobSpecId,
        selectedRows[0].runId,
        selectedRows[0].source,
        selectedRows[0].rowId,
        selectedRows[1].runId,
        selectedRows[1].source,
        selectedRows[1].rowId
      )
    );
    setSelectedRows([]);
    refreshAggregated();
  };

  const toggleSelect = (runId: string, source: "sourceA" | "sourceB", rowId: string) => {
    setSelectedRows((prev) => {
      const exists = prev.some((s) => s.runId === runId && s.source === source && s.rowId === rowId);
      if (exists) return prev.filter((s) => !(s.runId === runId && s.source === source && s.rowId === rowId));
      if (prev.length >= 2) return prev;
      return [...prev, { runId, source, rowId }];
    });
  };

  const handleArchive = async (
    runId: string,
    source: "sourceA" | "sourceB",
    rowId: string
  ) => {
    await Promise.resolve(archiveUnmatchedRecord(runId, source, rowId));
    setSelectedRows((prev) =>
      prev.filter((s) => !(s.runId === runId && s.source === source && s.rowId === rowId))
    );
    refreshAggregated();
  };

  const isSelected = (runId: string, source: "sourceA" | "sourceB", rowId: string) =>
    selectedRows.some((s) => s.runId === runId && s.source === source && s.rowId === rowId);

  return (
    <div className="data-tab-view">
      <div className="view-data-tabs view-data-tabs-inline">
        <button
          type="button"
          className={`view-data-tab ${viewTab === "unmatched" ? "view-data-tab-active" : ""}`}
          onClick={() => setViewTab("unmatched")}
        >
          Unmatched {result.unmatchedA.length + result.unmatchedB.length > 0 && `(${result.unmatchedA.length + result.unmatchedB.length})`}
        </button>
        <button
          type="button"
          className={`view-data-tab ${viewTab === "autoMatched" ? "view-data-tab-active" : ""}`}
          onClick={() => setViewTab("autoMatched")}
        >
          Auto Matched {result.autoMatched.length > 0 && `(${result.autoMatched.length})`}
        </button>
        <button
          type="button"
          className={`view-data-tab ${viewTab === "manualMatched" ? "view-data-tab-active" : ""}`}
          onClick={() => setViewTab("manualMatched")}
        >
          Manual Matched {result.manualMatched.length > 0 && `(${result.manualMatched.length})`}
        </button>
      </div>

      {viewTab === "unmatched" && (
        <div className="view-data-unmatched">
          {canArchive && (
            <div className="view-data-manual-match-bar">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const [single] = selectedRows;
                  void handleArchive(single.runId, single.source, single.rowId);
                }}
              >
                Archive
              </button>
            </div>
          )}
          {canManualMatch && (
            <div className="view-data-manual-match-bar">
              <button type="button" className="btn-primary" onClick={handleManualMatch}>
                Manual match
              </button>
            </div>
          )}
          <div className="view-data-two-panels">
            <div className="view-data-panel">
              <h3 className="view-data-panel-title">Data Source 1</h3>
              <div className="view-data-panel-toolbar">
                <button type="button" className="pill pill-outline btn-xs">
                  Add Filter ▾
                </button>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }} />
                      <th>#</th>
                      {colsA.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.unmatchedA.map(({ runId, row }, index) => (
                      <tr
                        key={`${runId}-${row._id}`}
                        className={isSelected(runId, "sourceA", row._id) ? "row-selected" : ""}
                        onClick={() => toggleSelect(runId, "sourceA", row._id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected(runId, "sourceA", row._id)}
                            onChange={() => toggleSelect(runId, "sourceA", row._id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td>{index + 1}</td>
                        {colsA.map((col) => (
                          <td key={col}>{row[col] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.unmatchedA.length === 0 && (
                <p className="view-data-empty">No unmatched records from Data Source 1.</p>
              )}
            </div>
            <div className="view-data-panel">
              <h3 className="view-data-panel-title">Data Source 2</h3>
              <div className="view-data-panel-toolbar">
                <button type="button" className="pill pill-outline btn-xs">
                  Add Filter ▾
                </button>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }} />
                      <th>#</th>
                      {colsB.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.unmatchedB.map(({ runId, row }, index) => (
                      <tr
                        key={`${runId}-${row._id}`}
                        className={isSelected(runId, "sourceB", row._id) ? "row-selected" : ""}
                        onClick={() => toggleSelect(runId, "sourceB", row._id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected(runId, "sourceB", row._id)}
                            onChange={() => toggleSelect(runId, "sourceB", row._id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td>{index + 1}</td>
                        {colsB.map((col) => (
                          <td key={col}>{row[col] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.unmatchedB.length === 0 && (
                <p className="view-data-empty">No unmatched records from Data Source 2.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewTab === "autoMatched" && (
        <div className="view-data-matched">
          <div className="view-data-matched-toolbar">
            <button type="button" className="pill">
              Date Range
            </button>
            <button type="button" className="pill pill-outline">
              + Filter
            </button>
            <button type="button" className="btn-secondary btn-xs">
              Export Matched
            </button>
          </div>
          <MatchedTable
            pairs={result.autoMatched}
            colsA={colsA}
            colsB={colsB}
            source1Label="Data Source 1"
            source2Label="Data Source 2"
          />
          {result.autoMatched.length === 0 && (
            <p className="view-data-empty">No auto-matched records.</p>
          )}
        </div>
      )}

      {viewTab === "manualMatched" && (
        <div className="view-data-matched">
          <div className="view-data-matched-toolbar">
            <button type="button" className="pill">
              Date Range
            </button>
            <button type="button" className="pill pill-outline">
              + Filter
            </button>
            <button type="button" className="btn-secondary btn-xs">
              Export Matched
            </button>
          </div>
          <MatchedTable
            pairs={result.manualMatched}
            colsA={colsA}
            colsB={colsB}
            source1Label="Data Source 1"
            source2Label="Data Source 2"
          />
          {result.manualMatched.length === 0 && (
            <p className="view-data-empty">No manually matched records yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MatchedTable({
  pairs,
  colsA,
  colsB,
  source1Label,
  source2Label
}: {
  pairs: { left: DataRow; right: DataRow }[];
  colsA: string[];
  colsB: string[];
  source1Label: string;
  source2Label: string;
}) {
  return (
    <div className="table-container">
      <table className="data-table data-table-wide">
        <thead>
          <tr>
            {colsA.length > 0 && (
              <th colSpan={colsA.length} className="table-section-header">
                {source1Label}
              </th>
            )}
            {colsB.length > 0 && (
              <th colSpan={colsB.length} className="table-section-header">
                {source2Label}
              </th>
            )}
          </tr>
          <tr>
            {colsA.map((col) => (
              <th key={col}>{col}</th>
            ))}
            {colsB.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair, index) => (
            <tr key={index}>
              {colsA.map((col) => (
                <td key={col}>{pair.left[col] ?? "—"}</td>
              ))}
              {colsB.map((col) => (
                <td key={col}>{pair.right[col] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
