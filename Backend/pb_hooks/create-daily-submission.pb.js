/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/submissions/weekly", (e) => {
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

    function formatUtcDateTime(date) {
        return (
            date.getUTCFullYear() +
            "-" +
            pad2(date.getUTCMonth() + 1) +
            "-" +
            pad2(date.getUTCDate()) +
            " " +
            pad2(date.getUTCHours()) +
            ":" +
            pad2(date.getUTCMinutes()) +
            ":" +
            pad2(date.getUTCSeconds()) +
            ".000Z"
        )
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

    function startOfWeekMonday(date) {
        const d = startOfDay(date)
        const day = d.getDay()
        const diff = day === 0 ? -6 : 1 - day
        d.setDate(d.getDate() + diff)
        return d
    }

    function endOfWeekSunday(date) {
        const d = startOfWeekMonday(date)
        d.setDate(d.getDate() + 6)
        d.setHours(23, 59, 59, 999)
        return d
    }

    function ensureWeeklyCategory(txApp, categoryKey) {
        const categories = {
            weekly_preparation: {
                labelEn: "Preparation",
                labelDe: "Vorbereitung",
            },
            weekly_contact_time: {
                labelEn: "Contact time",
                labelDe: "Kontaktzeit",
            },
            weekly_follow_up: {
                labelEn: "Follow-up",
                labelDe: "Nachbereitung",
            },
        }

        const category = categories[categoryKey]
        if (!category) {
            return null
        }

        try {
            const existing = txApp.findFirstRecordByFilter(
                "subjects",
                "key = {:categoryKey}",
                { categoryKey }
            )
            if (existing) {
                return existing
            }
        } catch (error) {
            // Create the reserved category below if it does not exist yet.
        }

        const collection = txApp.findCollectionByNameOrId("subjects")
        const record = new Record(collection)
        record.set("key", categoryKey)
        record.set("label_en", category.labelEn)
        record.set("label_de", category.labelDe)
        record.set("credits", 0)
        txApp.save(record)
        return record
    }

    const body = e.requestInfo().body || {}

    const participantId = String(body.participantId || "").trim()
    const weekStart = String(body.weekStart || "").trim()
    const comment = String(body.comment || "").trim()
    const reliability = Number(body.reliability || 0)
    const adminEffortMinutes = Math.max(0, Number(body.adminEffortMinutes || 0))
    const commuteMinutes = Math.max(0, Number(body.commuteMinutes || 0))
    const structuralChangesMinutes = Math.max(0, Number(body.structuralChangesMinutes || 0))
    const categoryTimes = Array.isArray(body.categoryTimes) ? body.categoryTimes : []

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    if (!weekStart) {
        return e.json(400, { error: "Missing weekStart" })
    }

    const targetDate = new Date(weekStart + "T00:00:00")
    if (isNaN(targetDate.getTime())) {
        return e.json(400, { error: "Invalid weekStart" })
    }

    if (reliability < 0 || reliability > 5) {
        return e.json(400, { error: "reliability must be between 0 and 5" })
    }

    let createdSubmissionId = ""
    let createdMode = "initial"
    let createdItemCount = 0

    try {
        $app.runInTransaction((txApp) => {
            const participant = txApp.findRecordById("participants", participantId)
            if (!participant) {
                throw new Error("Participant not found")
            }

            if ((participant.get("entryMode") || "day") !== "week") {
                throw new Error("Participant does not use weekly submissions")
            }

            const periodStart = startOfWeekMonday(targetDate)
            const periodEnd = endOfWeekSunday(periodStart)
            const periodStartStr = formatDateTime(periodStart)
            const periodEndStr = formatDateTime(periodEnd)
            const periodStartDayEndStr = formatDateTime(endOfDay(periodStart))

            const existingWeekSubmissions = txApp.findRecordsByFilter(
                "submissions",
                [
                    "participant = {:participantId}",
                    'periodType = "week"',
                    'submissionMode != "deleted"',
                    "periodStart >= {:periodStart}",
                    "periodStart <= {:periodStartDayEnd}",
                ].join(" && "),
                "-submittedAt",
                50,
                0,
                {
                    participantId,
                    periodStart: periodStartStr,
                    periodStartDayEnd: periodStartDayEndStr,
                }
            )

            const submissionMode = existingWeekSubmissions.length > 0 ? "appendum" : "initial"
            const replacesSubmissionId =
                submissionMode === "appendum" ? String(existingWeekSubmissions[0].id || "") : ""

            const submissionCollection = txApp.findCollectionByNameOrId("submissions")
            const submissionRecord = new Record(submissionCollection)
            submissionRecord.set("participant", participantId)
            submissionRecord.set("periodType", "week")
            submissionRecord.set("periodStart", periodStartStr)
            submissionRecord.set("periodEnd", periodEndStr)
            submissionRecord.set("status", "submitted")
            submissionRecord.set("submissionMode", submissionMode)
            submissionRecord.set("replacesSubmission", replacesSubmissionId)
            submissionRecord.set("submittedAt", formatUtcDateTime(new Date()))
            submissionRecord.set("dataRating", reliability)
            submissionRecord.set("comment", comment)
            submissionRecord.set("generalAdminTime", adminEffortMinutes)
            submissionRecord.set("commuteTime", commuteMinutes)
            submissionRecord.set("structuralChanges", structuralChangesMinutes)

            txApp.save(submissionRecord)

            const itemCollection = txApp.findCollectionByNameOrId("submission_items")

            for (const item of categoryTimes) {
                const categoryKey = String(item.categoryId || "").trim()
                const category = ensureWeeklyCategory(txApp, categoryKey)
                const minutes = Math.max(0, Number(item.minutes || 0))

                if (!category || minutes <= 0) {
                    continue
                }

                const categoryItem = new Record(itemCollection)
                categoryItem.set("submission", submissionRecord.id)
                categoryItem.set("workloadType", category.id)
                categoryItem.set("durationMinutes", minutes)
                categoryItem.set("type", "class")
                txApp.save(categoryItem)
                createdItemCount++
            }

            createdSubmissionId = submissionRecord.id
            createdMode = submissionMode
        })
    } catch (error) {
        return e.json(400, {
            error: "Failed to create weekly submission",
            details: String(error),
        })
    }

    return e.json(200, {
        ok: true,
        submissionId: createdSubmissionId,
        submissionMode: createdMode,
        createdItems: createdItemCount,
    })
})

routerAdd("DELETE", "/api/submissions/weekly", (e) => {
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

    function formatUtcDateTime(date) {
        return (
            date.getUTCFullYear() +
            "-" +
            pad2(date.getUTCMonth() + 1) +
            "-" +
            pad2(date.getUTCDate()) +
            " " +
            pad2(date.getUTCHours()) +
            ":" +
            pad2(date.getUTCMinutes()) +
            ":" +
            pad2(date.getUTCSeconds()) +
            ".000Z"
        )
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

    function startOfWeekMonday(date) {
        const d = startOfDay(date)
        const day = d.getDay()
        const diff = day === 0 ? -6 : 1 - day
        d.setDate(d.getDate() + diff)
        return d
    }

    const body = e.requestInfo().body || {}

    const participantId = String(body.participantId || "").trim()
    const weekStart = String(body.weekStart || "").trim()

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    if (!weekStart) {
        return e.json(400, { error: "Missing weekStart" })
    }

    const targetDate = new Date(weekStart + "T00:00:00")
    if (isNaN(targetDate.getTime())) {
        return e.json(400, { error: "Invalid weekStart" })
    }

    let deletedSubmissions = 0

    try {
        $app.runInTransaction((txApp) => {
            const participant = txApp.findRecordById("participants", participantId)
            if (!participant) {
                throw new Error("Participant not found")
            }

            const periodStart = startOfWeekMonday(targetDate)
            const periodStartStr = formatDateTime(periodStart)
            const periodStartDayEndStr = formatDateTime(endOfDay(periodStart))

            const weekSubmissions = txApp.findRecordsByFilter(
                "submissions",
                [
                    "participant = {:participantId}",
                    'periodType = "week"',
                    'submissionMode != "deleted"',
                    "periodStart >= {:periodStart}",
                    "periodStart <= {:periodStartDayEnd}",
                ].join(" && "),
                "",
                500,
                0,
                {
                    participantId,
                    periodStart: periodStartStr,
                    periodStartDayEnd: periodStartDayEndStr,
                }
            )

            const deletedAt = formatUtcDateTime(new Date())

            for (const submission of weekSubmissions) {
                submission.set("submissionMode", "deleted")
                submission.set("deletedAt", deletedAt)
                txApp.save(submission)
                deletedSubmissions++
            }
        })
    } catch (error) {
        return e.json(400, {
            error: "Failed to delete weekly submissions",
            details: String(error),
        })
    }

    return e.json(200, {
        ok: true,
        deletedSubmissions,
        deletedSubmissionItems: 0,
    })
})


routerAdd("POST", "/api/submissions/daily", (e) => {
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

    function formatUtcDateTime(date) {
        return (
            date.getUTCFullYear() +
            "-" +
            pad2(date.getUTCMonth() + 1) +
            "-" +
            pad2(date.getUTCDate()) +
            " " +
            pad2(date.getUTCHours()) +
            ":" +
            pad2(date.getUTCMinutes()) +
            ":" +
            pad2(date.getUTCSeconds()) +
            ".000Z"
        )
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

    const body = e.requestInfo().body || {}

    const participantId = String(body.participantId || "").trim()
    const date = String(body.date || "").trim()
    const comment = String(body.comment || "").trim()
    const reliability = Number(body.reliability || 0)
    const adminEffortMinutes = Math.max(0, Number(body.adminEffortMinutes || 0))
    const commuteMinutes = Math.max(0, Number(body.commuteMinutes || 0))
    const subjectTimes = Array.isArray(body.subjectTimes) ? body.subjectTimes : []

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    if (!date) {
        return e.json(400, { error: "Missing date" })
    }

    const targetDate = new Date(date + "T00:00:00")
    if (isNaN(targetDate.getTime())) {
        return e.json(400, { error: "Invalid date" })
    }

    if (reliability < 0 || reliability > 5) {
        return e.json(400, { error: "reliability must be between 0 and 5" })
    }

    let createdSubmissionId = ""
    let createdMode = "initial"
    let createdItemCount = 0

    try {
        $app.runInTransaction((txApp) => {
            const participant = txApp.findRecordById("participants", participantId)
            if (!participant) {
                throw new Error("Participant not found")
            }

            const dayStart = startOfDay(targetDate)
            const dayEnd = endOfDay(targetDate)
            const dayStartStr = formatDateTime(dayStart)
            const dayEndStr = formatDateTime(dayEnd)

            const existingDaySubmissions = txApp.findRecordsByFilter(
                "submissions",
                [
                    "participant = {:participantId}",
                    'periodType = "day"',
                    'submissionMode != "deleted"',
                    "periodStart >= {:dayStart}",
                    "periodStart <= {:dayEnd}",
                ].join(" && "),
                "-submittedAt",
                50,
                0,
                {
                    participantId,
                    dayStart: dayStartStr,
                    dayEnd: dayEndStr,
                }
            )

            const submissionMode = existingDaySubmissions.length > 0 ? "appendum" : "initial"
            const replacesSubmissionId =
                submissionMode === "appendum" ? String(existingDaySubmissions[0].id || "") : ""

            const enrollmentRecords = txApp.findRecordsByFilter(
                "participant_subjects",
                "participant = {:participantId}",
                "",
                1000,
                0,
                { participantId }
            )

            const allowedSubjectIds = {}
            for (const enrollment of enrollmentRecords) {
                const subjectId = String(enrollment.get("subject") || "")
                if (subjectId) {
                    allowedSubjectIds[subjectId] = true
                }
            }

            const submissionCollection = txApp.findCollectionByNameOrId("submissions")
            const submissionRecord = new Record(submissionCollection)
            submissionRecord.set("participant", participantId)
            submissionRecord.set("periodType", "day")
            submissionRecord.set("periodStart", dayStartStr)
            submissionRecord.set("periodEnd", dayEndStr)
            submissionRecord.set("status", "submitted")
            submissionRecord.set("submissionMode", submissionMode)
            submissionRecord.set("replacesSubmission", replacesSubmissionId)
            submissionRecord.set("submittedAt", formatUtcDateTime(new Date()))
            submissionRecord.set("dataRating", reliability)
            submissionRecord.set("comment", comment)
            submissionRecord.set("generalAdminTime", adminEffortMinutes)
            submissionRecord.set("commuteTime", commuteMinutes)

            txApp.save(submissionRecord)

            const itemCollection = txApp.findCollectionByNameOrId("submission_items")

            for (const item of subjectTimes) {
                const subjectId = String(item.subjectId || "")
                if (!subjectId || !allowedSubjectIds[subjectId]) {
                    continue
                }

                const classMinutes = Math.max(0, Number(item.classMinutes || 0))
                const studyMinutes = Math.max(0, Number(item.studyMinutes || 0))

                if (classMinutes > 0) {
                    const classItem = new Record(itemCollection)
                    classItem.set("submission", submissionRecord.id)
                    classItem.set("workloadType", subjectId)
                    classItem.set("durationMinutes", classMinutes)
                    classItem.set("type", "class")
                    txApp.save(classItem)
                    createdItemCount++
                }

                if (studyMinutes > 0) {
                    const studyItem = new Record(itemCollection)
                    studyItem.set("submission", submissionRecord.id)
                    studyItem.set("workloadType", subjectId)
                    studyItem.set("durationMinutes", studyMinutes)
                    studyItem.set("type", "study")
                    txApp.save(studyItem)
                    createdItemCount++
                }
            }

            createdSubmissionId = submissionRecord.id
            createdMode = submissionMode
        })
    } catch (error) {
        return e.json(400, {
            error: "Failed to create daily submission",
            details: String(error),
        })
    }

    return e.json(200, {
        ok: true,
        submissionId: createdSubmissionId,
        submissionMode: createdMode,
        createdItems: createdItemCount,
    })
})

routerAdd("DELETE", "/api/submissions/daily", (e) => {
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

    function formatUtcDateTime(date) {
        return (
            date.getUTCFullYear() +
            "-" +
            pad2(date.getUTCMonth() + 1) +
            "-" +
            pad2(date.getUTCDate()) +
            " " +
            pad2(date.getUTCHours()) +
            ":" +
            pad2(date.getUTCMinutes()) +
            ":" +
            pad2(date.getUTCSeconds()) +
            ".000Z"
        )
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

    const body = e.requestInfo().body || {}

    const participantId = String(body.participantId || "").trim()
    const date = String(body.date || "").trim()

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    if (!date) {
        return e.json(400, { error: "Missing date" })
    }

    const targetDate = new Date(date + "T00:00:00")
    if (isNaN(targetDate.getTime())) {
        return e.json(400, { error: "Invalid date" })
    }

    let deletedSubmissions = 0
    let deletedItems = 0

    try {
        $app.runInTransaction((txApp) => {
            const participant = txApp.findRecordById("participants", participantId)
            if (!participant) {
                throw new Error("Participant not found")
            }

            const dayStart = startOfDay(targetDate)
            const dayEnd = endOfDay(targetDate)
            const dayStartStr = formatDateTime(dayStart)
            const dayEndStr = formatDateTime(dayEnd)

            const daySubmissions = txApp.findRecordsByFilter(
                "submissions",
                [
                    "participant = {:participantId}",
                    'periodType = "day"',
                    'submissionMode != "deleted"',
                    "periodStart >= {:dayStart}",
                    "periodStart <= {:dayEnd}",
                ].join(" && "),
                "",
                500,
                0,
                {
                    participantId,
                    dayStart: dayStartStr,
                    dayEnd: dayEndStr,
                }
            )

            const deletedAt = formatUtcDateTime(new Date())

            for (const submission of daySubmissions) {
                submission.set("submissionMode", "deleted")
                submission.set("deletedAt", deletedAt)
                txApp.save(submission)
                deletedSubmissions++
            }
        })
    } catch (error) {
        return e.json(400, {
            error: "Failed to delete daily submissions",
            details: String(error),
        })
    }

    return e.json(200, {
        ok: true,
        deletedSubmissions,
        deletedSubmissionItems: deletedItems,
    })
})
