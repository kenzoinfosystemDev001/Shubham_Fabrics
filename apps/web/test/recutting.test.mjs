// Recutting allocation, cut and Stitching-issue rules (apps/web/src/lib/recutting.mjs).
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { maxConverted, validateAllocationRows, validateCut, validateStitchingLines } from '../src/lib/recutting.mjs';

const line = (overrides = {}) => ({ status: 'RECEIVED', uom: 'MTR', expectedQuantity: 10, receivedQuantity: 10, heldQuantity: 0, ...overrides });
const row = (overrides = {}) => ({ category: 'TOP', allocatedQuantity: 10, cutUom: 'PCS', cutQuantity: 0, ...overrides });

test('conversion bounds: meters to pieces and pieces to meters are limited', () => {
  assert.equal(maxConverted(10, 'MTR', 'PCS'), 500);
  assert.equal(maxConverted(5, 'PCS', 'MTR'), 50);
  assert.equal(maxConverted(7, 'MTR', 'MTR'), 7);
});

test('allocation: cutting 10 MTR into 999,999 PCS is refused', () => {
  const result = validateAllocationRows(line(), [], [row({ cutQuantity: 999999 })]);
  assert.equal(result.ok, false);
});

test('allocation: a realistic cut of 10 MTR into 40 PCS is accepted', () => {
  const result = validateAllocationRows(line(), [], [row({ cutQuantity: 40 })]);
  assert.equal(result.ok, true, result.error);
});

test('allocation: cut in the same unit cannot exceed the allocation', () => {
  assert.equal(validateAllocationRows(line(), [], [row({ cutUom: 'MTR', cutQuantity: 11 })]).ok, false);
});

test('cut update: bounded across units, as on allocation', () => {
  const allocation = { status: 'ALLOCATED', allocatedQuantity: 10, allocatedUom: 'MTR', cutUom: 'PCS', transferredQuantity: 0 };
  assert.equal(validateCut(allocation, 999999).ok, false);
  assert.equal(validateCut(allocation, 500).ok, true);
});

test('stitching issue: 5 PCS cut cannot leave as 50,000 MTR', () => {
  const allocation = {
    id: 'a1',
    allocationNumber: 'ALC-1',
    status: 'CUT',
    cutUom: 'PCS',
    cutQuantity: 5,
    transferredQuantity: 0,
    workItem: { departmentCode: 'RECUTTING', programId: 'p1', inboundChallanId: 'c1' },
  };
  const byId = new Map([['a1', allocation]]);
  assert.equal(validateStitchingLines([{ allocationId: 'a1', quantity: 50000, uom: 'MTR' }], byId).ok, false);
  assert.equal(validateStitchingLines([{ allocationId: 'a1', quantity: 12, uom: 'MTR' }], byId).ok, true);
  assert.equal(validateStitchingLines([{ allocationId: 'a1', quantity: 5 }], byId).ok, true);
  assert.equal(validateStitchingLines([{ allocationId: 'a1', quantity: 6 }], byId).ok, false);
});

test('cancel: refused once pieces are cut, allowed when nothing was cut', async () => {
  const { validateCancel } = await import('../src/lib/recutting.mjs');
  const base = { status: 'ALLOCATED', transferredQuantity: 0, cutUom: 'PCS' };
  assert.equal(validateCancel({ ...base, cutQuantity: 20 }, 'wrong style').ok, false);
  assert.equal(validateCancel({ ...base, cutQuantity: 0 }, 'wrong style').ok, true);
  assert.equal(validateCancel({ ...base, cutQuantity: 0 }, '').ok, false);
});
