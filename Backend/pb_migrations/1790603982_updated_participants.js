/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_653341844")

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "date2198845375",
    "max": "",
    "min": "",
    "name": "referenceDate",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_653341844")

  // remove field
  collection.fields.removeById("date2198845375")

  return app.save(collection)
})
