/// <reference path="../pb_data/types.d.ts" />


routerAdd("POST", "/api/admin/participant/reminder", (e) => {
    
function reminderStringValue(record, fieldName) {
    const value = record.get(fieldName)
    return value === null || value === undefined ? "" : String(value || "")
}

function reminderLoadMailConfig() {
    let fileConfig = {}

    try {
        const raw = toString($os.readFile(__hooks + "/gmail.local.json")).trim()
        if (raw) {
            fileConfig = JSON.parse(raw)
        }
    } catch (error) {
        fileConfig = {}
    }

    const smtpHost = String($os.getenv("PB_SMTP_HOST") || fileConfig.smtpHost || "smtp.gmail.com").trim()
    const smtpPort = Number($os.getenv("PB_SMTP_PORT") || fileConfig.smtpPort || 587)
    const smtpUsername = String($os.getenv("PB_SMTP_USERNAME") || fileConfig.smtpUsername || "").trim()
    const smtpPassword = String($os.getenv("PB_SMTP_PASSWORD") || fileConfig.smtpPassword || "").trim()
    const senderName = String($os.getenv("PB_SMTP_SENDER_NAME") || fileConfig.senderName || $app.settings().meta.appName || "Workload Tracker").trim()
    const senderAddress = String($os.getenv("PB_SMTP_SENDER_ADDRESS") || fileConfig.senderAddress || smtpUsername).trim()
    const appUrl = String($os.getenv("PB_PUBLIC_APP_URL") || fileConfig.appUrl || $app.settings().meta.appURL || "").trim()

    return {
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        senderName,
        senderAddress,
        appUrl,
    }
}

function reminderEnsureMailClientConfigured() {
    const config = reminderLoadMailConfig()

    if (!config.smtpUsername || !config.smtpPassword) {
        throw new Error("Missing SMTP credentials. Configure Backend/pb_hooks/gmail.local.json or PB_SMTP_* environment variables.")
    }

    if (!config.senderAddress) {
        throw new Error("Missing sender email address for reminder emails.")
    }

    const settings = $app.settings()
    settings.smtp.enabled = true
    settings.smtp.host = config.smtpHost
    settings.smtp.port = config.smtpPort
    settings.smtp.username = config.smtpUsername
    settings.smtp.password = config.smtpPassword
    settings.smtp.authMethod = "LOGIN"
    settings.smtp.tls = false
    settings.smtp.localName = "localhost"
    settings.meta.senderName = config.senderName
    settings.meta.senderAddress = config.senderAddress

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
    const linkSection = participantLink
        ? `<p><a href="${participantLink}">Open your workload tracker</a></p>
           <p><a href="${participantLink}">${participantLink}</a></p>`
        : ""

    return `
        <p>Hello ${safeName},</p>
        <p>This is a friendly reminder to submit your workload tracking data.</p>
        ${linkSection}
        <p>Thank you.</p>
        <hr />
        <p>Hallo ${safeName},</p>
        <p>Dies ist eine kurze Erinnerung, deine Lernaufwandsdaten einzureichen.</p>
        ${linkSection}
        <p>Vielen Dank und freundliche Gruesse.</p>
    `
}

function reminderEmailText(participantName, participantLink) {
    const safeName = participantName || "there"
    const linkLine = participantLink ? `\n\nOpen your workload tracker:\n${participantLink}` : ""

    return `Hello ${safeName},

This is a friendly reminder to submit your workload tracking data.${linkLine}

Thank you.

Hallo ${safeName},

Dies ist eine kurze Erinnerung, deine Lernaufwandsdaten einzureichen.${linkLine}

Vielen Dank und freundliche Gruesse.`
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
        const config = reminderEnsureMailClientConfigured()
        const participantLink = reminderParticipantLink(participantId, config.appUrl)

        const message = new MailerMessage({
            from: {
                address: config.senderAddress,
                name: config.senderName,
            },
            to: [{ address: participantEmail, name: participantName }],
            subject: "Reminder: submit your workload tracking",
            html: reminderEmailHtml(participantName, participantLink),
            text: reminderEmailText(participantName, participantLink),
        })

        $app.newMailClient().send(message)

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
