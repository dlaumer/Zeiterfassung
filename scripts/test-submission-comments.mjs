import assert from 'node:assert/strict';
import { loadHook } from './lib/load-hook.mjs';
const review = loadHook('submission-review.js');
for (const periodType of ['day', 'week']) {
const record = (id, mode, comment) => ({ id, get: key => ({ submissionMode: mode, submittedAt: id, comment, periodType })[key] });
    const original = record('1', 'initial', 'Original comment');
    const app = { findRecordsByFilter: () => [] };
    let group = [original];
    const save = comment => {
        const latest = group.at(-1);
        const changes = review.prepare(app, group, { inputMode: 'totals', expectedSubmissionId: latest.id, comment }, '', true);
        const correction = record(String(group.length + 1), 'correction', changes.comment);
        group.push(correction);
        return correction.get('comment');
    };
    assert.equal(review.fieldValue(group, 'comment', ''), 'Original comment');
    assert.equal(save('Original comment'), '');
    assert.equal(review.fieldValue(group, 'comment', ''), 'Original comment');
    assert.equal(save('Updated comment'), 'Updated comment');
    assert.equal(save('Updated comment'), '');
    assert.equal(save('   '), '');
    assert.equal(review.fieldValue(group, 'comment', ''), 'Updated comment');
    assert.equal(save('Original comment'), 'Original comment');
    assert.equal(review.fieldValue(group, 'comment', ''), 'Original comment');
    assert.equal(review.fieldValue([record('1', 'initial', ''), record('2', 'correction', '  ')], 'comment', ''), '');
    assert.equal(review.prepare(app, [], { inputMode: 'totals', comment: ' First ' }, '', true).comment, 'First');
}
console.log('PASS: daily and weekly comments, unchanged corrections, edits, blanks and latest non-empty fallback');
