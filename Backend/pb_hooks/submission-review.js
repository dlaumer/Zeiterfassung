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

function settings(app, now) {
    const record = app.findFirstRecordByFilter("adminSettings", 'key = "reviewTime"')
    const raw = String(record.get("value")).trim()
    const days = Number(raw)
    if (!raw || !Number.isInteger(days) || days < 0) throw new Error("Invalid reviewTime setting")
    const cutoff = new Date(now || new Date())
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - days)
    const pad = n => String(n).padStart(2, "0")
    return { reviewTime: days, reviewCutoff: cutoff.getFullYear() + "-" + pad(cutoff.getMonth() + 1) + "-" + pad(cutoff.getDate()) }
}

function assertEditable(app, periodEnd) {
    if (String(periodEnd).slice(0, 10) < settings(app).reviewCutoff) {
        throw new Error("The review period has expired. This entry is read-only.")
    }
}

function prepare(app, group, body, periodEnd) {
    const latest = group.slice().sort(newestFirst)[0]
    if (String(body.expectedSubmissionId || "") !== (latest ? latest.id : "")) {
        throw new Error("This entry has changed. Reload the page before saving.")
    }
    if (latest) assertEditable(app, periodEnd)
    if (body.inputMode !== "totals") throw new Error("Please reload the page to use the updated entry form.")
    const selected = effective(group)
    const totals = {}
    for (const s of selected) {
        const items = app.findRecordsByFilter("submission_items", "submission = {:id}", "", 0, 0, { id: s.id })
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
        subjectIds: Object.keys(totals).map(key => key.split("|")[0]),
        item: (subjectId, type, value) => minutes(value) - (totals[subjectId + "|" + type] || 0),
        field: (name, value) => minutes(value) - (latest ? Number(fieldValue(selected, name, 0)) : 0),
    }
}

module.exports = { newestFirst, effective, fieldValue, settings, assertEditable, prepare }
