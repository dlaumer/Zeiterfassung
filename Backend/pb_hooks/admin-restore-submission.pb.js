routerAdd("POST", "/api/admin/submissions/restore", (e) => {
    const id = String((e.requestInfo().body || {}).submissionId || "")
    let failure = "admin.restore.failed"
    try {
        $app.runInTransaction((app) => {
            const review = require(`${__hooks}/submission-review.js`)
            const requested = app.findRecordById("submissions", id)
            const selected = requested.get("submissionMode") === "deleted" ? requested : review.root(app, requested)
            if (selected.get("submissionMode") !== "deleted") throw new Error("Not deleted")
            const group = app.findRecordsByFilter("submissions",
                "participant = {:participant} && periodType = {:type} && periodStart = {:start}",
                "", 0, 0, { participant: selected.get("participant"), type: selected.get("periodType"), start: selected.get("periodStart") })
            if (review.active(app, group).length) {
                failure = "admin.restore.conflict"
                throw new Error("Period already contains an active submission")
            }
            const batch = group.filter(s => String(s.get("deletedAt")) === String(selected.get("deletedAt")))
            // Keep deletion markers as log history; only restore original data.
            const originals = batch.filter(s => {
                const previous = group.find(record => record.id === String(s.get("replacesSubmission") || ""))
                const items = app.findRecordsByFilter("submission_items", "submission = {:id}", "", 1, 0, { id: s.id })
                return !review.isDeletionMarker(s, previous, items.length > 0)
            })
            if (!originals.length) throw new Error("No original submissions")
            for (const s of originals) {
                let mode = String(s.get("modeBeforeDeletion") || "")
                if (!mode) {
                    // Old single initial entries are unambiguous. Legacy corrections
                    // cannot be distinguished from appendums after their mode was erased.
                    if (originals.length !== 1 || s.get("replacesSubmission")) {
                        failure = "admin.restore.legacy"
                        throw new Error("Original submission modes are unavailable")
                    }
                    mode = "initial"
                }
                if (!["initial", "appendum", "correction"].includes(mode)) throw new Error("Invalid original mode")
                s.set("submissionMode", mode)
                s.set("deletedAt", "")
                s.set("modeBeforeDeletion", "")
                app.save(s)
            }
        })
    } catch (error) {
        return e.json(400, { error: failure })
    }
    return e.json(200, { ok: true })
}, $apis.requireAuth("admins"))
