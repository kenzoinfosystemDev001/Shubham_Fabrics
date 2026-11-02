// Status changes allowed through the generic challan routes (apps/web/src/lib/challan-transitions.mjs).
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGenericStatusChange } from '../src/lib/challan-transitions.mjs';

const sender = { engineManaged: false, isSender: true, isReceiver: false, isAdmin: false };
const receiver = { engineManaged: false, isSender: false, isReceiver: true, isAdmin: false };
const admin = { engineManaged: false, isSender: false, isReceiver: false, isAdmin: true };

test('receiver can receive an issued challan, but not twice', () => {
  assert.equal(checkGenericStatusChange('ISSUED', 'RECEIVED', receiver).ok, true);
  assert.equal(checkGenericStatusChange('COMPLETED', 'RECEIVED', receiver).ok, false);
  assert.equal(checkGenericStatusChange('ISSUED', 'RECEIVED', sender).ok, false);
});

test('sender can cancel only before receipt, and never an engine-tracked challan', () => {
  assert.equal(checkGenericStatusChange('ISSUED', 'CANCELLED', sender).ok, true);
  assert.equal(checkGenericStatusChange('RECEIVED', 'CANCELLED', sender).ok, false);
  assert.equal(checkGenericStatusChange('ISSUED', 'CANCELLED', receiver).ok, false);
  assert.equal(checkGenericStatusChange('ISSUED', 'CANCELLED', { ...sender, engineManaged: true }).ok, false);
  assert.equal(checkGenericStatusChange('ISSUED', 'CANCELLED', { ...admin, engineManaged: true }).ok, false);
});

test('workflow statuses cannot be set through the generic route', () => {
  for (const to of ['QC_APPROVED', 'COMPLETED', 'HANDED_OVER', 'REJECTED', 'IN_PROCESS', 'whatever']) {
    assert.equal(checkGenericStatusChange('ISSUED', to, receiver).ok, false, to);
  }
});

test('admin may close an untracked older challan, but not an engine-tracked one', () => {
  assert.equal(checkGenericStatusChange('RECEIVED', 'COMPLETED', admin).ok, true);
  assert.equal(checkGenericStatusChange('RECEIVED', 'COMPLETED', { ...admin, engineManaged: true }).ok, false);
  assert.equal(checkGenericStatusChange('ISSUED', 'HANDED_OVER', admin).ok, false);
});

test('no status, or the same status, is not a change', () => {
  assert.equal(checkGenericStatusChange('RECEIVED', undefined, receiver).ok, true);
  assert.equal(checkGenericStatusChange('RECEIVED', 'RECEIVED', receiver).ok, true);
});

test('generic issue: only Programming -> Store and Store -> Dyeing / Embroidery', async () => {
  const { checkGenericIssueRoute } = await import('../src/lib/challan-transitions.mjs');
  assert.equal(checkGenericIssueRoute('PROGRAMMING', 'STORE').ok, true);
  assert.equal(checkGenericIssueRoute('STORE', 'DYEING').ok, true);
  assert.equal(checkGenericIssueRoute('STORE', 'EMBROIDERY').ok, true);
  // QC gate bypass, stage skipping, Store bypass and orphaned destinations are refused.
  assert.equal(checkGenericIssueRoute('QC1', 'EMBROIDERY').ok, false);
  assert.equal(checkGenericIssueRoute('STITCHING', 'FINAL_CHECK').ok, false);
  assert.equal(checkGenericIssueRoute('PROGRAMMING', 'DYEING').ok, false);
  assert.equal(checkGenericIssueRoute('FINISHING', null).ok, false);
});
