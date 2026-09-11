/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("submissions")
  const existing = collection.fields.getByName("socialBattery")
  if (existing) {
    existing.required = false
    existing.min = 0
  } else {
    collection.fields.add(new NumberField({
      name: "socialBattery",
      required: false,
      min: 0,
      max: 5,
      onlyInt: true,
    }))
  }
  return app.save(collection)
}, (app) => {
  // Preserve existing ratings and the optional field on rollback.
})
