import assert from 'node:assert/strict';
import { needsClassTimeConfirmation, getClassTimeWarnings } from '../src/app/components/classTimeConfirmation.mjs';

const savedTime = 3 + 25 / 60;
assert.equal(needsClassTimeConfirmation(savedTime, savedTime), false, 'Rating-only correction keeps saved 3:25 without confirmation');
assert.equal(needsClassTimeConfirmation(savedTime, undefined), true, 'New fractional entry requires confirmation');
assert.equal(needsClassTimeConfirmation(3.5, savedTime), true, 'Changed fractional time requires confirmation');
assert.equal(needsClassTimeConfirmation(3.5, savedTime, 3.5), false, 'Confirmed new value can be saved');
assert.equal(needsClassTimeConfirmation(3.75, savedTime, 3.5), true, 'Another change requires a new confirmation');
assert.equal(needsClassTimeConfirmation(savedTime, savedTime, 3.5), false, 'Returning to the saved value needs no confirmation');
assert.equal(needsClassTimeConfirmation(4, savedTime), false, 'Whole hours need no confirmation');
assert.equal(needsClassTimeConfirmation(0, savedTime), false, 'Zero hours need no confirmation');
console.log('Class time confirmation tests passed.');

const weekend = { date: new Date(2026, 9, 3), entryMode: 'day', participantRole: 'student', subjectKey: 'math' };
const warning = 'subject.weekendContactTimeWarning.student';
assert.deepEqual(getClassTimeWarnings(3, undefined, undefined, weekend), [warning]);
assert.deepEqual(getClassTimeWarnings(3, 3, undefined, weekend), []);
assert.deepEqual(getClassTimeWarnings(3, undefined, 3, weekend), []);
assert.deepEqual(getClassTimeWarnings(0, undefined, undefined, weekend), []);
assert.deepEqual(getClassTimeWarnings(3.5, 3, undefined, weekend), ['subject.fractionalClassTimeWarning', warning]);
assert.deepEqual(getClassTimeWarnings(3, undefined, undefined, { ...weekend, date: new Date(2026, 9, 4) }), [warning]);
assert.deepEqual(getClassTimeWarnings(3, undefined, undefined, { ...weekend, date: new Date(2026, 9, 5) }), []);
assert.deepEqual(getClassTimeWarnings(3, undefined, undefined, { ...weekend, entryMode: 'week' }), []);
assert.deepEqual(getClassTimeWarnings(3, undefined, undefined, { ...weekend, participantRole: 'faculty', subjectKey: 'weekly_contact_time' }), ['subject.weekendContactTimeWarning.faculty']);
assert.deepEqual(getClassTimeWarnings(3.5, undefined, undefined, { ...weekend, participantRole: 'faculty', subjectKey: 'weekly_preparation' }), []);
console.log('Weekend contact time confirmation tests passed.');
