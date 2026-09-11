/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/admin/participant/reminder", (e) => {
    const contactEmail = "katharina.sperger@stab.baug.ethz.ch"
    const defaultCategoryGuideUrl = "https://methric.ch/assets/KategorisierungZeiterfassung-CsWCFA54.pdf"

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
        const senderName = String($os.getenv("RESEND_SENDER_NAME") || fileConfig.senderName || "mETHric Team").trim()
        const senderAddress = String($os.getenv("RESEND_SENDER_ADDRESS") || fileConfig.senderAddress || "").trim()
        const replyTo = String($os.getenv("RESEND_REPLY_TO") || fileConfig.replyTo || senderAddress).trim()
        const appUrl = String($os.getenv("PB_PUBLIC_APP_URL") || fileConfig.appUrl || $app.settings().meta.appURL || "").trim()
        const categoryGuideDeUrl = String($os.getenv("REMINDER_CATEGORY_GUIDE_DE_URL") || fileConfig.categoryGuideDeUrl || fileConfig.categoryGuideUrl || defaultCategoryGuideUrl).trim()
        const categoryGuideEnUrl = String($os.getenv("REMINDER_CATEGORY_GUIDE_EN_URL") || fileConfig.categoryGuideEnUrl || fileConfig.categoryGuideUrl || defaultCategoryGuideUrl).trim()

        return {
            apiKey,
            senderName,
            senderAddress,
            replyTo,
            appUrl,
            categoryGuideDeUrl,
            categoryGuideEnUrl,
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

    function reminderFirstName(participantName) {
        const trimmedName = String(participantName || "").trim()
        if (!trimmedName) {
            return ""
        }

        return trimmedName.split(/\s+/)[0]
    }

    function reminderSubjectName(subject, language) {
        if (!subject) {
            return ""
        }

        const label = language === "en"
            ? reminderStringValue(subject, "label_en") || reminderStringValue(subject, "label_de")
            : reminderStringValue(subject, "label_de") || reminderStringValue(subject, "label_en")
        const fallback = reminderStringValue(subject, "key") || subject.id
        const name = label || fallback
        const number = reminderStringValue(subject, "number")

        return number ? `${name} (${number})` : name
    }

    function reminderParticipantRole(participant) {
        const role = reminderStringValue(participant, "type")
        if (role === "faculty" || role === "student") {
            return role
        }

        return reminderStringValue(participant, "entryMode") === "week" ? "faculty" : "student"
    }

    function reminderLoadParticipantSubjects(participantId) {
        const enrollments = $app.findRecordsByFilter(
            "participant_subjects",
            "participant = {:participantId}",
            "",
            50,
            0,
            { participantId }
        )
        const subjects = []

        for (const enrollment of enrollments) {
            const subjectId = reminderStringValue(enrollment, "subject")
            if (!subjectId) {
                continue
            }

            try {
                subjects.push($app.findRecordById("subjects", subjectId))
            } catch (error) {
                // Ignore stale enrollment links so one broken relation does not block the reminder.
            }
        }

        return subjects
    }

    function reminderSubjectList(subjects, language) {
        const names = []
        for (const subject of subjects || []) {
            const name = reminderSubjectName(subject, language)
            if (name) {
                names.push(name)
            }
        }

        return names.join(", ")
    }

    function reminderEmailHtmlStudent(participantName, participantLink) {
        const safeName = reminderHtmlEscape(reminderFirstName(participantName) || participantName || "Du")
        const urlDe = reminderHtmlEscape(reminderLanguageLink(participantLink, "de"))
        const linkDe = `<a href="${urlDe}">${urlDe}</a>`
        const contact = `<a href="mailto:${contactEmail}">${contactEmail}</a>`

        return `<p>Hallo ${safeName},</p>
        <p>dies ist eine kurze Erinnerung, deinen Arbeitsaufwand fürs Studium einzureichen.<br />Erfasse deinen Aufwand hier: ${linkDe}</p>
        <p>Solltest du einmal nicht fürs Studium gearbeitet haben, bestätige das bitte durch Klick auf "<strong>Überspringen</strong>" rechts oben in der Ansicht des jeweiligen Tages. Nur so verschwindet die rote Markierung in der Kalenderansicht.</p>
        <p>Du erhältst diese E-Mail, weil du an der Zeiterfassung mit <em>mETHric</em> teilnimmst.</p>
        <p>Kontakt bei Rückfragen und Anregungen: Katharina Sperger, ${contact}</p>
        <p>Vielen Dank und beste Grüsse,<br /><em>mETHric</em> und das Projektteam von «Student Workload»</p>
        <p><em>Bitte antworte nicht direkt auf diese E-Mail.</em></p>`
    }

    function reminderEmailTextStudent(participantName, participantLink) {
        const safeName = reminderFirstName(participantName) || participantName || "Du"
        const linkDe = reminderLanguageLink(participantLink, "de")
        const contact = contactEmail

        return `Hallo ${safeName},

dies ist eine kurze Erinnerung, deinen Arbeitsaufwand fürs Studium einzureichen.
Erfasse deinen Aufwand hier: ${linkDe}

Solltest du einmal nicht fürs Studium gearbeitet haben, bestätige das bitte durch Klick auf "Überspringen" rechts oben in der Ansicht des jeweiligen Tages. Nur so verschwindet die rote Markierung in der Kalenderansicht.

Du erhältst diese E-Mail, weil du an der Zeiterfassung mit mETHric teilnimmst.

Kontakt bei Rückfragen und Anregungen: Katharina Sperger, ${contact}

Vielen Dank und beste Grüsse,
mETHric und das Projektteam von «Student Workload»

Bitte antworte nicht direkt auf diese E-Mail.`
    }

    function reminderEmailHtmlFaculty(participantName, participantLink, subjects, categoryGuideDeUrl, categoryGuideEnUrl) {
        const safeName = reminderHtmlEscape(participantName || "Sie")
        const urlDe = reminderHtmlEscape(reminderLanguageLink(participantLink, "de"))
        const linkDe = `<a href="${urlDe}">${urlDe}</a>`
        const subjectDe = reminderHtmlEscape(reminderSubjectList(subjects, "de") || "Ihr Modul")
        const guideDe = `<a href="${reminderHtmlEscape(categoryGuideDeUrl || defaultCategoryGuideUrl)}">Kategorisierungshilfe (PDF)</a>`
        const urlEn = reminderHtmlEscape(reminderLanguageLink(participantLink, "en"))
        const linkEn = `<a href="${urlEn}">${urlEn}</a>`
        const subjectEn = reminderHtmlEscape(reminderSubjectList(subjects, "en") || "your module")
        const guideEn = `<a href="${reminderHtmlEscape(categoryGuideEnUrl || defaultCategoryGuideUrl)}">categorisation guide (PDF)</a>`
        const contact = `<a href="mailto:${contactEmail}">${contactEmail}</a>`

        return `<p>*** English version below ***</p>
        <p>Hallo ${safeName},</p>
        <p>dies ist eine kurze Erinnerung, Ihren Arbeitsaufwand für ${subjectDe} einzureichen.<br />Erfassen Sie Ihren Aufwand hier: ${linkDe}</p>
        <p>Sollten Sie einmal nicht für ${subjectDe} gearbeitet haben, bestätigen Sie das bitte durch Klick auf "<strong>Überspringen</strong>" rechts oben in der Ansicht der jeweiligen Woche / des jeweiligen Tages. Nur so verschwindet die rote Markierung in der Kalenderansicht.</p>
        <p>Unsicher über die korrekte Kategorie für Ihre Aufwände? Werfen Sie einen Blick in die ${guideDe}.</p>
        <p>Sie erhalten diese E-Mail, weil Sie an der Zeiterfassung mit <em>mETHric</em> teilnehmen.</p>
        <p>Kontakt bei Rückfragen und Anregungen: Katharina Sperger, ${contact}</p>
        <p>Vielen Dank und beste Grüsse,<br /><em>mETHric</em> und das Projektteam von «Faculty Workload»</p>
        <p><em>Bitte antworten Sie nicht direkt auf diese E-Mail.</em></p>
        <hr />
        <p>*** English version ***</p>
        <p>Hello ${safeName},</p>
        <p>This is a short reminder to submit your workload for ${subjectEn}.<br />Please record your workload here: ${linkEn}</p>
        <p>If you did not work on ${subjectEn} during a particular week or day, please confirm this by clicking “<strong>Skip</strong>” in the top-right corner of the respective weekly/daily view. This is the only way to remove the red marking from the calendar view.</p>
        <p>Unsure which category your workload belongs to? Take a look at the ${guideEn}.</p>
        <p>You are receiving this email because you are participating in time tracking with <em>mETHric</em>.</p>
        <p>For any queries or suggestions, please contact Katharina Sperger, ${contact}</p>
        <p>Thank you very much and best wishes,<br /><em>mETHric</em> and the project team of «Faculty Workload»</p>
        <p><em>Please do not reply directly to this email.</em></p>`
    }

    function reminderEmailTextFaculty(participantName, participantLink, subjects, categoryGuideDeUrl, categoryGuideEnUrl) {
        const safeName = participantName || "Sie"
        const linkDe = reminderLanguageLink(participantLink, "de")
        const subjectDe = reminderSubjectList(subjects, "de") || "Ihr Modul"
        const guideDe = `Kategorisierungshilfe (PDF) (${categoryGuideDeUrl || defaultCategoryGuideUrl})`
        const linkEn = reminderLanguageLink(participantLink, "en")
        const subjectEn = reminderSubjectList(subjects, "en") || "your module"
        const guideEn = `categorisation guide (PDF) (${categoryGuideEnUrl || defaultCategoryGuideUrl})`
        const contact = contactEmail

        return `*** English version below ***

Hallo ${safeName},

dies ist eine kurze Erinnerung, Ihren Arbeitsaufwand für ${subjectDe} einzureichen.
Erfassen Sie Ihren Aufwand hier: ${linkDe}

Sollten Sie einmal nicht für ${subjectDe} gearbeitet haben, bestätigen Sie das bitte durch Klick auf "Überspringen" rechts oben in der Ansicht der jeweiligen Woche / des jeweiligen Tages. Nur so verschwindet die rote Markierung in der Kalenderansicht.

Unsicher über die korrekte Kategorie für Ihre Aufwände? Werfen Sie einen Blick in die ${guideDe}.

Sie erhalten diese E-Mail, weil Sie an der Zeiterfassung mit mETHric teilnehmen.

Kontakt bei Rückfragen und Anregungen: Katharina Sperger, ${contact}

Vielen Dank und beste Grüsse,
mETHric und das Projektteam von «Faculty Workload»

Bitte antworten Sie nicht direkt auf diese E-Mail.

*** English version ***

Hello ${safeName},

This is a short reminder to submit your workload for ${subjectEn}.
Please record your workload here: ${linkEn}

If you did not work on ${subjectEn} during a particular week or day, please confirm this by clicking “Skip” in the top-right corner of the respective weekly/daily view. This is the only way to remove the red marking from the calendar view.

Unsure which category your workload belongs to? Take a look at the ${guideEn}.

You are receiving this email because you are participating in time tracking with mETHric.

For any queries or suggestions, please contact Katharina Sperger, ${contact}

Thank you very much and best wishes,
mETHric and the project team of «Faculty Workload»

Please do not reply directly to this email.`
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
    const participantRole = reminderParticipantRole(participant)

    if (!participantEmail) {
        return e.json(400, { error: "Participant has no email address" })
    }

    try {
        const config = reminderValidateConfig()
        const participantLink = reminderParticipantLink(participantId, config.appUrl)
        const categoryGuideUrl = defaultCategoryGuideUrl
        const categoryGuideDeUrl = config.categoryGuideDeUrl || categoryGuideUrl
        const categoryGuideEnUrl = config.categoryGuideEnUrl || categoryGuideUrl
        const participantSubjects = participantRole === "faculty" ? reminderLoadParticipantSubjects(participantId) : []
        const subject = "REMINDER Workload Tracking"
        const html = participantRole === "faculty"
            ? reminderEmailHtmlFaculty(participantName, participantLink, participantSubjects, categoryGuideDeUrl, categoryGuideEnUrl)
            : reminderEmailHtmlStudent(participantName, participantLink)
        const text = participantRole === "faculty"
            ? reminderEmailTextFaculty(participantName, participantLink, participantSubjects, categoryGuideDeUrl, categoryGuideEnUrl)
            : reminderEmailTextStudent(participantName, participantLink)
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
                html: html,
                text: text,
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
    const contactEmail = "katharina.sperger@stab.baug.ethz.ch"
    const defaultCategoryGuideUrl = "https://methric.ch/assets/KategorisierungZeiterfassung-CsWCFA54.pdf"

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
        const senderName = String($os.getenv("RESEND_SENDER_NAME") || fileConfig.senderName || "mETHric Team").trim()
        const senderAddress = String($os.getenv("RESEND_SENDER_ADDRESS") || fileConfig.senderAddress || "").trim()
        const replyTo = String($os.getenv("RESEND_REPLY_TO") || fileConfig.replyTo || senderAddress).trim()
        const appUrl = String($os.getenv("PB_PUBLIC_APP_URL") || fileConfig.appUrl || $app.settings().meta.appURL || "").trim()
        const categoryGuideUrl = String($os.getenv("INVITATION_CATEGORY_GUIDE_URL") || fileConfig.invitationCategoryGuideUrl || fileConfig.categoryGuideUrl || defaultCategoryGuideUrl).trim()

        return {
            apiKey,
            senderName,
            senderAddress,
            replyTo,
            appUrl,
            categoryGuideUrl,
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

    function invitationFirstName(participantName) {
        const trimmedName = String(participantName || "").trim()
        if (!trimmedName) {
            return ""
        }

        return trimmedName.split(/\s+/)[0]
    }

    function invitationParticipantRole(participant) {
        const role = invitationStringValue(participant, "type")
        if (role === "faculty" || role === "student") {
            return role
        }

        return invitationStringValue(participant, "entryMode") === "week" ? "faculty" : "student"
    }

    function invitationEmailHtmlStudent(participantName, participantLink) {
        const safeName = invitationHtmlEscape(invitationFirstName(participantName) || participantName || "Du")
        const urlDe = invitationHtmlEscape(invitationLanguageLink(participantLink, "de"))
        const linkDe = `<a href="${urlDe}">${urlDe}</a>`
        const contact = `<a href="mailto:${contactEmail}">${contactEmail}</a>`

        return `<p>Hallo ${safeName},</p>
        <p>Du erhältst diese E-Mail, weil Du Dich zum Projekt «Student Workload» angemeldet hast. Für die Zeiterfassung im Rahmen des Projekts verwenden wir <em>mETHric</em> - eine simple, eigens für diesen Zweck entwickelte WebApp.</p>
        <p>Über folgenden persönlichen Link kannst Du regelmässig Deine Aufwände erfassen: ${linkDe}<br />Speichere ihn am besten direkt als Favorit im Browser - auf dem Handy, Tablet oder Laptop/PC.</p>
        <p><em>mETHric</em> ist sehr intuitiv und mehrheitlich selbsterklärend. Wichtige Hinweise zur Datenerfassung erhältst Du direkt vom Projektteam in einer separaten E-Mail. <strong>Bitte lies diese Hinweise unbedingt genau durch, ehe Du ins Tracking startest.</strong> Danke!</p>
        <p><em>mETHric</em> wurde erst vor Kurzem entwickelt, was bedeutet, dass durchaus noch Fehler oder Ungereimtheiten auftreten können. Melde Dich gerne, falls Dir etwas auffällt oder Du Verbesserungsvorschläge zur Weiterentwicklung hast.</p>
        <p>Wir wünschen Dir viel Freude beim Workload-Tracking mit mETHric und bedanken uns bereits im Voraus herzlich für Deine engagierte Teilnahme!</p>
        <p>Kontakt bei Rückfragen und Anregungen: Katharina Sperger, <strong>${contact}</strong></p>
        <p>Beste Grüsse,<br /><em>mETHric</em> und das Projektteam von «Student Workload»</p>
        <p><em>Bitte antworte nicht direkt auf diese E-Mail.</em></p>`
    }

    function invitationEmailTextStudent(participantName, participantLink) {
        const safeName = invitationFirstName(participantName) || participantName || "Du"
        const linkDe = invitationLanguageLink(participantLink, "de")
        const contact = contactEmail

        return `Hallo ${safeName},

Du erhältst diese E-Mail, weil Du Dich zum Projekt «Student Workload» angemeldet hast. Für die Zeiterfassung im Rahmen des Projekts verwenden wir mETHric - eine simple, eigens für diesen Zweck entwickelte WebApp.

Über folgenden persönlichen Link kannst Du regelmässig Deine Aufwände erfassen: ${linkDe}
Speichere ihn am besten direkt als Favorit im Browser - auf dem Handy, Tablet oder Laptop/PC.

mETHric ist sehr intuitiv und mehrheitlich selbsterklärend. Wichtige Hinweise zur Datenerfassung erhältst Du direkt vom Projektteam in einer separaten E-Mail. Bitte lies diese Hinweise unbedingt genau durch, ehe Du ins Tracking startest. Danke!

mETHric wurde erst vor Kurzem entwickelt, was bedeutet, dass durchaus noch Fehler oder Ungereimtheiten auftreten können. Melde Dich gerne, falls Dir etwas auffällt oder Du Verbesserungsvorschläge zur Weiterentwicklung hast.

Wir wünschen Dir viel Freude beim Workload-Tracking mit mETHric und bedanken uns bereits im Voraus herzlich für Deine engagierte Teilnahme!

Kontakt bei Rückfragen und Anregungen: Katharina Sperger, ${contact}

Beste Grüsse,
mETHric und das Projektteam von «Student Workload»

Bitte antworte nicht direkt auf diese E-Mail.`
    }

    function invitationEmailHtmlFacultyDetailed(participantName, participantLink) {
        const safeName = invitationHtmlEscape(participantName || "Sie")
        const urlDe = invitationHtmlEscape(invitationLanguageLink(participantLink, "de"))
        const linkDe = `<a href="${urlDe}">${urlDe}</a>`
        const urlEn = invitationHtmlEscape(invitationLanguageLink(participantLink, "en"))
        const linkEn = `<a href="${urlEn}">${urlEn}</a>`
        const contact = `<a href="mailto:${contactEmail}">${contactEmail}</a>`

        return `<p>*** English version below ***</p>
        <p>Hallo ${safeName},</p>
        <p>Sie erhalten diese E-Mail, weil Ihre Lehrveranstaltung (Modul) am Projekt «Faculty Workload» teilnimmt. Für die Zeiterfassung im Rahmen des Projekts verwenden wir <em>mETHric</em> - eine simple, eigens für diesen Zweck entwickelte WebApp.</p>
        <p>Über folgenden persönlichen Link können Sie regelmässig Ihre Aufwände erfassen: ${linkDe}<br />Speichern Sie ihn am besten direkt als Favorit im Browser - auf dem Handy, Tablet oder Laptop/PC.</p>
        <p><em>mETHric</em> ist sehr intuitiv und mehrheitlich selbsterklärend. Wichtige Hinweise zur Datenerfassung erhalten Sie direkt vom Projektteam in einer separaten E-Mail. <strong>Bitte lesen Sie diese Hinweise unbedingt genau durch, ehe Sie ins Tracking starten.</strong> Danke!</p>
        <p><em>mETHric</em> wurde erst vor Kurzem entwickelt, was bedeutet, dass durchaus noch Fehler oder Ungereimtheiten auftreten können. Melden Sie sich gerne, falls Ihnen etwas auffällt oder Sie Verbesserungsvorschläge zur Weiterentwicklung haben.</p>
        <p>Wir wünschen Ihnen viel Freude beim Workload-Tracking mit mETHric und bedanken uns bereits im Voraus herzlich für Ihre engagierte Teilnahme!</p>
        <p>Kontakt bei Rückfragen und Anregungen: Katharina Sperger, <strong>${contact}</strong></p>
        <p>Beste Grüsse,<br /><em>mETHric</em> und das Projektteam von «Faculty Workload»</p>
        <p><em>Bitte antworten Sie nicht direkt auf diese E-Mail.</em></p>
        <hr />
        <p>*** English version ***</p>
        <p>Hello ${safeName},</p>
        <p>You are receiving this email because your course (module) is participating in the project "Faculty Workload". As part of the project, we use <em>mETHric</em> to track working time – a simple web app developed specifically for this purpose.</p>
        <p>You can use the following personal link to regularly log your workload: ${linkEn}<br />We recommend saving the link as a bookmark in your browser so that you can easily access it from your phone, tablet, laptop, or PC.</p>
        <p><em>mETHric</em> is very intuitive and largely self-explanatory. You will receive important instructions on how to record your data directly from the project team in a separate email. <strong>Please make sure to read these instructions carefully before you start tracking your workload.</strong> Thank you!</p>
        <p><em>mETHric</em> was developed only recently, which means that you may still encounter occasional bugs or inconsistencies. Please feel free to contact us if you notice anything or have suggestions for improvements.</p>
        <p>We hope you enjoy tracking your workload with mETHric, and we would already like to thank you very much for your active participation!</p>
        <p>For any queries or suggestions, please contact Katharina Sperger, <strong>${contact}</strong></p>
        <p>Best wishes,<br /><em>mETHric</em> and the project team of «Faculty Workload»</p>
        <p><em>Please do not reply directly to this email.</em></p>`
    }

    function invitationEmailTextFacultyDetailed(participantName, participantLink) {
        const safeName = participantName || "Sie"
        const linkDe = invitationLanguageLink(participantLink, "de")
        const linkEn = invitationLanguageLink(participantLink, "en")
        const contact = contactEmail

        return `*** English version below ***

Hallo ${safeName},

Sie erhalten diese E-Mail, weil Ihre Lehrveranstaltung (Modul) am Projekt «Faculty Workload» teilnimmt. Für die Zeiterfassung im Rahmen des Projekts verwenden wir mETHric - eine simple, eigens für diesen Zweck entwickelte WebApp.

Über folgenden persönlichen Link können Sie regelmässig Ihre Aufwände erfassen: ${linkDe}
Speichern Sie ihn am besten direkt als Favorit im Browser - auf dem Handy, Tablet oder Laptop/PC.

mETHric ist sehr intuitiv und mehrheitlich selbsterklärend. Wichtige Hinweise zur Datenerfassung erhalten Sie direkt vom Projektteam in einer separaten E-Mail. Bitte lesen Sie diese Hinweise unbedingt genau durch, ehe Sie ins Tracking starten. Danke!

mETHric wurde erst vor Kurzem entwickelt, was bedeutet, dass durchaus noch Fehler oder Ungereimtheiten auftreten können. Melden Sie sich gerne, falls Ihnen etwas auffällt oder Sie Verbesserungsvorschläge zur Weiterentwicklung haben.

Wir wünschen Ihnen viel Freude beim Workload-Tracking mit mETHric und bedanken uns bereits im Voraus herzlich für Ihre engagierte Teilnahme!

Kontakt bei Rückfragen und Anregungen: Katharina Sperger, ${contact}

Beste Grüsse,
mETHric und das Projektteam von «Faculty Workload»

Bitte antworten Sie nicht direkt auf diese E-Mail.

*** English version ***

Hello ${safeName},

You are receiving this email because your course (module) is participating in the project "Faculty Workload". As part of the project, we use mETHric to track working time – a simple web app developed specifically for this purpose.

You can use the following personal link to regularly log your workload: ${linkEn}
We recommend saving the link as a bookmark in your browser so that you can easily access it from your phone, tablet, laptop, or PC.

mETHric is very intuitive and largely self-explanatory. You will receive important instructions on how to record your data directly from the project team in a separate email. Please make sure to read these instructions carefully before you start tracking your workload. Thank you!

mETHric was developed only recently, which means that you may still encounter occasional bugs or inconsistencies. Please feel free to contact us if you notice anything or have suggestions for improvements.

We hope you enjoy tracking your workload with mETHric, and we would already like to thank you very much for your active participation!

For any queries or suggestions, please contact Katharina Sperger, ${contact}

Best wishes,
mETHric and the project team of «Faculty Workload»

Please do not reply directly to this email.`
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
    const participantRole = invitationParticipantRole(participant)

    if (!participantEmail) {
        return e.json(400, { error: "Participant has no email address" })
    }

    try {
        const config = invitationValidateConfig()
        const participantLink = invitationParticipantLink(participantId, config.appUrl)
        const subject = participantRole === "faculty"
            ? "“Faculty Workload”: Einladung zur Datenerhebung mit mETHric / Invitation to the workload tracking with mETHric"
            : "«Student Workload»: Einladung zur Datenerhebung mit mETHric"
        const html = participantRole === "faculty"
            ? invitationEmailHtmlFacultyDetailed(participantName, participantLink)
            : invitationEmailHtmlStudent(participantName, participantLink)
        const text = participantRole === "faculty"
            ? invitationEmailTextFacultyDetailed(participantName, participantLink)
            : invitationEmailTextStudent(participantName, participantLink)
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
                html: html,
                text: text,
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
