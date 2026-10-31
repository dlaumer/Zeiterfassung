/// <reference path="../pb_data/types.d.ts" />

// Partial updates keep unrelated participant fields and faculty assignments intact.
routerAdd("PATCH", "/api/admin/participant/status", (e) => {
    const body = e.requestInfo().body || {}
    const participantId = String(body.participantId || "").trim()
    if (!participantId) return e.json(400, { error: "Missing participantId" })
    const hasDate = Object.prototype.hasOwnProperty.call(body, "referenceDate")
    const hasInactive = Object.prototype.hasOwnProperty.call(body, "inactive")
    if (!hasDate && !hasInactive) return e.json(400, { error: "Missing update" })
    if (hasInactive && typeof body.inactive !== "boolean") return e.json(400, { error: "Invalid inactive" })
    const date = String(body.referenceDate || "")
    if (hasDate) {
        const parsed = new Date(date + "T00:00:00Z")
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
            return e.json(400, { error: "Invalid referenceDate" })
        }
    }
    let participant
    try { participant = $app.findRecordById("participants", participantId) }
    catch (_) { return e.json(404, { error: "Participant not found" }) }
    if (hasDate) participant.set("referenceDate", date + " 00:00:00.000Z")
    if (hasInactive) participant.set("inactive", body.inactive)
    $app.save(participant)
    return e.json(200, { ok: true })
}, $apis.requireAuth("admins"))
