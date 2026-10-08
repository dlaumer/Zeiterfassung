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

Each module's chart button flips the calendar to a stacked bar chart. The module
overview becomes its visibility legend, with category toggles for students and
one toggle per faculty category. The chart and overview share the selected range.
Weekly buckets are consecutive seven-day intervals anchored to the range end,
so the restricted 14-day range always produces two bars. Monthly and yearly
buckets follow calendar boundaries and clip to the selected range. Empty buckets
remain visible. Daily grouping is offered only for daily submission mode; weekly
submissions are never spread across invented daily records. Returning to the
calendar preserves its navigation; reduced-motion preferences disable the flip.

The calendar header's Statistics button initially selects all modules, then
restores the existing module/category selection and grouping on later visits.
Module chart buttons are always present in the card header beside the remove
action and explicitly select that module alone. Calendar and Statistics switch
the two faces; range controls appear only above the graph. Calendar month arrows
sit beside the month title. Horizontal pointer swipes navigate months, while
vertical gestures retain native scrolling and a completed swipe suppresses the
day click that would otherwise follow the gesture.

Chart display controls offer Total, Ø Week, and Ø Day, computed separately for
each bucket. Daily averages divide that bucket's hours by its calendar-day count;
weekly averages multiply the daily average by seven. Partial buckets use their
actual covered days, and unreported days count as zero. The three control groups
occupy equal horizontal columns and wrap on smaller screens. Student category presets All/Study/Class update the same hidden-category
state used by the legend eyes without changing module visibility. The three-way
control supports dragging, clicks, and arrow keys; custom eye selections clear
its preset highlight. Display settings persist across calendar flips.
