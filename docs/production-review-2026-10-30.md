# Production review — 30 October 2026

## Changes

- Daily and weekly submission routes share strict calendar-date and time validation.
  Invalid dates, negative/non-finite times, malformed rows and duplicate workload IDs
  are rejected before writes. Delete routes validate dates as well.
- Full history, overview, enrollment and export reads no longer silently stop at
  fixed record limits. Related-item reads use bound parameters in batches of 100
  rather than one arbitrarily large SQLite OR expression.
- Corrections load prior items in batches. History resolution caches predecessor
  records and roots across chains, avoiding repeated database lookups; cycles fail
  explicitly.
- Participant removal runs in one transaction and includes all linked submissions,
  items and enrollments. Correction links are cleared before record removal.
- Review cutoffs, sequential-entry checks and expected export periods use the
  Europe/Zurich calendar date, independent of the server timezone.
- All three exports share CSV escaping, including carriage returns and protection
  against user-controlled spreadsheet formulas. Negative numeric correction values
  and generated Excel text/date literals remain intact. Flat exports include
  columns that contain only negative corrections.
- Landing, tracking and admin routes load separately. Spreadsheet import parsing
  is extracted from the admin screen into `src/admin/subjectImport.ts`.
- Vite is updated to 6.4.5, vulnerable transitive dependencies are patched, unused
  react-router is removed, and SheetJS is updated to the official 0.20.3 tarball.
  The official distribution is documented at
  https://docs.sheetjs.com/docs/getting-started/installation/nodejs/.
- `npm test` runs every JavaScript regression script and returns a failing status
  if any script fails. Obsolete rolling-window expectations now test the current
  calendar-week policy. `npm run check` adds both builds and the dependency audit.

## Data inspected

The checked-in local database contains 4 participants, 12 subjects, 9 enrollments,
25 submissions and 50 submission items. SQLite integrity is healthy. The read-only
audit found no orphan records, duplicate enrollments/emails/subject keys, broken or
cross-period predecessor links, cyclic histories or invalid item types.

This local database has an older schema: participant type/referenceDate/inactive,
subject entryMode/number, submission socialBattery/modeBeforeDeletion and
adminSettings are missing. It must not be used with the current application until
migrations have run.

A consistent SQLite backup was migrated in a temporary directory. All migrations
completed successfully; the same data counts were preserved, required schema and
review settings were present, and the audit reported no issues. The source
database was opened read-only and its business records were not changed.

No authenticated live dev or production database was available for this review.
The local audit and migration rehearsal do not certify those environments.

## Release checks

Final local verification: `npm run check` passed, with 31/31 test scripts,
successful staging and production builds, and zero reported dependency
vulnerabilities. `git diff --check` passed. Build outputs are in `dist/dev` and
`dist/prod`; nothing was deployed.

Run `npm ci` and `npm run check` before deploying. Tests create disposable local
PocketBase databases; they do not write to the remote APIs. The suite covers
authorization, stale forms, correction totals, deletion/restoration, module history,
dates/DST, review settings, reminders, analytics, group operations, CSV escaping,
large relation filters and XLS/XLSX imports.

Before promoting, audit a consistent backup from the actual target environment:

```sh
python scripts/audit-data.py /path/to/backup/data.db
```

The audit prints counts and findings without personal fields and exits nonzero
on issues. It checks structural integrity and selected data invariants, not whether
each person's recorded hours are factually correct.

Back up the target database, apply all repository migrations, and deploy the entire
`Backend/pb_hooks` directory, including `csv.js`, `record-queries.js`,
`submission-validation.js` and the existing shared modules. Restart PocketBase to
load hooks. Upload only `dist/prod` contents to the production frontend directory.
Do not copy the old local database over production. Verify admin sign-in, one
participant entry/correction, analytics and both export formats in the deployed
environment. Mail delivery and server/proxy configuration require environment checks.

Large chart/spreadsheet chunks still trigger Vite's size advisory. Route splitting
reduces the entry bundle, but this review does not claim a complete frontend
performance rewrite. Overview/export responses still materialize all required
records in memory; very large datasets should use paginated dashboards/streamed
exports in a separate change. No browser-based visual acceptance pass was performed.
