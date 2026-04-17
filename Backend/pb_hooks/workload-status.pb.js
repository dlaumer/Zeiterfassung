/// <reference path="../pb_data/types.d.ts" />


/* ---------------- helpers ---------------- */


routerAdd("GET", "/api/workload-status", (e) => {


    const startOfDay = function (date) {
        const d = new Date(date)
        d.setHours(0, 0, 0, 0)
        return d
    }

    function endOfDay(date) {
        const d = new Date(date)
        d.setHours(23, 59, 59, 999)
        return d
    }

    function addDays(date, days) {
        const d = new Date(date)
        d.setDate(d.getDate() + days)
        return d
    }

    function startOfWeekMonday(date) {
        const d = startOfDay(date)
        const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
        const diff = day === 0 ? -6 : 1 - day
        d.setDate(d.getDate() + diff)
        return d
    }

    function endOfWeekSunday(date) {
        const start = startOfWeekMonday(date)
        const end = addDays(start, 6)
        end.setHours(23, 59, 59, 999)
        return end
    }

    function buildExpectedDailyPeriods(rangeStart, todayStart) {
        const result = []
        let cursor = new Date(rangeStart)

        while (cursor <= todayStart) {
            result.push({
                type: "day",
                start: startOfDay(cursor),
                end: endOfDay(cursor),
            })
            cursor = addDays(cursor, 1)
        }

        return result
    }

    function buildExpectedWeeklyPeriods(rangeStart, currentWeekStart) {
        const result = []
        let cursor = startOfWeekMonday(rangeStart)

        while (cursor <= currentWeekStart) {
            result.push({
                type: "week",
                start: new Date(cursor),
                end: endOfWeekSunday(cursor),
            })
            cursor = addDays(cursor, 7)
        }

        return result
    }

    function hasSubmissionForDay(submissions, dayStart) {
        for (let i = 0; i < submissions.length; i++) {
            const r = submissions[i]
            if (r.get("periodType") !== "day") continue

            const ps = new Date(r.get("periodStart"))
            if (sameDay(ps, dayStart)) return true
        }
        return false
    }

    function hasSubmissionForWeek(submissions, weekStart) {
        for (let i = 0; i < submissions.length; i++) {
            const r = submissions[i]
            if (r.get("periodType") !== "week") continue

            const ps = new Date(r.get("periodStart"))
            if (sameDateTimeStart(ps, weekStart)) return true
        }
        return false
    }

    function findSubmissionForExactStart(submissions, periodType, startDate) {
        for (let i = 0; i < submissions.length; i++) {
            const r = submissions[i]
            if (r.get("periodType") !== periodType) continue

            const ps = new Date(r.get("periodStart"))
            if (periodType === "day" && sameDay(ps, startDate)) return r
            if (periodType === "week" && sameDateTimeStart(ps, startDate)) return r
        }
        return null
    }

    function sameDay(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        )
    }

    function sameDateTimeStart(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate() &&
            a.getHours() === b.getHours() &&
            a.getMinutes() === b.getMinutes()
        )
    }

    function pad2(n) {
        return n < 10 ? "0" + n : "" + n
    }

    // PocketBase date filters usually work best with "YYYY-MM-DD HH:mm:ss"
    function formatDateTime(date) {
        return (
            date.getFullYear() +
            "-" +
            pad2(date.getMonth() + 1) +
            "-" +
            pad2(date.getDate()) +
            " " +
            pad2(date.getHours()) +
            ":" +
            pad2(date.getMinutes()) +
            ":" +
            pad2(date.getSeconds())
        )
    }

    const participantId = (e.requestInfo().query["participantId"] || "").trim()
    const lookbackDays = parseInt(e.requestInfo().query["lookbackDays"] || "28", 10)

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    const participant = $app.findFirstRecordByFilter(
        "participants",
        'id = {:participantId}',
        { participantId: participantId }
    )

    if (!participant) {
        return e.json(404, { error: "Participant not found" })
    }

    const entryMode = participant.get("entryMode") || "day" // "day" | "week"
    const now = new Date()

    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)

    const currentWeekStart = startOfWeekMonday(now)
    const currentWeekEnd = endOfWeekSunday(now)

    // We load all relevant submitted records in a lookback window.
    const rangeStart = addDays(todayStart, -lookbackDays)
    const rangeStartStr = formatDateTime(rangeStart)

    // Only current valid records matter here.
    // If you use replaced/corrected chains, exclude replaced records.
    const submissions = $app.findRecordsByFilter(
        "submissions",
        [
            'participant = {:participantId}',
            'periodStart >= {:rangeStart}'
        ].join(" && "),
        "-periodStart",
        500,
        0,
        {
            participantId: participantId,
            rangeStart: rangeStartStr
        }
    )

    const submittedPeriods = submissions.map((r) => ({
        id: r.id,
        periodType: r.get("periodType"),
        periodStart: r.get("periodStart"),
        periodEnd: r.get("periodEnd"),
        submissionMode: r.get("submissionMode"),
        submittedAt: r.get("submittedAt"),
    }))

    let expectedPeriods = []
    let missingPeriods = []
    let currentPeriod = null
    let alreadySubmittedCurrent = false
    let currentSubmission = null

    if (entryMode === "day") {
        expectedPeriods = buildExpectedDailyPeriods(rangeStart, todayStart)

        currentPeriod = {
            periodType: "day",
            periodStart: formatDateTime(todayStart),
            periodEnd: formatDateTime(todayEnd),
        }

        missingPeriods = expectedPeriods.filter((p) => {
            return !hasSubmissionForDay(submissions, p.start)
        })

        currentSubmission = findSubmissionForExactStart(submissions, "day", todayStart)
        alreadySubmittedCurrent = !!currentSubmission
    } else {
        expectedPeriods = buildExpectedWeeklyPeriods(rangeStart, currentWeekStart)

        currentPeriod = {
            periodType: "week",
            periodStart: formatDateTime(currentWeekStart),
            periodEnd: formatDateTime(currentWeekEnd),
        }

        missingPeriods = expectedPeriods.filter((p) => {
            return !hasSubmissionForWeek(submissions, p.start)
        })

        currentSubmission = findSubmissionForExactStart(submissions, "week", currentWeekStart)
        alreadySubmittedCurrent = !!currentSubmission
    }

    return e.json(200, {
        participant: {
            id: participant.id,
            entryMode: entryMode,
        },

        currentPeriod: currentPeriod,

        submittedPeriods: submittedPeriods,

        missingPeriods: missingPeriods.map((p) => ({
            periodType: p.type,
            periodStart: formatDateTime(p.start),
            periodEnd: formatDateTime(p.end),
        })),

        alreadySubmittedCurrent: alreadySubmittedCurrent,

        currentActionSuggestion: alreadySubmittedCurrent
            ? {
                needsChoice: true,
                options: ["correction", "addendum"],
                existingSubmissionId: currentSubmission.id,
                message:
                    "A submission already exists for the current period. The user should choose correction or addendum."
            }
            : {
                needsChoice: false,
                options: ["initial"],
                existingSubmissionId: null,
                message:
                    "No submission exists yet for the current period."
            }
    })
})
