/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_653341844")

  // remove field
  collection.fields.removeById("text889886754")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_653341844")

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "[a-z0-9]{30}",
    "hidden": false,
    "id": "text889886754",
    "max": 0,
    "min": 0,
    "name": "accessToken",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
