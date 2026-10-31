/// <reference path="../pb_data/types.d.ts" />
routerAdd("DELETE", "/api/admin/participant", (e) => {
    const participantId = (e.requestInfo().query["participantId"] || "").trim()
    if (!participantId) return e.json(400, { error: "Missing participantId" })
    // Roll back the entire removal if any related record fails to delete.
    $app.runInTransaction(app => {
        const queries = require(`${__hooks}/record-queries.js`)
        const participant = app.findRecordById("participants", participantId)
        const submissions = queries.all(app, "submissions", "participant = {:participantId}", "", { participantId })
        for (const item of queries.related(app, "submission_items", "submission", submissions.map(s => s.id))) app.delete(item)
        for (const enrollment of queries.all(app, "participant_subjects", "participant = {:participantId}", "", { participantId })) app.delete(enrollment)
        for (const submission of submissions) {
            if (submission.get("replacesSubmission")) {
                submission.set("replacesSubmission", "")
                app.save(submission)
            }
        }
        for (const submission of submissions) app.delete(submission)
        app.delete(participant)
    })
    return e.json(200, { success: true })
}, $apis.requireAuth("admins"))
