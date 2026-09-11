/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("participants")
    if (!collection.fields.getByName("inactive")) {
        collection.fields.add(new BoolField({ name: "inactive" }))
        app.save(collection)
    }
}, (app) => {
    // Preserve participant status on rollback.
})
