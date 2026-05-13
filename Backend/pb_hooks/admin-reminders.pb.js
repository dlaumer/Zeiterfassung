/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/admin/participant/reminder", (e) => {
    function reminderStringValue(record, fieldName) {
        const value = record.get(fieldName)
        return value === null || value === undefined ? "" : String(value || "")
    }

    function reminderLoadConfig() {
        let fileConfig = {}

        try {
            const raw = toString($os.readFile(__hooks + "/resend.local.json")).trim()
            if (raw) {
                fileConfig = JSON.parse(raw)
            }
        } catch (error) {
            fileConfig = {}
        }

        const apiKey = String($os.getenv("RESEND_API_KEY") || fileConfig.apiKey || "").trim()
        const senderName = String($os.getenv("RESEND_SENDER_NAME") || fileConfig.senderName || "Methric Team").trim()
        const senderAddress = String($os.getenv("RESEND_SENDER_ADDRESS") || fileConfig.senderAddress || "").trim()
        const replyTo = String($os.getenv("RESEND_REPLY_TO") || fileConfig.replyTo || senderAddress).trim()
        const appUrl = String($os.getenv("PB_PUBLIC_APP_URL") || fileConfig.appUrl || $app.settings().meta.appURL || "").trim()

        return {
            apiKey,
            senderName,
            senderAddress,
            replyTo,
            appUrl,
        }
    }

    function reminderValidateConfig() {
        const config = reminderLoadConfig()

        if (!config.apiKey) {
            throw new Error("Missing Resend API key. Configure Backend/pb_hooks/resend.local.json or RESEND_API_KEY.")
        }

        if (!config.senderAddress) {
            throw new Error("Missing sender email address for reminder emails.")
        }

        return config
    }

    function reminderParticipantLink(participantId, appUrl) {
        const normalizedBase = String(appUrl || "").trim().replace(/\/+$/, "")
        if (!normalizedBase) {
            return ""
        }

        return normalizedBase + "/" + participantId + "/"
    }

    function reminderEmailHtml(participantName, participantLink) {
        const safeName = participantName || "there"
        const linkSectionEn = participantLink
            ? `<p><a href="${participantLink}?lang=en">Open your workload tracker</a></p>`
            : ""
        const linkSectionDe = participantLink
            ? `<p><a href="${participantLink}?lang=de">Arbeitsaufwand erfassen</a></p>`
            : ""

        return `
        <p>Hello ${safeName},</p>
        <p>This is a friendly reminder to submit your workload tracking data.</p>
        ${linkSectionEn}
        <p>You receive this email because you participate in the Methric study.</p>
        <p>Thank you.</p>
        <p>Methric Team</p>
        <hr />
        <p>Hallo ${safeName},</p>
        <p>Dies ist eine kurze Erinnerung, deine Lernaufwandsdaten einzureichen.</p>
        ${linkSectionDe}
        <p>Du erhaeltst diese E-Mail, weil du an der Methric-Studie teilnimmst.</p>
        <p>Vielen Dank und freundliche Gruesse.</p>
        <p>Methric Team</p>
    `
    }

    function reminderEmailText(participantName, participantLink) {
        const safeName = participantName || "there"
        const englishLink = participantLink ? `\n\nOpen your workload tracker:\n${participantLink}?lang=en` : ""
        const germanLink = participantLink ? `\n\nArbeitsaufwand erfassen:\n${participantLink}?lang=de` : ""

        return `Hello ${safeName},

This is a friendly reminder to submit your workload tracking data.${englishLink}

You receive this email because you participate in the Methric study.

Thank you.

Methric Team

Hallo ${safeName},

Dies ist eine kurze Erinnerung, deine Lernaufwandsdaten einzureichen.${germanLink}

Du erhaeltst diese E-Mail, weil du an der Methric-Studie teilnimmst.

Vielen Dank und freundliche Gruesse.

Methric Team`
    }

    function reminderCreateLogRecord(e, participantId, participantName, participantEmail, participantLink, subject, senderAddress) {
        const collection = $app.findCollectionByNameOrId("admin_reminders")
        const record = new Record(collection)
        const authRecord = e.auth

        record.set("participant", participantId)
        record.set("participantName", participantName)
        record.set("participantEmail", participantEmail)
        record.set("participantLink", participantLink)
        record.set("subject", subject)
        record.set("senderAddress", senderAddress)

        if (authRecord) {
            record.set("sentBy", authRecord.id)
            record.set("sentByEmail", reminderStringValue(authRecord, "email"))
        }

        $app.save(record)
    }

    const body = e.requestInfo().body || {}
    const participantId = String(body.participantId || "").trim()

    if (!participantId) {
        return e.json(400, { error: "Missing participantId" })
    }

    let participant
    try {
        participant = $app.findRecordById("participants", participantId)
    } catch (error) {
        return e.json(404, { error: "Participant not found" })
    }

    const participantEmail = reminderStringValue(participant, "email").trim()
    const participantName = reminderStringValue(participant, "name").trim()

    if (!participantEmail) {
        return e.json(400, { error: "Participant has no email address" })
    }

    try {
        const config = reminderValidateConfig()
        const participantLink = reminderParticipantLink(participantId, config.appUrl)
        const subject = "Reminder: submit your workload tracking"
        const fromValue = config.senderName
            ? `${config.senderName} <${config.senderAddress}>`
            : config.senderAddress

        const response = $http.send({
            method: "POST",
            url: "https://api.resend.com/emails",
            timeout: 120,
            headers: {
                "Authorization": "Bearer " + config.apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: fromValue,
                to: [participantEmail],
                reply_to: config.replyTo ? [config.replyTo] : undefined,
                subject: subject,
                html: reminderEmailHtml(participantName, participantLink),
                text: reminderEmailText(participantName, participantLink),
            }),
        })

        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error("Resend API returned status " + response.statusCode + ": " + toString(response.body))
        }

        reminderCreateLogRecord(e, participantId, participantName, participantEmail, participantLink, subject, config.senderAddress)

        return e.json(200, {
            ok: true,
            email: participantEmail,
        })
    } catch (error) {
        console.error("Failed to send participant reminder:", error)
        return e.json(500, {
            error: "Reminder email could not be sent",
            details: String(error),
        })
    }
}, $apis.requireAuth("admins"))
