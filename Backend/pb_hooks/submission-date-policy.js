// Submission dates follow Europe/Zurich, independently of the server timezone.
function todayKey(now) {
    const date = new Date(now || new Date())
    const year = date.getUTCFullYear()
    const transition = month => {
        const lastSunday = new Date(Date.UTC(year, month + 1, 0, 1))
        lastSunday.setUTCDate(lastSunday.getUTCDate() - lastSunday.getUTCDay())
        return lastSunday.getTime()
    }
    const summer = date.getTime() >= transition(2) && date.getTime() < transition(9)
    return new Date(date.getTime() + (summer ? 2 : 1) * 3600000).toISOString().slice(0, 10)
}
function periodKey(date, mode) {
    const parsed = new Date(String(date).slice(0, 10) + "T00:00:00Z")
    if (mode === "week") parsed.setUTCDate(parsed.getUTCDate() - (parsed.getUTCDay() + 6) % 7)
    return parsed.toISOString().slice(0, 10)
}
function isFuture(date, mode, now) {
    return periodKey(date, mode) > periodKey(todayKey(now), mode)
}
function assertAllowed(body, date, mode, now) {
    if (!isFuture(date, mode, now)) return false
    const values = [body.adminEffortMinutes, body.commuteMinutes, body.structuralChangesMinutes]
    for (const item of Array.isArray(body.subjectTimes) ? body.subjectTimes : []) values.push(item.classMinutes, item.studyMinutes)
    for (const item of Array.isArray(body.categoryTimes) ? body.categoryTimes : []) values.push(item.minutes)
    if (body.skipped !== true || values.some(value => !Number.isFinite(Number(value ?? 0)) || Number(value ?? 0) !== 0)) {
        throw new Error("Future periods can only be skipped. Work time cannot be recorded in advance.")
    }
    return true
}
module.exports = { todayKey, periodKey, isFuture, assertAllowed }
