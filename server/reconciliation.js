function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if ((c === "," && !inQuotes) || (c === "\n" && !inQuotes)) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else current += c;
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

export function parseCsvToRows(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => normalizeHeader(h));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = { _id: `row-${i}-${Math.random().toString(36).slice(2)}` };
    headers.forEach((h, j) => { row[h] = values[j] ?? ""; });
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(header) {
  return String(header ?? "").replace(/^\uFEFF/, "").trim();
}

function normalizeColumnKey(name) {
  return normalizeHeader(name).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getRowValue(row, column) {
  if (column in row) return String(row[column] ?? "");
  const normalizedTarget = normalizeColumnKey(column);
  const matchedKey = Object.keys(row).find((k) => normalizeColumnKey(k) === normalizedTarget);
  if (!matchedKey) return "";
  return String(row[matchedKey] ?? "");
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseNumberLike(value) {
  const numericLike = normalizeText(value).replace(/[$,]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(numericLike)) return null;
  return Number(numericLike);
}

function parseDateLike(value) {
  const normalizedText = normalizeText(value);
  const parts = normalizedText.match(/\d+/g);
  if (!parts || parts.length < 3) return null;

  const hasLikelyDateShape =
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})/.test(normalizedText);
  if (!hasLikelyDateShape) return null;

  const structuralSet = new Set();

  const hour = parts[3] ?? "0";
  const minute = parts[4] ?? "0";
  const second = parts[5] ?? "0";

  const pad2 = (n) => String(n).padStart(2, "0");
  const buildStructural = (year, month, day) =>
    `${String(year).padStart(4, "0")}${pad2(month)}${pad2(day)}${pad2(hour)}${pad2(minute)}${pad2(second)}`;
  const isValidMonthDay = (month, day) => {
    const m = Number(month);
    const d = Number(day);
    return m >= 1 && m <= 12 && d >= 1 && d <= 31;
  };

  if (parts[0].length === 4) {
    if (isValidMonthDay(parts[1], parts[2])) {
      structuralSet.add(buildStructural(parts[0], parts[1], parts[2]));
    }
  } else if (parts[2].length === 4) {
    if (isValidMonthDay(parts[1], parts[0])) {
      structuralSet.add(buildStructural(parts[2], parts[1], parts[0]));
    }
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

function valuesMatch(left, right) {
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

export function runReconciliation(jobSpec, rowsA, rowsB) {
  const rules = jobSpec.rules ?? [];
  const toDataRow = (raw, id) => ({ ...raw, _id: id });
  let listA = rowsA.map((r, i) => toDataRow(r, `a-${i}-${Math.random().toString(36).slice(2)}`));
  let listB = rowsB.map((r, i) => toDataRow(r, `b-${i}-${Math.random().toString(36).slice(2)}`));
  const autoMatched = [];
  if (rules.length > 0) {
    const remainingA = [...listA];
    const remainingB = [...listB];
    for (const a of listA) {
      const matchIndex = remainingB.findIndex((b) =>
        rules.every((rule) => {
          const leftVal = rule.left.source === "sourceA"
            ? getRowValue(a, rule.left.column)
            : getRowValue(b, rule.left.column);
          const rightVal = rule.right.source === "sourceA"
            ? getRowValue(a, rule.right.column)
            : getRowValue(b, rule.right.column);
          return valuesMatch(leftVal, rightVal);
        })
      );
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
  return { unmatchedA: listA, unmatchedB: listB, archivedA: [], archivedB: [], autoMatched, manualMatched: [] };
}

export function buildMockRunResult(jobSpec) {
  const colsA = (jobSpec.sampleSources ?? []).find((s) => s.sourceId === "sourceA")?.columns ?? [];
  const colsB = (jobSpec.sampleSources ?? []).find((s) => s.sourceId === "sourceB")?.columns ?? [];
  const makeRow = (cols, prefix, n) => {
    const row = { _id: `${prefix}-${n}-${Math.random().toString(36).slice(2)}` };
    cols.forEach((c) => { row[c] = `${c}_${prefix}_${n}`; });
    return row;
  };
  const unmatchedA = colsA.length ? [1, 2, 3].map((n) => makeRow(colsA, "unmatchedA", n)) : [];
  const unmatchedB = colsB.length ? [1, 2, 3].map((n) => makeRow(colsB, "unmatchedB", n)) : [];
  const autoMatched = colsA.length && colsB.length
    ? [1, 2].map((n) => ({ left: makeRow(colsA, "autoLeft", n), right: makeRow(colsB, "autoRight", n) }))
    : [];
  return { unmatchedA, unmatchedB, archivedA: [], archivedB: [], autoMatched, manualMatched: [] };
}
