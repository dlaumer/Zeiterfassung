/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/admin/participant/reminder", (e) => {
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
        const participantLinkDe = reminderLanguageLink(participantLink, "de")
        const linkSectionDe = participantLinkDe
            ? `<p>Erfasse Deinen Aufwand hier: <a href="${reminderHtmlEscape(participantLinkDe)}">${reminderHtmlEscape(participantLinkDe)}</a></p>`
            : ""

        return `
        <p>Hallo ${safeName},</p>
        <p>dies ist eine kurze Erinnerung, Deinen Arbeitsaufwand fürs Studium einzureichen.</p>
        ${linkSectionDe}
        <p>Solltest Du einmal nicht fürs Studium gearbeitet haben, bestätige Deinen Aufwand durch Klick auf <em>Überspringen</em>. Nur so verschwindet die rote Markierung in der Kalenderansicht.</p>
        <p>Du erhältst diese E-Mail, weil Du an der Zeiterfassung mit mETHric teilnimmst.</p>
        <p>Vielen Dank und beste Grüsse,</p>
        <p>mETHric und das Projektteam von &laquo;Student Workload&raquo;</p>
    `
    }

    function reminderEmailTextStudent(participantName, participantLink) {
        const safeName = reminderFirstName(participantName) || participantName || "Du"
        const germanLink = participantLink ? `\n\nErfasse Deinen Aufwand hier: ${reminderLanguageLink(participantLink, "de")}` : ""

        return `Hallo ${safeName},

dies ist eine kurze Erinnerung, Deinen Arbeitsaufwand fürs Studium einzureichen.${germanLink}

Solltest Du einmal nicht fürs Studium gearbeitet haben, bestätige Deinen Aufwand durch Klick auf "Überspringen". Nur so verschwindet die rote Markierung in der Kalenderansicht.

Du erhältst diese E-Mail, weil Du an der Zeiterfassung mit mETHric teilnimmst.

Vielen Dank und beste Grüsse,

mETHric und das Projektteam von \u00abStudent Workload\u00bb`
    }

    function reminderEmailHtmlFaculty(participantName, participantLink, subjects, categoryGuideDeUrl, categoryGuideEnUrl) {
        const safeName = reminderHtmlEscape(participantName || "Sie")
        const subjectDe = reminderHtmlEscape(reminderSubjectList(subjects, "de") || "Ihr Modul")
        const subjectEn = reminderHtmlEscape(reminderSubjectList(subjects, "en") || "your module")
        const participantLinkDe = reminderLanguageLink(participantLink, "de")
        const participantLinkEn = reminderLanguageLink(participantLink, "en")
        const linkSectionDe = participantLinkDe
            ? `<p>Erfassen Sie Ihren Aufwand hier: <a href="${reminderHtmlEscape(participantLinkDe)}">${reminderHtmlEscape(participantLinkDe)}</a></p>`
            : ""
        const linkSectionEn = participantLinkEn
            ? `<p>Enter your workload here: <a href="${reminderHtmlEscape(participantLinkEn)}">${reminderHtmlEscape(participantLinkEn)}</a></p>`
            : ""
        const guideSectionDe = categoryGuideDeUrl
            ? `<p>Unsicher über die korrekte Kategorie für Ihre Aufwände? Werfen Sie einen Blick in die <a href="${reminderHtmlEscape(categoryGuideDeUrl)}">Kategorisierungshilfe (PDF)</a>.</p>`
            : ""
        const guideSectionEn = categoryGuideEnUrl
            ? `<p>Unsure about the correct category for your workload? Please have a look at the <a href="${reminderHtmlEscape(categoryGuideEnUrl)}">categorisation guide (PDF)</a>.</p>`
            : ""

        return `
        <p>*** English version below***</p>
        <p>Hallo ${safeName},</p>
        <p>dies ist eine kurze Erinnerung, Ihren Arbeitsaufwand für &laquo;${subjectDe}&raquo; einzureichen.</p>
        ${linkSectionDe}
        ${guideSectionDe}
        <p>Sollten Sie einmal nicht für &laquo;${subjectDe}&raquo; gearbeitet haben, bestätigen Sie bitte den Aufwand durch Klick auf <em>Überspringen</em>. Nur so verschwindet die rote Markierung in der Kalenderansicht.</p>
        <p>Sie erhalten diese E-Mail, weil Sie an der Zeiterfassung mit mETHric teilnehmen.</p>
        <p>Vielen Dank und beste Grüsse,</p>
        <p>mETHric und das Projektteam von &laquo;Faculty Workload&raquo;</p>
        <hr />
        <p>*** English version***</p>
        <p>Hello ${safeName},</p>
        <p>This is a quick reminder to submit your workload spent on &ldquo;${subjectEn}&rdquo;.</p>
        ${linkSectionEn}
        ${guideSectionEn}
        <p>If you did not work on &ldquo;${subjectEn}&rdquo; during a certain period of time, please confirm your workload by clicking <em>Skip</em>. This is the only way to remove the red mark from the calendar view.</p>
        <p>You are receiving this email because you are participating in workload tracking with mETHric.</p>
        <p>Thank you very much and best regards,</p>
        <p>mETHric and the &ldquo;Faculty Workload&rdquo; project team</p>
    `
    }

    function reminderEmailTextFaculty(participantName, participantLink, subjects, categoryGuideDeUrl, categoryGuideEnUrl) {
        const safeName = participantName || "Sie"
        const subjectDe = reminderSubjectList(subjects, "de") || "Ihr Modul"
        const subjectEn = reminderSubjectList(subjects, "en") || "your module"
        const germanLink = participantLink ? `\n\nErfassen Sie Ihren Aufwand hier: ${reminderLanguageLink(participantLink, "de")}` : ""
        const englishLink = participantLink ? `\n\nEnter your workload here: ${reminderLanguageLink(participantLink, "en")}` : ""
        const germanGuide = categoryGuideDeUrl ? `\n\nUnsicher über die korrekte Kategorie für Ihre Aufwände? Kategorisierungshilfe (PDF): ${categoryGuideDeUrl}` : ""
        const englishGuide = categoryGuideEnUrl ? `\n\nUnsure about the correct category for your workload? Categorisation guide (PDF): ${categoryGuideEnUrl}` : ""

        return `*** English version below***

Hallo ${safeName},

dies ist eine kurze Erinnerung, Ihren Arbeitsaufwand für \u00ab${subjectDe}\u00bb einzureichen.${germanLink}${germanGuide}

Sollten Sie einmal nicht für \u00ab${subjectDe}\u00bb gearbeitet haben, bestätigen Sie bitte den Aufwand durch Klick auf "Überspringen". Nur so verschwindet die rote Markierung in der Kalenderansicht.

Sie erhalten diese E-Mail, weil Sie an der Zeiterfassung mit mETHric teilnehmen.

Vielen Dank und beste Grüsse,

mETHric und das Projektteam von \u00abFaculty Workload\u00bb


*** English version***

Hello ${safeName},

This is a quick reminder to submit your workload spent on "${subjectEn}".${englishLink}${englishGuide}

If you did not work on "${subjectEn}" during a certain period of time, please confirm your workload by clicking "Skip". This is the only way to remove the red mark from the calendar view.

You are receiving this email because you are participating in workload tracking with mETHric.

Thank you very much and best regards,

mETHric and the "Faculty Workload" project team`
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

    function invitationSubjectName(subject, language) {
        if (!subject) {
            return ""
        }

        const label = language === "en"
            ? invitationStringValue(subject, "label_en") || invitationStringValue(subject, "label_de")
            : invitationStringValue(subject, "label_de") || invitationStringValue(subject, "label_en")
        const fallback = invitationStringValue(subject, "key") || subject.id
        const name = label || fallback
        const number = invitationStringValue(subject, "number")

        return number ? `${name} (${number})` : name
    }

    function invitationLoadParticipantSubjects(participantId) {
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
            const subjectId = invitationStringValue(enrollment, "subject")
            if (!subjectId) {
                continue
            }

            try {
                subjects.push($app.findRecordById("subjects", subjectId))
            } catch (error) {
                // Ignore stale enrollment links so one broken relation does not block the invitation.
            }
        }

        return subjects
    }

    function invitationSubjectList(subjects, language) {
        const names = []
        for (const subject of subjects || []) {
            const name = invitationSubjectName(subject, language)
            if (name) {
                names.push(name)
            }
        }

        return names.join(", ")
    }

    function invitationEmailHtmlStudent(participantName, participantLink) {
        const safeName = invitationHtmlEscape(invitationFirstName(participantName) || participantName || "Du")
        const participantLinkDe = invitationLanguageLink(participantLink, "de")
        const linkSectionDe = participantLinkDe
            ? `<p>Über folgenden <strong>persönlichen Link</strong> kannst Du Deine Aufwände erfassen: <a href="${invitationHtmlEscape(participantLinkDe)}">${invitationHtmlEscape(participantLinkDe)}</a><br />Speichere ihn am besten direkt als Favorit im Browser - auf dem Handy, Tablet oder Laptop/PC.</p>`
            : ""

        return `
        <p>Hallo ${safeName},</p>
        <p>Du erhältst diese E-Mail, weil Du bereits im Herbstsemester 2025 an &laquo;Student Workload&raquo; teilgenommen hast. Es geht nun weiter mit dem Tracking der Aufwände für die Sommersession 2026 - mit <strong>mETHric</strong>, unserem <strong>neu entwickelten Tracking-Tool</strong>. Wir hoffen sehr, dass Du wieder mit dabei bist!<br /><strong>Jedes Modul, für welches Du den Lernaufwand trackst und anschliessend die Prüfung ablegst, wird mit CHF 10 (in Gutscheinform) vergütet.</strong></p>
        ${linkSectionDe}
        <p>Die App ist sehr intuitiv und mehrheitlich selbsterklärend. Ein paar Hinweise:</p>
        <ul>
            <li>Die Module (Fächer), welche Du tracken möchtest, kannst Du selbstständig unter &laquo;Modulverwaltung / Module Management&raquo; hinzufügen. ACHTUNG: Für die Studie sind nur diejenigen Module relevant, welche Du bereits im Herbstsemester 2025 belegt hast, die Leistungskontrolle aber erst jetzt im Sommer zum ersten Mal ablegen wirst. Das Tracking ist NICHT für andere Module (z.B. aus dem FS2026) oder Repetitionsprüfungen vorgesehen.<br />Sollte dennoch ein Modul in der Auswahl fehlen, melde Dich bitte unter <a href="mailto:${contactEmail}">${contactEmail}</a>.</li>
            <li>Dank der Kalenderansicht siehst Du jeweils sofort, wenn noch ein Tag in der Eingabe fehlt und an welchen Tagen Du für welches Modul gearbeitet hast. Tage, an welchen Du nicht fürs Studium gearbeitet hast, kannst Du durch einen Klick auf &laquo;Überspringen&raquo; ohne Aufwand in die Auswertung mit aufnehmen. Eingaben am Wochenende sind weiterhin möglich und erwünscht, sofern Du am Wochenende fürs Studium gearbeitet hast.</li>
            <li>Bei bereits eingegebenen Tagen kannst Du Ergänzungen machen (z.B., wenn Du abends noch ungeplanterweise gelernt hast), oder auch den Tag löschen und neu eingeben.</li>
            <li>Die Präferenzen zum generellen, täglichen Reminder zur Dateneingabe werden vom Herbstsemester 2025 übernommen. Änderungswünsche können jederzeit an <a href="mailto:${contactEmail}">${contactEmail}</a> gemeldet werden.</li>
            <li>Der Workload kann rückwirkend erfasst werden. Dennoch ist es für die Datenqualität weiterhin essentiell, dass Du Deine Aufwände möglichst zeitnah (d.h. möglichst jeden Tag) eingibst. Falls zu lange keine Eingaben erfolgen, wirst Du einen automatisierten Reminder erhalten.</li>
            <li>Bei der Zuverlässigkeit der Daten kannst Du neu zwischen 1 und 5 Sternen auswählen, wobei 5 Sterne einer 9-10 in Mentimeter entsprechen (usw.). Diese Angabe ist qualitativ, hilft uns aber sehr bei der Auswertung!</li>
        </ul>
        <p>Du nutzt nun mETHric in Version 1.0, was bedeutet, dass durchaus noch Fehler oder Ungereimtheiten auftreten können. Melde Dich gerne bei <a href="mailto:${contactEmail}">${contactEmail}</a>, falls Dir etwas auffällt oder Du Verbesserungsvorschläge zur Weiterentwicklung hast.</p>
        <p>Wir wünschen Dir viel Freude beim Workload-Tracking mit mETHric und bedanken uns bereits im Voraus herzlich für Deine engagierte Teilnahme!!</p>
        <p>Beste Grüsse,</p>
        <p>mETHric und das Projektteam von &laquo;Student Workload&raquo;</p>
    `
    }

    function invitationEmailTextStudent(participantName, participantLink) {
        const safeName = invitationFirstName(participantName) || participantName || "Du"
        const germanLink = participantLink ? `\n\nÜber folgenden persönlichen Link kannst Du Deine Aufwände erfassen: ${invitationLanguageLink(participantLink, "de")}\nSpeichere ihn am besten direkt als Favorit im Browser - auf dem Handy, Tablet oder Laptop/PC.` : ""

        return `Hallo ${safeName},

Du erhältst diese E-Mail, weil Du bereits im Herbstsemester 2025 an «Student Workload» teilgenommen hast. Es geht nun weiter mit dem Tracking der Aufwände für die Sommersession 2026 - mit mETHric, unserem neu entwickelten Tracking-Tool. Wir hoffen sehr, dass Du wieder mit dabei bist!
Jedes Modul, für welches Du den Lernaufwand trackst und anschliessend die Prüfung ablegst, wird mit CHF 10 (in Gutscheinform) vergütet.${germanLink}

Die App ist sehr intuitiv und mehrheitlich selbsterklärend. Ein paar Hinweise:

- Die Module (Fächer), welche Du tracken möchtest, kannst Du selbstständig unter «Modulverwaltung / Module Management» hinzufügen. ACHTUNG: Für die Studie sind nur diejenigen Module relevant, welche Du bereits im Herbstsemester 2025 belegt hast, die Leistungskontrolle aber erst jetzt im Sommer zum ersten Mal ablegen wirst. Das Tracking ist NICHT für andere Module (z.B. aus dem FS2026) oder Repetitionsprüfungen vorgesehen. Sollte dennoch ein Modul in der Auswahl fehlen, melde Dich bitte unter ${contactEmail}.

- Dank der Kalenderansicht siehst Du jeweils sofort, wenn noch ein Tag in der Eingabe fehlt und an welchen Tagen Du für welches Modul gearbeitet hast. Tage, an welchen Du nicht fürs Studium gearbeitet hast, kannst Du durch einen Klick auf «Überspringen» ohne Aufwand in die Auswertung mit aufnehmen. Eingaben am Wochenende sind weiterhin möglich und erwünscht, sofern Du am Wochenende fürs Studium gearbeitet hast.

- Bei bereits eingegebenen Tagen kannst Du Ergänzungen machen (z.B., wenn Du abends noch ungeplanterweise gelernt hast), oder auch den Tag löschen und neu eingeben.

- Die Präferenzen zum generellen, täglichen Reminder zur Dateneingabe werden vom Herbstsemester 2025 übernommen. Änderungswünsche können jederzeit an ${contactEmail} gemeldet werden.

- Der Workload kann rückwirkend erfasst werden. Dennoch ist es für die Datenqualität weiterhin essentiell, dass Du Deine Aufwände möglichst zeitnah (d.h. möglichst jeden Tag) eingibst. Falls zu lange keine Eingaben erfolgen, wirst Du einen automatisierten Reminder erhalten.

- Bei der Zuverlässigkeit der Daten kannst Du neu zwischen 1 und 5 Sternen auswählen, wobei 5 Sterne einer 9-10 in Mentimeter entsprechen (usw.). Diese Angabe ist qualitativ, hilft uns aber sehr bei der Auswertung!

Du nutzt nun mETHric in Version 1.0, was bedeutet, dass durchaus noch Fehler oder Ungereimtheiten auftreten können. Melde Dich gerne bei ${contactEmail}, falls Dir etwas auffällt oder Du Verbesserungsvorschläge zur Weiterentwicklung hast.

Wir wünschen Dir viel Freude beim Workload-Tracking mit mETHric und bedanken uns bereits im Voraus herzlich für Deine engagierte Teilnahme!!

Beste Grüsse,

mETHric und das Projektteam von «Student Workload»`
    }

    function invitationEmailHtmlFacultyDetailed(participantName, participantLink, subjects, categoryGuideUrl) {
        const safeName = invitationHtmlEscape(participantName || "Sie")
        const subjectDe = invitationHtmlEscape(invitationSubjectList(subjects, "de") || "Ihr Fach")
        const subjectEn = invitationHtmlEscape(invitationSubjectList(subjects, "en") || "your course")
        const participantLinkEn = invitationLanguageLink(participantLink, "en")
        const participantLinkDe = invitationLanguageLink(participantLink, "de")
        const safeGuideUrl = invitationHtmlEscape(categoryGuideUrl || defaultCategoryGuideUrl)
        const linkSectionDe = participantLinkDe
            ? `<p>Über folgenden <strong>persönlichen Link</strong> können Sie Ihre Aufwände für &laquo;${subjectDe}&raquo; erfassen: <a href="${invitationHtmlEscape(participantLinkDe)}">${invitationHtmlEscape(participantLinkDe)}</a><br />Speichern Sie den Link am besten direkt als Favorit im Browser - auf dem Handy, Tablet oder Laptop/PC.</p>`
            : ""
        const linkSectionEn = participantLinkEn
            ? `<p>You can use the following <strong>personal link</strong> to record your workload for &ldquo;${subjectEn}&rdquo;: <a href="${invitationHtmlEscape(participantLinkEn)}">${invitationHtmlEscape(participantLinkEn)}</a></p><p>It’s best to save the link directly as a bookmark in your browser - on your phone, tablet, or laptop/PC.</p>`
            : ""

        return `
        <p>Hallo ${safeName},</p>
        <p>Sie erhalten diese E-Mail, weil Sie bereits im Herbstsemester 2025 an &laquo;Faculty Workload&raquo; teilgenommen haben und diesen Sommer eine weitere Sessionsprüfung für &laquo;${subjectDe}&raquo; ansteht. Es geht daher nun weiter mit dem Tracking der Aufwände - mit <strong>mETHric</strong>, unserem <strong>neu entwickelten Tracking-Tool</strong>.</p>
        ${linkSectionDe}
        <p>Die App ist sehr intuitiv und mehrheitlich selbsterklärend. Ein paar Hinweise:</p>
        <ul>
            <li>Die Prüfungsvorbereitung, -durchführung, und -korrektur bzw. -nachbereitung können Sie genauso in die bestehenden Kategorien einteilen wie bisher den Unterricht. Hinweise dazu finden Sie im Dokument <a href="${safeGuideUrl}">Kategorisierung der Lehraufwände (PDF)</a>.</li>
            <li>Dank der Kalenderansicht sehen Sie jeweils sofort, wenn noch eine Woche in der Eingabe fehlt. Wochen, an welchen Sie nicht für &laquo;${subjectDe}&raquo; gearbeitet haben, können Sie durch einen Klick auf &laquo;Überspringen&raquo; ohne Aufwand in die Auswertung mit aufnehmen.</li>
            <li>Bei bereits eingegebenen Wochen können Sie Ergänzungen machen und somit den Aufwand auch die gesamte Woche über fortlaufend ergänzen. Es ist auch möglich, den Aufwand für eine Woche zu löschen und neu einzugeben.</li>
            <li>Die Präferenzen zum generellen, wöchentlichen Reminder zur Dateneingabe werden vom Herbstsemester 2025 übernommen. Änderungswünsche können jederzeit an <a href="mailto:${contactEmail}">${contactEmail}</a> gemeldet werden.</li>
            <li>Der Arbeitsaufwand kann rückwirkend erfasst werden. Dennoch ist es für die Datenqualität weiterhin essentiell, dass Sie die Aufwände möglichst zeitnah (d.h. möglichst einmal wöchentlich) eingeben. Falls zu lange keine Eingaben erfolgen, werden Sie einen automatisierten Reminder erhalten.</li>
            <li>Bei der Zuverlässigkeit der Daten können Sie neu zwischen 1 und 5 Sternen auswählen, wobei 5 Sterne einer 9-10 in Mentimeter entsprechen (usw.). Diese Angabe ist qualitativ, hilft uns aber sehr bei der Auswertung!</li>
            <li>Bitte beachten Sie, dass der administrative Aufwand sowie die strukturellen Änderungen (z.B. durch Änderung des Unterrichts-/Prüfungsformats) als Teilmengen des Gesamtaufwandes zu verstehen sind. Eine strukturelle Änderung kann dabei zugleich auch administrativer Natur sein.</li>
        </ul>
        <p>Sie nutzen nun mETHric in Version 1.0, was bedeutet, dass durchaus noch Fehler oder Ungereimtheiten auftreten können. Melden Sie sich gerne bei <a href="mailto:${contactEmail}">${contactEmail}</a>, falls Ihnen etwas auffällt oder Sie Verbesserungsvorschläge zur Weiterentwicklung haben.</p>
        <p>Wir wünschen Ihnen viel Freude beim Workload-Tracking mit mETHric und bedanken uns bereits im Voraus herzlich für Ihre engagierte Teilnahme!</p>
        <p>Beste Grüsse,</p>
        <p>mETHric und das Projektteam von &laquo;Faculty Workload&raquo;</p>
        <hr />
        <p>*** English version ***</p>
        <p>Hello ${safeName},</p>
        <p>You are receiving this email because you participated in &ldquo;Faculty Workload&rdquo; during Autumn Semester 2025 and have another session exam coming up this summer for &ldquo;${subjectEn}&rdquo;. We are therefore continuing with the tracking of workload - with mETHric, our newly developed tracking tool.</p>
        ${linkSectionEn}
        <p>The app is very intuitive and mostly self-explanatory. A few notes:</p>
        <ul>
            <li>You can categorise exam preparation, conduction, grading and follow-up work in the same way as you have previously categorised teaching. Further details can be found in the document <a href="${safeGuideUrl}">Categorisation of teaching workload (PDF)</a>.</li>
            <li>Thanks to the calendar view, you can immediately see if a week is still missing from your entries. You can easily include weeks during which you did not work on &ldquo;${subjectEn}&rdquo; in the evaluation by clicking &ldquo;Skip&rdquo;.</li>
            <li>For weeks that have already been entered, you can make additions and thus continuously update your time spent throughout the entire week. It is also possible to delete the workload for a week and re-enter it.</li>
            <li>The preferences for the general, weekly data entry reminder will be carried over from Autumn Semester 2025. Requests for changes can be submitted at any time to <a href="mailto:${contactEmail}">${contactEmail}</a>.</li>
            <li>Workload can be recorded retroactively. Nevertheless, it remains essential for data quality that you enter the workload as promptly as possible (i.e., ideally once a week). If you do not enter data for too long, you will receive an automated reminder.</li>
            <li>For data reliability, you can now select between 1 and 5 stars, where 5 stars correspond to a 9-10 in Mentimeter (etc.). This is a qualitative assessment, but it helps us greatly with the evaluation!</li>
            <li>Please note that administrative effort as well as structural changes (e.g., due to changes in the teaching/exam format) should be understood as subsets of the total effort. A structural change can also be of an administrative nature.</li>
        </ul>
        <p>You are now using mETHric version 1.0, which means that errors or inconsistencies may still occur. Please feel free to contact <a href="mailto:${contactEmail}">${contactEmail}</a> if you notice anything or have suggestions for improvement.</p>
        <p>We hope you enjoy tracking your workload with mETHric and thank you in advance for your dedicated participation!</p>
        <p>Best regards,</p>
        <p>mETHric and the &ldquo;Faculty Workload&rdquo; project team</p>
    `
    }

    function invitationEmailTextFacultyDetailed(participantName, participantLink, subjects, categoryGuideUrl) {
        const safeName = participantName || "Sie"
        const subjectDe = invitationSubjectList(subjects, "de") || "Ihr Fach"
        const subjectEn = invitationSubjectList(subjects, "en") || "your course"
        const guideUrl = categoryGuideUrl || defaultCategoryGuideUrl
        const germanLink = participantLink ? `\n\nÜber folgenden persönlichen Link können Sie Ihre Aufwände für «${subjectDe}» erfassen: ${invitationLanguageLink(participantLink, "de")}\nSpeichern Sie den Link am besten direkt als Favorit im Browser - auf dem Handy, Tablet oder Laptop/PC.` : ""
        const englishLink = participantLink ? `\n\nYou can use the following personal link to record your workload for "${subjectEn}": ${invitationLanguageLink(participantLink, "en")}\n\nIt's best to save the link directly as a bookmark in your browser - on your phone, tablet, or laptop/PC.` : ""

        return `Hallo ${safeName},

Sie erhalten diese E-Mail, weil Sie bereits im Herbstsemester 2025 an «Faculty Workload» teilgenommen haben und diesen Sommer eine weitere Sessionsprüfung für «${subjectDe}» ansteht. Es geht daher nun weiter mit dem Tracking der Aufwände - mit mETHric, unserem neu entwickelten Tracking-Tool.${germanLink}

Die App ist sehr intuitiv und mehrheitlich selbsterklärend. Ein paar Hinweise:

- Die Prüfungsvorbereitung, -durchführung, und -korrektur bzw. -nachbereitung können Sie genauso in die bestehenden Kategorien einteilen wie bisher den Unterricht. Hinweise dazu finden Sie im Dokument «Kategorisierung der Lehraufwände (PDF)»: ${guideUrl}

- Dank der Kalenderansicht sehen Sie jeweils sofort, wenn noch eine Woche in der Eingabe fehlt. Wochen, an welchen Sie nicht für «${subjectDe}» gearbeitet haben, können Sie durch einen Klick auf «Überspringen» ohne Aufwand in die Auswertung mit aufnehmen.

- Bei bereits eingegebenen Wochen können Sie Ergänzungen machen und somit den Aufwand auch die gesamte Woche über fortlaufend ergänzen. Es ist auch möglich, den Aufwand für eine Woche zu löschen und neu einzugeben.

- Die Präferenzen zum generellen, wöchentlichen Reminder zur Dateneingabe werden vom Herbstsemester 2025 übernommen. Änderungswünsche können jederzeit an ${contactEmail} gemeldet werden.

- Der Arbeitsaufwand kann rückwirkend erfasst werden. Dennoch ist es für die Datenqualität weiterhin essentiell, dass Sie die Aufwände möglichst zeitnah (d.h. möglichst einmal wöchentlich) eingeben. Falls zu lange keine Eingaben erfolgen, werden Sie einen automatisierten Reminder erhalten.

- Bei der Zuverlässigkeit der Daten können Sie neu zwischen 1 und 5 Sternen auswählen, wobei 5 Sterne einer 9-10 in Mentimeter entsprechen (usw.). Diese Angabe ist qualitativ, hilft uns aber sehr bei der Auswertung!

- Bitte beachten Sie, dass der administrative Aufwand sowie die strukturellen Änderungen (z.B. durch Änderung des Unterrichts-/Prüfungsformats) als Teilmengen des Gesamtaufwandes zu verstehen sind. Eine strukturelle Änderung kann dabei zugleich auch administrativer Natur sein.

Sie nutzen nun mETHric in Version 1.0, was bedeutet, dass durchaus noch Fehler oder Ungereimtheiten auftreten können. Melden Sie sich gerne bei ${contactEmail}, falls Ihnen etwas auffällt oder Sie Verbesserungsvorschläge zur Weiterentwicklung haben.

Wir wünschen Ihnen viel Freude beim Workload-Tracking mit mETHric und bedanken uns bereits im Voraus herzlich für Ihre engagierte Teilnahme!

Beste Grüsse,

mETHric und das Projektteam von «Faculty Workload»


*** English version ***

Hello ${safeName},

You are receiving this email because you participated in "Faculty Workload" during Autumn Semester 2025 and have another session exam coming up this summer for "${subjectEn}". We are therefore continuing with the tracking of workload - with mETHric, our newly developed tracking tool.${englishLink}

The app is very intuitive and mostly self-explanatory. A few notes:

- You can categorise exam preparation, conduction, grading and follow-up work in the same way as you have previously categorised teaching. Further details can be found in the document "Categorisation of teaching workload (PDF)": ${guideUrl}

- Thanks to the calendar view, you can immediately see if a week is still missing from your entries. You can easily include weeks during which you did not work on "${subjectEn}" in the evaluation by clicking "Skip".

- For weeks that have already been entered, you can make additions and thus continuously update your time spent throughout the entire week. It is also possible to delete the workload for a week and re-enter it.

- The preferences for the general, weekly data entry reminder will be carried over from Autumn Semester 2025. Requests for changes can be submitted at any time to ${contactEmail}.

- Workload can be recorded retroactively. Nevertheless, it remains essential for data quality that you enter the workload as promptly as possible (i.e., ideally once a week). If you do not enter data for too long, you will receive an automated reminder.

- For data reliability, you can now select between 1 and 5 stars, where 5 stars correspond to a 9-10 in Mentimeter (etc.). This is a qualitative assessment, but it helps us greatly with the evaluation!

- Please note that administrative effort as well as structural changes (e.g., due to changes in the teaching/exam format) should be understood as subsets of the total effort. A structural change can also be of an administrative nature.

You are now using mETHric version 1.0, which means that errors or inconsistencies may still occur. Please feel free to contact ${contactEmail} if you notice anything or have suggestions for improvement.

We hope you enjoy tracking your workload with mETHric and thank you in advance for your dedicated participation! Please feel free to contact us at any time with your questions at ${contactEmail}.

Best regards,

mETHric and the "Faculty Workload" project team`
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
        const participantSubjects = participantRole === "faculty" ? invitationLoadParticipantSubjects(participantId) : []
        const categoryGuideUrl = config.categoryGuideUrl || defaultCategoryGuideUrl
        const subject = participantRole === "faculty"
            ? "“Faculty Workload”: Einladung zur Datenerhebung mit mETHric / Invitation to the workload tracking with mETHric"
            : "«Student Workload»: Einladung zur Datenerhebung mit mETHric"
        const html = participantRole === "faculty"
            ? invitationEmailHtmlFacultyDetailed(participantName, participantLink, participantSubjects, categoryGuideUrl)
            : invitationEmailHtmlStudent(participantName, participantLink)
        const text = participantRole === "faculty"
            ? invitationEmailTextFacultyDetailed(participantName, participantLink, participantSubjects, categoryGuideUrl)
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
