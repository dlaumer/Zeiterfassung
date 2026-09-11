// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-participant-status.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-participant-status-'));
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
    const subjects = await Promise.all(['one', 'two'].map(key => create('subjects', { key, label_en: key, label_de: key, entryMode: 'day' })));
    for (const type of ['student', 'faculty']) {
        const profile = { name: `${type} status test`, email: `${type}@example.test`, comment: 'Keep profile', entryMode: 'day', type, role: type === 'faculty' ? 'professor' : '', referenceDate: daysAgo(20), subjectId: type === 'faculty' ? subjects[0].id : '' };
        const participant = await create('participants', profile);
        const assigned = type === 'faculty' ? subjects.slice(0, 1) : subjects;
        const enrollments = await Promise.all(assigned.map(subject => create('participant_subjects', { participant: participant.id, subject: subject.id })));
        const submission = await create('submissions', { participant: participant.id, periodType: 'day', periodStart: `${daysAgo(0)} 00:00:00.000Z`, periodEnd: `${daysAgo(0)} 00:00:00.000Z`, submittedAt: new Date().toISOString(), submissionMode: 'initial', comment: 'Keep history' });
        const item = await create('submission_items', { submission: submission.id, workloadType: subjects[0].id, type: 'class', durationMinutes: 60 });
        for (const inactive of [true, false]) {
            await request(`/api/admin/participant?participantId=${participant.id}`, { ...profile, inactive }, 'PATCH');
            const saved = await request(`/api/collections/participants/records/${participant.id}`);
            assert.equal(saved.inactive, inactive);
            assert.equal(saved.name, profile.name);
            const current = await request(`/api/collections/participant_subjects/records?filter=${encodeURIComponent(`participant="${participant.id}"`)}`);
            assert.deepEqual(current.items.sort((a, b) => a.id.localeCompare(b.id)), [...enrollments].sort((a, b) => a.id.localeCompare(b.id)), `${type}: enrollment records must remain unchanged`);
            assert.deepEqual(await request(`/api/collections/submissions/records/${submission.id}`), submission);
            assert.deepEqual(await request(`/api/collections/submission_items/records/${item.id}`), item);
            const overview = await request('/api/admin/overview');
            assert.equal(overview.participants.find(person => person.id === participant.id).inactive, inactive);
        }
        if (type === 'faculty') {
            await request(`/api/admin/participant?participantId=${participant.id}`, { ...profile, subjectId: subjects[1].id, inactive: false }, 'PATCH');
            const current = await request(`/api/collections/participant_subjects/records?filter=${encodeURIComponent(`participant="${participant.id}"`)}`);
            assert.deepEqual(current.items.map(enrollment => enrollment.subject), [subjects[1].id]);
            assert.deepEqual(await request(`/api/collections/submissions/records/${submission.id}`), submission);
        }
    }
    console.log('PASS: student and faculty activation toggles preserve enrollments and history; faculty module changes still work.');
} catch (error) {
    console.error(log.slice(-4000));
    throw error;
} finally {
    server.kill();
}



