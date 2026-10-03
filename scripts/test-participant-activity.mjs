// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-participant-activity.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-participant-activity-'));
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
let adminToken = '';
async function request(path, body, method = body ? 'POST' : 'GET', expectedStatus = 200) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: path.startsWith('/api/admin/') ? adminToken : token }, ...(body ? { body: JSON.stringify(body) } : {}) });
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
    await create('admins', { email: 'admin@example.test', password, passwordConfirm: password });
    adminToken = (await request('/api/collections/admins/auth-with-password', { identity: 'admin@example.test', password })).token;
    const person = await create('participants', { name: 'Activity Test', email: 'activity@example.test', type: 'student', entryMode: 'day' });
    const empty = (await request('/api/admin/overview')).participants.find(p => p.id === person.id);
    assert.equal(empty.lastReminderAt, '');
    assert.equal(empty.lastSubmissionAt, '');
    assert.equal(empty.lastPeriodStart, '');
    const submit = (period, time, mode = 'initial') => create('submissions', { participant: person.id, periodType: 'day', periodStart: `${period} 00:00:00.000Z`, periodEnd: `${period} 00:00:00.000Z`, submittedAt: time, submissionMode: mode });
    await submit('2026-09-28', '2026-09-28 12:25:00.000Z');
    const latestPeriod = await submit('2026-09-29', '2026-09-29 13:30:00.000Z');
    const correction = await submit('2026-09-28', '2026-10-01 14:45:00.000Z', 'correction');
    const reminder = await create('admin_reminders', { participant: person.id, participantName: person.name, participantEmail: person.email, senderAddress: 'sender@example.test', subject: 'REMINDER Workload Tracking' });
    await create('admin_reminders', { participant: person.id, participantName: person.name, participantEmail: person.email, senderAddress: 'sender@example.test', subject: 'INVITATION Workload Tracking' });
    const result = (await request('/api/admin/overview')).participants.find(p => p.id === person.id);
    assert.equal(result.lastReminderAt, reminder.created);
    assert.equal(result.lastPeriodStart.slice(0, 10), '2026-09-29');
    assert.equal(result.lastPeriodSubmittedAt, latestPeriod.submittedAt);
    assert.equal(result.lastSubmissionAt, correction.submittedAt);
    const weekly = await create('participants', { name: 'Weekly Test', email: 'weekly@example.test', type: 'student', entryMode: 'week' });
    await create('submissions', { participant: weekly.id, periodType: 'week', periodStart: '2026-09-21 00:00:00.000Z', periodEnd: '2026-09-27 00:00:00.000Z', submittedAt: '2026-09-28 09:05:00.000Z', submissionMode: 'initial' });
    const week = (await request('/api/admin/overview')).participants.find(p => p.id === weekly.id);
    assert.equal(week.lastPeriodType, 'week');
    assert.equal(week.lastPeriodEnd.slice(0, 10), '2026-09-27');
    console.log('PASS: reminder, latest period and latest submission are independent; weekly ranges and empty values are preserved.');
} catch (error) {
    console.error(log.slice(-4000));
    throw error;
} finally {
    server.kill();
}








