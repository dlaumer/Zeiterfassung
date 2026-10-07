# Workload analytics

Reuse `aggregateWorkload` and the components in `components/analytics` when adding
student or administrator analytics. Input values are effective hours from the
submission state, which already combines corrections and excludes deleted records.
Do not sum raw submission history again. Subject IDs are the grouping keys.

`AnalyticsPolicy` separates availability from date selection. The student panel
currently passes `restricted: true` and the API's `reviewTime` value (the
`adminSettings` record with `key: reviewTime`, measured in days). It fails closed
while loading or on errors. Once collection is complete, a future server-provided
policy can enable the existing today/week/month/all/custom range selections.
This is a UI statistics restriction, not a change to API access rules.

The rolling statistics period contains exactly the configured number of calendar
days including today (zero means today only). Unlike the editing cutoff, it does
not include an extra boundary day. Weekly averages divide total hours by calendar
days / 7, including unreported days. Weekly records belong to their recorded
week-start date, with no inferred daily allocation. Date math uses calendar days
to avoid daylight-saving errors. The panel refreshes its date on focus and every
minute, independently of calendar navigation.

Use the existing metric display and range filter for future graphs; graph-specific
rendering should consume the same calculated data. Keep cohort selection and API
fetching outside these pure calculations. Run `node scripts/test-workload-analytics.mjs`
and `npm run build` after analytics changes.
