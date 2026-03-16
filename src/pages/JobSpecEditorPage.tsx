import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "../context/DataContext";
import type { DataSourceId, MatchRule, SampleSource } from "../data/mock";

type LocalSourceState = {
  fileName: string;
  columns: string[];
};

type LocalRule = {
  id: string;
  leftSource: DataSourceId;
  leftColumn: string;
  rightSource: DataSourceId;
  rightColumn: string;
};

const MAX_RULES = 5;

function normalizeColumnName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function suggestRulesFromColumns(
  sourceAColumns: string[],
  sourceBColumns: string[]
): LocalRule[] {
  if (!sourceAColumns.length || !sourceBColumns.length) return [];

  const byNormalizedB = new Map<string, string>();
  sourceBColumns.forEach((col) => {
    const key = normalizeColumnName(col);
    if (!byNormalizedB.has(key)) {
      byNormalizedB.set(key, col);
    }
  });

  const suggestions: LocalRule[] = [];
  for (const colA of sourceAColumns) {
    const key = normalizeColumnName(colA);
    const matchB = byNormalizedB.get(key);
    if (matchB) {
      const id = `rule-suggested-${suggestions.length + 1}`;
      suggestions.push({
        id,
        leftSource: "sourceA",
        leftColumn: colA,
        rightSource: "sourceB",
        rightColumn: matchB
      });
      if (suggestions.length >= MAX_RULES) break;
    }
  }

  return suggestions;
}

const createEmptyRule = (id: string): LocalRule => ({
  id,
  leftSource: "sourceA",
  leftColumn: "",
  rightSource: "sourceB",
  rightColumn: ""
});

async function parseCsvHeaders(file: File): Promise<string[]> {
  const text = await file.text();
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine
    .split(",")
    .map((cell) => cell.trim().replace(/^"|"$/g, ""))
    .filter((cell) => cell.length > 0);
}

export function JobSpecEditorPage() {
  const { projectId, jobSpecId } = useParams();
  const navigate = useNavigate();
  const { projects, jobSpecs, addJobSpec, updateJobSpec } = useData();

  const project = projects.find((p) => p.id === projectId);
  const existingSpec = jobSpecId ? jobSpecs.find((s) => s.id === jobSpecId) : undefined;

  const [name, setName] = useState(existingSpec?.name ?? "");
  const [description, setDescription] = useState(existingSpec?.description ?? "");

  const [sourceA, setSourceA] = useState<LocalSourceState>({
    fileName: existingSpec?.sampleSources?.find((s) => s.sourceId === "sourceA")?.fileName ??
      "",
    columns:
      existingSpec?.sampleSources?.find((s) => s.sourceId === "sourceA")?.columns ?? []
  });

  const [sourceB, setSourceB] = useState<LocalSourceState>({
    fileName: existingSpec?.sampleSources?.find((s) => s.sourceId === "sourceB")?.fileName ??
      "",
    columns:
      existingSpec?.sampleSources?.find((s) => s.sourceId === "sourceB")?.columns ?? []
  });

  const [rules, setRules] = useState<LocalRule[]>(() => {
    if (!existingSpec?.rules) return [];
    return existingSpec.rules.map((rule) => ({
      id: rule.id,
      leftSource: rule.left.source,
      leftColumn: rule.left.column,
      rightSource: rule.right.source,
      rightColumn: rule.right.column
    }));
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (sourceA.columns.length === 0 || sourceB.columns.length === 0) return false;
    if (rules.length === 0) return false;
    return rules.every(
      (r) => r.leftColumn.trim() && r.rightColumn.trim() && r.leftSource && r.rightSource
    );
  }, [name, sourceA.columns, sourceB.columns, rules]);

  if (!projectId || !project) {
    return (
      <section>
        <p className="page-subtitle">Project not found for this job spec.</p>
      </section>
    );
  }

  const isEditMode = Boolean(existingSpec);

  const handleUpload =
    (target: "sourceA" | "sourceB") => async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const columns = await parseCsvHeaders(file);
      const nextState: LocalSourceState = { fileName: file.name, columns };
      if (target === "sourceA") {
        setSourceA(nextState);
      } else {
        setSourceB(nextState);
      }

      // If both sources have columns and no rules have been defined yet,
      // suggest an initial set of rules based on matching column names.
      setRules((prev) => {
        const hasExistingRules = prev.length > 0;
        const nextSourceA = target === "sourceA" ? nextState : sourceA;
        const nextSourceB = target === "sourceB" ? nextState : sourceB;
        if (
          hasExistingRules ||
          nextSourceA.columns.length === 0 ||
          nextSourceB.columns.length === 0
        ) {
          return prev;
        }
        return suggestRulesFromColumns(nextSourceA.columns, nextSourceB.columns);
      });
    };

  const handleAddRule = () => {
    if (rules.length >= MAX_RULES) return;
    setRules((prev) => [...prev, createEmptyRule(`rule-${prev.length + 1}`)]);
  };

  const handleRuleChange = (id: string, patch: Partial<LocalRule>) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setError(null);

    try {
      const sampleSources: SampleSource[] = [
        { sourceId: "sourceA", fileName: sourceA.fileName, columns: sourceA.columns },
        { sourceId: "sourceB", fileName: sourceB.fileName, columns: sourceB.columns }
      ];

      const serializedRules: MatchRule[] = rules.map((rule) => ({
        id: rule.id,
        left: { source: rule.leftSource, column: rule.leftColumn },
        right: { source: rule.rightSource, column: rule.rightColumn }
      }));

      if (isEditMode && existingSpec) {
        await Promise.resolve(
          updateJobSpec(existingSpec.id, { name, description, sampleSources, rules: serializedRules })
        );
      } else {
        await Promise.resolve(
          addJobSpec({ projectId, name, description, sampleSources, rules: serializedRules })
        );
      }
      navigate(`/projects/${projectId}`);
    } catch (e) {
      setError("Something went wrong while saving this job spec. Please try again.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section>
      <button className="link-button" onClick={() => navigate(-1)}>
        ← Job Specs
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEditMode ? "Edit job spec" : "Create a new job spec"}
          </h1>
          <p className="page-subtitle">
            Configure how this reconciliation job will be identified, what its sample inputs
            look like, and how records should be matched.
          </p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <form onSubmit={handleSubmit} className="job-spec-form">
        <details open className="step-panel">
          <summary className="step-summary">
            <span className="step-badge">Step 1</span>
            <span className="step-title">Name and describe this job spec</span>
          </summary>
          <div className="step-body">
            <div className="field-row">
              <label className="field-label">
                Job spec name
                <input
                  className="text-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Load Money UPI Recon"
                  required
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field-label">
                Description
                <input
                  className="text-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of what this job spec reconciles"
                />
              </label>
            </div>
          </div>
        </details>

        <details className="step-panel">
          <summary className="step-summary">
            <span className="step-badge">Step 2</span>
            <span className="step-title">Upload sample CSV files</span>
          </summary>
          <div className="step-body step-body-grid">
            <div className="sample-card">
              <h3 className="sample-title">Data Source 1</h3>
              <p className="sample-subtitle">
                Upload a small, representative CSV so the system can see the available
                columns.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleUpload("sourceA")}
              />
              {sourceA.fileName && (
                <div className="sample-meta">
                  <div className="sample-file-name">{sourceA.fileName}</div>
                  <div className="sample-columns">
                    {sourceA.columns.length} column
                    {sourceA.columns.length === 1 ? "" : "s"} detected
                  </div>
                </div>
              )}
            </div>

            <div className="sample-card">
              <h3 className="sample-title">Data Source 2</h3>
              <p className="sample-subtitle">
                Upload the corresponding CSV from the second system you want to reconcile
                against.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleUpload("sourceB")}
              />
              {sourceB.fileName && (
                <div className="sample-meta">
                  <div className="sample-file-name">{sourceB.fileName}</div>
                  <div className="sample-columns">
                    {sourceB.columns.length} column
                    {sourceB.columns.length === 1 ? "" : "s"} detected
                  </div>
                </div>
              )}
            </div>
          </div>
        </details>

        <details className="step-panel">
          <summary className="step-summary">
            <span className="step-badge">Step 3</span>
            <span className="step-title">Define matching rules (up to 5)</span>
          </summary>
          <div className="step-body">
            <p className="page-subtitle">
              Choose columns from either data source and state how they should be equal when
              records match.
            </p>

            <div className="rules-header">
              <button
                type="button"
                className="btn-secondary btn-xs"
                onClick={handleAddRule}
                disabled={
                  rules.length >= MAX_RULES ||
                  sourceA.columns.length === 0 ||
                  sourceB.columns.length === 0
                }
              >
                + Add rule
              </button>
              <span className="rules-count">
                {rules.length}/{MAX_RULES} rules defined
              </span>
            </div>

            {rules.length === 0 && (
              <p className="hint-text">
                Upload both sample CSVs first, then add up to five matching rules.
              </p>
            )}

            <div className="rules-list">
              {rules.map((rule, index) => (
                <div key={rule.id} className="rule-row">
                  <span className="rule-index">{index + 1}</span>
                  <div className="rule-side">
                    <select
                      className="select-input"
                      value={rule.leftSource}
                      onChange={(e) =>
                        handleRuleChange(rule.id, {
                          leftSource: e.target.value as DataSourceId,
                          leftColumn: ""
                        })
                      }
                    >
                      <option value="sourceA">Data Source 1</option>
                      <option value="sourceB">Data Source 2</option>
                    </select>
                    <select
                      className="select-input"
                      value={rule.leftColumn}
                      onChange={(e) =>
                        handleRuleChange(rule.id, { leftColumn: e.target.value })
                      }
                    >
                      <option value="">Select column</option>
                      {(rule.leftSource === "sourceA"
                        ? sourceA.columns
                        : sourceB.columns
                      ).map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="rule-operator">=</span>

                  <div className="rule-side">
                    <select
                      className="select-input"
                      value={rule.rightSource}
                      onChange={(e) =>
                        handleRuleChange(rule.id, {
                          rightSource: e.target.value as DataSourceId,
                          rightColumn: ""
                        })
                      }
                    >
                      <option value="sourceA">Data Source 1</option>
                      <option value="sourceB">Data Source 2</option>
                    </select>
                    <select
                      className="select-input"
                      value={rule.rightColumn}
                      onChange={(e) =>
                        handleRuleChange(rule.id, { rightColumn: e.target.value })
                      }
                    >
                      <option value="">Select column</option>
                      {(rule.rightSource === "sourceA"
                        ? sourceA.columns
                        : sourceB.columns
                      ).map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="link-button-small link-button-danger"
                    onClick={() => handleRemoveRule(rule.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </details>

        <div className="form-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!canSave || isSaving}>
            {isEditMode ? "Save job spec" : "Create job spec"}
          </button>
        </div>
      </form>
    </section>
  );
}

