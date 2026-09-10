/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/admin/settings", (e) => {
    const review = require(`${__hooks}/submission-review.js`)
    return e.json(200, { reviewTime: review.settings($app).reviewTime })
}, $apis.requireAuth("admins"))

routerAdd("PATCH", "/api/admin/settings", (e) => {
    const value = e.requestInfo().body.reviewTime
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 36500) {
        return e.json(400, { message: "Review period must be a whole number of days between 0 and 36500." })
    }
    const setting = $app.findFirstRecordByFilter("adminSettings", 'key = "reviewTime"')
    setting.set("value", String(value))
    $app.save(setting)
    return e.json(200, { reviewTime: value })
}, $apis.requireAuth("admins"))
