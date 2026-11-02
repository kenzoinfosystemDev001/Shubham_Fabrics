// Quantity rules of the shared department work-item engine (apps/web/src/lib/work-items.mjs).
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionUpdate, validateWorkUpdate } from '../src/lib/work-items.mjs';

const line = (overrides = {}) => ({
  status: 'IN_PROGRESS',
  uom: 'PCS',
  expectedQuantity: 100,
  receivedQuantity: 100,
  takenQuantity: 0,
  processedQuantity: 0,
  defectQuantity: 0,
  transferredQuantity: 0,
  heldQuantity: 0,
  ...overrides,
});

test('production: defective quantity is subtracted once, so taken - defective can be completed', () => {
  const item = line({ takenQuantity: 100, defectQuantity: 10 });
  const result = validateProductionUpdate(item, { processedQuantity: 90, status: 'COMPLETED' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.processedQuantity, 90);
  assert.equal(result.status, 'COMPLETED');
});

test('production: defective recorded in the same update is subtracted once', () => {
  const item = line({ takenQuantity: 100 });
  const result = validateProductionUpdate(item, { defectQuantity: 10, processedQuantity: 90 });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.defectQuantity, 10);
});

test('production: completing more than taken - defective is refused', () => {
  const item = line({ takenQuantity: 100, defectQuantity: 10 });
  const result = validateProductionUpdate(item, { processedQuantity: 91 });
  assert.equal(result.ok, false);
});

test('production: HOLD on quantity not yet taken in does not reduce what was taken', () => {
  // 100 received, 95 taken (5 left on the rack), 5 on HOLD: the HOLD sits on the 5 not taken in.
  const item = line({ takenQuantity: 95, heldQuantity: 5 });
  const result = validateProductionUpdate(item, { processedQuantity: 95 });
  assert.equal(result.ok, true, result.error);
});

test('production: HOLD beyond the untaken quantity blocks that much of the taken work', () => {
  // All 100 taken in, then 5 put on HOLD: only 95 can be completed.
  const item = line({ takenQuantity: 100, heldQuantity: 5 });
  assert.equal(validateProductionUpdate(item, { processedQuantity: 95 }).ok, true);
  assert.equal(validateProductionUpdate(item, { processedQuantity: 96 }).ok, false);
});

test('production: taking in more than received - HOLD is refused', () => {
  const item = line({ heldQuantity: 10 });
  assert.equal(validateProductionUpdate(item, { takenQuantity: 91 }).ok, false);
  assert.equal(validateProductionUpdate(item, { takenQuantity: 90 }).ok, true);
});

test('production: defective quantity cannot be reduced', () => {
  const item = line({ takenQuantity: 100, defectQuantity: 10 });
  assert.equal(validateProductionUpdate(item, { defectQuantity: 5 }).ok, false);
});

test('process update: defective and HOLD are each subtracted once', () => {
  const item = line({ defectQuantity: 10, heldQuantity: 5 });
  assert.equal(validateWorkUpdate(item, { processedQuantity: 85 }).ok, true);
  assert.equal(validateWorkUpdate(item, { processedQuantity: 86 }).ok, false);
});

test('process update: cannot go below what was already transferred', () => {
  const item = line({ processedQuantity: 50, transferredQuantity: 40, status: 'PARTIALLY_TRANSFERRED' });
  assert.equal(validateWorkUpdate(item, { processedQuantity: 39 }).ok, false);
});

test('production: a line with defects closes as fully transferred once all good pieces are sent', async () => {
  const { statusAfterTransfer } = await import('../src/lib/work-items.mjs');
  const item = line({ takenQuantity: 100, defectQuantity: 10, processedQuantity: 90, status: 'COMPLETED' });
  assert.equal(statusAfterTransfer(item, 90), 'TRANSFERRED');
  assert.equal(statusAfterTransfer(item, 50), 'PARTIALLY_TRANSFERRED');
});

test('receipt: a blank received quantity is an error, never 0', async () => {
  const { parseReceivedQuantity } = await import('../src/lib/work-items.mjs');
  for (const raw of [undefined, null, '', '  ']) {
    assert.equal(parseReceivedQuantity(raw, 100).ok, false, `raw=${JSON.stringify(raw)}`);
  }
  assert.deepEqual(parseReceivedQuantity('0', 100), { ok: true, received: 0 });
});

test('receipt: more than dispatched is refused by default; shortages are accepted', async () => {
  const { parseReceivedQuantity } = await import('../src/lib/work-items.mjs');
  assert.equal(parseReceivedQuantity(120, 100).ok, false);
  assert.deepEqual(parseReceivedQuantity(95.5, 100), { ok: true, received: 95.5 });
  assert.deepEqual(parseReceivedQuantity(120, 100, { allowExcess: true }), { ok: true, received: 120 });
  assert.equal(parseReceivedQuantity(-1, 100).ok, false);
  assert.equal(parseReceivedQuantity('abc', 100).ok, false);
});
