// Shared by submission routes, history and exports. Time values are minutes.
function newestFirst(a, b) {
    return String(b.get("submittedAt") || b.get("created") || "").localeCompare(String(a.get("submittedAt") || a.get("created") || "")) || String(b.id).localeCompare(String(a.id))
}

function effective(group) {
    const initial = group.filter(s => s.get("submissionMode") === "initial").sort(newestFirst)[0]
    return (initial ? [initial] : []).concat(group.filter(s => ["appendum", "correction"].includes(s.get("submissionMode"))))
}

function fieldValue(submissions, name, fallback) {
    const sorted = submissions.slice().sort(newestFirst)
    if (name === "comment") {
        const latestComment = sorted.find(s => String(s.get("comment") || "").trim())
        return latestComment ? String(latestComment.get("comment")).trim() : fallback
    }
    if (["generalAdminTime", "commuteTime", "structuralChanges"].includes(name)) {
        // Legacy appendums stored these fields as totals, unlike their subject items.
        let delta = 0
        for (const s of sorted) {
            if (s.get("submissionMode") === "correction") delta += Number(s.get(name) || 0)
            else return delta + Number(s.get(name) || 0)
        }
        return delta
    }
    return sorted.length ? sorted[0].get(name) : fallback
}

function settingsRecord(app) {
    try { return app.findFirstRecordByFilter("adminSettings", 'key = "reviewTimeWeeks"') } catch (error) {
        // A production-to-dev data refresh can restore the legacy row after the
        // calendar-week migration has already been recorded as applied.
        let legacy
        try { legacy = app.findFirstRecordByFilter("adminSettings", 'key = "reviewTime"') } catch (_) { throw error }
        legacy.set("key", "reviewTimeWeeks")
        legacy.set("value", "2") // Same initial policy as 1793100000_review_time_weeks.js.
        app.save(legacy)
        return legacy
    }
}

function settings(app, now) {
    const record = settingsRecord(app)
    const raw = String(record.get("value")).trim()
    const weeks = Number(raw)
    if (!raw || !Number.isSafeInteger(weeks) || weeks < 0 || weeks > 5200) throw new Error("Invalid reviewTimeWeeks setting")
    const cutoff = now ? new Date(now) : new Date(require(`${__hooks}/submission-date-policy.js`).todayKey() + "T00:00:00")
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - (cutoff.getDay() + 6) % 7 - weeks * 7)
    const pad = n => String(n).padStart(2, "0")
    return { reviewTimeWeeks: weeks, reviewCutoff: cutoff.getFullYear() + "-" + pad(cutoff.getMonth() + 1) + "-" + pad(cutoff.getDate()) }
}

// Current week plus the configured completed Monday–Sunday weeks.
function editableWeeklyStarts(app, participantId, submissions, now) {
    const config = settings(app, now)
    const cutoff = config.reviewCutoff
    const start = new Date(cutoff + "T12:00:00")
    const pad = n => String(n).padStart(2, "0")
    return Array.from({ length: config.reviewTimeWeeks + 1 }, (_, index) => (config.reviewTimeWeeks - index) * 7).map(days => {
        const date = new Date(start)
        date.setDate(date.getDate() + days)
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
    })
}

function assertEditable(app, periodEnd) {
    if (String(periodEnd).slice(0, 10) < settings(app).reviewCutoff) {
        throw new Error("The review period has expired. This entry is read-only.")
    }
}

function prepare(app, group, body, periodEnd, adminOverride) {
    const latest = group.slice().sort(newestFirst)[0]
    if (String(body.expectedSubmissionId || "") !== (latest ? latest.id : "")) {
        throw new Error("This entry has changed. Reload the page before saving.")
    }
    if (latest && !adminOverride) {
        if (latest.get("periodType") === "week") {
            if (!editableWeeklyStarts(app, latest.get("participant")).includes(String(latest.get("periodStart")).slice(0, 10))) {
                throw new Error("The configured review period has expired. This entry is read-only.")
            }
        } else assertEditable(app, periodEnd)
    }
    if (body.inputMode !== "totals") throw new Error("Please reload the page to use the updated entry form.")
    const selected = effective(group)
    const totals = {}
    if (selected.length) {
        const items = require(`${__hooks}/record-queries.js`).related(app, "submission_items", "submission", selected.map(s => s.id))
        for (const item of items) {
            const key = item.get("workloadType") + "|" + item.get("type")
            totals[key] = (totals[key] || 0) + Number(item.get("durationMinutes") || 0)
        }
    }
    function minutes(value) {
        const n = Number(value || 0)
        if (!Number.isFinite(n) || n < 0) throw new Error("Invalid time value")
        return Math.round(n)
    }
    return {
        latestId: latest ? latest.id : "",
        comment: String(body.comment || "").trim() === String(fieldValue(selected, "comment", "")).trim()
            ? "" : String(body.comment || "").trim(),
        subjectIds: Object.keys(totals).map(key => key.split("|")[0]),
        item: (subjectId, type, value) => minutes(value) - (totals[subjectId + "|" + type] || 0),
        field: (name, value) => minutes(value) - (latest ? Number(fieldValue(selected, name, 0)) : 0),
    }
}

module.exports = { newestFirst, effective, fieldValue, settingsRecord, settings, assertEditable, prepare, editableWeeklyStarts }

// PocketBase assigns submittedAt automatically, so it can differ from deletedAt
// by milliseconds. Use the payload and predecessor as well as the timestamp.
module.exports.isDeletionMarker = function (submission, previous, hasItems) {
    const mode = String(submission.get("modeBeforeDeletion") || "")
    if (mode === "deletion") return true
    if (mode || submission.get("submissionMode") !== "deleted") return false
    return !!previous && !!submission.get("deletedAt") &&
        String(submission.get("submittedAt")).slice(0, 19) === String(submission.get("deletedAt")).slice(0, 19) &&
        !hasItems &&
        !["dataRating", "socialBattery", "generalAdminTime", "commuteTime", "structuralChanges"].some(field => Number(submission.get(field) || 0)) &&
        !String(submission.get("comment") || "")
}

// Existing corrections may link to the previous correction rather than directly
// to the initial submission. Follow either shape without rewriting history.
module.exports.root = function (app, submission) {
    const visited = {}
    while (submission.get("replacesSubmission")) {
        if (visited[submission.id]) throw new Error("Cyclic submission history")
        visited[submission.id] = true
        submission = app.findRecordById("submissions", String(submission.get("replacesSubmission")))
    }
    return submission
}
module.exports.active = function (app, submissions) {
    // Resolve each predecessor once, sharing cached records across correction chains.
    const records = {}
    const roots = {}
    for (const submission of submissions) records[submission.id] = submission
    function root(submission) {
        const path = []
        const visited = {}
        while (!roots[submission.id] && submission.get("replacesSubmission")) {
            if (visited[submission.id]) throw new Error("Cyclic submission history")
            visited[submission.id] = true
            path.push(submission.id)
            const id = String(submission.get("replacesSubmission"))
            submission = records[id] || (records[id] = app.findRecordById("submissions", id))
        }
        const result = roots[submission.id] || submission
        roots[submission.id] = result
        for (const id of path) roots[id] = result
        return result
    }
    return submissions.filter(s => {
        if (s.get("submissionMode") === "deleted") return false
        return root(s).get("submissionMode") !== "deleted"
    })
}
