/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const adminRule = '@request.auth.collectionName = "admins"'

  try {
    const collection = app.findCollectionByNameOrId("referenceDate")
    unmarshal({
      "createRule": adminRule,
      "deleteRule": adminRule,
      "listRule": adminRule,
      "updateRule": adminRule,
      "viewRule": adminRule
    }, collection)

    return app.save(collection)
  } catch (error) {
    const collection = new Collection({
      "createRule": adminRule,
      "deleteRule": adminRule,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "date1080000001",
          "max": "",
          "min": "",
          "name": "referenceDate",
          "presentable": true,
          "required": true,
          "system": false,
          "type": "date"
        },
        {
          "hidden": false,
          "id": "autodate1080000002",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate1080000003",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_1080000000",
      "indexes": [],
      "listRule": adminRule,
      "name": "referenceDate",
      "system": false,
      "type": "base",
      "updateRule": adminRule,
      "viewRule": adminRule
    })

    return app.save(collection)
  }
}, () => {
  return null
})
