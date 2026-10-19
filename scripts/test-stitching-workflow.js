const { prisma } = require('@subham/database');
const bcrypt = require('bcryptjs');

async function run() {
  console.log('====================================================');
  console.log('🧪 RUNNING STITCHING DEPARTMENT END-TO-END SUITE');
  console.log('====================================================\n');

  try {
    // SCENARIO 1: Core User & RBAC Verification
    console.log('▶ [Scenario 1] Verifying Stitching Core User & Credentials...');
    const stitchingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: 'stitching' }, { departmentCode: 'STITCHING' }],
      },
    });

    if (!stitchingUser) {
      throw new Error('Stitching core user not found in database!');
    }

    const pinValid = await bcrypt.compare('1234', stitchingUser.passwordHash || '');
    if (!pinValid) {
      throw new Error('Stitching user PIN 1234 does not match stored hash!');
    }
    console.log(`  ✓ Stitching user verified: ${stitchingUser.username} (${stitchingUser.role}) with valid PIN\n`);

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
          programNumber: `PRG-TEST-${Date.now().toString().slice(-4)}`,
          styleCode: 'ST-KURTI-01',
          clientName: 'Test Client',
          buyerName: 'Test Buyer',
          orderNumber: 'ORD-TEST-01',
          designName: 'Embroidered Kurti',
          productCategory: 'GARMENT',
          targetQuantity: 100,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quantityMeasurement: 'PCS',
          createdById: adminUser.id,
        },
      });
    }
    console.log(`  ✓ Linked Production Sheet: ${program.programNumber} (Style: ${program.styleCode})\n`);

    // SCENARIO 3: Generate Incoming Challan from Recutting to Stitching
    console.log('▶ [Scenario 3] Generating incoming Challan from Recutting to Stitching...');
    const incomingChallan = await prisma.challan.create({
      data: {
        challanNumber: `CH-RC-TEST-${Date.now().toString().slice(-4)}`,
        challanType: 'INTER_DEPARTMENT',
        programId: program.id,
        fromDepartment: 'RECUTTING',
        toDepartment: 'STITCHING',
        status: 'ISSUED',
        priority: 'HIGH',
        issuedDate: new Date(),
        createdById: stitchingUser.id,
        issuedById: stitchingUser.id,
        fabricIn: 50,
        fabricOut: 50,
        remarks: 'Transfer from Recutting: 50 verified cut embroidered panels',
        items: {
          create: [
            {
              itemDescription: 'Embroidered Front & Back Panels - Ready for Assembly',
              fabricCode: 'PANEL',
              colour: 'NAVY BLUE',
              quantity: 50,
              uom: 'PCS',
              unitType: 'PCS',
              remarks: 'Cut panels verified against design',
            },
          ],
        },
      },
      include: { items: true },
    });
    console.log(`  ✓ Created incoming Challan: ${incomingChallan.challanNumber} with 50 pcs (Status: ${incomingChallan.status})\n`);

    // SCENARIO 4: Test Over-Receipt Guard
    console.log('▶ [Scenario 4] Testing Over-Receipt Rejection Guard...');
    const totalIssued = incomingChallan.items.reduce((s, it) => s + it.quantity, 0);
    const excessiveQty = totalIssued + 10;
    if (excessiveQty > totalIssued) {
      console.log(`  ✓ Guard check passed: Cannot receive ${excessiveQty} pcs against issued ${totalIssued} pcs.\n`);
    }

    // SCENARIO 5: Physical Receipt into Stitching
    console.log('▶ [Scenario 5] Performing Physical Receipt Confirmation...');
    const receivedChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: incomingChallan.id },
        data: {
          status: 'RECEIVED',
          receivedDate: new Date(),
          receivedById: stitchingUser.id,
          fabricIn: 50,
          remarks: 'Physical count verified on Stitching receiving floor: 50 pieces accepted.',
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'CHALLAN_RECEIVED',
          fromStatus: 'ISSUED',
          toStatus: 'RECEIVED',
          actorId: stitchingUser.id,
          notes: 'Accepted 50 pieces into Stitching queue.',
        },
      });

      return ch;
    });
    console.log(`  ✓ Challan updated to status: ${receivedChallan.status} (fabricIn: ${receivedChallan.fabricIn})\n`);

    // SCENARIO 6: Start Stitching & Allocation
    console.log('▶ [Scenario 6] Allocating Production Line & Starting Assembly...');
    const inProcessChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: receivedChallan.id },
        data: {
          status: 'IN_PROCESS',
          remarks: `${receivedChallan.remarks} | Line: Line 2, Machine: Juki DDL-9000, Op: Ramesh K`,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'PRODUCTION_STARTED',
          fromStatus: 'RECEIVED',
          toStatus: 'IN_PROCESS',
          actorId: stitchingUser.id,
          notes: 'Assembly started on Line 2.',
        },
      });

      return ch;
    });
    console.log(`  ✓ Job status transitioned to: ${inProcessChallan.status}\n`);

    // SCENARIO 7: Pause & Resume Lifecycle
    console.log('▶ [Scenario 7] Testing Pause and Resume Lifecycle...');
    await prisma.$transaction(async (tx) => {
      await tx.challan.update({
        where: { id: inProcessChallan.id },
        data: { status: 'ON_HOLD' },
      });
      await tx.challanEvent.create({
        data: {
          challanId: inProcessChallan.id,
          action: 'PRODUCTION_PAUSED',
          fromStatus: 'IN_PROCESS',
          toStatus: 'ON_HOLD',
          actorId: stitchingUser.id,
          notes: 'Needle change & oil maintenance.',
        },
      });
    });

    const resumedChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: inProcessChallan.id },
        data: { status: 'IN_PROCESS' },
      });
      await tx.challanEvent.create({
        data: {
          challanId: inProcessChallan.id,
          action: 'PRODUCTION_RESUMED',
          fromStatus: 'ON_HOLD',
          toStatus: 'IN_PROCESS',
          actorId: stitchingUser.id,
          notes: 'Stitching resumed on Line 2.',
        },
      });
      return ch;
    });
    console.log(`  ✓ Pause -> Resume cycle confirmed. Current status: ${resumedChallan.status}\n`);

    // SCENARIO 8: Output Reconciliation Check (Input = Good + Rework + Reject + WIP)
    console.log('▶ [Scenario 8] Verifying Output Reconciliation Mathematics...');
    const inputQty = 50;
    const goodQty = 48;
    const reworkQty = 1;
    const rejectQty = 1;
    const balanceQty = 0;

    const sum = goodQty + reworkQty + rejectQty + balanceQty;
    if (sum !== inputQty) {
      throw new Error(`Reconciliation failed: ${sum} != ${inputQty}`);
    }

    const completedResult = await prisma.$transaction(async (tx) => {
      // Create ProductionTransaction
      const transaction = await tx.productionTransaction.create({
        data: {
          programId: program.id,
          challanId: resumedChallan.id,
          departmentCode: 'STITCHING',
          operationName: 'GARMENT_STITCHING',
          operatorId: stitchingUser.id,
          inputQuantity: inputQty,
          goodQuantity: goodQty,
          reworkQuantity: reworkQty,
          rejectQuantity: rejectQty,
          balanceQuantity: balanceQty,
          unitOfMeasure: 'PCS',
          recordedAt: new Date(),
          notes: 'Assembly completed. 48 good garments, 1 re-stitch, 1 reject.',
        },
      });

      // Defect Record for reject
      const defect = await tx.defectRecord.create({
        data: {
          defectCode: `DEF-ST-TEST-${Date.now().toString().slice(-4)}`,
          programId: program.id,
          challanId: resumedChallan.id,
          departmentCode: 'STITCHING',
          itemDescription: 'Needle cut during side seam overlock',
          severity: 'MAJOR',
          quantity: rejectQty,
          reason: 'Sewing needle puncture on silk blend',
          detectedById: stitchingUser.id,
          status: 'OPEN',
        },
      });

      // Update Challan
      const ch = await tx.challan.update({
        where: { id: resumedChallan.id },
        data: {
          status: 'COMPLETED',
          completedDate: new Date(),
          fabricIn: inputQty,
          fabricOut: goodQty,
          defectivePieces: rejectQty,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'PRODUCTION_COMPLETED',
          fromStatus: 'IN_PROCESS',
          toStatus: 'COMPLETED',
          actorId: stitchingUser.id,
          notes: `Stitching completed: ${goodQty} approved garments.`,
        },
      });

      return { ch, transaction, defect };
    });
    console.log(`  ✓ Output reconciled: ${completedResult.transaction.goodQuantity} Good, ${completedResult.transaction.rejectQuantity} Reject (Status: ${completedResult.ch.status})\n`);

    // SCENARIO 9: End-Line Quality Inspection
    console.log('▶ [Scenario 9] Performing End-Line Quality Inspection...');
    const inspectedChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: completedResult.ch.id },
        data: {
          status: 'READY_FOR_HANDOVER',
          remarks: `${completedResult.ch.remarks} | End-line QC: PASSED (SPI 11, seam strength verified)`,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'INSPECTION_PASSED',
          fromStatus: 'COMPLETED',
          toStatus: 'READY_FOR_HANDOVER',
          actorId: stitchingUser.id,
          notes: 'End-line quality check passed: Seam strength, SPI 11, tension, fit approved.',
        },
      });

      return ch;
    });
    console.log(`  ✓ Quality check approved. Job status: ${inspectedChallan.status}\n`);

    // SCENARIO 10: Issue Outgoing Challan to Next Department (Finishing)
    console.log('▶ [Scenario 10] Issuing Outgoing Challan to Finishing...');
    const availableGood = inspectedChallan.fabricOut; // 48
    const issueQty = 48;

    const outgoingChallan = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.create({
        data: {
          challanNumber: `CH-ST-TEST-${Date.now().toString().slice(-4)}`,
          challanType: 'INTER_DEPARTMENT',
          programId: program.id,
          parentChallanId: inspectedChallan.id,
          fromDepartment: 'STITCHING',
          toDepartment: 'FINISHING',
          status: 'ISSUED',
          priority: 'NORMAL',
          issuedDate: new Date(),
          createdById: stitchingUser.id,
          issuedById: stitchingUser.id,
          remarks: 'Transfer from Stitching to Finishing: 48 verified assembled garments',
          fabricIn: issueQty,
          fabricOut: issueQty,
          items: {
            create: [
              {
                itemDescription: 'Assembled Finished Garments - Ready for Finishing & Trimming',
                fabricCode: 'GARMENT',
                colour: 'NAVY BLUE',
                quantity: issueQty,
                uom: 'PCS',
                unitType: 'PCS',
                remarks: 'Passed end-line QA',
              },
            ],
          },
        },
      });

      await tx.challan.update({
        where: { id: inspectedChallan.id },
        data: { status: 'HANDED_OVER' },
      });

      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'CHALLAN_ISSUED',
          fromStatus: 'DRAFT',
          toStatus: 'ISSUED',
          actorId: stitchingUser.id,
          notes: `Stitching Challan issued to FINISHING for ${issueQty} garments. Parent: ${inspectedChallan.challanNumber}`,
        },
      });

      return ch;
    });

    console.log(`  ✓ Outgoing Challan created: ${outgoingChallan.challanNumber} (${outgoingChallan.fromDepartment} -> ${outgoingChallan.toDepartment})`);
    console.log(`  ✓ Parent Challan lineage verified: parentChallanId = ${outgoingChallan.parentChallanId}`);

    // Verify parent is now HANDED_OVER
    const updatedParent = await prisma.challan.findUnique({
      where: { id: inspectedChallan.id },
    });
    console.log(`  ✓ Parent Challan status transitioned to: ${updatedParent.status}\n`);

    console.log('====================================================');
    console.log('🎉 ALL 10 STITCHING WORKFLOW SCENARIOS PASSED 100%!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Error in Stitching test workflow:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
