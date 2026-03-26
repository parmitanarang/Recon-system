import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useData } from "../context/DataContext";
import type { AggregatedResult, DataRow, JobSpec } from "../data/mock";
import { exportRowsAsCsv } from "../utils/exportCsv";

type DataViewTab = "unmatched" | "autoMatched" | "manualMatched";
type SourceId = "sourceA" | "sourceB";
type SelectedUnmatched = { runId: string; source: SourceId; rowId: string };

interface DataTabViewProps {
  jobSpecId: string;
  jobSpec: JobSpec;
  runIds: string[];
}

type ColumnFilterMap = Record<string, string>;

const emptyAggregated: AggregatedResult = {
  unmatchedA: [],
  unmatchedB: [],
  archivedA: [],
  archivedB: [],
  autoMatched: [],
  manualMatched: []
};

export function DataTabView({ jobSpecId, jobSpec, runIds }: DataTabViewProps) {
  const { ensureRunResult, getAggregatedResult, addManualMatchForJobSpec, archiveUnmatchedRecord } =
    useData();
  const [viewTab, setViewTab] = useState<DataViewTab>("unmatched");
  const [selectedRows, setSelectedRows] = useState<SelectedUnmatched[]>([]);
  const [result, setResult] = useState<AggregatedResult>(emptyAggregated);

  const colsA = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceA")?.columns ?? [];
  const colsB = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceB")?.columns ?? [];

  const [sourceAFilters, setSourceAFilters] = useState<ColumnFilterMap>({});
  const [sourceBFilters, setSourceBFilters] = useState<ColumnFilterMap>({});

  const [autoMatchedFilters, setAutoMatchedFilters] = useState<ColumnFilterMap>({});
  const [manualMatchedFilters, setManualMatchedFilters] = useState<ColumnFilterMap>({});

  useEffect(() => {
    runIds.forEach((runId) => {
      Promise.resolve(ensureRunResult(runId, jobSpec)).catch(() => {});
    });
  }, [jobSpecId, jobSpec, runIds, ensureRunResult]);

  useEffect(() => {
    Promise.resolve(getAggregatedResult(jobSpecId))
      .then(setResult)
      .catch(() => setResult(emptyAggregated));
  }, [jobSpecId, getAggregatedResult]);

  const refreshAggregated = () => {
    Promise.resolve(getAggregatedResult(jobSpecId))
      .then(setResult)
      .catch(() => {});
  };

  const canArchive = selectedRows.length === 1;
  const canManualMatch = selectedRows.length === 2;

  const normalizedContains = (value: unknown, filterValue: string) =>
    String(value ?? "").toLowerCase().includes(filterValue.trim().toLowerCase());

  const rowPassesFilters = (row: DataRow, filters: ColumnFilterMap) =>
    Object.entries(filters).every(([col, val]) => !val.trim() || normalizedContains(row[col], val));

  const pairPassesFilters = (pair: { left: DataRow; right: DataRow }, filters: ColumnFilterMap) =>
    Object.entries(filters).every(([key, val]) => {
      if (!val.trim()) return true;
      const [source, col] = key.split(":", 2);
      const cell = source === "sourceA" ? pair.left[col] : pair.right[col];
      return normalizedContains(cell, val);
    });

  const filteredUnmatchedA = useMemo(
    () => result.unmatchedA.filter(({ row }) => rowPassesFilters(row, sourceAFilters)),
    [result.unmatchedA, sourceAFilters]
  );
  const filteredUnmatchedB = useMemo(
    () => result.unmatchedB.filter(({ row }) => rowPassesFilters(row, sourceBFilters)),
    [result.unmatchedB, sourceBFilters]
  );
  const filteredAutoMatched = useMemo(
    () => result.autoMatched.filter((pair) => pairPassesFilters(pair, autoMatchedFilters)),
    [result.autoMatched, autoMatchedFilters]
  );
  const filteredManualMatched = useMemo(
    () => result.manualMatched.filter((pair) => pairPassesFilters(pair, manualMatchedFilters)),
    [result.manualMatched, manualMatchedFilters]
  );

  const pairFilterOptions = useMemo(
    () => [
      ...colsA.map((c) => ({ key: `sourceA:${c}`, label: `Data Source 1 · ${c}` })),
      ...colsB.map((c) => ({ key: `sourceB:${c}`, label: `Data Source 2 · ${c}` }))
    ],
    [colsA, colsB]
  );

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

  const toggleSelect = (runId: string, source: SourceId, rowId: string) => {
    setSelectedRows((prev) => {
      const exists = prev.some((s) => s.runId === runId && s.source === source && s.rowId === rowId);
      if (exists)
        return prev.filter((s) => !(s.runId === runId && s.source === source && s.rowId === rowId));
      if (prev.length >= 2) return prev;
      return [...prev, { runId, source, rowId }];
    });
  };

  const handleArchive = async (runId: string, source: SourceId, rowId: string) => {
    await Promise.resolve(archiveUnmatchedRecord(runId, source, rowId));
    setSelectedRows((prev) =>
      prev.filter((s) => !(s.runId === runId && s.source === source && s.rowId === rowId))
    );
    refreshAggregated();
  };

  const isSelected = (runId: string, source: SourceId, rowId: string) =>
    selectedRows.some((s) => s.runId === runId && s.source === source && s.rowId === rowId);

  const exportUnmatched = () => {
    const rows = [
      ...filteredUnmatchedA.map(({ runId, row }) => ({
        source: "Data Source 1",
        runId,
        ...row
      })),
      ...filteredUnmatchedB.map(({ runId, row }) => ({
        source: "Data Source 2",
        runId,
        ...row
      }))
    ];
    exportRowsAsCsv("unmatched-records.csv", rows);
  };

  const exportPairs = (filename: string, pairs: { left: DataRow; right: DataRow }[]) => {
    const rows = pairs.map((pair) => ({
      ...Object.fromEntries(colsA.map((c) => [`sourceA_${c}`, pair.left[c] ?? ""])),
      ...Object.fromEntries(colsB.map((c) => [`sourceB_${c}`, pair.right[c] ?? ""]))
    }));
    exportRowsAsCsv(filename, rows);
  };

  const unmatchedFilterOptionsA = colsA.filter((c) => !(c in sourceAFilters));
  const unmatchedFilterOptionsB = colsB.filter((c) => !(c in sourceBFilters));
  const autoFilterOptions = pairFilterOptions.filter((opt) => !(opt.key in autoMatchedFilters));
  const manualFilterOptions = pairFilterOptions.filter((opt) => !(opt.key in manualMatchedFilters));

  return (
    <div className="data-tab-view">
      <div className="view-data-tabs view-data-tabs-inline view-data-tabs-with-actions">
        <div className="view-data-tabs-left">
          <button
            type="button"
            className={`view-data-tab ${viewTab === "unmatched" ? "view-data-tab-active" : ""}`}
            onClick={() => setViewTab("unmatched")}
          >
            Unmatched{" "}
            {result.unmatchedA.length + result.unmatchedB.length > 0 &&
              `(${result.unmatchedA.length + result.unmatchedB.length})`}
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
        <div className="view-data-tabs-actions">
          {viewTab === "unmatched" && canArchive && (
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={() => {
                const [single] = selectedRows;
                void handleArchive(single.runId, single.source, single.rowId);
              }}
            >
              Archive
            </button>
          )}
          {viewTab === "unmatched" && canManualMatch && (
            <button type="button" className="btn-primary btn-xs" onClick={handleManualMatch}>
              Manual match
            </button>
          )}
          {viewTab === "unmatched" && (
            <button type="button" className="btn-secondary btn-xs" onClick={exportUnmatched}>
              Export Unmatched
            </button>
          )}
          {viewTab === "autoMatched" && (
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={() => exportPairs("matched-records.csv", filteredAutoMatched)}
            >
              Export Matched
            </button>
          )}
          {viewTab === "manualMatched" && (
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={() => exportPairs("manual-matched-records.csv", filteredManualMatched)}
            >
              Export Matched
            </button>
          )}
        </div>
      </div>

      {viewTab === "unmatched" && (
        <div className="view-data-unmatched">
          <div className="view-data-two-panels">
            <div className="view-data-panel">
              <h3 className="view-data-panel-title">Data Source 1</h3>
              <div className="view-data-panel-toolbar">
                <select
                  className="pill pill-outline btn-xs filter-select-pill"
                  value=""
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (!selected) return;
                    setSourceAFilters((prev) => ({ ...prev, [selected]: "" }));
                  }}
                >
                  <option value="">Add Filter</option>
                  {unmatchedFilterOptionsA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <FilterPills filters={sourceAFilters} setFilters={setSourceAFilters} inline />
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
                    {filteredUnmatchedA.map(({ runId, row }, index) => (
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
              {filteredUnmatchedA.length === 0 && (
                <p className="view-data-empty">No unmatched records from Data Source 1.</p>
              )}
            </div>

            <div className="view-data-panel">
              <h3 className="view-data-panel-title">Data Source 2</h3>
              <div className="view-data-panel-toolbar">
                <select
                  className="pill pill-outline btn-xs filter-select-pill"
                  value=""
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (!selected) return;
                    setSourceBFilters((prev) => ({ ...prev, [selected]: "" }));
                  }}
                >
                  <option value="">Add Filter</option>
                  {unmatchedFilterOptionsB.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <FilterPills filters={sourceBFilters} setFilters={setSourceBFilters} inline />
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
                    {filteredUnmatchedB.map(({ runId, row }, index) => (
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
              {filteredUnmatchedB.length === 0 && (
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
            <select
              className="pill pill-outline filter-select-pill"
              value=""
              onChange={(e) => {
                const selected = e.target.value;
                if (!selected) return;
                setAutoMatchedFilters((prev) => ({ ...prev, [selected]: "" }));
              }}
            >
              <option value="">+ Filter</option>
              {autoFilterOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FilterPills
              filters={autoMatchedFilters}
              setFilters={setAutoMatchedFilters}
              labelMap={Object.fromEntries(pairFilterOptions.map((o) => [o.key, o.label]))}
              inline
            />
          </div>
          <MatchedTable
            pairs={filteredAutoMatched}
            colsA={colsA}
            colsB={colsB}
            source1Label="Data Source 1"
            source2Label="Data Source 2"
          />
          {filteredAutoMatched.length === 0 && (
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
            <select
              className="pill pill-outline filter-select-pill"
              value=""
              onChange={(e) => {
                const selected = e.target.value;
                if (!selected) return;
                setManualMatchedFilters((prev) => ({ ...prev, [selected]: "" }));
              }}
            >
              <option value="">+ Filter</option>
              {manualFilterOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FilterPills
              filters={manualMatchedFilters}
              setFilters={setManualMatchedFilters}
              labelMap={Object.fromEntries(pairFilterOptions.map((o) => [o.key, o.label]))}
              inline
            />
          </div>
          <MatchedTable
            pairs={filteredManualMatched}
            colsA={colsA}
            colsB={colsB}
            source1Label="Data Source 1"
            source2Label="Data Source 2"
          />
          {filteredManualMatched.length === 0 && (
            <p className="view-data-empty">No manually matched records yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPills({
  filters,
  setFilters,
  labelMap,
  inline
}: {
  filters: ColumnFilterMap;
  setFilters: Dispatch<SetStateAction<ColumnFilterMap>>;
  labelMap?: Record<string, string>;
  inline?: boolean;
}) {
  const entries = Object.entries(filters);
  if (!entries.length) return null;
  return (
    <div className={`filter-pill-list ${inline ? "filter-pill-list-inline" : ""}`}>
      {entries.map(([key, value]) => (
        <div key={key} className="filter-pill">
          <span className="filter-pill-label">{labelMap?.[key] ?? key}</span>
          <input
            className="text-input filter-pill-input"
            placeholder="contains..."
            value={value}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                [key]: e.target.value
              }))
            }
          />
          <button
            type="button"
            className="link-button-small link-button-danger"
            onClick={() =>
              setFilters((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              })
            }
          >
            ×
          </button>
        </div>
      ))}
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
