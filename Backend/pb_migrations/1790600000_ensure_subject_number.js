migrate((app) => {
    const collection = app.findCollectionByNameOrId("subjects")
    if (!collection.fields.getByName("number")) {
        collection.fields.add(new TextField({ name: "number" }))
        app.save(collection)
    }
}, (app) => {
    // Preserve module numbers when rolling back this compatibility migration.
})
