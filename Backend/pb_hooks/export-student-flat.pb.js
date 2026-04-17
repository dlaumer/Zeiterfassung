/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/export-student-flat", (e) => {
    
function toCsvRow(values) {
  return values.map(csvEscape).join(",")
}

function csvEscape(value) {
  const str = String(value ?? "")

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

  const participantId = (e.requestInfo().query["participantId"] || "").trim()

  if (!participantId) {
    return e.json(400, { error: "Missing participantId" })
  }

  const participant = $app.findRecordById("participants", participantId)

  if (!participant) {
    return e.json(404, { error: "Participant not found" })
  }

  // No active filter anymore
  const workloadTypes = $app.findRecordsByFilter(
    "subjects",
    "",
    "key",
    500,
    0
  )

  const submissions = $app.findRecordsByFilter(
    "submissions",
    "participant = {:participantId}",
    "periodStart",
    2000,
    0,
    { participantId }
  )

  const submissionIds = submissions.map((s) => s.id)

  let items = []

  if (submissionIds.length > 0) {
    const idFilter = submissionIds
      .map((id) => `submission = "${id}"`)
      .join(" || ")

    items = $app.findRecordsByFilter(
      "submission_items",
      idFilter,
      "",
      10000,
      0
    )
  }

  const typeKeys = workloadTypes.map((t) => t.get("key"))

  const exportTypes = ["class", "study"]

  const exportColumns = []

  for (const key of typeKeys) {
    for (const itemType of exportTypes) {
      exportColumns.push(`${key}_${itemType}_minutes`)
    }
  }

  const itemsBySubmission = {}

  for (const item of items) {
    const submissionId = item.get("submission")
    const workloadTypeId = item.get("workloadType")
    const itemType = item.get("type") // "class" or "study"

    if (!exportTypes.includes(itemType)) continue

    const workloadType = workloadTypes.find((t) => t.id === workloadTypeId)
    if (!workloadType) continue

    const key = workloadType.get("key")
    const columnName = `${key}_${itemType}_minutes`
    const minutes = item.get("durationMinutes") || 0

    if (!itemsBySubmission[submissionId]) {
      itemsBySubmission[submissionId] = {}
    }

    if (!itemsBySubmission[submissionId][columnName]) {
      itemsBySubmission[submissionId][columnName] = 0
    }

    itemsBySubmission[submissionId][columnName] += minutes
  }

  const headers = [
    "submissionId",
    "participantId",
    "participantName",
    "periodType",
    "periodStart",
    "periodEnd",
    "submissionMode",
    "dataRating",
    "comment",
    "submittedAt",
    ...exportColumns,
  ]

  const rows = [headers]

  for (const submission of submissions) {
    const submissionMap = itemsBySubmission[submission.id] || {}

    const row = [
      submission.id,
      participant.id,
      participant.get("name") || "",
      submission.get("periodType") || "",
      submission.get("periodStart") || "",
      submission.get("periodEnd") || "",
      submission.get("submissionMode") || "",
      submission.get("dataRating") || "",
      submission.get("comment") || "",
      submission.get("submittedAt") || "",
    ]

    for (const columnName of exportColumns) {
      row.push(submissionMap[columnName] || 0)
    }

    rows.push(row)
  }

  const csv = rows.map(toCsvRow).join("\n")

  e.response.header().set("Content-Type", "text/csv; charset=utf-8")
  e.response.header().set(
    "Content-Disposition",
    `attachment; filename="student_${participantId}_submissions.csv"`
  )

  return e.string(200, csv)
})
