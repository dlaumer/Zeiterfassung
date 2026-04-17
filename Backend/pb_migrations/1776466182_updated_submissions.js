/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3482339971")

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "number266481599",
    "max": null,
    "min": null,
    "name": "generalAdminTime",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "number4115426736",
    "max": null,
    "min": null,
    "name": "commuteTime",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3482339971")

  // remove field
  collection.fields.removeById("number266481599")

  // remove field
  collection.fields.removeById("number4115426736")

  return app.save(collection)
})
