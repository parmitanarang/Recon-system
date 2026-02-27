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
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = { _id: `row-${i}-${Math.random().toString(36).slice(2)}` };
    headers.forEach((h, j) => { row[h] = values[j] ?? ""; });
    rows.push(row);
  }
  return rows;
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
          const leftVal = rule.left.source === "sourceA" ? a[rule.left.column] : b[rule.left.column];
          const rightVal = rule.right.source === "sourceA" ? a[rule.right.column] : b[rule.right.column];
          return String(leftVal ?? "").trim() === String(rightVal ?? "").trim();
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
  return { unmatchedA: listA, unmatchedB: listB, autoMatched, manualMatched: [] };
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
  return { unmatchedA, unmatchedB, autoMatched, manualMatched: [] };
}
