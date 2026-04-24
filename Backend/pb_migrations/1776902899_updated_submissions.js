/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3482339971")

  // update field
  collection.fields.addAt(7, new Field({
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
      "appendum",
      "deleted"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3482339971")

  // update field
  collection.fields.addAt(7, new Field({
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
})
