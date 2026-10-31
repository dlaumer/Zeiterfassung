function dateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(value + "T00:00:00Z")
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function minutes(value) {
    if (value == null) return
    if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") throw new Error("Invalid time value")
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.round(n))) throw new Error("Invalid time value")
}

// Validate before clamping or saving. Duplicate rows would double-count workload
// and, for corrections, subtract the same previous total more than once.
function totals(body) {
    for (const field of ["adminEffortMinutes", "commuteMinutes", "structuralChangesMinutes"]) minutes(body[field])
    for (const [field, idField, timeFields] of [
        ["subjectTimes", "subjectId", ["classMinutes", "studyMinutes"]],
        ["categoryTimes", "categoryId", ["minutes"]],
    ]) {
        if (body[field] == null) continue
        if (!Array.isArray(body[field])) throw new Error("Invalid " + field)
        const seen = new Set()
        for (const item of body[field]) {
            if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid workload row")
            const id = String(item[idField] || "").trim()
            if (!id || seen.has(id)) throw new Error("Missing or duplicate workload ID")
            seen.add(id)
            for (const timeField of timeFields) minutes(item[timeField])
        }
    }
}

module.exports = { dateOnly, totals }
