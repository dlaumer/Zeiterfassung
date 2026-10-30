/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/admin/settings", (e) => {
    const review = require(`${__hooks}/submission-review.js`)
    return e.json(200, { reviewTimeWeeks: review.settings($app).reviewTimeWeeks })
}, $apis.requireAuth("admins"))

routerAdd("PATCH", "/api/admin/settings", (e) => {
    const value = e.requestInfo().body.reviewTimeWeeks
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 5200) {
        return e.json(400, { message: "Review period must be a whole number of weeks between 0 and 5200." })
    }
    const setting = require(`${__hooks}/submission-review.js`).settingsRecord($app)
    setting.set("value", String(value))
    $app.save(setting)
    return e.json(200, { reviewTimeWeeks: value })
}, $apis.requireAuth("admins"))
