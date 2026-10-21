# Sync production application records into dev

Install/update from Git Bash on the laptop:

```bash
cd /c/repos/Zeiterfassung
scp scripts/refresh-methric-dev root@78.47.244.186:/usr/local/bin/refresh-methric-dev
ssh root@78.47.244.186 "chmod 700 /usr/local/bin/refresh-methric-dev"
```

On the Hetzner server:

```bash
refresh-methric-dev
```

This replaces the old full-database restore command. It reads a consistent
production SQLite snapshot using SQLite's online backup API. Production stays
running. No PocketBase credentials or dashboard backup are needed; the old
root credential file is no longer used.

Default behavior: insert missing records and update matching IDs from production
in **all non-system base collections** (participants, subjects/modules,
participant_subjects, submissions, submission_items, workload types, application
settings such as adminSettings, and any other base collection). Dev-only records
are retained. No records are deleted, including records deleted in production.
Production soft-deletion/status fields on matching records are updated normally.

System tables, backend settings, migrations history, schema definitions, auth
collections (including admins), and view collections are excluded. Views derive
their results from the updated base collections. Dev hooks, mail credentials,
and email recipient configuration remain in place. No email safety checks are
required for this operation. Writes go directly into an offline dev copy in one
transaction, so no PocketBase record hooks or API email handlers run during the
copy. The existing dev service is restarted normally, including its existing
startup hooks and any pending dev migrations; this command does not disable
independent scheduled jobs.

Options:

```bash
refresh-methric-dev --dry-run
refresh-methric-dev --add-only
```

Dry run prepares/validates a copy and reports counts without replacing live dev
data. It still briefly stops/restarts dev to take its consistent copy. Add-only
preserves existing dev records even if production differs.

Dev is stopped while its copy is prepared. Every selected collection must have
matching collection ID, fields and SQL columns. Missing collections, changed
schemas, missing related records, SQL triggers, and populated file fields on
records being copied stop the sync before activation. Uploaded-file syncing is
not implemented; current Methric base collections have no file fields.
Deploy compatible schema migrations before syncing; schema is never imported.

On successful activation, the old dev directory remains at
`/opt/pocketbase-dev/pb_data-before-<timestamp>`. Failed startup triggers rollback.
Review old snapshots periodically because they consume disk space. A server
crash or forced kill during swapping may require manual recovery from these
directories. Do not deploy hooks/migrations or run another restore concurrently.

Validation:

```bash
python -B scripts/test-refresh-methric-dev.py
```

Tests cover collection upserts, dev-only record retention, excluded settings/auth,
idempotency, add-only mode, relation/schema errors, transaction rollback, WAL
snapshot consistency, and failed-start rollback. Live server validation is still
required after upload.
