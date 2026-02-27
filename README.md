## Reconciliation System

This repository contains a multi‑phase implementation of a reconciliation system used to compare data between two sources (Source A and Source B).

The core domain concepts are:
- **Project**: A group of related job specs (for example, "Load Money" or "Pixel Repayments").
- **Job Spec**: A reusable definition of reconciliation rules for a specific data comparison.
- **Job Run**: An individual execution of a job spec against real data.

---

## Phase 1 – UI Skeleton for Projects, Job Specs, and Job Runs

**Goal**: Implement a neutral‑themed web UI that reflects the initial designs for:
- Listing all **projects**
- Viewing **job specs** within a project
- Viewing **job runs** for a job spec
 - Managing projects and selected job specs in‑memory

**Scope**:
- Frontend built with **Node.js tooling + React + Vite + TypeScript**
- No persistence layer yet – the UI uses **in‑memory mock data**
- Simple client‑side routing between:
  - Projects list
  - Job specs for a project
  - Job runs for a job spec
- Styling uses a **neutral palette** (grays with a muted accent) instead of the original blue theme.
 - Shared in‑memory store (React context) powers:
   - **Create / edit / delete** projects
   - **Delete** job specs (and their job runs) within a project

**How to run (Phase 1)**:
1. Install Node.js (v18+ recommended).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the printed URL (typically `http://localhost:5173`) in your browser.

---

## Phase 2 – Job Spec Builder (in‑memory)

**Goal**: Add the ability to **create and edit job specs** with a structured, three‑step builder.

**What’s included**:
- From a project’s **Job Specs** screen you can:
  - Create a new job spec.
  - Edit an existing job spec.
- The job spec builder runs in a **single page with three collapsible steps**:
  1. **Name & description** – give the job spec a clear title and short description.
  2. **Sample CSV files** – upload one CSV for **Data Source 1** and one for **Data Source 2**; the UI reads the header row to discover available columns (stored only in memory).
  3. **Matching rules** – define up to **5 rules** where:
     - Each rule chooses a column from either source on the left.
     - Chooses a column from either source on the right.
     - Conceptually expresses “left column = right column” for matching.
- All job spec configuration is still **stored in React state only**; there is **no backend persistence** yet.

**How to use (Phase 2)**:
- Go to a project → click **“+ New job spec”** or **Edit** on an existing spec.
- Complete Steps 1–3 and click **Create job spec** / **Save job spec**.
- You’ll return to the project’s job specs list with the new/updated spec visible for the current session.

---

## Phase 3 – View Data (first part)

**Goal**: Define and implement what appears when the user clicks **“View Data”** on a job run row on the Job Runs page.

**What’s included**:
- Clicking **“View Data”** opens a **modal** with reconciliation data for that run.
- The modal has **three tabs**:
  1. **Unmatched** – Records that did not satisfy any of the job spec rules. Two side‑by‑side panels (Data Source 1 and Data Source 2), each with a table and **checkboxes** per row. When the user selects **one row from the left** and **one from the right**, a **“Manual match”** button appears; clicking it moves that pair into the Manual Matched list.
  2. **Auto Matched** – Records that matched automatically via the job spec rules, shown in a single table with columns from both sources.
  3. **Manual Matched** – Records the user has manually matched, same table layout as Auto Matched.
- Run result data (unmatched, auto‑matched, manual‑matched) is stored **in memory** in the app context. Manual matches persist for the session.
- Labels use **“Data Source 1”** and **“Data Source 2”** only (no other product names in the UI).
- For runs that have no stored result yet, the UI seeds **mock data** from the job spec’s sample column definitions so the three tabs are usable immediately.

**How to use (Phase 3 – View Data)**:
- Go to a project → a job spec → Job Runs.
- Click **“View Data”** on any run.
- Switch between Unmatched / Auto Matched / Manual Matched; in Unmatched, select one row in each panel and click **“Manual match”** to see the pair move to Manual Matched.

**Phase 3 – Data pill (aggregated across runs)**:
- Clicking the **“Data”** pill on the Job Runs page shows a view that is **not bound to a single job run**.
- It **compiles data across all job runs** for that job spec, so line items from one run’s Source A / Source B can be matched with line items from another run’s Source A / Source B.
- The same **three tabs** appear: **Unmatched**, **Auto Matched**, **Manual Matched**, each with a count.
- **Unmatched**: Two panels (Data Source 1 and Data Source 2) with checkboxes. Select one row from the left and one from the right; a **“Manual match”** button appears. Clicking it adds that pair to Manual Matched and removes them from the aggregated unmatched lists (the match is stored at job-spec level).
- **Auto Matched** / **Manual Matched**: Single table with columns from both sources; toolbar includes Date Range, “+ Filter”, and “Export Matched”.
- Labels use **“Data Source 1”** and **“Data Source 2”** only.

**Phase 3 – Run a Job**: Run a Job opens a modal to upload Data Source A and Data Source B as CSV files (UI states CSV format required). On Run job, the app parses the CSVs and runs the job spec rules (1:1 matching); a new run is created and the result appears in View Data and the Data tab.

---

## Phase 4 – Backend API and persistence

**Goal**: Persist projects, job specs, job runs, and run results in PostgreSQL, with an Express API and a frontend that can run against the API or in-memory.

**What’s included**:
- **Backend** (`server/`): Node (ESM), Express, PostgreSQL (via `pg`), CORS, multer for CSV uploads.
- **API**: Projects CRUD; job specs CRUD; job runs list/create; run result get/put/ensure; manual match (per-run and aggregated); “Run a Job” (`POST /api/job-specs/:id/run`) with two CSV files.
- **Frontend**: When the API is configured (see below), the app uses `ApiDataProvider` and talks to the backend; otherwise it uses in-memory mock data.
- **Run a Job**: In API mode, CSV files are sent to the backend; reconciliation runs on the server and the new run/result are stored in the DB.

**How to run the backend locally**:
1. Create a Postgres database and set `DATABASE_URL` (e.g. `postgres://user:pass@localhost:5432/recon`).
2. From the repo root:
   ```bash
   cd server && npm install && npm run dev
   ```
   Server runs at `http://localhost:3000` (or the next free port if 3000 is in use).
3. Run the frontend with the API URL:
   ```bash
   npm install && VITE_API_URL=http://localhost:3000 npm run dev
   ```
   Open the Vite dev URL (e.g. `http://localhost:5173`). The UI will use the backend for all data and for “Run a Job”.

**Environment variables**:
- **Backend**: `DATABASE_URL` (required for persistence). `PORT` (optional; default 3000).
- **Frontend (build-time)**: `VITE_API_URL` – base URL of the API (e.g. `http://localhost:3000`). If unset, the app uses in-memory data in development; in production builds it assumes the API is on the same origin.

---

## Deploying on Render

The repo includes a **Render Blueprint** (`render.yaml`) for a single web service plus Postgres.

1. **Connect the repo** to Render and use the Blueprint to create:
   - A **Postgres** database (`reconciliation-db`).
   - A **Web Service** (`reconciliation-system`) that builds the frontend, installs server deps, and runs the Node server.

2. **Build**: `npm install && npm run build && cd server && npm install`  
   **Start**: `cd server && npm start`

3. The service serves the API at `/api/*` and the built frontend from the same host. `DATABASE_URL` is set automatically from the linked Postgres instance.

4. No need to set `VITE_API_URL` for this deploy: the production build uses the same origin for API calls.

5. After the first deploy, the database is empty; create projects and job specs via the UI.

---

## Upcoming Phases (High‑Level)

These phases are not yet implemented but will be documented as they are added:
- **Phase 5**: Actual reconciliation engine and data ingestion (beyond current rule-based matching).
- **Phase 6**: Scheduling, notifications, and reporting.

Each phase will update this README with:
- **New capabilities**
- **How to run / test** the new pieces
- Any **breaking changes** or migrations.

