import { pool } from "./db.js";
import { parseCsvToRows, runReconciliation, buildMockRunResult } from "./reconciliation.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

function toId(str) {
  return str?.toLowerCase().trim().replace(/\s+/g, "-") || "";
}

export function registerRoutes(app) {
  // --- Projects ---
  app.get("/api/projects", async (_req, res) => {
    try {
      const r = await pool.query("SELECT id, name, description FROM projects ORDER BY id");
      res.json(r.rows.map((p) => ({ id: p.id, name: p.name, description: p.description })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const name = (req.body?.name ?? "").trim();
      const description = (req.body?.description ?? "").trim();
      if (!name) return res.status(400).json({ error: "Name required" });
      let id = toId(name);
      const existing = await pool.query("SELECT id FROM projects WHERE id = $1", [id]);
      if (existing.rows.length) id = `${id}-${Date.now()}`;
      await pool.query(
        "INSERT INTO projects (id, name, description) VALUES ($1, $2, $3)",
        [id, name, description]
      );
      res.status(201).json({ id, name, description });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const name = (req.body?.name ?? "").trim();
      const description = (req.body?.description ?? "").trim();
      await pool.query(
        "UPDATE projects SET name = COALESCE(NULLIF($2,''), name), description = $3 WHERE id = $1",
        [id, name, description]
      );
      const r = await pool.query("SELECT id, name, description FROM projects WHERE id = $1", [id]);
      if (!r.rows.length) return res.status(404).json({ error: "Not found" });
      res.json(r.rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Job specs ---
  app.get("/api/job-specs", async (_req, res) => {
    try {
      const r = await pool.query("SELECT id, project_id, name, description, sample_sources, rules FROM job_specs ORDER BY project_id, id");
      res.json(
        r.rows.map((s) => ({
          id: s.id,
          projectId: s.project_id,
          name: s.name,
          description: s.description,
          sampleSources: s.sample_sources ?? undefined,
          rules: s.rules ?? undefined,
        }))
      );
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects/:projectId/job-specs", async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT id, project_id, name, description, sample_sources, rules FROM job_specs WHERE project_id = $1 ORDER BY id",
        [req.params.projectId]
      );
      res.json(
        r.rows.map((s) => ({
          id: s.id,
          projectId: s.project_id,
          name: s.name,
          description: s.description,
          sampleSources: s.sample_sources ?? undefined,
          rules: s.rules ?? undefined,
        }))
      );
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects/:projectId/job-specs", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const { name, description, sampleSources, rules } = req.body ?? {};
      const trimmedName = (name ?? "").trim();
      if (!trimmedName) return res.status(400).json({ error: "Name required" });
      let id = toId(trimmedName);
      const existing = await pool.query("SELECT id FROM job_specs WHERE id = $1", [id]);
      if (existing.rows.length) id = `${id}-${Date.now()}`;
      await pool.query(
        "INSERT INTO job_specs (id, project_id, name, description, sample_sources, rules) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, projectId, trimmedName, (description ?? "").trim(), JSON.stringify(sampleSources ?? []), JSON.stringify(rules ?? [])]
      );
      res.status(201).json({
        id,
        projectId,
        name: trimmedName,
        description: (description ?? "").trim(),
        sampleSources: sampleSources ?? undefined,
        rules: rules ?? undefined,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/job-specs/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const { name, description, sampleSources, rules } = req.body ?? {};
      await pool.query(
        `UPDATE job_specs SET
          name = COALESCE(NULLIF(TRIM($2),''), name),
          description = COALESCE($3, description),
          sample_sources = COALESCE($4, sample_sources),
          rules = COALESCE($5, rules)
        WHERE id = $1`,
        [id, name, description, sampleSources != null ? JSON.stringify(sampleSources) : null, rules != null ? JSON.stringify(rules) : null]
      );
      const r = await pool.query("SELECT id, project_id, name, description, sample_sources, rules FROM job_specs WHERE id = $1", [id]);
      if (!r.rows.length) return res.status(404).json({ error: "Not found" });
      const s = r.rows[0];
      res.json({
        id: s.id,
        projectId: s.project_id,
        name: s.name,
        description: s.description,
        sampleSources: s.sample_sources ?? undefined,
        rules: s.rules ?? undefined,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/job-specs/:id", async (req, res) => {
    try {
      const r = await pool.query("SELECT id, project_id, name, description, sample_sources, rules FROM job_specs WHERE id = $1", [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: "Not found" });
      const s = r.rows[0];
      res.json({
        id: s.id,
        projectId: s.project_id,
        name: s.name,
        description: s.description,
        sampleSources: s.sample_sources ?? undefined,
        rules: s.rules ?? undefined,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/job-specs/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM job_specs WHERE id = $1", [req.params.id]);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Job runs ---
  app.get("/api/job-runs", async (_req, res) => {
    try {
      const r = await pool.query(
        "SELECT id, job_spec_id, run_at, status, source_a_file, source_b_file FROM job_runs ORDER BY run_at DESC"
      );
      res.json(
        r.rows.map((row) => ({
          id: row.id,
          jobSpecId: row.job_spec_id,
          runAt: row.run_at,
          status: row.status,
          sourceAFileName: row.source_a_file ?? undefined,
          sourceBFileName: row.source_b_file ?? undefined
        }))
      );
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/job-specs/:jobSpecId/job-runs", async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT id, job_spec_id, run_at, status, source_a_file, source_b_file FROM job_runs WHERE job_spec_id = $1 ORDER BY run_at DESC",
        [req.params.jobSpecId]
      );
      res.json(
        r.rows.map((row) => ({
          id: row.id,
          jobSpecId: row.job_spec_id,
          runAt: row.run_at,
          status: row.status,
          sourceAFileName: row.source_a_file ?? undefined,
          sourceBFileName: row.source_b_file ?? undefined
        }))
      );
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-specs/:jobSpecId/job-runs", async (req, res) => {
    try {
      const jobSpecId = req.params.jobSpecId;
      const id = crypto.randomUUID();
      const runAt = (req.body?.runAt ?? new Date().toISOString());
      const status = req.body?.status ?? "completed";
      const sourceAFileName = req.body?.sourceAFileName ?? null;
      const sourceBFileName = req.body?.sourceBFileName ?? null;
      await pool.query(
        "INSERT INTO job_runs (id, job_spec_id, run_at, status, source_a_file, source_b_file) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, jobSpecId, runAt, status, sourceAFileName, sourceBFileName]
      );
      const result = req.body?.result;
      if (result) {
        await pool.query(
          `INSERT INTO run_results (run_id, unmatched_a, unmatched_b, archived_a, archived_b, auto_matched, manual_matched)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (run_id) DO UPDATE SET
             unmatched_a = EXCLUDED.unmatched_a,
             unmatched_b = EXCLUDED.unmatched_b,
             archived_a = EXCLUDED.archived_a,
             archived_b = EXCLUDED.archived_b,
             auto_matched = EXCLUDED.auto_matched,
             manual_matched = EXCLUDED.manual_matched`,
          [
            id,
            JSON.stringify(result.unmatchedA ?? []),
            JSON.stringify(result.unmatchedB ?? []),
            JSON.stringify(result.archivedA ?? []),
            JSON.stringify(result.archivedB ?? []),
            JSON.stringify(result.autoMatched ?? []),
            JSON.stringify(result.manualMatched ?? []),
          ]
        );
      }
      res.status(201).json({
        id,
        jobSpecId,
        runAt,
        status,
        sourceAFileName: sourceAFileName ?? undefined,
        sourceBFileName: sourceBFileName ?? undefined
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Run result ---
  app.get("/api/job-runs/:runId/result", async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT unmatched_a, unmatched_b, archived_a, archived_b, auto_matched, manual_matched FROM run_results WHERE run_id = $1",
        [req.params.runId]
      );
      if (!r.rows.length) return res.status(404).json({ error: "No result for this run" });
      const row = r.rows[0];
      res.json({
        unmatchedA: row.unmatched_a ?? [],
        unmatchedB: row.unmatched_b ?? [],
        archivedA: row.archived_a ?? [],
        archivedB: row.archived_b ?? [],
        autoMatched: row.auto_matched ?? [],
        manualMatched: row.manual_matched ?? [],
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-runs/:runId/ensure-result", async (req, res) => {
    try {
      const runId = req.params.runId;
      const jobSpec = req.body ?? {};
      const existing = await pool.query("SELECT run_id FROM run_results WHERE run_id = $1", [runId]);
      if (existing.rows.length) return res.status(200).json({ ok: true });
      const result = buildMockRunResult(jobSpec);
      await pool.query(
        `INSERT INTO run_results (run_id, unmatched_a, unmatched_b, archived_a, archived_b, auto_matched, manual_matched)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          runId,
          JSON.stringify(result.unmatchedA),
          JSON.stringify(result.unmatchedB),
          JSON.stringify(result.archivedA ?? []),
          JSON.stringify(result.archivedB ?? []),
          JSON.stringify(result.autoMatched),
          JSON.stringify(result.manualMatched),
        ]
      );
      res.status(201).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/job-runs/:runId/result", async (req, res) => {
    try {
      const runId = req.params.runId;
      const result = req.body ?? {};
      await pool.query(
        `INSERT INTO run_results (run_id, unmatched_a, unmatched_b, archived_a, archived_b, auto_matched, manual_matched)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (run_id) DO UPDATE SET
           unmatched_a = EXCLUDED.unmatched_a,
           unmatched_b = EXCLUDED.unmatched_b,
           archived_a = EXCLUDED.archived_a,
           archived_b = EXCLUDED.archived_b,
           auto_matched = EXCLUDED.auto_matched,
           manual_matched = EXCLUDED.manual_matched`,
        [
          runId,
          JSON.stringify(result.unmatchedA ?? []),
          JSON.stringify(result.unmatchedB ?? []),
          JSON.stringify(result.archivedA ?? []),
          JSON.stringify(result.archivedB ?? []),
          JSON.stringify(result.autoMatched ?? []),
          JSON.stringify(result.manualMatched ?? []),
        ]
      );
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-runs/:runId/manual-match", async (req, res) => {
    try {
      const runId = req.params.runId;
      const { firstSource, firstRowId, secondSource, secondRowId } = req.body ?? {};
      if (!["sourceA", "sourceB"].includes(firstSource) || !["sourceA", "sourceB"].includes(secondSource)) {
        return res.status(400).json({ error: "Invalid source" });
      }
      const r = await pool.query("SELECT * FROM run_results WHERE run_id = $1", [runId]);
      if (!r.rows.length) return res.status(404).json({ error: "No result for this run" });
      const row = r.rows[0];
      const unmatchedA = row.unmatched_a ?? [];
      const unmatchedB = row.unmatched_b ?? [];
      const manualMatched = row.manual_matched ?? [];
      const first =
        firstSource === "sourceA"
          ? unmatchedA.find((x) => x._id === firstRowId)
          : unmatchedB.find((x) => x._id === firstRowId);
      const second =
        secondSource === "sourceA"
          ? unmatchedA.find((x) => x._id === secondRowId)
          : unmatchedB.find((x) => x._id === secondRowId);
      if (!first || !second) return res.status(400).json({ error: "Row not found" });
      const newUnmatchedA = unmatchedA.filter(
        (x) =>
          !(
            (firstSource === "sourceA" && x._id === firstRowId) ||
            (secondSource === "sourceA" && x._id === secondRowId)
          )
      );
      const newUnmatchedB = unmatchedB.filter(
        (x) =>
          !(
            (firstSource === "sourceB" && x._id === firstRowId) ||
            (secondSource === "sourceB" && x._id === secondRowId)
          )
      );
      await pool.query(
        "UPDATE run_results SET unmatched_a = $2, unmatched_b = $3, manual_matched = $4 WHERE run_id = $1",
        [runId, JSON.stringify(newUnmatchedA), JSON.stringify(newUnmatchedB), JSON.stringify([...manualMatched, { left: first, right: second }])]
      );
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-runs/:runId/archive-unmatched", async (req, res) => {
    try {
      const runId = req.params.runId;
      const { source, rowId } = req.body ?? {};
      if (!["sourceA", "sourceB"].includes(source)) {
        return res.status(400).json({ error: "Invalid source" });
      }
      const r = await pool.query("SELECT * FROM run_results WHERE run_id = $1", [runId]);
      if (!r.rows.length) return res.status(404).json({ error: "No result for this run" });
      const row = r.rows[0];
      if (source === "sourceA") {
        const unmatchedA = row.unmatched_a ?? [];
        const archivedA = row.archived_a ?? [];
        const target = unmatchedA.find((x) => x._id === rowId);
        if (!target) return res.status(404).json({ error: "Record not found in unmatched sourceA" });
        await pool.query(
          "UPDATE run_results SET unmatched_a = $2, archived_a = $3 WHERE run_id = $1",
          [runId, JSON.stringify(unmatchedA.filter((x) => x._id !== rowId)), JSON.stringify([...archivedA, target])]
        );
      } else {
        const unmatchedB = row.unmatched_b ?? [];
        const archivedB = row.archived_b ?? [];
        const target = unmatchedB.find((x) => x._id === rowId);
        if (!target) return res.status(404).json({ error: "Record not found in unmatched sourceB" });
        await pool.query(
          "UPDATE run_results SET unmatched_b = $2, archived_b = $3 WHERE run_id = $1",
          [runId, JSON.stringify(unmatchedB.filter((x) => x._id !== rowId)), JSON.stringify([...archivedB, target])]
        );
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Aggregated result ---
  app.get("/api/job-specs/:jobSpecId/aggregated-result", async (req, res) => {
    try {
      const jobSpecId = req.params.jobSpecId;
      const runs = await pool.query("SELECT id FROM job_runs WHERE job_spec_id = $1 ORDER BY run_at DESC", [jobSpecId]);
      const unmatchedA = [];
      const unmatchedB = [];
      const archivedA = [];
      const archivedB = [];
      let autoMatched = [];
      let manualMatched = [];
      for (const run of runs.rows) {
        const rr = await pool.query("SELECT * FROM run_results WHERE run_id = $1", [run.id]);
        if (!rr.rows.length) continue;
        const r = rr.rows[0];
        (r.unmatched_a ?? []).forEach((row) => unmatchedA.push({ runId: run.id, row }));
        (r.unmatched_b ?? []).forEach((row) => unmatchedB.push({ runId: run.id, row }));
        (r.archived_a ?? []).forEach((row) => archivedA.push({ runId: run.id, row }));
        (r.archived_b ?? []).forEach((row) => archivedB.push({ runId: run.id, row }));
        autoMatched = autoMatched.concat(r.auto_matched ?? []);
        manualMatched = manualMatched.concat(r.manual_matched ?? []);
      }
      const specMatches = await pool.query(
        "SELECT left_row, right_row FROM job_spec_manual_matches WHERE job_spec_id = $1",
        [jobSpecId]
      );
      specMatches.rows.forEach((m) => manualMatched.push({ left: m.left_row, right: m.right_row }));
      res.json({ unmatchedA, unmatchedB, archivedA, archivedB, autoMatched, manualMatched });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/job-specs/:jobSpecId/archived-records", async (req, res) => {
    try {
      const jobSpecId = req.params.jobSpecId;
      const runs = await pool.query(
        "SELECT id, run_at, source_a_file, source_b_file FROM job_runs WHERE job_spec_id = $1 ORDER BY run_at DESC",
        [jobSpecId]
      );
      const archived = [];
      for (const run of runs.rows) {
        const rr = await pool.query("SELECT archived_a, archived_b FROM run_results WHERE run_id = $1", [run.id]);
        if (!rr.rows.length) continue;
        const result = rr.rows[0];
        (result.archived_a ?? []).forEach((row) =>
          archived.push({
            runId: run.id,
            runAt: run.run_at,
            source: "sourceA",
            sourceFileName: run.source_a_file ?? undefined,
            row
          })
        );
        (result.archived_b ?? []).forEach((row) =>
          archived.push({
            runId: run.id,
            runAt: run.run_at,
            source: "sourceB",
            sourceFileName: run.source_b_file ?? undefined,
            row
          })
        );
      }
      res.json(archived);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-specs/:jobSpecId/manual-match", async (req, res) => {
    try {
      const jobSpecId = req.params.jobSpecId;
      const { firstRunId, firstSource, firstRowId, secondRunId, secondSource, secondRowId } = req.body ?? {};
      if (!["sourceA", "sourceB"].includes(firstSource) || !["sourceA", "sourceB"].includes(secondSource)) {
        return res.status(400).json({ error: "Invalid source" });
      }
      const [firstRes, secondRes] = await Promise.all([
        pool.query("SELECT * FROM run_results WHERE run_id = $1", [firstRunId]),
        pool.query("SELECT * FROM run_results WHERE run_id = $1", [secondRunId]),
      ]);
      if (!firstRes.rows.length || !secondRes.rows.length) return res.status(404).json({ error: "Run result not found" });
      const firstResult = firstRes.rows[0];
      const secondResult = secondRes.rows[0];
      const first =
        firstSource === "sourceA"
          ? (firstResult.unmatched_a ?? []).find((x) => x._id === firstRowId)
          : (firstResult.unmatched_b ?? []).find((x) => x._id === firstRowId);
      const second =
        secondSource === "sourceA"
          ? (secondResult.unmatched_a ?? []).find((x) => x._id === secondRowId)
          : (secondResult.unmatched_b ?? []).find((x) => x._id === secondRowId);
      if (!first || !second) return res.status(400).json({ error: "Row not found" });
      await pool.query(
        "INSERT INTO job_spec_manual_matches (id, job_spec_id, left_row, right_row) VALUES ($1, $2, $3, $4)",
        [crypto.randomUUID(), jobSpecId, JSON.stringify(first), JSON.stringify(second)]
      );
      const updatesByRun = {};
      const enqueue = (runId, source, rowId) => {
        if (!updatesByRun[runId]) updatesByRun[runId] = { sourceA: [], sourceB: [] };
        updatesByRun[runId][source].push(rowId);
      };
      enqueue(firstRunId, firstSource, firstRowId);
      enqueue(secondRunId, secondSource, secondRowId);

      for (const [runId, ids] of Object.entries(updatesByRun)) {
        const currentRes = runId === firstRunId ? firstResult : secondResult;
        const nextA = (currentRes.unmatched_a ?? []).filter((x) => !ids.sourceA.includes(x._id));
        const nextB = (currentRes.unmatched_b ?? []).filter((x) => !ids.sourceB.includes(x._id));
        await pool.query(
          "UPDATE run_results SET unmatched_a = $2, unmatched_b = $3 WHERE run_id = $1",
          [runId, JSON.stringify(nextA), JSON.stringify(nextB)]
        );
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Run job (CSV upload) ---
  app.post("/api/job-specs/:jobSpecId/run", upload.fields([{ name: "fileA", maxCount: 1 }, { name: "fileB", maxCount: 1 }]), async (req, res) => {
    try {
      const jobSpecId = req.params.jobSpecId;
      const files = req.files ?? {};
      const fileA = files.fileA?.[0];
      const fileB = files.fileB?.[0];
      if (!fileA || !fileB) return res.status(400).json({ error: "Both fileA and fileB are required" });
      const specRow = await pool.query("SELECT * FROM job_specs WHERE id = $1", [jobSpecId]);
      if (!specRow.rows.length) return res.status(404).json({ error: "Job spec not found" });
      const jobSpec = {
        id: specRow.rows[0].id,
        projectId: specRow.rows[0].project_id,
        name: specRow.rows[0].name,
        description: specRow.rows[0].description,
        sampleSources: specRow.rows[0].sample_sources ?? undefined,
        rules: specRow.rows[0].rules ?? undefined,
      };
      const textA = fileA.buffer.toString("utf-8");
      const textB = fileB.buffer.toString("utf-8");
      const rowsA = parseCsvToRows(textA);
      const rowsB = parseCsvToRows(textB);
      const result = runReconciliation(jobSpec, rowsA, rowsB);
      const runId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO job_runs (id, job_spec_id, run_at, status, source_a_file, source_b_file) VALUES ($1, $2, $3, $4, $5, $6)",
        [runId, jobSpecId, new Date().toISOString(), "completed", fileA.originalname, fileB.originalname]
      );
      await pool.query(
        `INSERT INTO run_results (run_id, unmatched_a, unmatched_b, archived_a, archived_b, auto_matched, manual_matched)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          runId,
          JSON.stringify(result.unmatchedA),
          JSON.stringify(result.unmatchedB),
          JSON.stringify(result.archivedA ?? []),
          JSON.stringify(result.archivedB ?? []),
          JSON.stringify(result.autoMatched),
          JSON.stringify(result.manualMatched),
        ]
      );
      res.status(201).json({
        id: runId,
        jobSpecId,
        runAt: new Date().toISOString(),
        status: "completed",
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
