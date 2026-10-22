import assert from 'node:assert/strict';
import test from 'node:test';
import {
  availableAcceptedQuantity,
  inspectionPassed,
  parseWholeNumber,
  validateHandoverQuantity,
  validateInspectionQuantities,
} from '../apps/web/src/lib/final-check-rules.mjs';

test('accepts a complete, reconciled inspection', () => {
  assert.deepEqual(
    validateInspectionQuantities({
      inputQuantity: 120,
      acceptedQuantity: 112,
      reworkQuantity: 5,
      rejectedQuantity: 3,
      pendingQuantity: 0,
    }),
    { input: 120, accepted: 112, rework: 5, rejected: 3, pending: 0 },
  );
});

test('rejects malformed, negative, decimal, and unsafe piece counts', () => {
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 'abc', '', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseWholeNumber(value, 'quantity'), /whole number/);
  }
});

test('rejects unreconciled inspection outcomes', () => {
  assert.throws(
    () => validateInspectionQuantities({
      inputQuantity: 120,
      acceptedQuantity: 112,
      reworkQuantity: 5,
      rejectedQuantity: 2,
      pendingQuantity: 0,
    }),
    /must total 120/,
  );
});

test('pending pieces remain distinct from accepted and rejected outcomes', () => {
  assert.deepEqual(
    validateInspectionQuantities({
      inputQuantity: 120,
      acceptedQuantity: 95,
      reworkQuantity: 5,
      rejectedQuantity: 0,
      pendingQuantity: 20,
    }),
    { input: 120, accepted: 95, rework: 5, rejected: 0, pending: 20 },
  );
});

test('only passing, complete checkpoints produce a pass decision', () => {
  assert.equal(inspectionPassed(['PASS', 'PASS', 'PASS'], 'PASS'), true);
  assert.equal(inspectionPassed(['PASS', 'FAIL', 'PASS'], 'PASS'), false);
  assert.equal(inspectionPassed(['PASS', 'PASS', 'PASS'], 'FAIL'), false);
});

test('handover is capped at accepted quantity not previously transferred', () => {
  assert.equal(availableAcceptedQuantity(112, 20), 92);
  assert.equal(validateHandoverQuantity(92, 92), 92);
  assert.throws(() => validateHandoverQuantity(93, 92), /only 92 accepted pieces remain/);
  assert.throws(() => validateHandoverQuantity(0, 92), /greater than zero/);
});
