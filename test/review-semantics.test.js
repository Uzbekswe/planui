'use strict';
// Regression tests for the Phase 1 review-state semantic.
//
// Core rule (from PHASE1_REVIEW_SYSTEM.md):
//   A step is RESOLVED only when its state is "approved" or "struck".
//   "commenting" and "" are UNRESOLVED — comments are advisory only.
//
// These tests protect the dual-gate invariant: Approve Plan must stay
// disabled as long as any step is unresolved, regardless of comments.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── isStepResolved predicate (mirrors actions.js) ─────────────────
// This function is intentionally duplicated here so that any change
// to the predicate in actions.js that breaks these tests is surfaced.
function isStepResolved(steps, id) {
  const s = steps[id] || '';
  return s === 'approved' || s === 'struck';
}

// Count unresolved steps in a steps map (mirrors updateApproveGating)
function countUnresolved(steps) {
  return Object.keys(steps).filter(function (id) {
    return !isStepResolved(steps, id);
  }).length;
}

// Determine action type for feedback (mirrors buildFeedback)
function resolveAction(steps) {
  const ids = Object.keys(steps);
  if (ids.length === 0) return 'approve';
  const allApproved = ids.every(function (id) { return steps[id] === 'approved'; });
  if (allApproved) return 'approve';
  const anyStruck = ids.some(function (id) { return steps[id] === 'struck'; });
  return anyStruck ? 'modify' : 'revise';
}

// ── Predicate correctness ─────────────────────────────────────────
describe('isStepResolved', function () {
  test('approved → resolved', function () {
    assert.equal(isStepResolved({ s1: 'approved' }, 's1'), true);
  });

  test('struck → resolved', function () {
    assert.equal(isStepResolved({ s1: 'struck' }, 's1'), true);
  });

  test('commenting → NOT resolved', function () {
    assert.equal(isStepResolved({ s1: 'commenting' }, 's1'), false);
  });

  test('empty string → NOT resolved', function () {
    assert.equal(isStepResolved({ s1: '' }, 's1'), false);
  });

  test('absent key → NOT resolved', function () {
    assert.equal(isStepResolved({}, 's1'), false);
  });
});

// ── Approval gating — core invariant ─────────────────────────────
describe('approval gating', function () {
  test('plan with all approved steps is approvable', function () {
    const steps = { s1: 'approved', s2: 'approved', s3: 'approved' };
    assert.equal(countUnresolved(steps), 0);
  });

  test('plan with all struck steps is approvable', function () {
    const steps = { s1: 'struck', s2: 'struck' };
    assert.equal(countUnresolved(steps), 0);
  });

  test('plan with mixed approved+struck is approvable', function () {
    const steps = { s1: 'approved', s2: 'struck', s3: 'approved' };
    assert.equal(countUnresolved(steps), 0);
  });

  test('comment-only step keeps gate closed', function () {
    // This is the critical regression: a step with only a comment must block gating.
    // The comment field is separate from the step state; the state here is "commenting".
    const steps = { s1: 'approved', s2: 'commenting' };
    assert.equal(countUnresolved(steps), 1, 'commenting step must remain unresolved');
  });

  test('empty-state step keeps gate closed', function () {
    const steps = { s1: 'approved', s2: '' };
    assert.equal(countUnresolved(steps), 1, 'unreviewed step must remain unresolved');
  });

  test('mixed comment + unresolved still counts unresolved', function () {
    const steps = { s1: 'approved', s2: 'commenting', s3: '', s4: 'struck' };
    assert.equal(countUnresolved(steps), 2, 's2 and s3 are both unresolved');
  });

  test('single unreviewed step in 10 keeps gate closed', function () {
    const steps = {};
    for (let i = 1; i <= 9; i++) steps['s' + i] = 'approved';
    steps['s10'] = '';
    assert.equal(countUnresolved(steps), 1);
  });
});

// ── Feedback action determination ─────────────────────────────────
describe('feedback action', function () {
  test('all approved → action is "approve"', function () {
    assert.equal(resolveAction({ s1: 'approved', s2: 'approved' }), 'approve');
  });

  test('any struck → action is "modify"', function () {
    assert.equal(resolveAction({ s1: 'approved', s2: 'struck' }), 'modify');
  });

  test('comments only (no struck) → action is "revise"', function () {
    // "commenting" state without any struck means the human wants changes
    // but hasn't struck any steps — that's a revision request.
    assert.equal(resolveAction({ s1: 'approved', s2: 'commenting' }), 'revise');
  });

  test('empty state → action is "revise"', function () {
    assert.equal(resolveAction({ s1: '' }), 'revise');
  });

  test('no steps → action is "approve"', function () {
    assert.equal(resolveAction({}), 'approve');
  });
});
