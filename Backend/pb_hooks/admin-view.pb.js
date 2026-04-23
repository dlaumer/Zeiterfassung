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

        app.save(eventRecord)
    }

    const participants = $app.findRecordsByFilter("participants", "", "name", 1000, 0)
    const subjects = $app.findRecordsByFilter("subjects", "", "key", 1000, 0)
    const participantSubjects = $app.findRecordsByFilter("participant_subjects", "", "", 5000, 0)
    const submissions = $app.findRecordsByFilter("submissions", "", "-submittedAt", 5000, 0)
    const submissionItems = $app.findRecordsByFilter("submission_items", "", "", 10000, 0)

    let deletionEvents = []
    try {
        deletionEvents = $app.findRecordsByFilter("admin_activity_events", 'kind = "deletion"', "-created", 5000, 0)
    } catch (error) {
        deletionEvents = []
    }

    const participantById = {}
    const participantStatsById = {}
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
            lastActivityAt: "",
        }
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
            color: adminStringValue(subject, "color"),
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
        const happenedAt = adminDateValue(submission, "submittedAt") || adminDateValue(submission, "created")
        const items = itemsBySubmissionId[submission.id] || []
        const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0)

        if (participantStatsById[participantId]) {
            participantStatsById[participantId].submissionCount++
            if (!participantStatsById[participantId].lastActivityAt || String(happenedAt).localeCompare(participantStatsById[participantId].lastActivityAt) > 0) {
                participantStatsById[participantId].lastActivityAt = happenedAt
            }
        }

        events.push({
            id: "submission:" + submission.id,
            kind: "submission",
            eventType: adminStringValue(submission, "submissionMode") || "submitted",
            happenedAt: happenedAt,
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
            comment: adminStringValue(submission, "comment"),
            itemCount: items.length,
            totalMinutes: totalMinutes,
            items: items,
        })
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
            comment: adminStringValue(eventRecord, "comment"),
            itemCount: 0,
            totalMinutes: 0,
            items: [],
        })
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
