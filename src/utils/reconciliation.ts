import type { DataRow, JobSpec, MatchPair, RunResult } from "../data/mock";

/**
 * Parse CSV text into rows (array of objects keyed by header). Adds _id to each row.
 * Handles quoted fields and commas inside quotes.
 */
export function parseCsvToRows(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = { _id: `row-${i}-${Math.random().toString(36).slice(2)}` };
    headers.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\n" && !inQuotes)) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

/**
 * Run reconciliation: match rows from A and B using job spec rules (1:1 greedy).
 * Returns RunResult with DataRow (with _id) for unmatched and auto-matched pairs.
 */
export function runReconciliation(
  jobSpec: JobSpec,
  rowsA: Record<string, string>[],
  rowsB: Record<string, string>[]
): RunResult {
  const rules = jobSpec.rules ?? [];
  const colsA = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceA")?.columns ?? [];
  const colsB = jobSpec.sampleSources?.find((s) => s.sourceId === "sourceB")?.columns ?? [];

  const toDataRow = (raw: Record<string, string>, id: string): DataRow => ({
    ...raw,
    _id: id
  });

  let listA = rowsA.map((r, i) => toDataRow(r, `a-${i}-${Math.random().toString(36).slice(2)}`));
  let listB = rowsB.map((r, i) => toDataRow(r, `b-${i}-${Math.random().toString(36).slice(2)}`));

  const autoMatched: MatchPair[] = [];

  if (rules.length > 0) {
    const remainingA = [...listA];
    const remainingB = [...listB];

    for (const a of listA) {
      const matchIndex = remainingB.findIndex((b) => {
        return rules.every((rule) => {
          const leftVal =
            rule.left.source === "sourceA" ? a[rule.left.column] : (b as DataRow)[rule.left.column];
          const rightVal =
            rule.right.source === "sourceA" ? a[rule.right.column] : (b as DataRow)[rule.right.column];
          return String(leftVal ?? "").trim() === String(rightVal ?? "").trim();
        });
      });
      if (matchIndex >= 0) {
        const b = remainingB[matchIndex];
        autoMatched.push({ left: a, right: b });
        remainingA.splice(remainingA.indexOf(a), 1);
        remainingB.splice(matchIndex, 1);
      }
    }

    listA = remainingA;
    listB = remainingB;
  }

  return {
    unmatchedA: listA,
    unmatchedB: listB,
    autoMatched,
    manualMatched: []
  };
}
