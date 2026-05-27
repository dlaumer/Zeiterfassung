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

    function reminderLanguageLink(participantLink, language) {
        if (!participantLink) {
            return ""
        }

        const separator = participantLink.indexOf("?") === -1 ? "?" : "&"
        return participantLink + separator + "lang=" + language
    }

    function reminderHtmlEscape(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
    }

    function reminderEmailHtml(participantName, participantLink) {
        const safeName = reminderHtmlEscape(participantName || "there")
        const participantLinkEn = reminderLanguageLink(participantLink, "en")
        const participantLinkDe = reminderLanguageLink(participantLink, "de")
        const linkSectionEn = participantLink
            ? `<p>Open your workload tracker<br /><a href="${participantLinkEn}">${participantLinkEn}</a></p>`
            : ""
        const linkSectionDe = participantLink
            ? `<p>Arbeitsaufwand erfassen<br /><a href="${participantLinkDe}">${participantLinkDe}</a></p>`
            : ""

        return `
        <p>Hallo ${safeName},</p>
        <p>Dies ist eine kurze Erinnerung, deine Lernaufwandsdaten einzureichen.</p>
        ${linkSectionDe}
        <p>Du erhaeltst diese E-Mail, weil du an der Methric-Studie teilnimmst.</p>
        <p>Vielen Dank und freundliche Gruesse.</p>
        <p>Methric Team</p>
        <hr />
        <p>Hello ${safeName},</p>
        <p>This is a friendly reminder to submit your workload tracking data.</p>
        ${linkSectionEn}
        <p>You receive this email because you participate in the Methric study.</p>
        <p>Thank you.</p>
        <p>Methric Team</p>
    `
    }

    function reminderEmailText(participantName, participantLink) {
        const safeName = participantName || "there"
        const englishLink = participantLink ? `\n\nOpen your workload tracker:\n${reminderLanguageLink(participantLink, "en")}` : ""
        const germanLink = participantLink ? `\n\nArbeitsaufwand erfassen:\n${reminderLanguageLink(participantLink, "de")}` : ""

        return `Hallo ${safeName},

Dies ist eine kurze Erinnerung, deine Lernaufwandsdaten einzureichen.${germanLink}

Du erhaeltst diese E-Mail, weil du an der Methric-Studie teilnimmst.

Vielen Dank und freundliche Gruesse.

Methric Team

Hello ${safeName},

This is a friendly reminder to submit your workload tracking data.${englishLink}

You receive this email because you participate in the Methric study.

Thank you.

Methric Team`
    }

    function reminderCreateLogRecord(participantId, participantName, participantEmail, participantLink, subject, senderAddress) {
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
        const subject = "Erinnerung: Lernaufwandsdaten einreichen"
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

        reminderCreateLogRecord(participantId, participantName, participantEmail, participantLink, subject, config.senderAddress)

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

routerAdd("POST", "/api/admin/participant/invitation", (e) => {
    function invitationStringValue(record, fieldName) {
        const value = record.get(fieldName)
        return value === null || value === undefined ? "" : String(value || "")
    }

    function invitationLoadConfig() {
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

    function invitationValidateConfig() {
        const config = invitationLoadConfig()

        if (!config.apiKey) {
            throw new Error("Missing Resend API key. Configure Backend/pb_hooks/resend.local.json or RESEND_API_KEY.")
        }

        if (!config.senderAddress) {
            throw new Error("Missing sender email address for invitation emails.")
        }

        return config
    }

    function invitationParticipantLink(participantId, appUrl) {
        const normalizedBase = String(appUrl || "").trim().replace(/\/+$/, "")
        if (!normalizedBase) {
            return ""
        }

        return normalizedBase + "/" + participantId + "/"
    }

    function invitationLanguageLink(participantLink, language) {
        if (!participantLink) {
            return ""
        }

        const separator = participantLink.indexOf("?") === -1 ? "?" : "&"
        return participantLink + separator + "lang=" + language
    }

    function invitationHtmlEscape(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
    }

    function invitationEmailHtml(participantName, participantLink) {
        const safeName = invitationHtmlEscape(participantName || "there")
        const participantLinkEn = invitationLanguageLink(participantLink, "en")
        const participantLinkDe = invitationLanguageLink(participantLink, "de")
        const linkSectionEn = participantLink
            ? `<p>Start the data collection<br /><a href="${participantLinkEn}">${participantLinkEn}</a></p>`
            : ""
        const linkSectionDe = participantLink
            ? `<p>Datenerhebung starten<br /><a href="${participantLinkDe}">${participantLinkDe}</a></p>`
            : ""

        return `
        <p>Hallo ${safeName},</p>
        <p>Du wurdest eingeladen, am Methric-Projekt teilzunehmen.</p>
        <p>Bitte nutze den Link unten, um die Datenerhebung zu starten.</p>
        ${linkSectionDe}
        <p>Vielen Dank und freundliche Gruesse.</p>
        <p>Methric Team</p>
        <hr />
        <p>Hello ${safeName},</p>
        <p>You have been invited to participate in the Methric project.</p>
        <p>Please use the link below to start the data collection.</p>
        ${linkSectionEn}
        <p>Thank you.</p>
        <p>Methric Team</p>
    `
    }

    function invitationEmailText(participantName, participantLink) {
        const safeName = participantName || "there"
        const englishLink = participantLink ? `\n\nStart the data collection:\n${invitationLanguageLink(participantLink, "en")}` : ""
        const germanLink = participantLink ? `\n\nDatenerhebung starten:\n${invitationLanguageLink(participantLink, "de")}` : ""

        return `Hallo ${safeName},

Du wurdest eingeladen, am Methric-Projekt teilzunehmen.

Bitte nutze den Link unten, um die Datenerhebung zu starten.${germanLink}

Vielen Dank und freundliche Gruesse.

Methric Team

Hello ${safeName},

You have been invited to participate in the Methric project.

Please use the link below to start the data collection.${englishLink}

Thank you.

Methric Team`
    }

    function invitationCreateLogRecord(participantId, participantName, participantEmail, participantLink, subject, senderAddress) {
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
            record.set("sentByEmail", invitationStringValue(authRecord, "email"))
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

    const participantEmail = invitationStringValue(participant, "email").trim()
    const participantName = invitationStringValue(participant, "name").trim()

    if (!participantEmail) {
        return e.json(400, { error: "Participant has no email address" })
    }

    try {
        const config = invitationValidateConfig()
        const participantLink = invitationParticipantLink(participantId, config.appUrl)
        const subject = "Einladung: Methric-Datenerhebung starten"
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
                html: invitationEmailHtml(participantName, participantLink),
                text: invitationEmailText(participantName, participantLink),
            }),
        })

        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error("Resend API returned status " + response.statusCode + ": " + toString(response.body))
        }

        invitationCreateLogRecord(participantId, participantName, participantEmail, participantLink, subject, config.senderAddress)

        return e.json(200, {
            ok: true,
            email: participantEmail,
        })
    } catch (error) {
        console.error("Failed to send participant invitation:", error)
        return e.json(500, {
            error: "Invitation email could not be sent",
            details: String(error),
        })
    }
}, $apis.requireAuth("admins"))
