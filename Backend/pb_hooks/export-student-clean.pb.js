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

    function getPeriodKey(submission) {
        const periodType = submission.get("periodType") || ""
        const periodStart = submission.get("periodStart") || ""

        // For daily data this groups by date only.
        // Example: "2026-04-13 00:00:00" -> "2026-04-13"
        const datePart = String(periodStart).slice(0, 10)

        return `${periodType}_${datePart}`
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

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    const participant = $app.findRecordById("participants", participantId)

    if (!participant) {
        return e.json(404, { error: "Participant not found" })
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
        "participant = {:participantId}",
        "periodStart",
        5000,
        0,
        { participantId }
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

    const typeKeys = workloadTypes.map((t) => t.get("key"))
    const exportTypes = ["class", "study"]

    const exportColumns = []

    for (const key of typeKeys) {
        for (const itemType of exportTypes) {
            exportColumns.push(`${key}_${itemType}_minutes`)
        }
    }

    const workloadTypeById = {}
    for (const wt of workloadTypes) {
        workloadTypeById[wt.id] = wt
    }

    const itemsBySubmission = {}

    for (const item of items) {
        const submissionId = item.get("submission")
        const workloadTypeId = item.get("workloadType")
        const itemType = item.get("type")

        if (!exportTypes.includes(itemType)) continue

        const workloadType = workloadTypeById[workloadTypeId]
        if (!workloadType) continue

        const key = workloadType.get("key")
        const columnName = `${key}_${itemType}_minutes`
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
        "baseSubmissionId",
        "baseSubmissionMode",
        "appendumSubmissionIds",
        "dataRating",
        "comment",
        "submittedAt",
        ...exportColumns,
    ]

    const rows = [headers]

    const periodKeys = Object.keys(submissionsByPeriod).sort()

    for (const periodKey of periodKeys) {
        const group = submissionsByPeriod[periodKey]

        const baseSubmission = chooseBaseSubmission(group)

        const appendumSubmissions = group.filter((s) => {
            return s.get("submissionMode") === "appendum"
        })

        if (!baseSubmission && appendumSubmissions.length === 0) {
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

        const representative = baseSubmission || appendumSubmissions[0]

        const row = [
            participant.id,
            participant.get("name") || "",
            representative.get("periodType") || "",
            representative.get("periodStart") || "",
            representative.get("periodEnd") || "",
            baseSubmission ? baseSubmission.id : "",
            baseSubmission ? baseSubmission.get("submissionMode") || "" : "",
            appendumSubmissions.map((s) => s.id).join(";"),
            representative.get("dataRating") || "",
            representative.get("comment") || "",
            representative.get("submittedAt") || "",
        ]

        for (const columnName of exportColumns) {
            row.push(finalMap[columnName] || 0)
        }

        rows.push(row)
    }

    const csv = rows.map(toCsvRow).join("\n")

    e.response.header().set("Content-Type", "text/csv; charset=utf-8")
    e.response.header().set(
        "Content-Disposition",
        `attachment; filename="student_${participantId}_clean.csv"`
    )

    return e.string(200, csv)
})
