import { useEffect, useState } from "react";
import { useData } from "../context/DataContext";
import { buildMockRunResult, type DataRow, type JobSpec, type RunResult } from "../data/mock";

type ViewDataTab = "unmatched" | "autoMatched" | "manualMatched";

interface ViewDataModalProps {
  runId: string;
  jobSpec: JobSpec;
  runLabel: string;
  onClose: () => void;
}

export function ViewDataModal({ runId, jobSpec, runLabel, onClose }: ViewDataModalProps) {
  const { ensureRunResult, runResults, addManualMatch, archiveUnmatchedRecord } = useData();
  const [viewTab, setViewTab] = useState<ViewDataTab>("unmatched");
  const [selectedRows, setSelectedRows] = useState<
    { source: "sourceA" | "sourceB"; rowId: string }[]
  >([]);

  useEffect(() => {
    Promise.resolve(ensureRunResult(runId, jobSpec)).catch(() => {});
  }, [runId, jobSpec, ensureRunResult]);

  const result: RunResult = runResults[runId] ?? buildMockRunResult(jobSpec);
  const colsA = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceA")?.columns ?? [];
  const colsB = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceB")?.columns ?? [];

  const canArchive = selectedRows.length === 1;
  const canManualMatch = selectedRows.length === 2;

  const toggleSelect = (source: "sourceA" | "sourceB", rowId: string) => {
    setSelectedRows((prev) => {
      const exists = prev.some((s) => s.source === source && s.rowId === rowId);
      if (exists) return prev.filter((s) => !(s.source === source && s.rowId === rowId));
      if (prev.length >= 2) return prev;
      return [...prev, { source, rowId }];
    });
  };

  const isSelected = (source: "sourceA" | "sourceB", rowId: string) =>
    selectedRows.some((s) => s.source === source && s.rowId === rowId);

  const handleManualMatch = async () => {
    if (!canManualMatch) return;
    const [first, second] = selectedRows;
    await Promise.resolve(
      addManualMatch(runId, first.source, first.rowId, second.source, second.rowId)
    );
    setSelectedRows([]);
  };

  const handleArchive = async (source: "sourceA" | "sourceB", rowId: string) => {
    await Promise.resolve(archiveUnmatchedRecord(runId, source, rowId));
    setSelectedRows((prev) => prev.filter((s) => !(s.source === source && s.rowId === rowId)));
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="view-data-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-card view-data-modal">
        <div className="modal-header">
          <h2 id="view-data-title" className="modal-title">
            View Data – {runLabel}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="view-data-tabs">
          <button
            type="button"
            className={`view-data-tab ${viewTab === "unmatched" ? "view-data-tab-active" : ""}`}
            onClick={() => setViewTab("unmatched")}
          >
            Unmatched
          </button>
          <button
            type="button"
            className={`view-data-tab ${viewTab === "autoMatched" ? "view-data-tab-active" : ""}`}
            onClick={() => setViewTab("autoMatched")}
          >
            Auto Matched
          </button>
          <button
            type="button"
            className={`view-data-tab ${viewTab === "manualMatched" ? "view-data-tab-active" : ""}`}
            onClick={() => setViewTab("manualMatched")}
          >
            Manual Matched
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
                    void handleArchive(single.source, single.rowId);
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
                        {colsA.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.unmatchedA.map((row) => (
                        <tr
                          key={row._id}
                          className={isSelected("sourceA", row._id) ? "row-selected" : ""}
                          onClick={() => toggleSelect("sourceA", row._id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected("sourceA", row._id)}
                              onChange={() => toggleSelect("sourceA", row._id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
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
                        {colsB.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.unmatchedB.map((row) => (
                        <tr
                          key={row._id}
                          className={isSelected("sourceB", row._id) ? "row-selected" : ""}
                          onClick={() => toggleSelect("sourceB", row._id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected("sourceB", row._id)}
                              onChange={() => toggleSelect("sourceB", row._id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
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
