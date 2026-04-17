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

    function chooseBaseSubmission(group) {
        const corrections = group.filter((s) => s.get("submissionMode") === "correction")
        if (corrections.length > 0) {
            return corrections.sort(compareLatestFirst)[0]
        }

        const initials = group.filter((s) => s.get("submissionMode") === "initial")
        if (initials.length > 0) {
            return initials.sort(compareLatestFirst)[0]
        }

        const nonAppendums = group.filter((s) => s.get("submissionMode") !== "appendum")
        if (nonAppendums.length > 0) {
            return nonAppendums.sort(compareLatestFirst)[0]
        }

        return null
    }

    function compareLatestFirst(a, b) {
        const aDate = getSubmissionSortDate(a)
        const bDate = getSubmissionSortDate(b)

        return bDate.getTime() - aDate.getTime()
    }

    function getSubmissionSortDate(submission) {
        const submittedAt = submission.get("submittedAt")
        const updated = submission.get("updated")
        const created = submission.get("created")

        return new Date(submittedAt || updated || created || 0)
    }

    function getPeriodKey(submission) {
        const periodType = submission.get("periodType") || ""
        const periodStart = submission.get("periodStart") || ""
        const datePart = String(periodStart).slice(0, 10)

        return `${periodType}_${datePart}`
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

    const submissionIds = submissions.map((s) => s.id)
    let submissionItems = []

    if (submissionIds.length > 0) {
        const idFilter = submissionIds
            .map((id) => `submission = "${id}"`)
            .join(" || ")

        submissionItems = $app.findRecordsByFilter(
            "submission_items",
            idFilter,
            "",
            5000,
            0
        )
    }

    const subjects = $app.findRecordsByFilter(
        "subjects",
        "",
        "key",
        1000,
        0
    )

    const subjectById = {}
    for (const subject of subjects) {
        subjectById[subject.id] = {
            id: subject.id,
            key: subject.get("key") || "",
            labelEn: subject.get("label_en") || "",
            labelDe: subject.get("label_de") || "",
        }
    }

    const itemsBySubmission = {}
    for (const item of submissionItems) {
        const submissionId = item.get("submission")
        const subjectId = item.get("workloadType")
        const itemType = item.get("type") || ""

        if (!subjectById[subjectId]) continue

        if (!itemsBySubmission[submissionId]) {
            itemsBySubmission[submissionId] = {}
        }

        if (!itemsBySubmission[submissionId][subjectId]) {
            itemsBySubmission[submissionId][subjectId] = {
                hasClassEntry: false,
                hasStudyEntry: false,
            }
        }

        if (itemType === "class") {
            itemsBySubmission[submissionId][subjectId].hasClassEntry = true
        }

        if (itemType === "study") {
            itemsBySubmission[submissionId][subjectId].hasStudyEntry = true
        }
    }

    const submissionsByPeriod = {}
    for (const submission of submissions) {
        const periodKey = getPeriodKey(submission)

        if (!submissionsByPeriod[periodKey]) {
            submissionsByPeriod[periodKey] = []
        }

        submissionsByPeriod[periodKey].push(submission)
    }

    const submissionHistory = []
    const periodKeys = Object.keys(submissionsByPeriod)

    for (const periodKey of periodKeys) {
        const group = submissionsByPeriod[periodKey]
        const baseSubmission = chooseBaseSubmission(group)
        const appendumSubmissions = group.filter((s) => s.get("submissionMode") === "appendum")

        const effectiveSubmissions = []

        if (baseSubmission) {
            effectiveSubmissions.push(baseSubmission)
        }

        for (const appendum of appendumSubmissions) {
            effectiveSubmissions.push(appendum)
        }

        if (effectiveSubmissions.length === 0) {
            continue
        }

        const representative = baseSubmission || appendumSubmissions.sort(compareLatestFirst)[0]
        const subjectMap = {}

        for (const submission of effectiveSubmissions) {
            const bySubject = itemsBySubmission[submission.id] || {}

            for (const subjectId of Object.keys(bySubject)) {
                const existing = subjectMap[subjectId] || {
                    hasClassEntry: false,
                    hasStudyEntry: false,
                }

                const fromSubmission = bySubject[subjectId]
                existing.hasClassEntry = existing.hasClassEntry || !!fromSubmission.hasClassEntry
                existing.hasStudyEntry = existing.hasStudyEntry || !!fromSubmission.hasStudyEntry
                subjectMap[subjectId] = existing
            }
        }

        const subjectsForPeriod = Object.keys(subjectMap)
            .filter((subjectId) => !!subjectById[subjectId])
            .map((subjectId) => ({
                id: subjectById[subjectId].id,
                key: subjectById[subjectId].key,
                labelEn: subjectById[subjectId].labelEn,
                labelDe: subjectById[subjectId].labelDe,
                classTime: 0,
                selfStudyTime: 0,
                hasClassEntry: !!subjectMap[subjectId].hasClassEntry,
                hasStudyEntry: !!subjectMap[subjectId].hasStudyEntry,
            }))
            .sort((a, b) => String(a.key).localeCompare(String(b.key)))

        const representativeCommuteTime = Number(representative.get("commuteTime") || 0)
        const representativeGeneralAdminTime = Number(representative.get("generalAdminTime") || 0)
        const representativeDataRating = Number(representative.get("dataRating") || 0)

        submissionHistory.push({
            periodType: representative.get("periodType") || "",
            periodStart: representative.get("periodStart") || "",
            periodEnd: representative.get("periodEnd") || "",
            periodDate: String(representative.get("periodStart") || "").slice(0, 10),
            commuteTime: representativeCommuteTime,
            generalAdminTime: representativeGeneralAdminTime,
            dataRating: representativeDataRating,
            submissionIds: effectiveSubmissions.map((s) => s.id),
            baseSubmissionId: baseSubmission ? baseSubmission.id : "",
            appendumSubmissionIds: appendumSubmissions.map((s) => s.id),
            subjects: subjectsForPeriod,
        })
    }

    submissionHistory.sort((a, b) => String(b.periodStart).localeCompare(String(a.periodStart)))

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

        submissionHistory: submissionHistory,

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
