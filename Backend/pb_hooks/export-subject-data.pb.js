/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/export-subject-data", (e) => {
    function csvEscape(value) {
        const str = String(value ?? "")

        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`
        }

        return str
    }

    function csvExcelText(value) {
        const str = String(value ?? "").replace(/"/g, '""')
        return `="${str}"`
    }

    function toCsvRow(values) {
        return values.map(csvEscape).join(",")
    }

    function minutesToHours(value) {
        return Number(value || 0) / 60
    }

    function pad2(n) {
        return n < 10 ? "0" + n : "" + n
    }

    function formatDateOnly(date) {
        return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate())
    }

    function formatDateTime(date) {
        return formatDateOnly(date) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + ":" + pad2(date.getSeconds())
    }

    function parseDateOnly(value) {
        const raw = String(value || "").trim().slice(0, 10)
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (!match) return null

        const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0)
        if (isNaN(parsed.getTime())) return null
        return parsed
    }

    function startOfDay(date) {
        const d = new Date(date)
        d.setHours(0, 0, 0, 0)
        return d
    }

    function endOfDay(date) {
        const d = new Date(date)
        d.setHours(23, 59, 59, 999)
        return d
    }

    function addDays(date, days) {
        const d = new Date(date)
        d.setDate(d.getDate() + days)
        return d
    }

    function startOfWeekMonday(date) {
        const d = startOfDay(date)
        const day = d.getDay()
        const diff = day === 0 ? -6 : 1 - day
        d.setDate(d.getDate() + diff)
        return d
    }

    function getReferenceDateStart(app) {
        try {
            const records = app.findRecordsByFilter("referenceDate", "", "", 1, 0)
            if (records.length === 0) return null
            return parseDateOnly(records[0].get("referenceDate"))
        } catch (error) {
            console.error("Failed to load subject export reference date:", error)
            return null
        }
    }

    function getPeriodKey(submission) {
        return `${submission.get("periodType") || ""}_${String(submission.get("periodStart") || "").slice(0, 10)}`
    }

    function getPeriodKeyFromDate(periodType, date) {
        return `${periodType}_${formatDateOnly(date)}`
    }

    function buildExpectedDailyPeriods(referenceDate, today) {
        const periods = []
        let cursor = startOfDay(referenceDate)
        const end = startOfDay(today)

        while (cursor <= end) {
            periods.push({
                key: getPeriodKeyFromDate("day", cursor),
                label: formatDateOnly(cursor),
                rangeStart: formatDateTime(startOfDay(cursor)),
                rangeEnd: formatDateTime(endOfDay(cursor)),
            })
            cursor = addDays(cursor, 1)
        }

        return periods
    }

    function buildExpectedWeeklyPeriods(referenceDate, today) {
        const periods = []
        let cursor = startOfWeekMonday(referenceDate)
        const end = startOfWeekMonday(today)

        while (cursor <= end) {
            periods.push({
                key: getPeriodKeyFromDate("week", cursor),
                label: formatDateOnly(cursor),
                rangeStart: formatDateTime(startOfDay(cursor)),
                rangeEnd: formatDateTime(endOfDay(addDays(cursor, 6))),
            })
            cursor = addDays(cursor, 7)
        }

        return periods
    }

    function compareLatestFirst(a, b) {
        return getSubmissionSortDate(b).getTime() - getSubmissionSortDate(a).getTime()
    }

    function getSubmissionSortDate(submission) {
        return new Date(submission.get("submittedAt") || submission.get("updated") || submission.get("created") || 0)
    }

    function chooseBaseSubmission(group) {
        const corrections = group.filter((s) => s.get("submissionMode") === "correction")
        if (corrections.length > 0) return corrections.sort(compareLatestFirst)[0]

        const initials = group.filter((s) => s.get("submissionMode") === "initial")
        if (initials.length > 0) return initials.sort(compareLatestFirst)[0]

        return null
    }

    function cleanFilenamePart(value) {
        return String(value || "subject").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "subject"
    }

    function utf8Bytes(value) {
        const bytes = []
        const str = String(value ?? "")

        for (let i = 0; i < str.length; i++) {
            let code = str.charCodeAt(i)

            if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
                const next = str.charCodeAt(i + 1)
                if (next >= 0xdc00 && next <= 0xdfff) {
                    code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
                    i++
                }
            }

            if (code <= 0x7f) {
                bytes.push(code)
            } else if (code <= 0x7ff) {
                bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
            } else if (code <= 0xffff) {
                bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
            } else {
                bytes.push(
                    0xf0 | (code >> 18),
                    0x80 | ((code >> 12) & 0x3f),
                    0x80 | ((code >> 6) & 0x3f),
                    0x80 | (code & 0x3f)
                )
            }
        }

        return bytes
    }

    function makeCrcTable() {
        const table = []
        for (let n = 0; n < 256; n++) {
            let c = n
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
            }
            table[n] = c >>> 0
        }
        return table
    }

    const crcTable = makeCrcTable()

    function crc32(bytes) {
        let crc = 0xffffffff
        for (const b of bytes) {
            crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)
        }
        return (crc ^ 0xffffffff) >>> 0
    }

    function pushLe16(bytes, value) {
        bytes.push(value & 0xff, (value >>> 8) & 0xff)
    }

    function pushLe32(bytes, value) {
        bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
    }

    function getDosDateTime(date) {
        const year = Math.max(1980, date.getFullYear())
        return {
            time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
            date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
        }
    }

    function appendBytes(target, source) {
        for (const byte of source) {
            target.push(byte)
        }
    }

    function createZip(files) {
        const output = []
        const centralDirectory = []
        const now = getDosDateTime(new Date())

        for (const file of files) {
            const nameBytes = utf8Bytes(file.name)
            const dataBytes = utf8Bytes(file.content)
            const crc = crc32(dataBytes)
            const offset = output.length

            pushLe32(output, 0x04034b50)
            pushLe16(output, 20)
            pushLe16(output, 0x0800)
            pushLe16(output, 0)
            pushLe16(output, now.time)
            pushLe16(output, now.date)
            pushLe32(output, crc)
            pushLe32(output, dataBytes.length)
            pushLe32(output, dataBytes.length)
            pushLe16(output, nameBytes.length)
            pushLe16(output, 0)
            appendBytes(output, nameBytes)
            appendBytes(output, dataBytes)

            pushLe32(centralDirectory, 0x02014b50)
            pushLe16(centralDirectory, 20)
            pushLe16(centralDirectory, 20)
            pushLe16(centralDirectory, 0x0800)
            pushLe16(centralDirectory, 0)
            pushLe16(centralDirectory, now.time)
            pushLe16(centralDirectory, now.date)
            pushLe32(centralDirectory, crc)
            pushLe32(centralDirectory, dataBytes.length)
            pushLe32(centralDirectory, dataBytes.length)
            pushLe16(centralDirectory, nameBytes.length)
            pushLe16(centralDirectory, 0)
            pushLe16(centralDirectory, 0)
            pushLe16(centralDirectory, 0)
            pushLe16(centralDirectory, 0)
            pushLe32(centralDirectory, 0)
            pushLe32(centralDirectory, offset)
            appendBytes(centralDirectory, nameBytes)
        }

        const centralDirectoryOffset = output.length
        appendBytes(output, centralDirectory)

        pushLe32(output, 0x06054b50)
        pushLe16(output, 0)
        pushLe16(output, 0)
        pushLe16(output, files.length)
        pushLe16(output, files.length)
        pushLe32(output, centralDirectory.length)
        pushLe32(output, centralDirectoryOffset)
        pushLe16(output, 0)

        return output
    }

    function getParticipantRole(participant) {
        const entryMode = participant.get("entryMode") || "day"
        return participant.get("type") || (entryMode === "week" ? "faculty" : "student")
    }

    function getParticipantEntryMode(participant) {
        const entryMode = participant.get("entryMode") || "day"
        return entryMode === "week" ? "week" : "day"
    }

    function getParticipantLabel(participant) {
        const name = String(participant.get("name") || "").trim()
        return name || participant.id
    }

    function getStudentColumnKey(participant) {
        return getParticipantLabel(participant) + " (" + participant.id + ")"
    }

    function buildCsvForPeriod(periodType, itemType, participants, periods, submissionsByParticipantPeriod, minutesBySubmission) {
        const headers = ["periodStart", "periodEnd", ...participants.map(getStudentColumnKey)]
        const rows = [headers]

        for (const period of periods) {
            const row = [csvExcelText(period.rangeStart), csvExcelText(period.rangeEnd)]

            for (const participant of participants) {
                const groupKey = participant.id + "|" + period.key
                const group = submissionsByParticipantPeriod[groupKey] || []

                if (group.length === 0) {
                    row.push("")
                    continue
                }

                const baseSubmission = chooseBaseSubmission(group)
                const appendumSubmissions = group.filter((s) => s.get("submissionMode") === "appendum")
                const effectiveSubmissions = []

                if (baseSubmission) {
                    effectiveSubmissions.push(baseSubmission)
                }

                for (const appendum of appendumSubmissions) {
                    effectiveSubmissions.push(appendum)
                }

                if (effectiveSubmissions.length === 0) {
                    row.push(0)
                    continue
                }

                let minutes = 0
                for (const submission of effectiveSubmissions) {
                    const itemKey = submission.id + "|" + itemType
                    minutes += minutesBySubmission[itemKey] || 0
                }

                row.push(minutesToHours(minutes))
            }

            rows.push(row)
        }

        return rows.map(toCsvRow).join("\n")
    }

    const subjectId = String(e.requestInfo().query["subjectId"] || "").trim()
    if (!subjectId) {
        return e.json(400, { error: "Missing subjectId" })
    }

    const subject = $app.findRecordById("subjects", subjectId)
    if (!subject) {
        return e.json(404, { error: "Subject not found" })
    }

    const referenceDateStart = getReferenceDateStart($app)
    if (!referenceDateStart) {
        return e.json(400, { error: "Reference date is not configured" })
    }

    const now = new Date()
    const dailyPeriods = buildExpectedDailyPeriods(referenceDateStart, now)
    const weeklyPeriods = buildExpectedWeeklyPeriods(referenceDateStart, now)
    const rangeStart = formatDateTime(startOfWeekMonday(referenceDateStart))

    const enrollments = $app.findRecordsByFilter(
        "participant_subjects",
        "subject = {:subjectId}",
        "",
        50000,
        0,
        { subjectId }
    )

    const subjectItems = $app.findRecordsByFilter(
        "submission_items",
        "workloadType = {:subjectId}",
        "",
        50000,
        0,
        { subjectId }
    )

    const participantById = {}
    const dailyStudentIdSet = {}
    const weeklyStudentIdSet = {}
    const enrolledStudentIdSet = {}

    for (const enrollment of enrollments) {
        const participantId = String(enrollment.get("participant") || "")
        if (!participantId) continue

        try {
            const participant = $app.findRecordById("participants", participantId)
            if (participant && getParticipantRole(participant) === "student") {
                participantById[participant.id] = participant
                enrolledStudentIdSet[participant.id] = true

                if (getParticipantEntryMode(participant) === "week") {
                    weeklyStudentIdSet[participant.id] = true
                } else {
                    dailyStudentIdSet[participant.id] = true
                }
            }
        } catch (error) {
            // Ignore stale enrollment references.
        }
    }

    const submissions = $app.findRecordsByFilter(
        "submissions",
        [
            'submissionMode != "deleted"',
            "periodStart >= {:rangeStart}",
        ].join(" && "),
        "periodStart",
        50000,
        0,
        { rangeStart }
    )

    const relevantSubmissions = []
    const relevantSubmissionIds = {}

    for (const submission of submissions) {
        const participantId = String(submission.get("participant") || "")
        const periodType = String(submission.get("periodType") || "")

        if (!enrolledStudentIdSet[participantId]) {
            continue
        }

        if (periodType === "day" && !dailyStudentIdSet[participantId]) {
            continue
        }

        if (periodType === "week" && !weeklyStudentIdSet[participantId]) {
            continue
        }

        if (periodType !== "day" && periodType !== "week") {
            continue
        }

        relevantSubmissions.push(submission)
        relevantSubmissionIds[submission.id] = true
    }

    const minutesBySubmission = {}
    for (const item of subjectItems) {
        const submissionId = String(item.get("submission") || "")
        if (!relevantSubmissionIds[submissionId]) continue

        const itemType = String(item.get("type") || "")
        if (itemType !== "class" && itemType !== "study") continue

        const key = submissionId + "|" + itemType
        minutesBySubmission[key] = (minutesBySubmission[key] || 0) + Number(item.get("durationMinutes") || 0)
    }

    const submissionsByParticipantPeriod = {}
    for (const submission of relevantSubmissions) {
        const periodType = String(submission.get("periodType") || "")
        if (periodType !== "day" && periodType !== "week") continue

        const key = String(submission.get("participant") || "") + "|" + getPeriodKey(submission)
        if (!submissionsByParticipantPeriod[key]) {
            submissionsByParticipantPeriod[key] = []
        }
        submissionsByParticipantPeriod[key].push(submission)
    }

    function getParticipantsFromSet(studentIdSet) {
        return Object.keys(studentIdSet)
            .map((id) => participantById[id])
            .filter((participant) => !!participant)
            .sort((a, b) => getParticipantLabel(a).localeCompare(getParticipantLabel(b)) || String(a.id).localeCompare(String(b.id)))
    }

    const dailyParticipants = getParticipantsFromSet(dailyStudentIdSet)
    const weeklyParticipants = getParticipantsFromSet(weeklyStudentIdSet)

    const subjectKey = cleanFilenamePart(subject.get("key") || subject.id)
    const files = [
        {
            name: "daily/class_time.csv",
            content: buildCsvForPeriod("day", "class", dailyParticipants, dailyPeriods, submissionsByParticipantPeriod, minutesBySubmission),
        },
        {
            name: "daily/self_study_time.csv",
            content: buildCsvForPeriod("day", "study", dailyParticipants, dailyPeriods, submissionsByParticipantPeriod, minutesBySubmission),
        },
        {
            name: "weekly/class_time.csv",
            content: buildCsvForPeriod("week", "class", weeklyParticipants, weeklyPeriods, submissionsByParticipantPeriod, minutesBySubmission),
        },
        {
            name: "weekly/self_study_time.csv",
            content: buildCsvForPeriod("week", "study", weeklyParticipants, weeklyPeriods, submissionsByParticipantPeriod, minutesBySubmission),
        },
    ]

    const zipBytes = createZip(files)

    e.response.header().set(
        "Content-Disposition",
        `attachment; filename="subject_${subjectKey}_data.zip"`
    )

    return e.blob(200, "application/zip", zipBytes)
}, $apis.requireAuth("admins"))
