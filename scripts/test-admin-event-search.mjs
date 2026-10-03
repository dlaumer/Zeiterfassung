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
console.log('Admin event search tests passed.');
