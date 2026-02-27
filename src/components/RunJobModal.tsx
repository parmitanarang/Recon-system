import { useState } from "react";
import { useData } from "../context/DataContext";
import { parseCsvToRows, runReconciliation } from "../utils/reconciliation";
import type { JobSpec } from "../data/mock";

interface RunJobModalProps {
  jobSpec: JobSpec;
  onClose: () => void;
}

export function RunJobModal({ jobSpec, onClose }: RunJobModalProps) {
  const { addJobRun, setRunResult, runJobWithFiles } = useData();
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const canRun = fileA && fileB;

  const handleRun = async () => {
    if (!canRun) return;
    setError(null);
    setIsRunning(true);
    try {
      if (runJobWithFiles) {
        await runJobWithFiles(jobSpec.id, fileA, fileB);
        onClose();
        return;
      }
      const [textA, textB] = await Promise.all([fileA.text(), fileB.text()]);
      const rowsA = parseCsvToRows(textA);
      const rowsB = parseCsvToRows(textB);
      if (rowsA.length === 0 && textA.trim().length > 0) {
        setError("Data Source A: could not parse CSV (check format).");
        setIsRunning(false);
        return;
      }
      if (rowsB.length === 0 && textB.trim().length > 0) {
        setError("Data Source B: could not parse CSV (check format).");
        setIsRunning(false);
        return;
      }
      const result = runReconciliation(jobSpec, rowsA, rowsB);
      const runId = await Promise.resolve(addJobRun(jobSpec.id));
      await Promise.resolve(setRunResult(runId, result));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="run-job-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-card run-job-modal">
        <div className="modal-header">
          <h2 id="run-job-title" className="modal-title">
            Run a Job
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="run-job-body">
          <p className="run-job-description">
            Upload <strong>CSV files</strong> for Data Source A and Data Source B. The job will run
            the reconciliation logic defined in this job spec on the uploaded data. Results will
            appear in View Data (for this run) and in the Data tab (aggregated).
          </p>
          <p className="run-job-format-note">
            Files must be in <strong>CSV format</strong>.
          </p>

          {error && <p className="error-text">{error}</p>}

          <div className="run-job-uploads">
            <div className="run-job-upload-block">
              <label className="field-label">
                Data Source A (CSV)
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFileA(e.target.files?.[0] ?? null)}
                  className="run-job-file-input"
                />
              </label>
              {fileA && (
                <p className="run-job-file-name">{fileA.name}</p>
              )}
            </div>
            <div className="run-job-upload-block">
              <label className="field-label">
                Data Source B (CSV)
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFileB(e.target.files?.[0] ?? null)}
                  className="run-job-file-input"
                />
              </label>
              {fileB && (
                <p className="run-job-file-name">{fileB.name}</p>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleRun}
            disabled={!canRun || isRunning}
          >
            {isRunning ? "Running…" : "Run job"}
          </button>
        </div>
      </div>
    </div>
  );
}
