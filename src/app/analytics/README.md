# Workload analytics

Reuse `aggregateWorkload` and the components in `components/analytics` when adding
student or administrator analytics. Input values are effective hours from the
submission state, which already combines corrections and excludes deleted records.
Do not sum raw submission history again. Subject IDs are the grouping keys.

`AnalyticsPolicy` separates availability from date selection. Participant views
pass `restricted: true`, which enforces the last 14 days independently of the
editing review period. Verified admin views enable rolling 7-, 14-, and 30-day
windows, all history, and custom dates. Manual date fields stay visible but
disabled for non-admins. Statistics remain hidden while loading or on errors.
This is a UI statistics restriction, not a change to API access rules.

The rolling statistics period contains exactly 7, 14, or 30 calendar
days ending on the latest recorded entry date, including a skipped entry. Only
an empty history falls back to today. Corrections to older entries do not move
the anchor backward. The date inputs always display the calculated range,
including when disabled; explicit admin custom ranges remain user-selected.
Unlike the editing cutoff, it does
not include an extra boundary day. Weekly averages divide total hours by calendar
days / 7, treating unreported days as skipped (zero hours). Weekly records belong to their recorded
week-start date, with no inferred daily allocation. Date math uses calendar days
to avoid daylight-saving errors. The panel refreshes its date on focus and every
minute, independently of calendar navigation.

Use the existing metric display and range filter for future graphs; graph-specific
rendering should consume the same calculated data. Keep cohort selection and API
fetching outside these pure calculations. Run `node scripts/test-workload-analytics.mjs`
and `npm run build` after analytics changes.
