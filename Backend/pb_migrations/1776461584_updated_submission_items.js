/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_586034538")

  // update field
  collection.fields.addAt(3, new Field({
    "hidden": true,
    "id": "number3473557905",
    "max": null,
    "min": null,
    "name": "durationMinutes",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_586034538")

  // update field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "number3473557905",
    "max": null,
    "min": null,
    "name": "durationMinutes",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})
