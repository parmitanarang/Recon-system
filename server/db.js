import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS job_specs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        sample_sources JSONB,
        rules JSONB
      );
      CREATE TABLE IF NOT EXISTS job_runs (
        id TEXT PRIMARY KEY,
        job_spec_id TEXT NOT NULL REFERENCES job_specs(id) ON DELETE CASCADE,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'completed',
        source_a_file TEXT,
        source_b_file TEXT
      );
      ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS source_a_file TEXT;
      ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS source_b_file TEXT;
      CREATE TABLE IF NOT EXISTS run_results (
        run_id TEXT PRIMARY KEY REFERENCES job_runs(id) ON DELETE CASCADE,
        unmatched_a JSONB NOT NULL DEFAULT '[]',
        unmatched_b JSONB NOT NULL DEFAULT '[]',
        archived_a JSONB NOT NULL DEFAULT '[]',
        archived_b JSONB NOT NULL DEFAULT '[]',
        auto_matched JSONB NOT NULL DEFAULT '[]',
        manual_matched JSONB NOT NULL DEFAULT '[]'
      );
      ALTER TABLE run_results ADD COLUMN IF NOT EXISTS archived_a JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE run_results ADD COLUMN IF NOT EXISTS archived_b JSONB NOT NULL DEFAULT '[]';
      CREATE TABLE IF NOT EXISTS job_spec_manual_matches (
        id TEXT PRIMARY KEY,
        job_spec_id TEXT NOT NULL REFERENCES job_specs(id) ON DELETE CASCADE,
        left_row JSONB NOT NULL,
        right_row JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_job_specs_project ON job_specs(project_id);
      CREATE INDEX IF NOT EXISTS idx_job_runs_spec ON job_runs(job_spec_id);
      CREATE INDEX IF NOT EXISTS idx_jsm_job_spec ON job_spec_manual_matches(job_spec_id);
    `);
  } finally {
    client.release();
  }
}

export { pool };
