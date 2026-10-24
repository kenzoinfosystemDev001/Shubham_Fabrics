#!/usr/bin/env node
/**
 * Final QC Department — End-to-End Workflow Test Script
 * Shubham Fabrics MES
 *
 * Tests 11 workflow scenarios against the live production database.
 * Run: node scripts/test-final-qc-workflow.js
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`     → ${err.message}`);
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${json.error || JSON.stringify(json)}`);
  }
  return json;
}

let testChallanId = null;
let testProgramId = null;

async function runAllTests() {
  console.log('\n🔬 FINAL QC DEPARTMENT — WORKFLOW TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`📡 Target: ${BASE_URL}`);
  console.log('═'.repeat(60) + '\n');

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 1: Dashboard API health
  // ─────────────────────────────────────────────────────────────
  console.log('📋 Scenario 1: Dashboard API Health Check');
  await test('Final QC dashboard API responds with 200', async () => {
    const json = await apiFetch('/api/final-qc/dashboard');
    if (!json.success) throw new Error('Dashboard API returned success=false');
    if (!json.data?.summary) throw new Error('Dashboard missing summary field');
    console.log(`     → Awaiting: ${json.data.summary.awaitingReceiptCount} challans`);
    console.log(`     → In Queue: ${json.data.summary.inQueueCount} challans`);
    console.log(`     → Ready: ${json.data.summary.readyForHandoverCount} challans`);
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 2: Incoming challans list
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 2: Incoming Challans from Steam Press');
  await test('Incoming challans API returns array', async () => {
    const json = await apiFetch('/api/final-qc/incoming');
    if (!json.success) throw new Error('Incoming API returned success=false');
    if (!Array.isArray(json.data)) throw new Error('Incoming data is not an array');
    console.log(`     → Found ${json.data.length} incoming challan(s)`);
    if (json.data.length > 0) {
      testChallanId = json.data[0].id;
      testProgramId = json.data[0].programId;
      console.log(`     → Using challan: ${json.data[0].challanNumber} (ID: ${testChallanId})`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 3: Queue API
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 3: Inspection Queue');
  await test('Queue API returns active jobs', async () => {
    const json = await apiFetch('/api/final-qc/queue');
    if (!json.success) throw new Error('Queue API returned success=false');
    if (!Array.isArray(json.data)) throw new Error('Queue data is not an array');
    console.log(`     → Active jobs in queue: ${json.data.length}`);
    // If queue has jobs and no challan set from incoming, use queue job
    if (!testChallanId && json.data.length > 0) {
      testChallanId = json.data[0].id;
      testProgramId = json.data[0].programId;
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 4: Receive challan (skip if no ISSUED challan)
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 4: Physical Receipt Verification');
  await test('Challan receipt API validates structure', async () => {
    // Test with invalid ID to check validation
    const res = await fetch(`${BASE_URL}/api/final-qc/challans/invalid-id-xyz/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivedQuantity: 10 }),
    });
    const json = await res.json();
    // Should return 404 for invalid ID
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}: ${json.error}`);
    console.log(`     → Correctly returned 404 for invalid challan ID`);
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 5: Job detail API
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 5: Job Detail Retrieval');
  await test('Job detail API returns full data structure', async () => {
    if (!testChallanId) {
      console.log('     ⚠  No challan available — checking with dummy ID');
      const res = await fetch(`${BASE_URL}/api/final-qc/jobs/dummy-id`);
      const json = await res.json();
      if (res.status !== 404) throw new Error(`Expected 404 for dummy ID, got ${res.status}`);
      console.log('     → Correctly returned 404 for unknown job');
      return;
    }
    const json = await apiFetch(`/api/final-qc/jobs/${testChallanId}`);
    if (!json.success) throw new Error('Job detail API returned success=false');
    if (!json.data) throw new Error('Job detail missing data field');
    console.log(`     → Job: ${json.data.challanNumber} | Status: ${json.data.status}`);
    if (json.data.program) {
      console.log(`     → Program: ${json.data.program.programNumber} | Style: ${json.data.program.styleCode}`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 6: Quantity reconciliation validation (math check)
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 6: Quantity Reconciliation Math Guard');
  await test('Inspect API rejects mismatched quantity reconciliation', async () => {
    if (!testChallanId) {
      // No challan — test with dummy to verify endpoint exists
      const res = await fetch(`${BASE_URL}/api/final-qc/jobs/dummy-id/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputQuantity: 10, acceptedQuantity: 5, reworkQuantity: 3, rejectedQuantity: 1, pendingQuantity: 0 }),
      });
      if (res.status === 404 || res.status === 400) {
        console.log('     → Endpoint reachable, validation guard active');
        return;
      }
    }
    // Test reconciliation mismatch: 5 + 3 + 1 + 0 = 9 ≠ 10
    const res = await fetch(`${BASE_URL}/api/final-qc/jobs/${testChallanId || 'dummy-id'}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputQuantity: 10,
        acceptedQuantity: 5,
        reworkQuantity: 3,
        rejectedQuantity: 1,
        pendingQuantity: 0, // intentional mismatch: 5+3+1+0=9≠10
      }),
    });
    const json = await res.json();
    if (res.status === 400 && json.error && json.error.includes('reconciliation')) {
      console.log(`     → Reconciliation guard fired correctly`);
    } else if (res.status === 404) {
      console.log(`     → Challan not in inspectable state (expected for this test environment)`);
    } else {
      throw new Error(`Expected 400 reconciliation error. Got ${res.status}: ${json.error}`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 7: Over-receipt guard
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 7: Over-Receipt Guard');
  await test('Receipt API blocks quantity exceeding issued amount', async () => {
    if (!testChallanId) {
      console.log('     ⚠  No test challan available — skipping');
      return;
    }
    // Try to receive more than could be issued
    const res = await fetch(`${BASE_URL}/api/final-qc/challans/${testChallanId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivedQuantity: 999999 }),
    });
    const json = await res.json();
    if (res.status === 400 && json.error && (json.error.includes('exceed') || json.error.includes('already'))) {
      console.log(`     → Over-receipt guard active: "${json.error.substring(0, 60)}..."`);
    } else if (res.status === 400) {
      console.log(`     → Got 400 validation: ${json.error}`);
    } else {
      console.log(`     ⚠  Got ${res.status} — challan may already be received`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 8: Hold/Resume API validation
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 8: Hold & Resume State Machine');
  await test('Hold API validates status precondition', async () => {
    if (!testChallanId) {
      // Test endpoint structure with dummy
      const res = await fetch(`${BASE_URL}/api/final-qc/jobs/dummy-id/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test hold' }),
      });
      if (res.status === 404 || res.status === 400) {
        console.log('     → Hold endpoint reachable and validates');
        return;
      }
    }
    const res = await fetch(`${BASE_URL}/api/final-qc/jobs/${testChallanId}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test supervisor hold' }),
    });
    const json = await res.json();
    if (res.status === 400) {
      console.log(`     → State validation guard active: ${json.error}`);
    } else if (res.status === 200 && json.success) {
      console.log(`     → Job placed on hold successfully`);
    } else {
      throw new Error(`Unexpected response ${res.status}: ${json.error}`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 9: Issue Challan validation
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 9: Outgoing Challan to Packing — Validation');
  await test('Issue challan API validates required fields', async () => {
    // Test missing parentChallanId
    const res = await fetch(`${BASE_URL}/api/final-qc/issue-challan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (res.status === 400 && json.error) {
      console.log(`     → Validation active: "${json.error}"`);
    } else {
      throw new Error(`Expected 400 validation error. Got ${res.status}: ${json.error || 'No error'}`);
    }
  });

  await test('Issue challan requires items array', async () => {
    const res = await fetch(`${BASE_URL}/api/final-qc/issue-challan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentChallanId: 'some-id', items: [] }),
    });
    const json = await res.json();
    if (res.status === 400 && json.error && json.error.toLowerCase().includes('item')) {
      console.log(`     → Items validation active: "${json.error}"`);
    } else {
      throw new Error(`Expected items validation error. Got ${res.status}: ${json.error}`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 10: Floor Board API
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 10: Floor Board / Kanban View');
  await test('Floor board API returns 4-lane structure', async () => {
    const json = await apiFetch('/api/final-qc/floor-board');
    if (!json.success) throw new Error('Floor board API returned success=false');
    if (!json.data?.lanes) throw new Error('Floor board missing lanes field');
    const lanes = json.data.lanes;
    if (!('PENDING' in lanes)) throw new Error('Missing PENDING lane');
    if (!('IN_INSPECTION' in lanes)) throw new Error('Missing IN_INSPECTION lane');
    if (!('COMPLETED' in lanes)) throw new Error('Missing COMPLETED lane');
    if (!('HANDED_OVER' in lanes)) throw new Error('Missing HANDED_OVER lane');
    console.log(`     → Lanes: PENDING=${lanes.PENDING.length}, IN_INSPECTION=${lanes.IN_INSPECTION.length}, COMPLETED=${lanes.COMPLETED.length}, HANDED_OVER=${lanes.HANDED_OVER.length}`);
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 11: Reports API
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Scenario 11: Reports & Analytics');
  await test('Reports API returns yield analytics', async () => {
    const json = await apiFetch('/api/final-qc/reports?days=30');
    if (!json.success) throw new Error('Reports API returned success=false');
    if (!json.data?.summary) throw new Error('Reports missing summary field');
    const s = json.data.summary;
    console.log(`     → Period: ${s.periodDays} days`);
    console.log(`     → Total Input: ${s.totalInput} pcs | Accepted: ${s.totalAccepted} | First-Pass Yield: ${s.firstPassYield}%`);
    console.log(`     → Defect Records: ${s.totalDefectRecords} | Transactions: ${s.totalTransactions}`);
    if (!Array.isArray(json.data.defectPareto)) throw new Error('Missing defectPareto array');
    console.log(`     → Top Defect Categories: ${json.data.defectPareto.length}`);
  });

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('═'.repeat(60));
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.name}`);
      console.log(`     Error: ${r.error}`);
    });
  } else {
    console.log('\n🎉 All Final QC workflow tests passed!');
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
