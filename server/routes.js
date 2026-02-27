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
      const r = await pool.query("SELECT id, job_spec_id, run_at, status FROM job_runs ORDER BY run_at DESC");
      res.json(r.rows.map((row) => ({ id: row.id, jobSpecId: row.job_spec_id, runAt: row.run_at, status: row.status })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/job-specs/:jobSpecId/job-runs", async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT id, job_spec_id, run_at, status FROM job_runs WHERE job_spec_id = $1 ORDER BY run_at DESC",
        [req.params.jobSpecId]
      );
      res.json(
        r.rows.map((row) => ({
          id: row.id,
          jobSpecId: row.job_spec_id,
          runAt: row.run_at,
          status: row.status,
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
      await pool.query(
        "INSERT INTO job_runs (id, job_spec_id, run_at, status) VALUES ($1, $2, $3, $4)",
        [id, jobSpecId, runAt, status]
      );
      const result = req.body?.result;
      if (result) {
        await pool.query(
          `INSERT INTO run_results (run_id, unmatched_a, unmatched_b, auto_matched, manual_matched)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (run_id) DO UPDATE SET
             unmatched_a = EXCLUDED.unmatched_a,
             unmatched_b = EXCLUDED.unmatched_b,
             auto_matched = EXCLUDED.auto_matched,
             manual_matched = EXCLUDED.manual_matched`,
          [
            id,
            JSON.stringify(result.unmatchedA ?? []),
            JSON.stringify(result.unmatchedB ?? []),
            JSON.stringify(result.autoMatched ?? []),
            JSON.stringify(result.manualMatched ?? []),
          ]
        );
      }
      res.status(201).json({ id, jobSpecId, runAt, status });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Run result ---
  app.get("/api/job-runs/:runId/result", async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT unmatched_a, unmatched_b, auto_matched, manual_matched FROM run_results WHERE run_id = $1",
        [req.params.runId]
      );
      if (!r.rows.length) return res.status(404).json({ error: "No result for this run" });
      const row = r.rows[0];
      res.json({
        unmatchedA: row.unmatched_a ?? [],
        unmatchedB: row.unmatched_b ?? [],
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
        `INSERT INTO run_results (run_id, unmatched_a, unmatched_b, auto_matched, manual_matched)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          runId,
          JSON.stringify(result.unmatchedA),
          JSON.stringify(result.unmatchedB),
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
        `INSERT INTO run_results (run_id, unmatched_a, unmatched_b, auto_matched, manual_matched)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (run_id) DO UPDATE SET
           unmatched_a = EXCLUDED.unmatched_a,
           unmatched_b = EXCLUDED.unmatched_b,
           auto_matched = EXCLUDED.auto_matched,
           manual_matched = EXCLUDED.manual_matched`,
        [
          runId,
          JSON.stringify(result.unmatchedA ?? []),
          JSON.stringify(result.unmatchedB ?? []),
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
      const { leftRowId, rightRowId } = req.body ?? {};
      const r = await pool.query("SELECT * FROM run_results WHERE run_id = $1", [runId]);
      if (!r.rows.length) return res.status(404).json({ error: "No result for this run" });
      const row = r.rows[0];
      const unmatchedA = row.unmatched_a ?? [];
      const unmatchedB = row.unmatched_b ?? [];
      const manualMatched = row.manual_matched ?? [];
      const left = unmatchedA.find((x) => x._id === leftRowId);
      const right = unmatchedB.find((x) => x._id === rightRowId);
      if (!left || !right) return res.status(400).json({ error: "Row not found" });
      const newUnmatchedA = unmatchedA.filter((x) => x._id !== leftRowId);
      const newUnmatchedB = unmatchedB.filter((x) => x._id !== rightRowId);
      await pool.query(
        "UPDATE run_results SET unmatched_a = $2, unmatched_b = $3, manual_matched = $4 WHERE run_id = $1",
        [runId, JSON.stringify(newUnmatchedA), JSON.stringify(newUnmatchedB), JSON.stringify([...manualMatched, { left, right }])]
      );
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
      let autoMatched = [];
      let manualMatched = [];
      for (const run of runs.rows) {
        const rr = await pool.query("SELECT * FROM run_results WHERE run_id = $1", [run.id]);
        if (!rr.rows.length) continue;
        const r = rr.rows[0];
        (r.unmatched_a ?? []).forEach((row) => unmatchedA.push({ runId: run.id, row }));
        (r.unmatched_b ?? []).forEach((row) => unmatchedB.push({ runId: run.id, row }));
        autoMatched = autoMatched.concat(r.auto_matched ?? []);
        manualMatched = manualMatched.concat(r.manual_matched ?? []);
      }
      const specMatches = await pool.query(
        "SELECT left_row, right_row FROM job_spec_manual_matches WHERE job_spec_id = $1",
        [jobSpecId]
      );
      specMatches.rows.forEach((m) => manualMatched.push({ left: m.left_row, right: m.right_row }));
      res.json({ unmatchedA, unmatchedB, autoMatched, manualMatched });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/job-specs/:jobSpecId/manual-match", async (req, res) => {
    try {
      const jobSpecId = req.params.jobSpecId;
      const { leftRunId, leftRowId, rightRunId, rightRowId } = req.body ?? {};
      const [leftRes, rightRes] = await Promise.all([
        pool.query("SELECT * FROM run_results WHERE run_id = $1", [leftRunId]),
        pool.query("SELECT * FROM run_results WHERE run_id = $1", [rightRunId]),
      ]);
      if (!leftRes.rows.length || !rightRes.rows.length) return res.status(404).json({ error: "Run result not found" });
      const leftResult = leftRes.rows[0];
      const rightResult = rightRes.rows[0];
      const left = (leftResult.unmatched_a ?? []).find((x) => x._id === leftRowId);
      const right = (rightResult.unmatched_b ?? []).find((x) => x._id === rightRowId);
      if (!left || !right) return res.status(400).json({ error: "Row not found" });
      await pool.query(
        "INSERT INTO job_spec_manual_matches (id, job_spec_id, left_row, right_row) VALUES ($1, $2, $3, $4)",
        [crypto.randomUUID(), jobSpecId, JSON.stringify(left), JSON.stringify(right)]
      );
      await pool.query(
        "UPDATE run_results SET unmatched_a = $2 WHERE run_id = $1",
        [leftRunId, JSON.stringify((leftResult.unmatched_a ?? []).filter((x) => x._id !== leftRowId))]
      );
      await pool.query(
        "UPDATE run_results SET unmatched_b = $2 WHERE run_id = $1",
        [rightRunId, JSON.stringify((rightResult.unmatched_b ?? []).filter((x) => x._id !== rightRowId))]
      );
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
        "INSERT INTO job_runs (id, job_spec_id, run_at, status) VALUES ($1, $2, $3, $4)",
        [runId, jobSpecId, new Date().toISOString(), "completed"]
      );
      await pool.query(
        `INSERT INTO run_results (run_id, unmatched_a, unmatched_b, auto_matched, manual_matched)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          runId,
          JSON.stringify(result.unmatchedA),
          JSON.stringify(result.unmatchedB),
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
