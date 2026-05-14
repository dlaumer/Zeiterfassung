/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const participants = app.findRecordsByFilter("participants", "", "", 1000, 0)

  for (const participant of participants) {
    const currentType = participant.get("type") || ""
    if (currentType === "student" || currentType === "faculty") {
      continue
    }

    const entryMode = participant.get("entryMode") || "day"
    participant.set("type", entryMode === "week" ? "faculty" : "student")
    app.save(participant)
  }
}, () => {
  return null
})
