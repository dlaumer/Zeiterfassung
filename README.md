
  # Daily Workload Tracker UI

  This is a code bundle for Daily Workload Tracker UI. The original project is available at https://www.figma.com/design/lyLG0dUnzE5Ta2alfDMpNU/Daily-Workload-Tracker-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Reviewing submissions

Deploy the frontend together with `Backend/pb_hooks` and apply migration
`1788912000_submission_corrections.js`. It adds the `correction` submission mode,
allows signed time values, and creates `adminSettings` with `key: reviewTime`,
`value: "14"` if that setting does not already exist. An existing value is preserved.

The review window is measured in calendar days from the recorded day, or Sunday
for a weekly entry, using the backend's calendar date. The cutoff day is included.
Older entries cannot be opened from the calendar: a notice explains that the
review period has ended and the entry can no longer be viewed or changed.
Corrections and deletion are also rejected by the backend.
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
