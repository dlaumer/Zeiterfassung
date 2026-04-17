/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_653341844")

  // remove field
  collection.fields.removeById("text2301595401")

  // add field
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
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_653341844")

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2301595401",
    "max": 0,
    "min": 0,
    "name": "entryMode",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("select2301595401")

  return app.save(collection)
})
