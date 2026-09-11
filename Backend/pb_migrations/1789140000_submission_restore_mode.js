migrate((app) => {
    const collection = app.findCollectionByNameOrId("submissions")
    collection.fields.add(new TextField({ name: "modeBeforeDeletion" }))
    app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId("submissions")
    collection.fields.removeByName("modeBeforeDeletion")
    app.save(collection)
})
