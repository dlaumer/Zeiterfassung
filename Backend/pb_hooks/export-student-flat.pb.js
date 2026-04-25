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

function minutesToHours(value) {
  return Number(value || 0) / 60
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

  const exportTypes = ["class", "study"]

  const workloadTypeById = {}
  for (const wt of workloadTypes) {
    workloadTypeById[wt.id] = wt
  }

  const submissionById = {}
  for (const submission of submissions) {
    submissionById[submission.id] = submission
  }

  function getExportColumnName(workloadType, itemType, submission) {
    const key = workloadType.get("key")
    const periodType = submission ? submission.get("periodType") || "" : ""

    if (periodType === "week") {
      return `${key}_hours`
    }

    return `${key}_${itemType}_hours`
  }

  const exportColumnSet = {}
  for (const item of items) {
    const workloadTypeId = item.get("workloadType")
    const itemType = item.get("type")
    const minutes = item.get("durationMinutes") || 0
    const submission = submissionById[item.get("submission")]

    if (!exportTypes.includes(itemType) || minutes <= 0) continue
    if (!workloadTypeById[workloadTypeId]) continue
    if (!submission) continue

    exportColumnSet[getExportColumnName(workloadTypeById[workloadTypeId], itemType, submission)] = true
  }

  const exportColumns = Object.keys(exportColumnSet).sort()

  const itemsBySubmission = {}

  for (const item of items) {
    const submissionId = item.get("submission")
    const workloadTypeId = item.get("workloadType")
    const itemType = item.get("type") // "class" or "study"
    const submission = submissionById[submissionId]

    if (!exportTypes.includes(itemType)) continue

    const workloadType = workloadTypeById[workloadTypeId]
    if (!workloadType) continue
    if (!submission) continue

    const columnName = getExportColumnName(workloadType, itemType, submission)
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
    "adminEffort_hours",
    "commuteTime_hours",
    "structuralChanges_hours",
    "comment",
    "submittedAt",
    ...exportColumns,
  ]

  const rows = [headers]

  for (const submission of submissions) {
    const submissionMap = itemsBySubmission[submission.id] || {}

    const periodType = submission.get("periodType") || ""
    const row = [
      submission.id,
      participant.id,
      participant.get("name") || "",
      periodType,
      submission.get("periodStart") || "",
      submission.get("periodEnd") || "",
      submission.get("submissionMode") || "",
      submission.get("dataRating") || "",
      minutesToHours(submission.get("generalAdminTime")),
      periodType === "week" ? "" : minutesToHours(submission.get("commuteTime")),
      periodType === "week" ? minutesToHours(submission.get("structuralChanges")) : "",
      submission.get("comment") || "",
      submission.get("submittedAt") || "",
    ]

    for (const columnName of exportColumns) {
      row.push(minutesToHours(submissionMap[columnName] || 0))
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
}, $apis.requireAuth("admins"))
