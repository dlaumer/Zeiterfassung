/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    let settings
    try { settings = app.findCollectionByNameOrId("adminSettings") } catch (_) {
        settings = new Collection({ name: "adminSettings", type: "base", fields: [
            { name: "key", type: "text", required: true },
            { name: "value", type: "text", required: true },
        ] })
        app.save(settings)
    }
    let reviewTime
    try { reviewTime = app.findFirstRecordByFilter("adminSettings", 'key = "reviewTime"') } catch (_) {}
    if (!reviewTime) {
        const record = new Record(settings)
        record.set("key", "reviewTime")
        record.set("value", "14")
        app.save(record)
    }
    const submissions = app.findCollectionByNameOrId("submissions")
    const mode = submissions.fields.getByName("submissionMode")
    if (!mode.values.includes("correction")) mode.values = mode.values.concat(["correction"])
    for (const name of ["generalAdminTime", "commuteTime", "structuralChanges"]) {
        submissions.fields.getByName(name).min = null
    }
    app.save(submissions)
    const items = app.findCollectionByNameOrId("submission_items")
    items.fields.getByName("durationMinutes").min = null
    app.save(items)
}, (app) => {
    // Keep correction data and settings intact when rolling back application code.
})
