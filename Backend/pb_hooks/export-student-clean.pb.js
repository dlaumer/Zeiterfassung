/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/export-student-clean", (e) => {


    function chooseBaseSubmission(group) {
        const corrections = group.filter((s) => {
            return s.get("submissionMode") === "correction"
        })

        if (corrections.length > 0) {
            return corrections.sort(compareLatestFirst)[0]
        }

        const initials = group.filter((s) => {
            return s.get("submissionMode") === "initial"
        })

        if (initials.length > 0) {
            return initials.sort(compareLatestFirst)[0]
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

    function pickLatestFieldValue(submissions, fieldName, fallbackValue) {
        const newestFirst = [...submissions].sort(compareLatestFirst)

        for (const submission of newestFirst) {
            const rawValue = submission.get(fieldName)
            if (rawValue !== null && rawValue !== undefined && rawValue !== "") {
                return rawValue
            }
        }

        return fallbackValue
    }

    function minutesToHours(value) {
        return Number(value || 0) / 60
    }

    function startOfDay(date) {
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
        const day = d.getDay()
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

    function parseDateOnly(value) {
        const raw = String(value || "").trim().slice(0, 10)
        if (!raw) return null

        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (!match) return null

        const parsed = new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            0,
            0,
            0,
            0
        )

        if (isNaN(parsed.getTime())) return null
        return parsed
    }

    function getReferenceDateStart(app) {
        try {
            const records = app.findRecordsByFilter("referenceDate", "", "", 1, 0)
            if (records.length === 0) {
                return null
            }

            return parseDateOnly(records[0].get("referenceDate"))
        } catch (error) {
            console.error("Failed to load clean export reference date:", error)
            return null
        }
    }

    function pad2(n) {
        return n < 10 ? "0" + n : "" + n
    }

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

    function normalizeDateTime(value) {
        if (value instanceof Date) {
            return formatDateTime(value)
        }

        const raw = String(value || "").trim()
        if (!raw) return ""

        const dateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/)
        if (dateTimeMatch) {
            return `${dateTimeMatch[1]} ${dateTimeMatch[2]}`
        }

        const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})$/)
        if (dateOnlyMatch) {
            return `${dateOnlyMatch[1]} 00:00:00`
        }

        const slashDateTimeMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?/)
        if (slashDateTimeMatch) {
            return (
                slashDateTimeMatch[3] +
                "-" +
                pad2(Number(slashDateTimeMatch[1])) +
                "-" +
                pad2(Number(slashDateTimeMatch[2])) +
                " " +
                pad2(Number(slashDateTimeMatch[4])) +
                ":" +
                slashDateTimeMatch[5] +
                ":" +
                (slashDateTimeMatch[6] || "00")
            )
        }

        if (raw.includes("/")) {
            return ""
        }

        return raw
    }

    function csvDateTime(value) {
        const normalized = normalizeDateTime(value)
        return normalized ? `="${normalized}"` : ""
    }

    function getPeriodKey(submission) {
        const periodType = submission.get("periodType") || ""
        const periodStart = submission.get("periodStart") || ""

        // For daily data this groups by date only.
        // Example: "2026-04-13 00:00:00" -> "2026-04-13"
        const datePart = String(periodStart).slice(0, 10)

        return `${periodType}_${datePart}`
    }

    function getPeriodKeyFromValues(periodType, periodStart) {
        return `${periodType}_${String(periodStart || "").slice(0, 10)}`
    }

    function buildExpectedDailyPeriods(rangeStart, todayStart) {
        const result = []
        let cursor = startOfDay(rangeStart)

        while (cursor <= todayStart) {
            result.push({
                key: getPeriodKeyFromValues("day", formatDateTime(cursor)),
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
                key: getPeriodKeyFromValues("week", formatDateTime(cursor)),
                type: "week",
                start: new Date(cursor),
                end: endOfWeekSunday(cursor),
            })
            cursor = addDays(cursor, 7)
        }

        return result
    }

    function toCsvRow(values) {
        return values.map(csvEscape).join(",")
    }

    function csvEscape(value) {
        const str = String(value ?? "")

        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`
        }

        return str
    }
    const participantId = (e.requestInfo().query["participantId"] || "").trim()
    const requestedPeriodType = (e.requestInfo().query["periodType"] || "").trim()

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    const participant = $app.findRecordById("participants", participantId)

    if (!participant) {
        return e.json(404, { error: "Participant not found" })
    }

    const participantEntryMode = participant.get("entryMode") || ""
    const participantRole = participant.get("type") || (participantEntryMode === "week" ? "faculty" : "student")
    const exportPeriodType = ["day", "week"].includes(requestedPeriodType)
        ? requestedPeriodType
        : (["day", "week"].includes(participantEntryMode) ? participantEntryMode : "")
    const includeCommuteTime = participantRole === "student"
    const includeStructuralChanges = participantRole === "faculty"
    const referenceDateStart = getReferenceDateStart($app)
    const submissionRangeStart = referenceDateStart && exportPeriodType === "week"
        ? startOfWeekMonday(referenceDateStart)
        : referenceDateStart
    const submissionFilterParts = [
        "participant = {:participantId}",
        'submissionMode != "deleted"',
    ]
    const submissionFilterParams = { participantId }

    if (exportPeriodType) {
        submissionFilterParts.push("periodType = {:periodType}")
        submissionFilterParams.periodType = exportPeriodType
    }

    if (submissionRangeStart) {
        submissionFilterParts.push("periodStart >= {:rangeStart}")
        submissionFilterParams.rangeStart = formatDateTime(submissionRangeStart)
    }

    const workloadTypes = $app.findRecordsByFilter(
        "subjects",
        "",
        "key",
        500,
        0
    )

    const submissions = $app.findRecordsByFilter(
        "submissions",
        submissionFilterParts.join(" && "),
        "periodStart",
        5000,
        0,
        submissionFilterParams
    )

    const submissionIds = submissions.map((s) => s.id)

    let items = []

    if (submissionIds.length > 0) {
        const idFilter = submissionIds
            .map((id) => `submission = "${id}"`)
            .join(" || ")

        items = $app.findRecordsByFilter(
            "submission_items",
            idFilter,
            "",
            20000,
            0
        )
    }

    const exportTypes = ["class", "study"]

    const workloadTypeById = {}
    for (const wt of workloadTypes) {
        workloadTypeById[wt.id] = wt
    }

    const submissionById = {}
    for (const submission of submissions) {
        submissionById[submission.id] = submission
    }

    function getExportColumnName(workloadType, itemType, submission) {
        const key = workloadType.get("key")
        const credits = String(workloadType.get("credits") || 0)
        const prefix = itemType === "study" ? "S" : "U"

        if (participantRole === "faculty") {
            return `U_${key}_${credits}`
        }

        return `${prefix}_${key}_${credits}`
    }

    const exportColumnSet = {}
    for (const item of items) {
        const workloadTypeId = item.get("workloadType")
        const itemType = item.get("type")
        const minutes = item.get("durationMinutes") || 0
        const submission = submissionById[item.get("submission")]

        if (!exportTypes.includes(itemType) || minutes <= 0) continue
        if (!workloadTypeById[workloadTypeId]) continue
        if (!submission) continue

        exportColumnSet[getExportColumnName(workloadTypeById[workloadTypeId], itemType, submission)] = true
    }

    const exportColumns = Object.keys(exportColumnSet).sort()

    const itemsBySubmission = {}

    for (const item of items) {
        const submissionId = item.get("submission")
        const workloadTypeId = item.get("workloadType")
        const itemType = item.get("type")
        const submission = submissionById[submissionId]

        if (!exportTypes.includes(itemType)) continue

        const workloadType = workloadTypeById[workloadTypeId]
        if (!workloadType) continue
        if (!submission) continue

        const columnName = getExportColumnName(workloadType, itemType, submission)
        const minutes = item.get("durationMinutes") || 0

        if (!itemsBySubmission[submissionId]) {
            itemsBySubmission[submissionId] = {}
        }

        if (!itemsBySubmission[submissionId][columnName]) {
            itemsBySubmission[submissionId][columnName] = 0
        }

        itemsBySubmission[submissionId][columnName] += minutes
    }

    const submissionsByPeriod = {}

    for (const submission of submissions) {
        const periodKey = getPeriodKey(submission)

        if (!submissionsByPeriod[periodKey]) {
            submissionsByPeriod[periodKey] = []
        }

        submissionsByPeriod[periodKey].push(submission)
    }

    const headers = [
        "participantId",
        "participantName",
        "periodType",
        "periodStart",
        "periodEnd",
        "submittedAt",
        "baseSubmissionId",
        "baseSubmissionMode",
        "appendumSubmissionIds",
        "dataRating",
        "adminEffort_hours",
        ...(includeCommuteTime ? ["commuteTime_hours"] : []),
        ...(includeStructuralChanges ? ["structuralChanges_hours"] : []),
        "comment",
        ...exportColumns,
    ]

    const rows = [headers]

    const periodsByKey = {}
    const now = new Date()

    if (referenceDateStart && exportPeriodType === "day") {
        for (const period of buildExpectedDailyPeriods(referenceDateStart, startOfDay(now))) {
            periodsByKey[period.key] = period
        }
    }

    if (referenceDateStart && exportPeriodType === "week") {
        for (const period of buildExpectedWeeklyPeriods(referenceDateStart, startOfWeekMonday(now))) {
            periodsByKey[period.key] = period
        }
    }

    for (const periodKey of Object.keys(submissionsByPeriod)) {
        if (!periodsByKey[periodKey]) {
            const representative = submissionsByPeriod[periodKey][0]
            periodsByKey[periodKey] = {
                key: periodKey,
                type: representative.get("periodType") || "",
                start: representative.get("periodStart") || "",
                end: representative.get("periodEnd") || "",
            }
        }
    }

    const periodKeys = Object.keys(periodsByKey).sort()

    for (const periodKey of periodKeys) {
        const group = submissionsByPeriod[periodKey] || []
        const period = periodsByKey[periodKey]

        const baseSubmission = chooseBaseSubmission(group)

        const appendumSubmissions = group.filter((s) => {
            return s.get("submissionMode") === "appendum"
        })

        if (!baseSubmission && appendumSubmissions.length === 0) {
            const row = [
                participant.id,
                participant.get("name") || "",
                period.type,
                csvDateTime(period.start),
                csvDateTime(period.end),
            ]

            while (row.length < headers.length) {
                row.push("")
            }

            rows.push(row)
            continue
        }

        const finalMap = {}

        for (const columnName of exportColumns) {
            finalMap[columnName] = 0
        }

        if (baseSubmission) {
            const baseMap = itemsBySubmission[baseSubmission.id] || {}

            for (const columnName of exportColumns) {
                finalMap[columnName] += baseMap[columnName] || 0
            }
        }

        for (const appendum of appendumSubmissions) {
            const appendumMap = itemsBySubmission[appendum.id] || {}

            for (const columnName of exportColumns) {
                finalMap[columnName] += appendumMap[columnName] || 0
            }
        }

        const effectiveSubmissions = []

        if (baseSubmission) {
            effectiveSubmissions.push(baseSubmission)
        }

        for (const appendum of appendumSubmissions) {
            effectiveSubmissions.push(appendum)
        }

        const representative = baseSubmission || appendumSubmissions[0]
        const latestEffectiveSubmission = [...effectiveSubmissions].sort(compareLatestFirst)[0] || representative
        const periodType = representative.get("periodType") || ""

        const row = [
            participant.id,
            participant.get("name") || "",
            periodType,
            csvDateTime(representative.get("periodStart")),
            csvDateTime(representative.get("periodEnd")),
            csvDateTime(latestEffectiveSubmission.get("submittedAt")),
            baseSubmission ? baseSubmission.id : "",
            baseSubmission ? baseSubmission.get("submissionMode") || "" : "",
            appendumSubmissions.map((s) => s.id).join(";"),
            pickLatestFieldValue(effectiveSubmissions, "dataRating", ""),
            minutesToHours(pickLatestFieldValue(effectiveSubmissions, "generalAdminTime", 0)),
        ]

        if (includeCommuteTime) {
            row.push(minutesToHours(pickLatestFieldValue(effectiveSubmissions, "commuteTime", 0)))
        }

        if (includeStructuralChanges) {
            row.push(minutesToHours(pickLatestFieldValue(effectiveSubmissions, "structuralChanges", 0)))
        }

        row.push(
            latestEffectiveSubmission.get("comment") || "",
        )

        for (const columnName of exportColumns) {
            row.push(minutesToHours(finalMap[columnName] || 0))
        }

        rows.push(row)
    }

    const csv = rows.map(toCsvRow).join("\n")

    e.response.header().set("Content-Type", "text/csv; charset=utf-8")
    e.response.header().set(
        "Content-Disposition",
        `attachment; filename="student_${participantId}${exportPeriodType ? "_" + exportPeriodType : ""}_clean.csv"`
    )

    return e.string(200, csv)
}, $apis.requireAuth("admins"))
