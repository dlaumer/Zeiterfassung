// Match workload-status: weekdays for daily entries, Monday-based weekly entries,
// referenceDate as the start and 28 days as the legacy fallback.
module.exports.assertNext = function (app, participant, periodType, target, existing) {
    if (existing.length) return // Corrections do not create a new gap.
    const review = require(`${__hooks}/submission-review.js`)
    const submissions = review.active(app, app.findRecordsByFilter(
        "submissions",
        'participant = {:participantId} && periodType = {:periodType} && submissionMode != "deleted"',
        "", 0, 0, { participantId: participant.id, periodType }
    ))
    const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const submitted = new Set(submissions.map(s => key(new Date(s.get("periodStart")))))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const reference = String(participant.get("referenceDate") || "").slice(0, 10)
    let cursor = reference ? new Date(reference + "T00:00:00") : new Date(NaN)
    if (isNaN(cursor.getTime())) {
        cursor = new Date(today)
        cursor.setDate(cursor.getDate() - 28)
    }
    if (periodType === "week") {
        cursor.setDate(cursor.getDate() - (cursor.getDay() + 6) % 7)
        today.setDate(today.getDate() - (today.getDay() + 6) % 7)
    }
    while (cursor < target && cursor <= today) {
        if ((periodType === "week" || (cursor.getDay() >= 1 && cursor.getDay() <= 5)) && !submitted.has(key(cursor))) {
            throw new Error(`Earlier entries must be completed first: ${key(cursor)}`)
        }
        cursor.setDate(cursor.getDate() + (periodType === "week" ? 7 : 1))
    }
}
