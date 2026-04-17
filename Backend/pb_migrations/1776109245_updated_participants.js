/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_653341844")

  // update field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "select2301595401",
    "maxSelect": 1,
    "name": "entryMode",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "day",
      "week"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_653341844")

  // update field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "select2301595401",
    "maxSelect": 1,
    "name": "entryMode",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "day",
      "week"
    ]
  }))

  return app.save(collection)
})
