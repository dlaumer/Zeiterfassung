/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2726736638")

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "number1092079998",
    "max": null,
    "min": null,
    "name": "credits",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2726736638")

  // remove field
  collection.fields.removeById("number1092079998")

  return app.save(collection)
})
