/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2726736638")

  // update collection data
  unmarshal({
    "name": "subjects"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2726736638")

  // update collection data
  unmarshal({
    "name": "workload_types"
  }, collection)

  return app.save(collection)
})
