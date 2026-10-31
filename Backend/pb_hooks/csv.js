// Excel text formulas emitted by exports contain only a quoted string literal.
// Other user-controlled formula prefixes must be treated as text on import.
function escape(value) {
    let str = String(value == null ? "" : value)
    if (typeof value === "string" && /^[\s]*[=+\-@]/.test(str) && !/^="(?:[^"]|"")*"$/.test(str)) str = "'" + str
    return /[,"\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str
}
function row(values) { return values.map(escape).join(",") }
module.exports = { escape, row }
