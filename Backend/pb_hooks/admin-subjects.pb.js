/// <reference path="../pb_data/types.d.ts" />

routerAdd("DELETE", "/api/admin/subject", (e) => {
    const subjectId = (e.requestInfo().query["subjectId"] || "").trim()

    if (!subjectId) {
        return e.json(400, { error: "Missing subjectId" })
    }

    const subject = $app.findRecordById("subjects", subjectId)

    if (!subject) {
        return e.json(404, { error: "Subject not found" })
    }

    const submissionItems = $app.findRecordsByFilter(
        "submission_items",
        "workloadType = {:subjectId}",
        "",
        1,
        0,
        { subjectId }
    )

    if (submissionItems.length > 0) {
        return e.json(409, { error: "Subject is used by submitted data" })
    }

    const participantSubjects = $app.findRecordsByFilter(
        "participant_subjects",
        "subject = {:subjectId}",
        "",
        5000,
        0,
        { subjectId }
    )

    for (const enrollment of participantSubjects) {
        $app.delete(enrollment)
    }

    $app.delete(subject)

    return e.json(200, { success: true })
}, $apis.requireAuth("admins"))
