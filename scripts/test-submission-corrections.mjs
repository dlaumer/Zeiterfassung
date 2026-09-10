// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-submission-corrections.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-corrections-'));
const migrations = join(root, 'Backend', 'pb_migrations');
const hooks = join(root, 'Backend', 'pb_hooks');
const password = 'disposable-integration-test-9284!';
execFileSync(binary, ['migrate', 'up', '--dir', dir, '--migrationsDir', migrations], { windowsHide: true });
execFileSync(binary, ['superuser', 'upsert', 'test@example.test', password, '--dir', dir], { windowsHide: true });
const portProbe = createServer();
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const server = spawn(binary, ['serve', '--http', `127.0.0.1:${port}`, '--dir', dir, '--hooksDir', hooks, '--migrationsDir', migrations], { windowsHide: true, stdio: 'pipe' });
let log = '';
server.stdout.on('data', chunk => { log += chunk; });
server.stderr.on('data', chunk => { log += chunk; });
let token = '';
async function request(path, body, method = body ? 'POST' : 'GET', expectedStatus = 200) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: token }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    assert.equal(response.status, expectedStatus, `${method} ${path}: ${text}`);
    try { return JSON.parse(text); } catch { return text; }
}
const create = (collection, data) => request(`/api/collections/${collection}/records`, data);
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); };
try {
    for (let i = 0; i < 80; i++) {
        try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    token = (await request('/api/collections/_superusers/auth-with-password', { identity: 'test@example.test', password })).token;
    const participant = await create('participants', { name: 'Correction test', email: 'student@example.test', entryMode: 'day', type: 'student', referenceDate: `${daysAgo(20)} 00:00:00.000Z` });
    const subject = await create('subjects', { key: 'test', label_en: 'Test module', label_de: 'Testmodul', entryMode: 'day' });
    await create('participant_subjects', { participant: participant.id, subject: subject.id });
    const payload = { inputMode: 'totals', expectedSubmissionId: '', participantId: participant.id, date: daysAgo(0), reliability: 4, socialBattery: 3, adminEffortMinutes: 60, commuteMinutes: 30, comment: 'original', subjectTimes: [{ subjectId: subject.id, classMinutes: 480, studyMinutes: 60 }] };
    const initial = await request('/api/submissions/daily', payload);
    assert.equal(initial.submissionMode, 'initial');
    const original = await request(`/api/collections/submissions/records/${initial.submissionId}`);
    // An old appendum adds subject time, but stores ancillary time as a total.
    const legacy = await create('submissions', { participant: participant.id, periodType: 'day', periodStart: original.periodStart, periodEnd: original.periodEnd, submissionMode: 'appendum', submittedAt: new Date().toISOString(), generalAdminTime: 90, commuteTime: 45, dataRating: 4, socialBattery: 3, comment: 'legacy', replacesSubmission: initial.submissionId });
    await create('submission_items', { submission: legacy.id, workloadType: subject.id, type: 'class', durationMinutes: 120 });
    let history = await request(`/api/workload-status?participantId=${participant.id}`);
    assert.equal(history.reviewTime, 14);
    assert.equal(history.submissionHistory[0].subjects[0].classTime, 10);
    assert.equal(history.submissionHistory[0].generalAdminTime, 90);
    const corrected = { ...payload, expectedSubmissionId: legacy.id, adminEffortMinutes: 30, commuteMinutes: 0, comment: '', subjectTimes: [{ subjectId: subject.id, classMinutes: 300, studyMinutes: 0 }] };
    for (const ratings of [{ reliability: 0 }, { reliability: undefined }, { socialBattery: 0 }, { socialBattery: undefined }]) {
        await request('/api/submissions/daily', { ...corrected, ...ratings }, 'POST', 400);
    }
    const correction = await request('/api/submissions/daily', corrected);
    assert.equal(correction.submissionMode, 'correction');
    const record = await request(`/api/collections/submissions/records/${correction.submissionId}`);
    assert.equal(record.generalAdminTime, -60);
    assert.equal(record.commuteTime, -45);
    assert.equal(record.replacesSubmission, legacy.id);
    const items = await request(`/api/collections/submission_items/records?filter=${encodeURIComponent(`submission="${record.id}"`)}`);
    assert.deepEqual(items.items.map(item => item.durationMinutes).sort((a, b) => a - b), [-300, -60]);
    history = await request(`/api/workload-status?participantId=${participant.id}`);
    assert.equal(history.submissionHistory[0].subjects[0].classTime, 5);
    assert.equal(history.submissionHistory[0].subjects[0].selfStudyTime, 0);
    assert.equal(history.submissionHistory[0].generalAdminTime, 30);
    assert.equal(history.submissionHistory[0].commuteTime, 0);
    assert.equal(history.submissionHistory[0].comment, '');
    assert.equal(history.submissionHistory[0].correctionDates.length, 2);
    assert.equal(history.submissionHistory[0].initialSubmittedAt, initial.submittedAt);
    await request('/api/submissions/daily', corrected, 'POST', 400); // stale form
    const increase = await request('/api/submissions/daily', { ...corrected, expectedSubmissionId: correction.submissionId, subjectTimes: [{ subjectId: subject.id, classMinutes: 360, studyMinutes: 0 }] });
    history = await request(`/api/workload-status?participantId=${participant.id}`);
    assert.equal(history.submissionHistory[0].subjects[0].classTime, 6);
    assert.equal(history.submissionHistory[0].latestSubmissionId, increase.submissionId);
    // Boundary day remains editable; the preceding day remains viewable only.
    for (const [age, status] of [[14, 200], [15, 400]]) {
        const first = await request('/api/submissions/daily', { ...payload, date: daysAgo(age) });
        await request('/api/submissions/daily', { ...payload, date: daysAgo(age), expectedSubmissionId: first.submissionId, comment: 'review' }, 'POST', status);
        if (age === 15) {
            await request('/api/submissions/daily', { participantId: participant.id, date: daysAgo(age), expectedSubmissionId: first.submissionId }, 'DELETE');
            const replacement = await request('/api/submissions/daily', { ...payload, date: daysAgo(age) });
            assert.equal(replacement.submissionMode, 'initial');
        }
    }
    // A changed admin setting applies immediately, without restarting the server.
    const settings = await request('/api/collections/adminSettings/records');
    const setting = settings.items.find(s => s.key === 'reviewTime');
    await request(`/api/collections/adminSettings/records/${setting.id}`, { value: '0' }, 'PATCH');
    const yesterday = await request('/api/submissions/daily', { ...payload, date: daysAgo(1) });
    await request('/api/submissions/daily', { ...payload, date: daysAgo(1), expectedSubmissionId: yesterday.submissionId }, 'POST', 400);
    await request(`/api/collections/adminSettings/records/${setting.id}`, { value: '14' }, 'PATCH');
    // Clean export uses calculated totals; flat export still contains the signed deltas.
    await create('admins', { email: 'admin@example.test', password, passwordConfirm: password });
    const superuserToken = token;
    token = (await request('/api/collections/admins/auth-with-password', { identity: 'admin@example.test', password })).token;
    assert.equal((await request('/api/admin/settings')).reviewTime, 14);
    await request('/api/admin/settings', { reviewTime: 21 }, 'PATCH');
    assert.equal((await request('/api/admin/settings')).reviewTime, 21);
    assert.equal((await request(`/api/workload-status?participantId=${participant.id}`)).reviewTime, 21);
    for (const reviewTime of [-1, 1.5, '', null, 36501]) {
        await request('/api/admin/settings', { reviewTime }, 'PATCH', 400);
    }
    await request('/api/admin/settings', { reviewTime: 14 }, 'PATCH');
    const adminToken = token;
    token = '';
    await request('/api/admin/settings', undefined, 'GET', 401);
    await request('/api/admin/settings', { reviewTime: 30 }, 'PATCH', 401);
    token = adminToken;
    const csv = await request(`/api/export-student-clean?participantId=${participant.id}`);
    const csvLines = csv.trim().split('\n').map(line => line.split(','));
    const headers = csvLines.shift();
    const today = csvLines.find(row => row[headers.indexOf('periodStart')].includes(payload.date));
    assert.ok(today, 'Clean export includes the corrected day');
    assert.equal(today[headers.indexOf('U_test_0')], '6');
    assert.equal(today[headers.indexOf('S_test_0')], '0');
    assert.equal(today[headers.indexOf('adminEffort_hours')], '0.5');
    assert.equal(today[headers.indexOf('appendumSubmissionIds')], legacy.id);
    assert.ok(today[headers.indexOf('correctionSubmissionIds')].includes(correction.submissionId));
    token = superuserToken;
    const beforeDelete = await request(`/api/collections/submissions/records?filter=${encodeURIComponent(`participant="${participant.id}"`)}`);
    await request('/api/submissions/daily', { participantId: participant.id, date: payload.date, expectedSubmissionId: increase.submissionId }, 'DELETE');
    const afterDelete = await request(`/api/collections/submissions/records?filter=${encodeURIComponent(`participant="${participant.id}"`)}`);
    assert.equal(afterDelete.totalItems, beforeDelete.totalItems + 1);
    history = await request(`/api/workload-status?participantId=${participant.id}`);
    assert.ok(!history.submissionHistory.some(entry => entry.periodDate === payload.date));
    const recreated = await request('/api/submissions/daily', payload);
    assert.equal(recreated.submissionMode, 'initial');
    // Weekly faculty categories use the same delta semantics.
    const faculty = await create('participants', { name: 'Weekly test', email: 'faculty@example.test', entryMode: 'week', type: 'faculty' });
    const week = new Date(); week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
    const weekly = { inputMode: 'totals', expectedSubmissionId: '', participantId: faculty.id, weekStart: dateKey(week), reliability: 4, socialBattery: 4, adminEffortMinutes: 60, structuralChangesMinutes: 90, categoryTimes: [{ categoryId: 'weekly_preparation', minutes: 600 }] };
    const firstWeek = await request('/api/submissions/weekly', weekly);
    for (const ratings of [{ reliability: 0 }, { socialBattery: 0 }]) {
        await request('/api/submissions/weekly', { ...weekly, expectedSubmissionId: firstWeek.submissionId, ...ratings }, 'POST', 400);
    }
    const secondWeek = await request('/api/submissions/weekly', { ...weekly, expectedSubmissionId: firstWeek.submissionId, categoryTimes: [{ categoryId: 'weekly_preparation', minutes: 300 }], adminEffortMinutes: 30, structuralChangesMinutes: 60 });
    history = await request(`/api/workload-status?participantId=${faculty.id}`);
    assert.equal(history.submissionHistory[0].subjects[0].classTime, 5);
    assert.equal(history.submissionHistory[0].structuralChanges, 60);
    await request('/api/submissions/weekly', { participantId: faculty.id, weekStart: weekly.weekStart, expectedSubmissionId: secondWeek.submissionId }, 'DELETE');
    week.setDate(week.getDate() - 28);
    const oldWeekly = { ...weekly, weekStart: dateKey(week) };
    const lockedWeek = await request('/api/submissions/weekly', oldWeekly);
    await request('/api/submissions/weekly', { ...oldWeekly, expectedSubmissionId: lockedWeek.submissionId }, 'POST', 400);
    await request('/api/submissions/weekly', { participantId: faculty.id, weekStart: oldWeekly.weekStart, expectedSubmissionId: lockedWeek.submissionId }, 'DELETE');
    assert.equal((await request('/api/submissions/weekly', oldWeekly)).submissionMode, 'initial');
    console.log('PASS: legacy increments, negative/positive corrections, totals/history, stale saves, review boundary/settings, export, deletion/recreation and weekly entries.');
} catch (error) {
    console.error(log.slice(-4000));
    throw error;
} finally {
    server.kill();
}
