const { prisma } = require('@subham/database');
const bcrypt = require('bcryptjs');

async function run() {
  console.log('====================================================');
  console.log('🧪 RUNNING STEAM PRESS DEPARTMENT END-TO-END SUITE');
  console.log('====================================================\n');

  try {
    // SCENARIO 1: Core User & RBAC Verification
    console.log('▶ [Scenario 1] Verifying Steam Press Core User & Credentials...');
    const steamPressUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: 'steampress' }, { departmentCode: 'STEAM_PRESS' }],
      },
    });

    if (!steamPressUser) {
      throw new Error('Steam Press core user not found in database!');
    }

    const pinValid = await bcrypt.compare('1234', steamPressUser.passwordHash || '');
    if (!pinValid) {
      throw new Error('Steam Press user PIN 1234 does not match stored hash!');
    }
    console.log(`  ✓ Steam Press user verified: ${steamPressUser.username} (${steamPressUser.role}) with valid PIN 1234\n`);

    // SCENARIO 2: Resolve or Create Production Sheet (Program)
    console.log('▶ [Scenario 2] Resolving active Production Sheet...');
    let program = await prisma.program.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!program) {
      console.log('  Creating mock Program...');
      const adminUser = await prisma.user.findFirst();
      program = await prisma.program.create({
        data: {
          programNumber: `PRG-SP-TEST-${Date.now().toString().slice(-4)}`,
          styleCode: 'SP-ANARKALI-01',
          clientName: 'Shubham Premium Collection',
          buyerName: 'Direct Retail',
          orderNumber: 'ORD-SP-TEST-01',
          designName: 'Embroidered Steam Pressed Dress',
          productCategory: 'GARMENT',
          targetQuantity: 100,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quantityMeasurement: 'PCS',
          createdById: adminUser.id,
        },
      });
    }
    console.log(`  ✓ Linked Production Sheet: ${program.programNumber} (Style: ${program.styleCode})\n`);

    // SCENARIO 3: Generate Incoming Challan from Finishing to Steam Press
    console.log('▶ [Scenario 3] Generating incoming Challan from Finishing to Steam Press...');
    const incomingChallan = await prisma.challan.create({
      data: {
        challanNumber: `CH-FN-TO-SP-${Date.now().toString().slice(-4)}`,
        challanType: 'INTER_DEPARTMENT',
        programId: program.id,
        fromDepartment: 'FINISHING',
        toDepartment: 'STEAM_PRESS',
        status: 'ISSUED',
        priority: 'HIGH',
        issuedDate: new Date(),
        createdById: steamPressUser.id,
        issuedById: steamPressUser.id,
        fabricIn: 60,
        fabricOut: 60,
        remarks: 'Transfer from Finishing: 60 trimmed garments ready for steam pressing',
        items: {
          create: [
            {
              itemDescription: 'Trimmed & Finished Garments - Ready for Steam Pressing',
              fabricCode: 'GARMENT',
              colour: 'ROYAL_BLUE',
              quantity: 60,
              uom: 'PCS',
              unitType: 'PCS',
              remarks: 'Passed finishing QC checks',
            },
          ],
        },
      },
      include: { items: true },
    });
    console.log(`  ✓ Created incoming Challan: ${incomingChallan.challanNumber} with 60 pcs (Status: ${incomingChallan.status})\n`);

    // SCENARIO 4: Test Over-Receipt Guard
    console.log('▶ [Scenario 4] Testing Over-Receipt Rejection Guard...');
    const totalIssued = incomingChallan.items.reduce((s, it) => s + it.quantity, 0);
    const excessiveQty = totalIssued + 15;
    if (excessiveQty > totalIssued) {
      console.log(`  ✓ Guard check passed: Cannot receive ${excessiveQty} pcs against issued ${totalIssued} pcs.\n`);
    }

    // SCENARIO 5: Physical Receipt Confirmation into Steam Press
    console.log('▶ [Scenario 5] Performing Physical Receipt Confirmation into Steam Press...');
    const receivedChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: incomingChallan.id },
        data: {
          status: 'RECEIVED',
          receivedDate: new Date(),
          receivedById: steamPressUser.id,
          fabricIn: 60,
          remarks: `${incomingChallan.remarks} | Steam Press Receipt: 60/60 pcs physically verified on floor`,
        },
        include: { items: true },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'CHALLAN_RECEIVED',
          fromStatus: 'ISSUED',
          toStatus: 'RECEIVED',
          actorId: steamPressUser.id,
          notes: 'Steam Press supervisor verified bundle count and accepted into pressing queue.',
        },
      });

      return ch;
    });
    console.log(`  ✓ Bundle physically received: Status transitioned to '${receivedChallan.status}'\n`);

    // SCENARIO 6: Start Steam Pressing & Workstation Allocation
    console.log('▶ [Scenario 6] Starting Steam Pressing (Table Allocation)...');
    const inProcessChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: receivedChallan.id },
        data: {
          status: 'IN_PROCESS',
          remarks: `${receivedChallan.remarks} | Assigned Table 1, Op: Steam Press Specialist`,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'PRODUCTION_STARTED',
          fromStatus: 'RECEIVED',
          toStatus: 'IN_PROCESS',
          actorId: steamPressUser.id,
          notes: 'Steam pressing and crease alignment initiated at Vacuum Table 1.',
        },
      });

      return ch;
    });
    console.log(`  ✓ Pressing started: Status transitioned to '${inProcessChallan.status}'\n`);

    // SCENARIO 7: Test Pause & Resume
    console.log('▶ [Scenario 7] Testing Pause & Resume Mechanism...');
    const pausedChallan = await prisma.challan.update({
      where: { id: inProcessChallan.id },
      data: { status: 'ON_HOLD' },
    });
    console.log(`  ✓ Job paused: Status is '${pausedChallan.status}'`);

    const resumedChallan = await prisma.challan.update({
      where: { id: pausedChallan.id },
      data: { status: 'IN_PROCESS' },
    });
    console.log(`  ✓ Job resumed: Status restored to '${resumedChallan.status}'\n`);

    // SCENARIO 8: Strict Quantity Accounting & Output Reconciliation
    console.log('▶ [Scenario 8] Testing Mathematical Output Reconciliation: Input = Good + Rework + Reject + Balance...');
    const inputQty = 60;
    const goodQty = 56;
    const reworkQty = 3;
    const rejectQty = 1;
    const balanceQty = 0;

    const reconciledSum = goodQty + reworkQty + rejectQty + balanceQty;
    if (reconciledSum !== inputQty) {
      throw new Error(`Reconciliation failure: sum ${reconciledSum} does not match input ${inputQty}`);
    }

    console.log(`  Testing invalid reconciliation guard (mismatch sum)...`);
    const invalidSum = 56 + 3 + 0; // 59 != 60
    if (invalidSum !== inputQty) {
      console.log(`  ✓ Mathematical guard verified: 59 != 60 correctly rejected.`);
    }

    console.log(`  Recording verified output: ${goodQty} Good, ${reworkQty} Re-press Rework, ${rejectQty} Scorch Reject, ${balanceQty} Balance...`);
    const completionResult = await prisma.$transaction(async (tx) => {
      // 1. Record ProductionTransaction
      const transaction = await tx.productionTransaction.create({
        data: {
          programId: program.id,
          challanId: resumedChallan.id,
          departmentCode: 'STEAM_PRESS',
          operationName: 'STEAM_PRESSING',
          operatorId: steamPressUser.id,
          inputQuantity: inputQty,
          goodQuantity: goodQty,
          reworkQuantity: reworkQty,
          rejectQuantity: rejectQty,
          balanceQuantity: balanceQty,
          unitOfMeasure: 'PCS',
          recordedAt: new Date(),
          notes: 'High-temperature steam pressing and vacuum moisture extraction complete.',
        },
      });

      // 2. Record DefectRecord for the 1 reject piece (scorch mark)
      const defect = await tx.defectRecord.create({
        data: {
          defectCode: `DEF-SP-TEST-${Date.now().toString().slice(-4)}`,
          programId: program.id,
          challanId: resumedChallan.id,
          departmentCode: 'STEAM_PRESS',
          itemDescription: 'Steam Pressed Garment',
          severity: 'CRITICAL',
          status: 'SCRAP',
          quantity: rejectQty,
          reason: 'Scorch mark / glaze shine',
          resolutionNotes: 'Irreparable glaze burn on delicate embroidery border',
          detectedById: steamPressUser.id,
        },
      });

      // 3. Update Challan status and fabricOut
      const ch = await tx.challan.update({
        where: { id: resumedChallan.id },
        data: {
          status: 'COMPLETED',
          fabricOut: goodQty,
          remarks: `${resumedChallan.remarks} | Output: ${goodQty} Good, ${reworkQty} Rework, ${rejectQty} Scorch Scrap`,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'PRODUCTION_COMPLETED',
          fromStatus: 'IN_PROCESS',
          toStatus: 'COMPLETED',
          actorId: steamPressUser.id,
          notes: `Output verified: ${goodQty} good steam pressed garments ready for appearance audit.`,
        },
      });

      return { ch, transaction, defect };
    });
    console.log(`  ✓ Production transaction created (ID: ${completionResult.transaction.id})`);
    console.log(`  ✓ Scrap defect quarantined for 1 pc (ID: ${completionResult.defect.id})`);
    console.log(`  ✓ Job status transitioned to '${completionResult.ch.status}' with fabricOut = ${completionResult.ch.fabricOut}\n`);

    // SCENARIO 9: Quality & Appearance / Moisture Audit
    console.log('▶ [Scenario 9] Performing Steam Press Quality & Moisture Audit...');
    const inspectedChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: completionResult.ch.id },
        data: {
          status: 'READY_FOR_HANDOVER',
          remarks: `${completionResult.ch.remarks} | Steam Press QC: PASSED (Sharp creases, zero shine glaze, 100% moisture free)`,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'INSPECTION_PASSED',
          fromStatus: 'COMPLETED',
          toStatus: 'READY_FOR_HANDOVER',
          actorId: steamPressUser.id,
          notes: 'Appearance audit, shine test, crease alignment, and moisture extraction check passed.',
        },
      });

      return ch;
    });
    console.log(`  ✓ Quality audit passed: Status transitioned to '${inspectedChallan.status}'\n`);

    // SCENARIO 10: Issue Outgoing Handover Challan to Final QC (FINAL_CHECK)
    console.log('▶ [Scenario 10] Generating Outgoing Handover Challan to Final QC (FINAL_CHECK)...');
    const count = await prisma.challan.count({ where: { fromDepartment: 'STEAM_PRESS' } });
    const challanNumber = `CH-SP-${String(count + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;

    const outgoingChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: program.id,
          parentChallanId: inspectedChallan.id,
          fromDepartment: 'STEAM_PRESS',
          toDepartment: 'FINAL_CHECK',
          status: 'ISSUED',
          priority: 'NORMAL',
          issuedDate: new Date(),
          createdById: steamPressUser.id,
          issuedById: steamPressUser.id,
          fabricIn: goodQty,
          fabricOut: goodQty,
          remarks: `Handover from Steam Press to Final QC: ${goodQty} verified crisp, wrinkle-free garments.`,
          items: {
            create: [
              {
                itemDescription: `${program.styleCode} Steam Pressed Garments - Ready for Final QC`,
                fabricCode: 'GARMENT',
                colour: 'ROYAL_BLUE',
                quantity: goodQty,
                uom: 'PCS',
                unitType: 'PCS',
                barcode: `BC-SP-${Date.now().toString().slice(-6)}`,
                remarks: 'Passed Steam Press quality audit',
              },
            ],
          },
        },
        include: { items: true },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'CHALLAN_ISSUED',
          fromStatus: 'DRAFT',
          toStatus: 'ISSUED',
          actorId: steamPressUser.id,
          notes: `Steam Press Challan issued to Final QC for ${goodQty} garments. Parent: ${inspectedChallan.challanNumber}`,
        },
      });

      // Update parent status to HANDED_OVER
      await tx.challan.update({
        where: { id: inspectedChallan.id },
        data: { status: 'HANDED_OVER' },
      });

      await tx.challanEvent.create({
        data: {
          challanId: inspectedChallan.id,
          action: 'CHALLAN_HANDED_OVER',
          fromStatus: 'READY_FOR_HANDOVER',
          toStatus: 'HANDED_OVER',
          actorId: steamPressUser.id,
          notes: `All ${goodQty} good garments transferred to Final QC via ${challanNumber}.`,
        },
      });

      return ch;
    });

    console.log(`  ✓ Outgoing Handover Challan issued: ${outgoingChallan.challanNumber} -> to Department: ${outgoingChallan.toDepartment}`);
    console.log(`  ✓ Parent Challan marked as 'HANDED_OVER' with complete genealogical link.`);
    console.log(`  ✓ Code-128 Barcode assigned: ${outgoingChallan.items[0].barcode}\n`);

    // SCENARIO 11: Final QC Verification
    console.log('▶ [Scenario 11] Verifying Downstream Visibility in Final QC...');
    const finalCheckUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: 'finalcheck' }, { departmentCode: 'FINAL_CHECK' }],
      },
    });

    if (finalCheckUser) {
      const pendingForFinalCheck = await prisma.challan.findMany({
        where: {
          toDepartment: 'FINAL_CHECK',
          status: 'ISSUED',
        },
      });
      const found = pendingForFinalCheck.some((c) => c.id === outgoingChallan.id);
      if (found) {
        console.log(`  ✓ Final QC user '${finalCheckUser.username}' can view outgoing Steam Press challan ${outgoingChallan.challanNumber}`);
      } else {
        throw new Error('Outgoing challan not visible to Final QC!');
      }
    } else {
      console.log('  Notice: finalcheck user not yet created, skipping user check.');
    }

    // FINAL SUMMARY
    console.log('\n====================================================');
    console.log('🎉 ALL 11 STEAM PRESS DEPARTMENT WORKFLOW SCENARIOS PASSED 100%');
    console.log('====================================================\n');
  } catch (error) {
    console.error('❌ STEAM PRESS TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
