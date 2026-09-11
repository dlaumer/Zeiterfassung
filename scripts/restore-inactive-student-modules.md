# Recover inactive students' modules

Run from the repository root with Node.js and installed dependencies. Deploy the participant-edit fix before recovery so a later profile edit cannot remove the restored assignments again.

Set `PB_URL` and either `PB_AUTH_TOKEN` (a PocketBase superuser token) or `PB_SUPERUSER_EMAIL` and `PB_SUPERUSER_PASSWORD` in your shell environment. Credentials are not printed or saved by the script.

```powershell
# Preview only; no assignment changes.
node scripts/restore-inactive-student-modules.mjs

# Apply after reviewing the preview.
node scripts/restore-inactive-student-modules.mjs --apply
```

The script requires the production `participants.type` and `participants.inactive` fields. It selects only `type = student` and `inactive = true`, including students who still have some assignments. It reads all pages of submission items and adds missing `workloadType` modules to `participant_subjects`. Existing assignments, colors, profiles, status and submission history are untouched. It rechecks status and assignment existence before creating each record. Rerunning after a partial failure is safe; run only one recovery process at a time.

Each output line identifies the student, module, proposed color and its source. Applied rows also include the new enrollment ID. Students with no module history and missing module records are flagged. A failed request stops the script with a nonzero exit code; earlier successful additions remain saved.

## Historical colors

Submission items do not store colors. Exact colors can only be recovered from surviving assignment records or a pre-deletion backup/export of `participant_subjects`. Export verified records from a separately restored backup into a JSON array:

```json
[
  { "participant": "participant-id", "subject": "subject-id", "color": "#e6194b" }
]
```

```powershell
node scripts/restore-inactive-student-modules.mjs --colors backup-colors.json
node scripts/restore-inactive-student-modules.mjs --colors backup-colors.json --apply
```

Only colors for history-backed missing assignments are used. The script rejects conflicting colors for the same student/module. Without historical color evidence, it selects and persists a replacement from the app palette, avoiding existing and recovered colors where the palette allows. The app itself may adjust duplicate colors when loading modules.

## Recovery limits

History proves a student submitted time for a module, not that they were still enrolled when deactivated. Intentionally removed historical modules may be proposed too. Modules with no submissions cannot be inferred; deleted submissions also cannot provide evidence. A verified pre-bug assignment backup is the better source for exact membership and colors. This script does not restore an entire backup or infer membership from color input. Previously affected students who are now active are outside its scope.

Test locally with `node scripts/test-restore-inactive-student-modules.mjs`; this uses a disposable PocketBase database and does not connect to production.
