/// <reference path="../pb_data/types.d.ts" />

routerAdd("PATCH", "/api/admin/subject", (e) => {
    const subjectId = String(e.requestInfo().query["subjectId"] || "").trim()
    const body = e.requestInfo().body || {}
    const key = String(body.key || "").trim()
    const number = String(body.number || "").trim()
    const labelEn = String(body.labelEn || "").trim()
    const labelDe = String(body.labelDe || "").trim()
    const credits = Number(body.credits || 0)

    if (!subjectId || !key || (!labelEn && !labelDe)) {
        return e.json(400, { error: "Missing subject ID, key, or label" })
    }
    if (!Number.isFinite(credits) || credits < 0) {
        return e.json(400, { error: "Credits must be a non-negative number" })
    }

    const subject = $app.findRecordById("subjects", subjectId)
    subject.set("key", key)
    subject.set("number", number)
    subject.set("label_en", labelEn)
    subject.set("label_de", labelDe)
    subject.set("credits", credits)
    $app.save(subject)

    return e.json(200, { ok: true, subjectId: subject.id })
}, $apis.requireAuth("admins"))

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
