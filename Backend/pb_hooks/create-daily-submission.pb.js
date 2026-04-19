/// <reference path="../pb_data/types.d.ts" />

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
                    "periodStart >= {:dayStart}",
                    "periodStart <= {:dayEnd}",
                ].join(" && "),
                "-created",
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
