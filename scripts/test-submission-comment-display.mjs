import assert from 'node:assert/strict';
import { latestNonEmptyComment } from '../src/app/submissionComments.mjs';
// Reopening immediately after a correction that did not change the comment.
let displayed = latestNonEmptyComment('', 'Original comment');
assert.equal(displayed, 'Original comment');
displayed = latestNonEmptyComment('', displayed);
assert.equal(displayed, 'Original comment');
displayed = latestNonEmptyComment('Updated comment', displayed);
assert.equal(displayed, 'Updated comment');
assert.equal(latestNonEmptyComment('  ', displayed), 'Updated comment');
// Loading history with an empty newest record falls back through older comments.
assert.equal(latestNonEmptyComment('', '', 'Latest non-empty', 'Original'), 'Latest non-empty');
assert.equal(latestNonEmptyComment(undefined, '', '  '), '');
console.log('PASS: correction panel comment preservation and history fallback');
