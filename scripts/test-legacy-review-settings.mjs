import assert from 'node:assert/strict';
import { loadHook } from './lib/load-hook.mjs';
const review = loadHook('submission-review.js');
const fields = { key: 'reviewTime', value: '14' };
const record = { get: key => fields[key], set: (key, value) => { fields[key] = value; } };
let saves = 0;
const app = {
  findFirstRecordByFilter: (_, filter) => {
    if (filter === `key = "${fields.key}"`) return record;
    throw new Error('No rows');
  },
  save: value => { assert.equal(value, record); saves++; },
};
assert.equal(review.settings(app, new Date('2026-10-30T12:00:00')).reviewTimeWeeks, 2);
assert.deepEqual(fields, { key: 'reviewTimeWeeks', value: '2' });
assert.equal(saves, 1);
fields.value = '6';
assert.equal(review.settings(app).reviewTimeWeeks, 6);
assert.equal(saves, 1, 'Existing dashboard settings remain unchanged');
fields.value = 'invalid';
assert.throws(() => review.settings(app), /Invalid/);
assert.throws(() => review.settings({ findFirstRecordByFilter: () => { throw new Error('Database unavailable'); } }), /Database unavailable/);
console.log('PASS: legacy review settings recover once, preserve current settings, and surface invalid/missing configuration');
