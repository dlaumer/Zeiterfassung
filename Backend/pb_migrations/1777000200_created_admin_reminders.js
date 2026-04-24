/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const adminRule = '@request.auth.collectionName = "admins"'

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
        "cascadeDelete": false,
        "collectionId": "pbc_653341844",
        "hidden": false,
        "id": "relation1020000001",
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
        "id": "text1020000002",
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
        "exceptDomains": null,
        "hidden": false,
        "id": "email1020000003",
        "name": "participantEmail",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "email"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1020000004",
        "max": 0,
        "min": 0,
        "name": "participantLink",
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
        "id": "text1020000005",
        "max": 0,
        "min": 0,
        "name": "subject",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "exceptDomains": null,
        "hidden": false,
        "id": "email1020000006",
        "name": "senderAddress",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "email"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3841632486",
        "hidden": false,
        "id": "relation1020000007",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "sentBy",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "exceptDomains": null,
        "hidden": false,
        "id": "email1020000008",
        "name": "sentByEmail",
        "onlyDomains": null,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "email"
      },
      {
        "hidden": false,
        "id": "autodate1020000009",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_1020000000",
    "indexes": [
      "CREATE INDEX `idx_admin_reminders_participant_created` ON `admin_reminders` (`participant`, `created`)",
      "CREATE INDEX `idx_admin_reminders_sentBy_created` ON `admin_reminders` (`sentBy`, `created`)"
    ],
    "listRule": adminRule,
    "name": "admin_reminders",
    "system": false,
    "type": "base",
    "updateRule": adminRule,
    "viewRule": adminRule
  })

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1020000000")

  return app.delete(collection)
})
