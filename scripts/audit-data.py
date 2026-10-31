"""Read-only SQLite data audit; outputs counts, never names, email or comments.

Usage: python scripts/audit-data.py /path/to/pb_data/data.db
Run against a consistent backup of the target environment before deployment.
"""
import json
import sqlite3
import sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else "Backend/pb_data/data.db").resolve()
db = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
db.execute("BEGIN")
report = {"database": str(path), "integrity": [row[0] for row in db.execute("PRAGMA integrity_check")], "counts": {}, "issues": {}}
tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    "participants": {"type", "referenceDate", "inactive"},
    "subjects": {"entryMode", "number"},
    "participant_subjects": {"participant", "subject"},
    "submissions": {"socialBattery", "modeBeforeDeletion"},
    "submission_items": {"durationMinutes", "submission", "workloadType"},
    "adminSettings": {"key", "value"},
}
for table, fields in required.items():
    if table not in tables:
        report["issues"]["missing_table:" + table] = True
        continue
    report["counts"][table] = db.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    missing = fields - {row[1] for row in db.execute(f'PRAGMA table_info("{table}")')}
    if missing:
        report["issues"]["missing_columns:" + table] = sorted(missing)

checks = {
    "orphan_enrollments": "SELECT COUNT(*) FROM participant_subjects e LEFT JOIN participants p ON p.id=e.participant LEFT JOIN subjects s ON s.id=e.subject WHERE p.id IS NULL OR s.id IS NULL",
    "duplicate_enrollments": "SELECT COUNT(*) FROM (SELECT participant,subject FROM participant_subjects GROUP BY participant,subject HAVING COUNT(*)>1)",
    "orphan_submissions": "SELECT COUNT(*) FROM submissions s LEFT JOIN participants p ON p.id=s.participant WHERE p.id IS NULL",
    "orphan_items": "SELECT COUNT(*) FROM submission_items i LEFT JOIN submissions s ON s.id=i.submission LEFT JOIN subjects w ON w.id=i.workloadType WHERE s.id IS NULL OR w.id IS NULL",
    "broken_predecessors": "SELECT COUNT(*) FROM submissions s LEFT JOIN submissions p ON p.id=s.replacesSubmission WHERE s.replacesSubmission!='' AND p.id IS NULL",
    "cross_period_predecessors": "SELECT COUNT(*) FROM submissions s JOIN submissions p ON p.id=s.replacesSubmission WHERE s.participant!=p.participant OR s.periodType!=p.periodType OR substr(s.periodStart,1,10)!=substr(p.periodStart,1,10)",
    "invalid_periods": "SELECT COUNT(*) FROM submissions WHERE periodType NOT IN ('day','week') OR julianday(periodStart) IS NULL OR julianday(periodEnd) IS NULL OR periodStart>periodEnd",
    "invalid_item_types": "SELECT COUNT(*) FROM submission_items WHERE type NOT IN ('class','study')",
    "negative_noncorrection_items": "SELECT COUNT(*) FROM submission_items i JOIN submissions s ON s.id=i.submission WHERE i.durationMinutes<0 AND s.submissionMode NOT IN ('correction','deleted')",
    "duplicate_participant_emails": "SELECT COUNT(*) FROM (SELECT lower(trim(email)) FROM participants WHERE trim(email)!='' GROUP BY lower(trim(email)) HAVING COUNT(*)>1)",
    "duplicate_subject_keys": "SELECT COUNT(*) FROM (SELECT lower(trim(key)) FROM subjects GROUP BY lower(trim(key)) HAVING COUNT(*)>1)",
    "invalid_review_settings": "SELECT CASE WHEN COUNT(*)=1 AND MIN(value)!='' AND MIN(value) NOT GLOB '*[^0-9]*' AND CAST(MIN(value) AS INTEGER) BETWEEN 0 AND 5200 THEN 0 ELSE 1 END FROM adminSettings WHERE key='reviewTimeWeeks'",
}
for name, sql in checks.items():
    try:
        count = db.execute(sql).fetchone()[0]
        if count:
            report["issues"][name] = count
    except sqlite3.OperationalError as error:
        report["issues"]["unavailable_check:" + name] = str(error)

# Find history cycles without recursively querying the database for each record.
links = dict(db.execute("SELECT id,replacesSubmission FROM submissions")) if "submissions" in tables else {}
done = set()
cycles = 0
for record in links:
    path_ids = set()
    while record in links and record not in done:
        if record in path_ids:
            cycles += 1
            break
        path_ids.add(record)
        record = links[record]
    done.update(path_ids)
if cycles:
    report["issues"]["history_cycles"] = cycles
db.close()
print(json.dumps(report, indent=2))
sys.exit(1 if report["issues"] or report["integrity"] != ["ok"] else 0)
