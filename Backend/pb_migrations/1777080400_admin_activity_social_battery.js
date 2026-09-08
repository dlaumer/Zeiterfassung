/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("admin_activity_events")
  collection.fields.add(new Field({
    "name": "socialBattery",
    "type": "number",
    "min": 0,
    "max": 5,
    "onlyInt": true,
    "required": false
  }))
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("admin_activity_events")
  collection.fields.removeByName("socialBattery")
  return app.save(collection)
})
