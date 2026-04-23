/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const adminRule = '@request.auth.collectionName = "admins"'

  function ensureAdminActivityEventsCollection() {
    try {
      return app.findCollectionByNameOrId("admin_activity_events")
    } catch (error) {
      const collection = new Collection({
        "createRule": null,
        "deleteRule": null,
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
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1010000001",
            "max": 0,
            "min": 0,
            "name": "kind",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": true,
            "system": false,
            "type": "text"
          },
          {
            "cascadeDelete": false,
            "collectionId": "pbc_653341844",
            "hidden": false,
            "id": "relation1010000002",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "participant",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "relation"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1010000003",
            "max": 0,
            "min": 0,
            "name": "participantName",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1010000004",
            "max": 0,
            "min": 0,
            "name": "submissionId",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1010000005",
            "max": 0,
            "min": 0,
            "name": "periodType",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "hidden": false,
            "id": "date1010000006",
            "max": "",
            "min": "",
            "name": "periodStart",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "date"
          },
          {
            "hidden": false,
            "id": "date1010000007",
            "max": "",
            "min": "",
            "name": "periodEnd",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "date"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1010000008",
            "max": 0,
            "min": 0,
            "name": "submissionMode",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1010000009",
            "max": 0,
            "min": 0,
            "name": "comment",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "hidden": false,
            "id": "number1010000010",
            "max": null,
            "min": null,
            "name": "dataRating",
            "onlyInt": false,
            "presentable": false,
            "required": false,
            "system": false,
            "type": "number"
          },
          {
            "hidden": false,
            "id": "number1010000011",
            "max": null,
            "min": null,
            "name": "generalAdminTime",
            "onlyInt": false,
            "presentable": false,
            "required": false,
            "system": false,
            "type": "number"
          },
          {
            "hidden": false,
            "id": "number1010000012",
            "max": null,
            "min": null,
            "name": "commuteTime",
            "onlyInt": false,
            "presentable": false,
            "required": false,
            "system": false,
            "type": "number"
          },
          {
            "hidden": false,
            "id": "autodate1010000013",
            "name": "created",
            "onCreate": true,
            "onUpdate": false,
            "presentable": false,
            "system": false,
            "type": "autodate"
          }
        ],
        "id": "pbc_1010000000",
        "indexes": [],
        "listRule": null,
        "name": "admin_activity_events",
        "system": false,
        "type": "base",
        "updateRule": null,
        "viewRule": null
      })

      app.save(collection)
      return collection
    }
  }

  ensureAdminActivityEventsCollection()

  for (const collectionName of ["submissions", "submission_items", "admin_activity_events"]) {
    const collection = app.findCollectionByNameOrId(collectionName)

    unmarshal({
      "createRule": adminRule,
      "deleteRule": adminRule,
      "listRule": adminRule,
      "updateRule": adminRule,
      "viewRule": adminRule
    }, collection)

    app.save(collection)
  }
}, (app) => {
  const publicRule = ""

  for (const collectionName of ["submissions", "submission_items"]) {
    const collection = app.findCollectionByNameOrId(collectionName)

    unmarshal({
      "createRule": publicRule,
      "deleteRule": publicRule,
      "listRule": null,
      "updateRule": publicRule,
      "viewRule": publicRule
    }, collection)

    app.save(collection)
  }

  const auditCollection = app.findCollectionByNameOrId("admin_activity_events")

  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, auditCollection)

  app.save(auditCollection)
})
