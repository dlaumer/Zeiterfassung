// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-submission-order.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-order-'));
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
try {
    for (let i = 0; i < 80; i++) {
        try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    token = (await request('/api/collections/_superusers/auth-with-password', { identity: 'test@example.test', password })).token;
    // Exercise the referenceDate path even with legacy migrations that omit it.
    const schema = await request('/api/collections/participants');
    if (!schema.fields.some(field => field.name === 'referenceDate')) {
        await request('/api/collections/participants', { fields: [...schema.fields, { name: 'referenceDate', type: 'date' }] }, 'PATCH');
    }
    for (const mode of ['day', 'week']) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (start.getDay() + 6) % 7 - 7);
        const later = new Date(start);
        later.setDate(later.getDate() + (mode === 'day' ? 1 : 7));
        const participant = await create('participants', { name: 'Order test', email: mode + '@example.test', entryMode: mode, type: mode === 'day' ? 'student' : 'faculty', referenceDate: dateKey(start) + ' 00:00:00.000Z' });
        const route = '/api/submissions/' + (mode === 'day' ? 'daily' : 'weekly');
        const payload = { participantId: participant.id, reliability: 4, inputMode: 'totals', expectedSubmissionId: '', subjectTimes: [], categoryTimes: [] };
        const dateField = mode === 'day' ? 'date' : 'weekStart';
        const blocked = await request(route, { ...payload, [dateField]: dateKey(later) }, 'POST', 400);
        assert.match(blocked.details, /Earlier entries must be completed first/);
        const first = await request(route, { ...payload, [dateField]: dateKey(start) });
        assert.equal(first.submissionMode, 'initial');
        // A zero-work submission fills the period and unlocks the next one.
        const second = await request(route, { ...payload, [dateField]: dateKey(later) });
        assert.equal(second.submissionMode, 'initial');
        // Corrections remain possible after an earlier entry is deleted.
        await request(route, { participantId: participant.id, [dateField]: dateKey(start), expectedSubmissionId: first.submissionId }, 'DELETE');
        const correction = await request(route, { ...payload, [dateField]: dateKey(later), expectedSubmissionId: second.submissionId, comment: 'Correction' });
        assert.equal(correction.submissionMode, 'correction');
        const next = new Date(later);
        next.setDate(next.getDate() + (mode === 'day' ? 1 : 7));
        await request(route, { ...payload, [dateField]: dateKey(next) }, 'POST', 400);
        await request(route, { ...payload, [dateField]: dateKey(start) });
    }
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const friday = new Date(monday);
    friday.setDate(friday.getDate() - 3);
    const weekendParticipant = await create('participants', { name: 'Weekend test', email: 'weekend@example.test', entryMode: 'day', type: 'student', referenceDate: dateKey(friday) });
    const daily = { participantId: weekendParticipant.id, reliability: 4, subjectTimes: [], inputMode: 'totals', expectedSubmissionId: '' };
    await request('/api/submissions/daily', { ...daily, date: dateKey(monday) }, 'POST', 400);
    await request('/api/submissions/daily', { ...daily, date: dateKey(friday) });
    await request('/api/submissions/daily', { ...daily, date: dateKey(monday) });
    const legacy = await create('participants', { name: 'Legacy fallback test', email: 'legacy@example.test', entryMode: 'day', type: 'student' });
    await request('/api/submissions/daily', { ...daily, participantId: legacy.id, date: dateKey(new Date()) }, 'POST', 400);
    console.log('Submission order integration tests passed.');

} catch (error) {
 console.error(log);
 throw error;
} finally {
 server.kill();
}
