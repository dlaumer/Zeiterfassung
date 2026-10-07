import assert from 'node:assert/strict';
import { matchesEventSearch } from '../src/admin/eventSearch.mjs';

const subjects = [{ id: 'module-id', number: '101', key: 'math', labelEn: 'Applied Mathematics', labelDe: 'Angewandte Mathematik' }];
const event = {
  participantName: 'Ada Lovelace',
  comment: 'Reviewed exercises',
  items: [{ subjectId: 'module-id', subjectKey: 'math', subjectLabelEn: 'Applied Mathematics', subjectLabelDe: 'Angewandte Mathematik' }],
};
for (const query of ['', '  ', '101', ' APPLIED mathematics ', 'Mathematik', '101 Applied Mathematics', 'Ada 101', 'math', 'exercises']) {
  assert.equal(matchesEventSearch(event, query, subjects), true, query);
}
for (const query of ['Physics', '101 Physics', 'Grace 101']) {
  assert.equal(matchesEventSearch(event, query, subjects), false, query);
}
assert.equal(matchesEventSearch({ items: [] }, '101', subjects), false);
assert.equal(matchesEventSearch(event, 'Applied Mathematics'), true);
assert.equal(matchesEventSearch({ items: [{ subjectNumber: '202', subjectLabelEn: 'Removed Module' }] }, '202 removed'), true);
const participants = [
  { id: 'faculty-id', participantRole: 'faculty', subjects },
  { id: 'student-id', participantRole: 'student', subjects },
  { id: 'other-faculty', participantRole: 'faculty', subjects: [{ id: 'physics-id', labelEn: 'Physics' }] },
];
const facultyEvent = { participantId: 'faculty-id', participantRole: 'faculty', items: [{ subjectKey: 'weekly_contact_time', subjectLabelEn: 'Contact time' }] };
for (const query of ['Applied Mathematics', 'Angewandte Mathematik', '101 Applied', 'math']) {
  assert.equal(matchesEventSearch(facultyEvent, query, subjects, participants), true, query);
}
assert.equal(matchesEventSearch({ participantId: 'faculty-id', items: [] }, 'Applied Mathematics', subjects, participants), true, 'Faculty events without module items match their assigned module');
assert.equal(matchesEventSearch(facultyEvent, 'Physics', subjects, participants), false);
assert.equal(matchesEventSearch({ participantId: 'other-faculty', participantRole: 'faculty', items: [] }, 'Applied Mathematics', subjects, participants), false);
assert.equal(matchesEventSearch({ participantId: 'student-id', participantRole: 'student', items: [] }, 'Applied Mathematics', subjects, participants), false, 'Student enrollment alone does not imply activity for that module');
assert.equal(matchesEventSearch({ participantId: 'missing', participantRole: 'faculty', items: [] }, 'Applied Mathematics', subjects, participants), false);
console.log('Admin event search tests passed, including faculty module matching.');
