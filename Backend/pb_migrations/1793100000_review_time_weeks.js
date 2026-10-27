/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // Preserve an existing weeks setting, including changes made in the dashboard.
    try { app.findFirstRecordByFilter("adminSettings", 'key = "reviewTimeWeeks"'); return } catch (_) {}
    let setting
    try { setting = app.findFirstRecordByFilter("adminSettings", 'key = "reviewTime"') } catch (_) {}
    if (!setting) setting = new Record(app.findCollectionByNameOrId("adminSettings"))
    // The legacy setting was measured in days. The initial calendar-week policy is two weeks.
    setting.set("key", "reviewTimeWeeks")
    setting.set("value", "2")
    app.save(setting)
}, (app) => {})
