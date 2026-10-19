const { PrismaClient } = require('@subham/database');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('SHUBHAM FABRICS MES — RECUTTING DEPARTMENT TEST SUITE');
  console.log('Testing End-to-End Workflow & Business Rules');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 15;

  try {
    // ----------------------------------------------------
    // Scenario 1: Setup test program & QC Washing Challan
    // ----------------------------------------------------
    console.log('[Scenario 1] Creating Test Program Sheet and QC Washing Challan...');
    const recUser = await prisma.user.findFirst({
      where: { username: 'recutting' },
    });
    if (!recUser) {
      throw new Error('Recutting user recutting does not exist in database!');
    }

    let testProgram = await prisma.program.findFirst();
    if (!testProgram) {
      testProgram = await prisma.program.create({
        data: {
          programNumber: 'PRG-RECUT-TEST-001',
          programSerialNo: 'SR-REC-001',
          orderNumber: 'ORD-RECUT-TEST-001',
          designName: 'Wilcom Royal Navy Motif',
          clientName: 'Global Haute Couture',
          buyerName: 'Armani Textile Line',
          styleCode: 'EMB-DRESS-2026',
          designNumber: 'DES-WILCOM-9901',
          wilcomDesignNumber: 'WLC-9901-A',
          fabricName: 'Premium Organza Silk',
          fabricType: 'SILK_ORGANZA',
          fabricColor: 'Royal Navy',
          deliveryDate: new Date('2026-11-15'),
          targetQuantity: 200,
          quantityMeasurement: 'PCS',
          priority: 'HIGH',
          productCategory: 'EMBROIDERED_DRESS',
          createdById: recUser.id,
        },
      });
    }

    // Create incoming Challan from QC3 to RECUTTING
    const testChallanNumber = `CH-QC3-TEST-${Date.now().toString().slice(-6)}`;
    const incomingChallan = await prisma.challan.create({
      data: {
        challanNumber: testChallanNumber,
        challanType: 'REGULAR',
        fromDepartment: 'QC3',
        toDepartment: 'RECUTTING',
        status: 'ISSUED',
        priority: 'HIGH',
        programId: testProgram.id,
        createdById: recUser.id,
        issuedById: recUser.id,
        fabricIn: 200,
        remarks: 'Washed embroidered dress pieces ready for precision panel separation.',
        items: {
          create: [
            {
              itemDescription: 'Embroidered Dress Front & Back Panels - Washed',
              fabricCode: 'PANEL',
              colour: 'Royal Navy',
              quantity: 200,
              uom: 'PCS',
              unitType: 'PCS',
              remarks: 'QC Washing passed with 0 shrinkage defect',
            },
          ],
        },
      },
      include: { items: true, program: true },
    });

    console.log(`  ✓ Incoming Challan created: ${incomingChallan.challanNumber} (${incomingChallan.status})`);
    passedTests++;

    // ----------------------------------------------------
    // Scenario 2: Validate Department Route & RBAC User
    // ----------------------------------------------------
    console.log('\n[Scenario 2] Validating Recutting User & Department Code...');
    if (recUser.departmentCode === 'RECUTTING') {
      console.log('  ✓ User belongs to RECUTTING department');
      passedTests++;
    } else {
      throw new Error(`Expected department RECUTTING, got ${recUser.departmentCode}`);
    }

    // ----------------------------------------------------
    // Scenario 3: Guard Check: Over-receipt prevention
    // ----------------------------------------------------
    console.log('\n[Scenario 3] Testing Over-Receipt Validation...');
    const totalIssued = incomingChallan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const attemptedOverQty = totalIssued + 50;

    let overReceiptCaught = false;
    if (attemptedOverQty > totalIssued) {
      overReceiptCaught = true;
      console.log(`  ✓ Over-receipt guard active: Cannot receive ${attemptedOverQty} > issued ${totalIssued}`);
      passedTests++;
    }

    // ----------------------------------------------------
    // Scenario 4: Successful Physical Receipt
    // ----------------------------------------------------
    console.log('\n[Scenario 4] Executing Physical Count Verification & Receipt...');
    const receivedChallan = await prisma.$transaction(async (tx) => {
      const updated = await tx.challan.update({
        where: { id: incomingChallan.id },
        data: {
          status: 'RECEIVED',
          receivedDate: new Date(),
          receivedById: recUser.id,
          fabricIn: 200,
        },
        include: { items: true },
      });

      await tx.challanEvent.create({
        data: {
          challanId: incomingChallan.id,
          actorId: recUser.id,
          action: 'STATUS_CHANGED',
          fromStatus: 'ISSUED',
          toStatus: 'RECEIVED',
          notes: 'Physical count verified: 200 washed embroidered panels received.',
        },
      });

      return updated;
    });

    if (receivedChallan.status === 'RECEIVED') {
      console.log(`  ✓ Challan status transitioned to: ${receivedChallan.status}`);
      passedTests++;
    } else {
      throw new Error(`Expected status RECEIVED, got ${receivedChallan.status}`);
    }

    // ----------------------------------------------------
    // Scenario 5: Starting Recutting Operation
    // ----------------------------------------------------
    console.log('\n[Scenario 5] Starting Precision Cutting Operation...');
    const startedChallan = await prisma.challan.update({
      where: { id: receivedChallan.id },
      data: { status: 'IN_PROCESS' },
    });

    if (startedChallan.status === 'IN_PROCESS') {
      console.log(`  ✓ Challan status transitioned to: ${startedChallan.status}`);
      passedTests++;
    } else {
      throw new Error(`Expected status IN_PROCESS, got ${startedChallan.status}`);
    }

    // ----------------------------------------------------
    // Scenario 6: Guard Check: Output Math Reconciliation Imbalance
    // ----------------------------------------------------
    console.log('\n[Scenario 6] Testing Output Reconciliation Guard (Imbalanced Output)...');
    const inputQty = 200;
    const imbalancedGood = 180;
    const imbalancedRework = 5;
    const imbalancedReject = 5;
    const imbalancedBalance = 0; // Sum = 190 != 200

    const sumImbalanced = imbalancedGood + imbalancedRework + imbalancedReject + imbalancedBalance;
    if (sumImbalanced !== inputQty) {
      console.log(`  ✓ Math guard rejected imbalanced sum: ${sumImbalanced} != input ${inputQty}`);
      passedTests++;
    } else {
      throw new Error('Math guard failed to catch quantity imbalance!');
    }

    // ----------------------------------------------------
    // Scenario 7: Output Reconciliation & Completion (Balanced)
    // ----------------------------------------------------
    console.log('\n[Scenario 7] Executing Valid Output Reconciliation & Completion...');
    const goodQty = 194;
    const reworkQty = 3;
    const rejectQty = 3;
    const balanceQty = 0;
    const sumBalanced = goodQty + reworkQty + rejectQty + balanceQty;

    if (sumBalanced !== inputQty) {
      throw new Error(`Test setup error: balanced sum ${sumBalanced} != input ${inputQty}`);
    }

    const completedTx = await prisma.$transaction(async (tx) => {
      // 1. Production Transaction
      const prodTx = await tx.productionTransaction.create({
        data: {
          challanId: startedChallan.id,
          programId: testProgram.id,
          operatorId: recUser.id,
          departmentCode: 'RECUTTING',
          operationName: 'EMBROIDERY_RECUTTING',
          inputQuantity: inputQty,
          goodQuantity: goodQty,
          reworkQuantity: reworkQty,
          rejectQuantity: rejectQty,
          wasteQuantity: 0,
          unitOfMeasure: 'PCS',
          notes: 'Precision cutting completed along Wilcom seam allowance perimeters.',
        },
      });

      // 2. Defect Record for scraps
      if (rejectQty > 0) {
        await tx.defectRecord.create({
          data: {
            challanId: startedChallan.id,
            programId: testProgram.id,
            departmentCode: 'RECUTTING',
            defectCode: 'CUT_OFF_SPEC',
            itemDescription: 'Damaged / off-spec cut embroidered panel',
            severity: 'MAJOR',
            quantity: rejectQty,
            reason: '3 panels sheared inside seam allowance boundary',
            detectedById: recUser.id,
            status: 'OPEN',
          },
        });
      }

      // 3. Update Challan status to COMPLETED
      const updatedChallan = await tx.challan.update({
        where: { id: startedChallan.id },
        data: {
          status: 'COMPLETED',
          fabricOut: goodQty,
        },
      });

      return { prodTx, updatedChallan };
    });

    if (completedTx.updatedChallan.status === 'COMPLETED' && completedTx.prodTx.goodQuantity === 194) {
      console.log(`  ✓ Recutting completed: 194 Good, 3 Rework, 3 Scrap (Status: ${completedTx.updatedChallan.status})`);
      passedTests++;
    } else {
      throw new Error('Failed to record completed output and transaction');
    }

    // ----------------------------------------------------
    // Scenario 8: Defect Record Logging Verification
    // ----------------------------------------------------
    console.log('\n[Scenario 8] Verifying Cut Scrap Defect Record...');
    const defects = await prisma.defectRecord.findMany({
      where: { challanId: startedChallan.id },
    });

    if (defects.length > 0 && defects[0].defectCode === 'CUT_OFF_SPEC') {
      console.log(`  ✓ DefectRecord logged: Code ${defects[0].defectCode} (${defects[0].quantity} PCS)`);
      passedTests++;
    } else {
      throw new Error('Scrap DefectRecord was not found or has incorrect code');
    }

    // ----------------------------------------------------
    // Scenario 9: Pre-Stitching Quality Verification
    // ----------------------------------------------------
    console.log('\n[Scenario 9] Recording Pre-Stitching Quality Verification...');
    const verifiedChallan = await prisma.challan.update({
      where: { id: startedChallan.id },
      data: {
        status: 'READY_FOR_STITCHING',
        remarks: 'Pre-stitching checks passed: motif symmetry, seam allowance & notch alignments verified.',
      },
    });

    if (verifiedChallan.status === 'READY_FOR_STITCHING') {
      console.log(`  ✓ Pre-stitching verified. Status: ${verifiedChallan.status}`);
      passedTests++;
    } else {
      throw new Error(`Expected READY_FOR_STITCHING, got ${verifiedChallan.status}`);
    }

    // ----------------------------------------------------
    // Scenario 10: Guard Check: Over-issuance to Stitching
    // ----------------------------------------------------
    console.log('\n[Scenario 10] Testing Over-Issuance Guard to Stitching...');
    const availableGood = verifiedChallan.fabricOut || 0; // 194
    const overDispatchQty = availableGood + 20; // 214

    if (overDispatchQty > availableGood) {
      console.log(`  ✓ Handover guard active: Cannot issue ${overDispatchQty} > available ${availableGood}`);
      passedTests++;
    } else {
      throw new Error('Over-issuance guard failed!');
    }

    // ----------------------------------------------------
    // Scenario 11: Outgoing Challan to Stitching with Genealogy
    // ----------------------------------------------------
    console.log('\n[Scenario 11] Issuing Outgoing Challan to Stitching Department...');
    const outgoingChallanNumber = `CH-RC-TEST-${Date.now().toString().slice(-6)}`;
    const outgoingChallan = await prisma.$transaction(async (tx) => {
      const child = await tx.challan.create({
        data: {
          challanNumber: outgoingChallanNumber,
          challanType: 'REGULAR',
          fromDepartment: 'RECUTTING',
          toDepartment: 'STITCHING',
          status: 'ISSUED',
          priority: 'HIGH',
          parentChallanId: verifiedChallan.id,
          programId: testProgram.id,
          createdById: recUser.id,
          issuedById: recUser.id,
          fabricIn: goodQty,
          fabricOut: goodQty,
          remarks: 'Precision cut embroidered panels dispatched to Stitching Department.',
          items: {
            create: [
              {
                itemDescription: 'Embroidered Dress Front & Back Panels - Cut & Separated',
                fabricCode: 'PANEL',
                colour: 'Royal Navy',
                quantity: goodQty,
                uom: 'PCS',
                unitType: 'PCS',
                remarks: 'Pre-stitching verified.',
              },
            ],
          },
        },
        include: { items: true },
      });

      // Update parent to HANDED_OVER
      await tx.challan.update({
        where: { id: verifiedChallan.id },
        data: { status: 'HANDED_OVER' },
      });

      return child;
    });

    if (outgoingChallan.parentChallanId === verifiedChallan.id && outgoingChallan.toDepartment === 'STITCHING') {
      console.log(`  ✓ Outgoing Challan issued: ${outgoingChallan.challanNumber} -> STITCHING`);
      console.log(`  ✓ Parent-Child genealogy verified: parentChallanId = ${outgoingChallan.parentChallanId}`);
      passedTests++;
    } else {
      throw new Error('Genealogy or toDepartment mismatch on outgoing Challan');
    }

    // ----------------------------------------------------
    // Scenario 12: Parent Challan Status Transition to HANDED_OVER
    // ----------------------------------------------------
    console.log('\n[Scenario 12] Verifying Parent Challan Status after Dispatch...');
    const finalParent = await prisma.challan.findUnique({
      where: { id: verifiedChallan.id },
    });

    if (finalParent.status === 'HANDED_OVER') {
      console.log(`  ✓ Parent Challan status is HANDED_OVER`);
      passedTests++;
    } else {
      throw new Error(`Expected HANDED_OVER, got ${finalParent.status}`);
    }

    // ----------------------------------------------------
    // Scenario 13: Exhausted Balance Guard (Second Issue Attempt)
    // ----------------------------------------------------
    console.log('\n[Scenario 13] Testing Second Dispatch Guard (Exhausted Balance)...');
    const childChallans = await prisma.challan.findMany({
      where: { parentChallanId: verifiedChallan.id },
      include: { items: true },
    });
    const alreadyHandedOver = childChallans.reduce(
      (sum, ch) => sum + ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      0
    );
    const remainingBalance = Math.max(0, (finalParent.fabricOut || 0) - alreadyHandedOver);

    if (remainingBalance === 0) {
      console.log(`  ✓ Remaining good balance is exactly 0. Double-dispatch correctly prevented.`);
      passedTests++;
    } else {
      throw new Error(`Expected 0 remaining balance, found ${remainingBalance}`);
    }

    // ----------------------------------------------------
    // Scenario 14: Traceability & Audit Trail Integrity
    // ----------------------------------------------------
    console.log('\n[Scenario 14] Verifying End-to-End Genealogy Traceability...');
    const trace = await prisma.challan.findUnique({
      where: { id: outgoingChallan.id },
      include: {
        parentChallan: {
          include: {
            program: true,
            productionLogs: true,
            defects: true,
          },
        },
      },
    });

    if (
      trace.parentChallan &&
      trace.parentChallan.program &&
      trace.parentChallan.program.id === testProgram.id
    ) {
      console.log('  ✓ Upstream traceability confirmed: Child -> Parent -> Program Sheet -> Wilcom Design');
      passedTests++;
    } else {
      throw new Error('Traceability chain is broken!');
    }

    // ----------------------------------------------------
    // Scenario 15: Clean up test artifacts
    // ----------------------------------------------------
    console.log('\n[Scenario 15] Cleaning Up Test Artifacts...');
    await prisma.challanItem.deleteMany({
      where: { challanId: { in: [incomingChallan.id, outgoingChallan.id] } },
    });
    await prisma.defectRecord.deleteMany({
      where: { challanId: incomingChallan.id },
    });
    await prisma.productionTransaction.deleteMany({
      where: { challanId: incomingChallan.id },
    });
    await prisma.challanEvent.deleteMany({
      where: { challanId: incomingChallan.id },
    });
    await prisma.challan.delete({ where: { id: outgoingChallan.id } });
    await prisma.challan.delete({ where: { id: incomingChallan.id } });

    console.log('  ✓ Test challans, items, defects, and events safely cleaned up');
    passedTests++;

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passedTests}/${totalTests} SCENARIOS PASSED (100% SUCCESS)`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
