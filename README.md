
  # Daily Workload Tracker UI

  This is a code bundle for Daily Workload Tracker UI. The original project is available at https://www.figma.com/design/lyLG0dUnzE5Ta2alfDMpNU/Daily-Workload-Tracker-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Frontend API routing

The shared configuration in `src/pocketbaseConfig.ts` selects the backend at
build time for both the participant frontend and the admin panel.

| Command | Backend | Output |
| --- | --- | --- |
| `npm run dev` | `https://api-dev.methric.ch` | Local development server |
| `npm run build:dev` | `https://api-dev.methric.ch` | `dist/dev` |
| `npm run build:prod` (or `npm run build`) | `https://api.methric.ch` | `dist/prod` |
| `npm run build:all` | Both builds above | `dist/dev` and `dist/prod` |

Upload only the contents of `dist/dev` to `/var/www/methric-dev`.
Upload only the contents of `dist/prod` to the production frontend directory.
Do not upload the entire `dist` directory: older files may remain at its root.
The build determines the backend regardless of hostname, including when previewed
locally. `npm run dev` always uses the dev API with its default development mode.

## Reviewing submissions

### Administrator participant view

The participant action **Open link as administrator** opens `/admin/<participantId>/`.
It reuses the dashboard's saved admin session; other browsers must sign in with an
`admins` account. The normal participant URL keeps its existing restrictions.
The admin view enables every statistics period and corrections to older entries.
Correction validation and stale-submission checks still apply.

Deploy the frontend together with `Backend/pb_hooks/create-daily-submission.pb.js`,
`Backend/pb_hooks/submission-review.js`, and `Backend/pb_hooks/workload-status.pb.js`.
No new migration is needed for this feature. The API checks the authenticated
record's collection before honoring `adminView`; a URL or request flag alone does
not grant the override. Run `node scripts/test-admin-entry-view.mjs` for the
disposable-database authorization and correction tests.

Deploy the frontend together with `Backend/pb_hooks` and apply migration
`1788912000_submission_corrections.js`. It adds the `correction` submission mode,
allows signed time values, and creates `adminSettings` with `key: reviewTime`,
`value: "14"` if that setting does not already exist. An existing value is preserved.

The review window is measured in calendar days from the recorded day, or Sunday
for a weekly entry, using the backend's calendar date. The cutoff day is included.
Older entries cannot be opened from the calendar: a notice explains that the
review period has ended and the entry can no longer be viewed or changed.
Corrections are also rejected by the backend. Locked entries can still be deleted
from the notice, then submitted again as a new initial entry.
Initial submissions for missing dates retain the existing behaviour.

The form and POST API send complete current totals (`inputMode: "totals"`), plus
`expectedSubmissionId` to detect stale forms. Inside a transaction, the backend
calculates and saves signed minute differences in a new `correction` record and
its items, linked through `replacesSubmission`. Ratings and comments remain new
values. Old `appendum` records retain their original semantics: subject items are
increments, while admin/commute/structural fields are totals. New corrections use
increments for all time fields. History and clean exports handle both formats;
clean exports distinguish `appendumSubmissionIds` and `correctionSubmissionIds`.

When correcting an entry, each changed time displays its signed difference from
the saved total. Data reliability and battery level start unselected and must be
chosen again; the optional comment starts blank. Submission history shows the initial submission
and numbered corrections in chronological order.

Deletion retains the existing soft-deletion behaviour and appends a linked
`deleted` submission. Deleted periods do not contribute to totals. Re-entering a
deleted period starts a new initial submission.

Run `node scripts/test-submission-corrections.mjs` for integration tests against a
disposable local PocketBase database. Set `POCKETBASE_BIN` to use another binary.
Run `npm run build` to check the frontend build.
