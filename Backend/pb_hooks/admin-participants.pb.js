/// <reference path="../pb_data/types.d.ts" />

routerAdd("DELETE", "/api/admin/participant", (e) => {
    const participantId = (e.requestInfo().query["participantId"] || "").trim()

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    const participant = $app.findRecordById("participants", participantId)

    if (!participant) {
        return e.json(404, { error: "Participant not found" })
    }

    const submissions = $app.findRecordsByFilter(
        "submissions",
        "participant = {:participantId}",
        "",
        5000,
        0,
        { participantId }
    )

    const submissionIds = submissions.map((submission) => submission.id)

    if (submissionIds.length > 0) {
        const submissionFilter = submissionIds
            .map((id) => `submission = "${id}"`)
            .join(" || ")

        const submissionItems = $app.findRecordsByFilter(
            "submission_items",
            submissionFilter,
            "",
            20000,
            0
        )

        for (const item of submissionItems) {
            $app.delete(item)
        }
    }

    const participantSubjects = $app.findRecordsByFilter(
        "participant_subjects",
        "participant = {:participantId}",
        "",
        5000,
        0,
        { participantId }
    )

    for (const enrollment of participantSubjects) {
        $app.delete(enrollment)
    }

    for (const submission of submissions) {
        $app.delete(submission)
    }

    $app.delete(participant)

    return e.json(200, { success: true })
}, $apis.requireAuth("admins"))
