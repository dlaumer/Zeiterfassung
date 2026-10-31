// Shared complete reads. Callers that only test existence should use limit 1.
function all(app, collection, filter, sort, params) {
    return app.findRecordsByFilter(collection, filter || "", sort || "", 0, 0, params || {})
}

// Keep relation filters below SQLite expression/parameter limits, even after
// years of corrections. Bound parameters also keep values out of filter syntax.
function related(app, collection, field, ids) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) throw new Error("Invalid relation field")
    const unique = Array.from(new Set(ids))
    const result = []
    for (let offset = 0; offset < unique.length; offset += 100) {
        const params = {}
        const filter = unique.slice(offset, offset + 100).map((id, index) => {
            params["id" + index] = id
            return field + " = {:id" + index + "}"
        }).join(" || ")
        result.push(...all(app, collection, filter, "", params))
    }
    return result
}

module.exports = { all, related }
