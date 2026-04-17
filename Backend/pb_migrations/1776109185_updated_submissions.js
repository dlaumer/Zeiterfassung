/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3482339971")

  // remove field
  collection.fields.removeById("text1809120727")

  // remove field
  collection.fields.removeById("text2063623452")

  // remove field
  collection.fields.removeById("text2926970275")

  // add field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "select1809120727",
    "maxSelect": 1,
    "name": "periodType",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "day",
      "week"
    ]
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 1,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "submitted",
      "replaced",
      "skipped"
    ]
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "select2926970275",
    "maxSelect": 1,
    "name": "submissionMode",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "initial",
      "correction",
      "appendum"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3482339971")

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1809120727",
    "max": 0,
    "min": 0,
    "name": "periodType",
    "pattern": "^(day|week)$",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2063623452",
    "max": 0,
    "min": 0,
    "name": "status",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2926970275",
    "max": 0,
    "min": 0,
    "name": "submissionMode",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("select1809120727")

  // remove field
  collection.fields.removeById("select2063623452")

  // remove field
  collection.fields.removeById("select2926970275")

  return app.save(collection)
})
