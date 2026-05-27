/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("subjects")

  let hasEntryMode = true
  try {
    hasEntryMode = !!collection.fields.getByName("entryMode")
  } catch (error) {
    hasEntryMode = false
  }

  if (!hasEntryMode) {
    collection.fields.addAt(5, new Field({
      "hidden": false,
      "id": "select1080000004",
      "maxSelect": 1,
      "name": "entryMode",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": [
        "day",
        "week"
      ]
    }))

    app.save(collection)
  }

  let offset = 0
  while (true) {
    const subjects = app.findRecordsByFilter("subjects", "", "", 1000, offset)
    if (subjects.length === 0) {
      break
    }

    for (const subject of subjects) {
      if (!subject.get("entryMode")) {
        subject.set("entryMode", "day")
        app.save(subject)
      }
    }

    offset += subjects.length
  }
}, (app) => {
  return null
})
