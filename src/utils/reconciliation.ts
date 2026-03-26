import type { DataRow, JobSpec, MatchPair, RunResult } from "../data/mock";

/**
 * Parse CSV text into rows (array of objects keyed by header). Adds _id to each row.
 * Handles quoted fields and commas inside quotes.
 */
export function parseCsvToRows(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => normalizeHeader(h));
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

function normalizeHeader(header: string): string {
  // Strip UTF-8 BOM when present and normalize surrounding whitespace.
  return header.replace(/^\uFEFF/, "").trim();
}

function normalizeColumnKey(name: string): string {
  return normalizeHeader(name).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getRowValue(row: Record<string, string>, column: string): string {
  if (column in row) return String(row[column] ?? "");
  const normalizedTarget = normalizeColumnKey(column);
  const matchedKey = Object.keys(row).find((k) => normalizeColumnKey(k) === normalizedTarget);
  if (!matchedKey) return "";
  return String(row[matchedKey] ?? "");
}

function normalizeText(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseNumberLike(value: string): number | null {
  const numericLike = normalizeText(value).replace(/[$,]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(numericLike)) return null;
  return Number(numericLike);
}

function parseDateLike(value: string): { structurals: string[]; epoch?: number } | null {
  const normalizedText = normalizeText(value);
  const parts = normalizedText.match(/\d+/g);
  if (!parts || parts.length < 3) return null;

  const hasLikelyDateShape =
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})/.test(normalizedText);
  if (!hasLikelyDateShape) return null;

  const structuralSet = new Set<string>();

  const hour = parts[3] ?? "0";
  const minute = parts[4] ?? "0";
  const second = parts[5] ?? "0";

  const pad2 = (n: string) => n.padStart(2, "0");
  const buildStructural = (year: string, month: string, day: string) =>
    `${year.padStart(4, "0")}${pad2(month)}${pad2(day)}${pad2(hour)}${pad2(minute)}${pad2(second)}`;
  const isValidMonthDay = (month: string, day: string) => {
    const m = Number(month);
    const d = Number(day);
    return m >= 1 && m <= 12 && d >= 1 && d <= 31;
  };

  if (parts[0].length === 4) {
    if (isValidMonthDay(parts[1], parts[2])) {
      structuralSet.add(buildStructural(parts[0], parts[1], parts[2]));
    }
  } else if (parts[2].length === 4) {
    // DMY candidate
    if (isValidMonthDay(parts[1], parts[0])) {
      structuralSet.add(buildStructural(parts[2], parts[1], parts[0]));
    }
    // MDY candidate
    if (isValidMonthDay(parts[0], parts[1])) {
      structuralSet.add(buildStructural(parts[2], parts[0], parts[1]));
    }
  }

  if (structuralSet.size === 0) return null;

  const dateParseInput = normalizedText.replace(" ", "T");
  const parsed = Date.parse(dateParseInput);
  const hasTimezone = /z$|[+\-]\d{2}:?\d{2}$/.test(dateParseInput);
  if (!Number.isNaN(parsed) && hasTimezone) {
    return { structurals: [...structuralSet], epoch: parsed };
  }
  return { structurals: [...structuralSet] };
}

function valuesMatch(left: string, right: string): boolean {
  const leftDate = parseDateLike(left);
  const rightDate = parseDateLike(right);
  if (leftDate && rightDate) {
    if (leftDate.structurals.some((s) => rightDate.structurals.includes(s))) return true;
    if (leftDate.epoch != null && rightDate.epoch != null) {
      return leftDate.epoch === rightDate.epoch;
    }
  }

  const leftNum = parseNumberLike(left);
  const rightNum = parseNumberLike(right);
  if (leftNum != null && rightNum != null) {
    return leftNum === rightNum;
  }

  return normalizeText(left) === normalizeText(right);
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
            rule.left.source === "sourceA"
              ? getRowValue(a, rule.left.column)
              : getRowValue(b as DataRow, rule.left.column);
          const rightVal =
            rule.right.source === "sourceA"
              ? getRowValue(a, rule.right.column)
              : getRowValue(b as DataRow, rule.right.column);
          return valuesMatch(leftVal, rightVal);
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
    archivedA: [],
    archivedB: [],
    autoMatched,
    manualMatched: []
  };
}
