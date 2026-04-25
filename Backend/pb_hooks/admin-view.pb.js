/// <reference path="../pb_data/types.d.ts" />

function adminRecordValue(record, fieldName, fallback) {
    const value = record.get(fieldName)
    return value === null || value === undefined ? fallback : value
}

function adminStringValue(record, fieldName) {
    return String(adminRecordValue(record, fieldName, "") || "")
}

function adminNumberValue(record, fieldName) {
    return Number(adminRecordValue(record, fieldName, 0) || 0)
}

function adminDateValue(record, fieldName) {
    return String(adminRecordValue(record, fieldName, "") || "")
}

function adminCreateDeletionEvent(app, deletedSubmission, participantName) {
    const collection = app.findCollectionByNameOrId("admin_activity_events")
    const eventRecord = new Record(collection)

    eventRecord.set("kind", "deletion")
    eventRecord.set("participant", adminStringValue(deletedSubmission, "participant"))
    eventRecord.set("participantName", participantName)
    eventRecord.set("submissionId", deletedSubmission.id)
    eventRecord.set("periodType", adminStringValue(deletedSubmission, "periodType"))
    eventRecord.set("periodStart", adminDateValue(deletedSubmission, "periodStart"))
    eventRecord.set("periodEnd", adminDateValue(deletedSubmission, "periodEnd"))
    eventRecord.set("submissionMode", adminStringValue(deletedSubmission, "submissionMode"))
    eventRecord.set("comment", adminStringValue(deletedSubmission, "comment"))
    eventRecord.set("dataRating", adminNumberValue(deletedSubmission, "dataRating"))
    eventRecord.set("generalAdminTime", adminNumberValue(deletedSubmission, "generalAdminTime"))
    eventRecord.set("commuteTime", adminNumberValue(deletedSubmission, "commuteTime"))
    eventRecord.set("structuralChanges", adminNumberValue(deletedSubmission, "structuralChanges"))

    app.save(eventRecord)
}

routerAdd("GET", "/api/admin/overview", (e) => {


    function adminRecordValue(record, fieldName, fallback) {
        const value = record.get(fieldName)
        return value === null || value === undefined ? fallback : value
    }

    function adminStringValue(record, fieldName) {
        return String(adminRecordValue(record, fieldName, "") || "")
    }

    function adminNumberValue(record, fieldName) {
        return Number(adminRecordValue(record, fieldName, 0) || 0)
    }

    function adminDateValue(record, fieldName) {
        return String(adminRecordValue(record, fieldName, "") || "")
    }

    function adminFindParticipantName(participantById, participantId) {
        const participant = participantById[participantId]
        return participant ? participant.name : ""
    }

    function adminPeriodDate(periodStart) {
        return String(periodStart || "").slice(0, 10)
    }

    function adminParseDateOnly(value) {
        const dateOnly = adminPeriodDate(value)
        if (!dateOnly) {
            return null
        }

        const date = new Date(dateOnly + "T00:00:00Z")
        return Number.isNaN(date.getTime()) ? null : date
    }

    function adminFormatDateOnly(date) {
        return date.toISOString().slice(0, 10)
    }

    function adminStartOfWeekMonday(value) {
        const date = adminParseDateOnly(value)
        if (!date) {
            return ""
        }

        const weekday = date.getUTCDay()
        const offset = (weekday + 6) % 7
        date.setUTCDate(date.getUTCDate() - offset)
        return adminFormatDateOnly(date)
    }

    function adminCountWeekdaysInclusive(startDate, endDate) {
        if (startDate.getTime() > endDate.getTime()) {
            return 0
        }

        let count = 0
        const cursor = new Date(startDate.getTime())
        cursor.setUTCHours(0, 0, 0, 0)

        while (cursor.getTime() <= endDate.getTime()) {
            const weekday = cursor.getUTCDay()
            if (weekday !== 0 && weekday !== 6) {
                count++
            }

            cursor.setUTCDate(cursor.getUTCDate() + 1)
        }

        return count
    }

    const adminMissingBaselineDate = "2026-04-01"

    function adminExpectedSubmissionCount(entryMode, todayDate) {
        const baselineDate = adminParseDateOnly(adminMissingBaselineDate)
        if (!baselineDate) {
            return 0
        }

        const today = new Date(todayDate.getTime())
        today.setUTCHours(0, 0, 0, 0)

        if (baselineDate.getTime() > today.getTime()) {
            return 0
        }

        if (entryMode === "week") {
            const createdWeek = adminStartOfWeekMonday(adminMissingBaselineDate)
            const todayWeek = adminStartOfWeekMonday(adminFormatDateOnly(today))
            if (!createdWeek || !todayWeek) {
                return 0
            }

            const createdWeekDate = adminParseDateOnly(createdWeek)
            const todayWeekDate = adminParseDateOnly(todayWeek)
            if (!createdWeekDate || !todayWeekDate) {
                return 0
            }

            return Math.floor((todayWeekDate.getTime() - createdWeekDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
        }

        return adminCountWeekdaysInclusive(baselineDate, today)
    }

    function adminCreateDeletionEvent(app, deletedSubmission, participantName) {
        const collection = app.findCollectionByNameOrId("admin_activity_events")
        const eventRecord = new Record(collection)

        eventRecord.set("kind", "deletion")
        eventRecord.set("participant", adminStringValue(deletedSubmission, "participant"))
        eventRecord.set("participantName", participantName)
        eventRecord.set("submissionId", deletedSubmission.id)
        eventRecord.set("periodType", adminStringValue(deletedSubmission, "periodType"))
        eventRecord.set("periodStart", adminDateValue(deletedSubmission, "periodStart"))
        eventRecord.set("periodEnd", adminDateValue(deletedSubmission, "periodEnd"))
        eventRecord.set("submissionMode", adminStringValue(deletedSubmission, "submissionMode"))
        eventRecord.set("comment", adminStringValue(deletedSubmission, "comment"))
        eventRecord.set("dataRating", adminNumberValue(deletedSubmission, "dataRating"))
        eventRecord.set("generalAdminTime", adminNumberValue(deletedSubmission, "generalAdminTime"))
        eventRecord.set("commuteTime", adminNumberValue(deletedSubmission, "commuteTime"))
        eventRecord.set("structuralChanges", adminNumberValue(deletedSubmission, "structuralChanges"))

        app.save(eventRecord)
    }

    const participants = $app.findRecordsByFilter("participants", "", "name", 1000, 0)
    const subjects = $app.findRecordsByFilter("subjects", "", "key", 1000, 0)
    const participantSubjects = $app.findRecordsByFilter("participant_subjects", "", "", 5000, 0)
    const submissions = $app.findRecordsByFilter("submissions", "", "-submittedAt", 5000, 0)
    const submissionItems = $app.findRecordsByFilter("submission_items", "", "", 10000, 0)
    let reminderEvents = []

    let deletionEvents = []
    try {
        deletionEvents = $app.findRecordsByFilter("admin_activity_events", 'kind = "deletion"', "-created", 5000, 0)
    } catch (error) {
        deletionEvents = []
    }

    try {
        reminderEvents = $app.findRecordsByFilter("admin_reminders", "", "-created", 5000, 0)
    } catch (error) {
        reminderEvents = []
    }

    const participantById = {}
    const participantStatsById = {}
    const validSubmittedPeriodKeysByParticipant = {}
    for (const participant of participants) {
        participantById[participant.id] = {
            id: participant.id,
            name: adminStringValue(participant, "name"),
            email: adminStringValue(participant, "email"),
            entryMode: adminStringValue(participant, "entryMode") || "day",
            created: adminDateValue(participant, "created"),
            updated: adminDateValue(participant, "updated"),
        }
        participantStatsById[participant.id] = {
            subjectCount: 0,
            submissionCount: 0,
            missingCount: 0,
            lastActivityAt: "",
        }
        validSubmittedPeriodKeysByParticipant[participant.id] = {}
    }

    const subjectById = {}
    const subjectStatsById = {}
    for (const subject of subjects) {
        subjectById[subject.id] = {
            id: subject.id,
            key: adminStringValue(subject, "key"),
            labelEn: adminStringValue(subject, "label_en"),
            labelDe: adminStringValue(subject, "label_de"),
            credits: adminNumberValue(subject, "credits"),
            created: adminDateValue(subject, "created"),
            updated: adminDateValue(subject, "updated"),
        }
        subjectStatsById[subject.id] = {
            participantCount: 0,
            submissionItemCount: 0,
        }
    }

    for (const enrollment of participantSubjects) {
        const participantId = adminStringValue(enrollment, "participant")
        const subjectId = adminStringValue(enrollment, "subject")

        if (participantStatsById[participantId]) {
            participantStatsById[participantId].subjectCount++
        }

        if (subjectStatsById[subjectId]) {
            subjectStatsById[subjectId].participantCount++
        }
    }

    const itemsBySubmissionId = {}
    for (const item of submissionItems) {
        const submissionId = adminStringValue(item, "submission")
        const subjectId = adminStringValue(item, "workloadType")
        const subject = subjectById[subjectId]

        if (!itemsBySubmissionId[submissionId]) {
            itemsBySubmissionId[submissionId] = []
        }

        itemsBySubmissionId[submissionId].push({
            id: item.id,
            subjectId: subjectId,
            subjectKey: subject ? subject.key : "",
            subjectLabelEn: subject ? subject.labelEn : "",
            subjectLabelDe: subject ? subject.labelDe : "",
            type: adminStringValue(item, "type"),
            durationMinutes: adminNumberValue(item, "durationMinutes"),
        })

        if (subjectStatsById[subjectId]) {
            subjectStatsById[subjectId].submissionItemCount++
        }
    }

    const events = []
    for (const submission of submissions) {
        const participantId = adminStringValue(submission, "participant")
        const submissionMode = adminStringValue(submission, "submissionMode")
        const submittedAt = adminDateValue(submission, "submittedAt") || adminDateValue(submission, "created")
        const deletedAt = adminDateValue(submission, "deletedAt")
        const items = itemsBySubmissionId[submission.id] || []
        const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0)

        if (participantStatsById[participantId]) {
            if (submissionMode !== "deleted") {
                if (submissionMode !== "appendum") {
                    participantStatsById[participantId].submissionCount++
                }

                const periodKey = adminStringValue(submission, "periodType") + ":" + adminPeriodDate(adminDateValue(submission, "periodStart"))
                if (periodKey !== ":") {
                    validSubmittedPeriodKeysByParticipant[participantId][periodKey] = true
                }
            }

            const lastRelevantActivity =
                submissionMode === "deleted" && deletedAt
                    ? deletedAt
                    : submittedAt

            if (!participantStatsById[participantId].lastActivityAt || String(lastRelevantActivity).localeCompare(participantStatsById[participantId].lastActivityAt) > 0) {
                participantStatsById[participantId].lastActivityAt = lastRelevantActivity
            }
        }

        events.push({
            id: "submission:" + submission.id,
            kind: "submission",
            eventType: submissionMode === "deleted" ? "submitted" : submissionMode || "submitted",
            happenedAt: submittedAt,
            participantId: participantId,
            participantName: adminFindParticipantName(participantById, participantId),
            submissionId: submission.id,
            periodType: adminStringValue(submission, "periodType"),
            periodStart: adminDateValue(submission, "periodStart"),
            periodEnd: adminDateValue(submission, "periodEnd"),
            periodDate: adminPeriodDate(adminDateValue(submission, "periodStart")),
            dataRating: adminNumberValue(submission, "dataRating"),
            generalAdminTime: adminNumberValue(submission, "generalAdminTime"),
            commuteTime: adminNumberValue(submission, "commuteTime"),
            structuralChanges: adminNumberValue(submission, "structuralChanges"),
            comment: adminStringValue(submission, "comment"),
            itemCount: items.length,
            totalMinutes: totalMinutes,
            items: items,
        })

        if (submissionMode === "deleted" && deletedAt) {
            events.push({
                id: "submission-deleted:" + submission.id,
                kind: "submission",
                eventType: "deleted",
                happenedAt: deletedAt,
                participantId: participantId,
                participantName: adminFindParticipantName(participantById, participantId),
                submissionId: submission.id,
                periodType: adminStringValue(submission, "periodType"),
                periodStart: adminDateValue(submission, "periodStart"),
                periodEnd: adminDateValue(submission, "periodEnd"),
                periodDate: adminPeriodDate(adminDateValue(submission, "periodStart")),
                dataRating: adminNumberValue(submission, "dataRating"),
                generalAdminTime: adminNumberValue(submission, "generalAdminTime"),
                commuteTime: adminNumberValue(submission, "commuteTime"),
                structuralChanges: adminNumberValue(submission, "structuralChanges"),
                comment: adminStringValue(submission, "comment"),
                itemCount: items.length,
                totalMinutes: totalMinutes,
                items: items,
            })
        }
    }

    for (const eventRecord of deletionEvents) {
        const participantId = adminStringValue(eventRecord, "participant")
        const happenedAt = adminDateValue(eventRecord, "created")

        if (participantStatsById[participantId] && (!participantStatsById[participantId].lastActivityAt || String(happenedAt).localeCompare(participantStatsById[participantId].lastActivityAt) > 0)) {
            participantStatsById[participantId].lastActivityAt = happenedAt
        }

        events.push({
            id: "admin-event:" + eventRecord.id,
            kind: "deletion",
            eventType: "deletion",
            happenedAt: happenedAt,
            participantId: participantId,
            participantName: adminStringValue(eventRecord, "participantName") || adminFindParticipantName(participantById, participantId),
            submissionId: adminStringValue(eventRecord, "submissionId"),
            periodType: adminStringValue(eventRecord, "periodType"),
            periodStart: adminDateValue(eventRecord, "periodStart"),
            periodEnd: adminDateValue(eventRecord, "periodEnd"),
            periodDate: adminPeriodDate(adminDateValue(eventRecord, "periodStart")),
            dataRating: adminNumberValue(eventRecord, "dataRating"),
            generalAdminTime: adminNumberValue(eventRecord, "generalAdminTime"),
            commuteTime: adminNumberValue(eventRecord, "commuteTime"),
            structuralChanges: adminNumberValue(eventRecord, "structuralChanges"),
            comment: adminStringValue(eventRecord, "comment"),
            itemCount: 0,
            totalMinutes: 0,
            items: [],
        })
    }

    for (const reminderRecord of reminderEvents) {
        const participantId = adminStringValue(reminderRecord, "participant")
        const happenedAt = adminDateValue(reminderRecord, "created")
        const participantEmail = adminStringValue(reminderRecord, "participantEmail")
        const sentByEmail = adminStringValue(reminderRecord, "sentByEmail")

        if (participantStatsById[participantId] && (!participantStatsById[participantId].lastActivityAt || String(happenedAt).localeCompare(participantStatsById[participantId].lastActivityAt) > 0)) {
            participantStatsById[participantId].lastActivityAt = happenedAt
        }

        events.push({
            id: "admin-reminder:" + reminderRecord.id,
            kind: "reminder",
            eventType: "reminder",
            happenedAt: happenedAt,
            participantId: participantId,
            participantName: adminStringValue(reminderRecord, "participantName") || adminFindParticipantName(participantById, participantId),
            participantEmail: participantEmail,
            sentByEmail: sentByEmail,
            submissionId: "",
            periodType: "",
            periodStart: happenedAt,
            periodEnd: "",
            periodDate: adminPeriodDate(happenedAt),
            dataRating: 0,
            generalAdminTime: 0,
            commuteTime: 0,
            structuralChanges: 0,
            itemCount: 0,
            totalMinutes: 0,
            items: [],
        })
    }

    const today = new Date()
    for (const participantId of Object.keys(participantById)) {
        const participant = participantById[participantId]
        const expectedCount = adminExpectedSubmissionCount(participant.entryMode, today)
        const submittedPeriodCount = Object.keys(validSubmittedPeriodKeysByParticipant[participantId] || {}).length
        participantStatsById[participantId].missingCount = Math.max(0, expectedCount - submittedPeriodCount)
    }

    events.sort((a, b) => String(b.happenedAt).localeCompare(String(a.happenedAt)))

    return e.json(200, {
        participants: Object.keys(participantById).map((id) => ({
            ...participantById[id],
            ...participantStatsById[id],
        })),
        subjects: Object.keys(subjectById).map((id) => ({
            ...subjectById[id],
            ...subjectStatsById[id],
        })),
        events: events,
    })
}, $apis.requireAuth("admins"))

routerAdd("POST", "/api/admin/participants", (e) => {
    const body = e.requestInfo().body || {}

    const name = String(body.name || "").trim()
    const email = String(body.email || "").trim()
    const entryMode = String(body.entryMode || "day").trim() === "week" ? "week" : "day"

    if (!name) {
        return e.json(400, { error: "Missing participant name" })
    }

    const collection = $app.findCollectionByNameOrId("participants")
    const participant = new Record(collection)

    participant.set("name", name)
    participant.set("email", email)
    participant.set("entryMode", entryMode)

    $app.save(participant)

    return e.json(200, {
        ok: true,
        participantId: participant.id,
    })
}, $apis.requireAuth("admins"))

routerAdd("POST", "/api/admin/subjects", (e) => {
    const body = e.requestInfo().body || {}

    const key = String(body.key || "").trim()
    const labelEn = String(body.labelEn || "").trim()
    const labelDe = String(body.labelDe || "").trim()
    const credits = Math.max(0, Number(body.credits || 0))

    if (!key) {
        return e.json(400, { error: "Missing subject key" })
    }

    if (!labelEn && !labelDe) {
        return e.json(400, { error: "Missing subject label" })
    }

    const collection = $app.findCollectionByNameOrId("subjects")
    const subject = new Record(collection)

    subject.set("key", key)
    subject.set("label_en", labelEn)
    subject.set("label_de", labelDe)
    subject.set("credits", credits)

    $app.save(subject)

    return e.json(200, {
        ok: true,
        subjectId: subject.id,
    })
}, $apis.requireAuth("admins"))

onRecordAfterDeleteSuccess((e) => {
    const record = e.record
    if (!record) {
        return
    }

    const participantId = adminStringValue(record, "participant")
    let participantName = ""

    if (participantId) {
        try {
            const participant = e.app.findRecordById("participants", participantId)
            participantName = adminStringValue(participant, "name")
        } catch (error) {
            participantName = ""
        }
    }

    try {
        adminCreateDeletionEvent(e.app, record, participantName)
    } catch (error) {
        console.error("Failed to write admin deletion event:", error)
    }
}, "submissions")
