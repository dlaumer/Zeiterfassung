import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { runGroupActions } from '../src/admin/groupActions.mjs';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

const items = ['a', 'b', 'c'].map(id => ({ id, name: id }));
let active = 0;
let maxActive = 0;
let pauses = 0;
const attempts = [];
const progress = [];
const results = await runGroupActions(items, async item => {
    active++;
    maxActive = Math.max(maxActive, active);
    attempts.push(item.id);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    if (item.id === 'b') throw new Error('Unconfirmed send');
}, state => progress.push(state.completed), async () => { pauses++; });
assert.equal(maxActive, 1);
assert.deepEqual(attempts, ['a', 'b', 'c']);
assert.equal(pauses, 2);
assert.deepEqual(results.map(result => result.ok), [true, false, true]);
assert.deepEqual(progress, [0, 1, 1, 2, 2, 3]);
const archive = unzipSync(zipSync({ 'a.csv': strToU8('name,time\na,12'), 'b.csv': strToU8('name,time\nb,13') }, { level: 0 }));
assert.equal(strFromU8(archive['b.csv']), 'name,time\nb,13');

// Run the real mail hooks with a fake provider. No network or real credentials.
const routes = {};
let providerStatus = 200;
const sent = [];
const logs = [];
class Record {
    values = {};
    set(key, value) { this.values[key] = value; }
}
vm.runInNewContext(readFileSync(new URL('../Backend/pb_hooks/admin-reminders.pb.js', import.meta.url), 'utf8'), {
    routerAdd: (method, path, handler) => { routes[path] = handler; },
    $apis: { requireAuth: () => {} },
    __hooks: '/unused', toString: value => String(value), Record,
    console: { error() {} },
    $os: { readFile() { throw new Error('No config file'); }, getenv: key => ({ RESEND_API_KEY: 'fake', RESEND_SENDER_ADDRESS: 'test@example.test', PB_PUBLIC_APP_URL: 'https://example.test' }[key] || '') },
    $app: {
        findRecordById: () => ({ get: key => ({ name: 'Test Person', email: 'person@example.test', type: 'student' }[key] || '') }),
        findCollectionByNameOrId: () => ({}),
        save: record => logs.push(record.values),
    },
    $http: { send: request => { sent.push(request); return { statusCode: providerStatus, body: '{}' }; } },
});
for (const action of ['reminder', 'invitation']) {
    const event = { requestInfo: () => ({ body: { participantId: 'person1', operationId: 'operation-123' } }), json: (status, body) => ({ status, body }) };
    const before = logs.length;
    providerStatus = 429;
    assert.equal(routes[`/api/admin/participant/${action}`](event).status, 500);
    assert.equal(logs.length, before, 'Failed sends must not be logged as successful');
    providerStatus = 200;
    assert.equal(routes[`/api/admin/participant/${action}`](event).status, 200);
    assert.equal(logs.length, before + 1);
    assert.equal(sent.at(-1).headers['Idempotency-Key'], `${action}-person1-operation-123`);
    assert.deepEqual(JSON.parse(sent.at(-1).body).to, ['person@example.test']);
}
console.log('PASS: sequential processing, pacing, failure isolation, ZIP contents, and mail success logging.');
