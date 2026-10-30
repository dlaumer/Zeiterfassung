# Statistics links

The statistics view automatically replaces the current URL as settings change. Copying or bookmarking it restores the view, including whether it is open. Other query parameters and the URL fragment are preserved. Browser history navigation restores the settings from the destination URL without adding a history entry for every toggle or slider movement.

Parameters use the `stats.` namespace and `stats.v=1` marks the format version.

| Parameter | Values / purpose |
| --- | --- |
| `stats.module` | Repeated stable module IDs selected in the legend; no occurrences means an explicit empty selection |
| `stats.group` | `daily`, `weekly`, `monthly` |
| `stats.period` | `last2Weeks`, `last4Weeks`, `all`, `custom` |
| `stats.from`, `stats.to` | Exact inclusive `YYYY-MM-DD` dates, only for `custom` |
| `stats.value` | `total`, `weeklyAverage`, `dailyAverage` |
| `stats.hide` | Repeated `moduleId:classTime` or `moduleId:selfStudyTime` exclusions; captures All/Study/Class and individually hidden series |
| `stats.workload` | Workload series visibility, retaining the module selection |
| `stats.summaries` | Module statistics visibility |
| `stats.totals` | Bar totals visibility |
| `stats.rating`, `stats.energy` | Rating and energy series visibility |
| `stats.zoom` | Chart zoom from 1 to 8 |
| `stats.open` | Whether statistics is open |

Visibility flags use `1` and `0`. Repeated parameters are URL encoded independently, so punctuation in an ID cannot split a selection. Stable IDs survive module renaming and reordering. Explicit selections are retained when data arrives; new submissions for selected modules are included automatically. A link does not add or remove modules from a participant's saved module list.

Relative presets store their meaning, never a snapshot of their resolved dates. They recalculate using current entries and the current calendar date, including on focus and across midnight. All can expand as older submissions arrive. Custom dates remain fixed when entries, the current date, or grouping change; weekly bars at the edges include only the chosen dates. Existing participant access windows still clamp the effective dates and can move over time. URL parameters cannot override these limits.

Invalid enums fall back to defaults. Invalid or reversed custom dates fall back to the relative default period. Impossible average/grouping combinations are normalized. Missing or unknown versions do not activate URL settings. Temporary popovers, comments, focus, and scroll positions are not saved.
