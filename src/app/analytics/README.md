# Workload analytics

Reuse `aggregateWorkload` and the components in `components/analytics` when adding
student or administrator analytics. Input values are effective hours from the
submission state, which already combines corrections and excludes deleted records.
Do not sum raw submission history again. Subject IDs are the grouping keys.

Statistics use full Monday–Sunday calendar weeks anchored to today. The default
last-two-weeks range includes two completed weeks and the entire current week
(three weekly bars; daily bars stop at today). Administrators can also choose four completed
weeks plus the current week, all history, or custom ranges aligned to calendar weeks.
Participant views allow manual selection within the configured completed-week window plus the current week. Dates outside that window are disabled and ranges are clamped during calculation. Future days count as zero.
Grey chart shading identifies the current week. Module side totals and averages
exclude the current week entirely, including its days from the average denominator.
Review editing uses the current week and the configured number of completed weeks.
Missing submissions do not move either window backward.

Weekly records allocate totals by overlapping days. Date math uses calendar days
for daylight-saving safety. The panel refreshes today on focus and every minute.
Run `node scripts/test-calendar-week-periods.mjs` and `npm run build` for validation.
Run `npm test` for the complete regression suite; date-window tests follow the current calendar-week policy.

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

All history starts at the Monday of the first submission for currently saved modules,
including zero-hour submissions. Adding or removing modules recalculates this range.
Participant reference dates only govern missing-submission reminders, not statistics.

Daily grouping preserves exact manually selected dates and starts All on the first
submission date. Weekly grouping continues to align ranges to Monday–Sunday.

The adminSettings key reviewTimeWeeks is the canonical configurable review limit.
It controls both editing and statistics in participant mode: N completed weeks plus
the current week. The dashboard API and workload status return reviewTimeWeeks.
Migration 1793100000 preserves existing week settings and initializes legacy installs
to two weeks. Expiry messages interpolate the configured number of weeks.
