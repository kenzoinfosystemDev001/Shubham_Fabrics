import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser, type AuthenticatedUser } from '@/lib/auth/require-user';
import { departmentKeyFor, userBelongsToDepartment, type DepartmentKey } from '@/lib/auth/department-access';
import { sniffDepartmentImageType } from '@/lib/department-images';
import { apiErrorResponse } from '@/lib/api-errors';
import { WorkRequestError, errorResponse } from '@/lib/work-items-server';

/**
 * Fabric photos taken along the line (table "FabricPhoto", manual-migrations/20261028_fabric_photos.sql).
 *
 * - Embroidery, Threadcut QC (QC2) and Stitching upload photos on their own work lines. A department may add
 *   several photos; a photo is never replaced or deleted by a later one.
 * - A photo belongs to its Production Sheet (Design No + Serial No) and to the work line it was taken on.
 * - A department sees the photos of a Production Sheet it holds a line of, taken by its own department or any
 *   department before it in the route (Embroidery -> ... -> Inventory). So Threadcut QC sees Embroidery's,
 *   Stitching sees Embroidery's and Threadcut QC's, and Inventory sees all three.
 * - The uploading department always comes from the work line on the server, never from the request.
 *
 * Files are stored in the database (imageData), like garment images. Raw SQL, so this works with a Prisma
 * client generated before the table existed.
 */

/** The production route, first to last. Photos flow down it. */
const ROUTE: DepartmentKey[] = [
  'EMBROIDERY',
  'THREAD_CUTTING',
  'QC2',
  'WASHING',
  'QC3',
  'RECUTTING',
  'STITCHING',
  'FINISHING',
  'STEAM_PRESS',
  'FINAL_CHECK',
  'INVENTORY',
];
/** Departments that upload fabric photos, with the label shown on their photos. */
export const PHOTO_DEPARTMENTS: Partial<Record<DepartmentKey, string>> = {
  EMBROIDERY: 'Embroidery',
  QC2: 'Threadcut QC',
  STITCHING: 'Stitching',
};
export const MAX_FABRIC_PHOTO_BYTES = 5 * 1024 * 1024;

const routeIndex = (code: string | null | undefined) => {
  const key = departmentKeyFor(code);
  return key ? ROUTE.indexOf(key) : -1;
};
/** Department codes whose photos a line in `code` may see (its own and every earlier one on the route). */
function visibleUploaderCodes(code: string): string[] {
  const at = routeIndex(code);
  if (at < 0) return [];
  return ROUTE.slice(0, at + 1).filter((k) => PHOTO_DEPARTMENTS[k]);
}

// ---- table ---------------------------------------------------------------------------------------------

// Same statements as manual-migrations/20261028_fabric_photos.sql (additive, re-runnable). Run once when the
// table is missing, so photos work even when the app started without that migration.
const CREATE_TABLE = [
  `CREATE TABLE IF NOT EXISTS "FabricPhoto" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "fabricName" TEXT,
    "colour" TEXT,
    "imageData" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FabricPhoto_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "FabricPhoto_programId_idx" ON "FabricPhoto"("programId")`,
  `CREATE INDEX IF NOT EXISTS "FabricPhoto_workItemId_idx" ON "FabricPhoto"("workItemId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FabricPhoto_workItemId_fileHash_key" ON "FabricPhoto"("workItemId", "fileHash")`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricPhoto_programId_fkey') THEN
      ALTER TABLE "FabricPhoto" ADD CONSTRAINT "FabricPhoto_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricPhoto_workItemId_fkey') THEN
      ALTER TABLE "FabricPhoto" ADD CONSTRAINT "FabricPhoto_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "DepartmentWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricPhoto_uploadedById_fkey') THEN
      ALTER TABLE "FabricPhoto" ADD CONSTRAINT "FabricPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
];

let tableReady = false;
let creating: Promise<void> | null = null;
async function tableExistsNow() {
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FabricPhoto') AS ok`;
  return Boolean(rows[0]?.ok);
}
async function ensureTable() {
  if (tableReady) return;
  if (await tableExistsNow()) {
    tableReady = true;
    return;
  }
  try {
    creating ??= (async () => {
      for (const statement of CREATE_TABLE) await prisma.$executeRawUnsafe(statement);
    })().finally(() => {
      creating = null;
    });
    await creating;
  } catch (error) {
    console.error('Could not create the FabricPhoto table:', error);
  }
  tableReady = await tableExistsNow();
  if (!tableReady) throw new WorkRequestError('Fabric photos are not set up in the database yet. Restart the app and try again.', 503);
}

// ---- access --------------------------------------------------------------------------------------------

/** The work line the request is about, checked against the signed-in user's department. */
async function workLineFor(user: AuthenticatedUser, workItemId: string) {
  if (!workItemId) throw new WorkRequestError('Choose the work line.');
  const item = await prisma.departmentWorkItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      departmentCode: true,
      programId: true,
      fabricName: true,
      colour: true,
      program: { select: { id: true, programNumber: true, programSerialNo: true, designNumber: true, designName: true, wilcomDesignNumber: true } },
    },
  });
  if (!item) throw new WorkRequestError('Work line not found.', 404);
  if (!userBelongsToDepartment(user, item.departmentCode)) throw new WorkRequestError('This work line belongs to another department.', 403);
  return item;
}

// ---- API handlers --------------------------------------------------------------------------------------

/**
 * GET /api/fabric-photos?workItemId= — the photos this work line's department may see for its Production
 * Sheet, oldest first (no image data), and whether this line may upload.
 */
export async function listFabricPhotos(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const item = await workLineFor(user, new URL(request.url).searchParams.get('workItemId') || '');
    const uploaderKey = departmentKeyFor(item.departmentCode);
    const canUpload = Boolean(uploaderKey && PHOTO_DEPARTMENTS[uploaderKey]);
    const codes = visibleUploaderCodes(item.departmentCode);
    await ensureTable();
    const rows = codes.length
      ? await prisma.$queryRaw<any[]>`
          SELECT f."id", f."departmentCode", f."fabricName", f."colour", f."fileName", f."fileSize", f."createdAt",
            f."workItemId", COALESCE(u."fullName", u."username", '') AS "uploadedBy"
          FROM "FabricPhoto" f LEFT JOIN "User" u ON u."id" = f."uploadedById"
          WHERE f."programId" = ${item.programId} AND f."departmentCode" = ANY(${codes})
          ORDER BY f."createdAt" ASC`
      : [];
    const p = item.program;
    return NextResponse.json({
      data: rows.map((r) => ({
        ...r,
        departmentLabel: PHOTO_DEPARTMENTS[departmentKeyFor(r.departmentCode) as DepartmentKey] || r.departmentCode,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
      line: {
        workItemId: item.id,
        departmentCode: item.departmentCode,
        designNumber: p?.designNumber || p?.designName || p?.wilcomDesignNumber || '',
        serialNumber: p?.programSerialNo || p?.programNumber || '',
        productionSheet: p?.programNumber || '',
      },
      // Departments whose photos this line sees, e.g. ["Embroidery"] for Thread Cutting.
      visibleFrom: codes.map((c) => PHOTO_DEPARTMENTS[c as DepartmentKey]).filter(Boolean),
      canUpload,
      uploadLabel: canUpload ? PHOTO_DEPARTMENTS[uploaderKey as DepartmentKey] : null,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load fabric photos.');
  }
}

/** POST /api/fabric-photos (multipart: workItemId, file) — Embroidery, Threadcut QC or Stitching adds a photo. */
export async function uploadFabricPhoto(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new WorkRequestError('Send the photo as a file upload.');
    }
    const item = await workLineFor(user, String(form.get('workItemId') || ''));
    const key = departmentKeyFor(item.departmentCode);
    if (!key || !PHOTO_DEPARTMENTS[key]) {
      throw new WorkRequestError('Fabric photos are uploaded by Embroidery, Threadcut QC and Stitching only.', 403);
    }
    const file = form.get('file');
    if (!file || typeof file === 'string') throw new WorkRequestError('Choose a photo to upload.');
    if (file.size > MAX_FABRIC_PHOTO_BYTES) throw new WorkRequestError(`Photo must be ${MAX_FABRIC_PHOTO_BYTES / (1024 * 1024)} MB or smaller.`);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length === 0) throw new WorkRequestError('The selected file is empty.');
    const mimeType = sniffDepartmentImageType(bytes);
    if (!mimeType) throw new WorkRequestError('Upload a JPG, PNG or WebP photo.');
    const fileHash = createHash('sha256').update(bytes).digest('hex');
    const fileName = String(file.name || 'fabric-photo').slice(0, 200);

    await ensureTable();
    const id = randomUUID();
    // The same file twice on one line (e.g. a double tap) is stored once.
    const inserted = await prisma.$executeRaw`
      INSERT INTO "FabricPhoto" ("id", "programId", "workItemId", "departmentCode", "fabricName", "colour", "imageData",
        "mimeType", "fileName", "fileSize", "fileHash", "uploadedById", "createdAt")
      VALUES (${id}, ${item.programId}, ${item.id}, ${key}, ${item.fabricName}, ${item.colour}, ${bytes},
        ${mimeType}, ${fileName}, ${bytes.length}, ${fileHash}, ${user.id}, NOW())
      ON CONFLICT ("workItemId", "fileHash") DO NOTHING`;
    if (inserted === 0) throw new WorkRequestError('This photo is already uploaded for this line.', 409);
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'FABRIC_PHOTO_UPLOADED',
        entity: 'FabricPhoto',
        entityId: id,
        afterState: JSON.stringify({ programId: item.programId, workItemId: item.id, department: key, fileName, fileSize: bytes.length }),
      },
    });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to upload the photo.');
  }
}

/**
 * GET /api/fabric-photos/:id?workItemId= — the image, for a user whose work line (in `workItemId`) may see it:
 * same Production Sheet, taken at or before that line's department on the route.
 */
export async function serveFabricPhoto(request: Request, id: string) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const item = await workLineFor(user, new URL(request.url).searchParams.get('workItemId') || '');
    await ensureTable();
    const rows = await prisma.$queryRaw<Array<{ programId: string; departmentCode: string; mimeType: string; imageData: Uint8Array }>>`
      SELECT "programId", "departmentCode", "mimeType", "imageData" FROM "FabricPhoto" WHERE "id" = ${id}`;
    const photo = rows[0];
    if (!photo || photo.programId !== item.programId || !visibleUploaderCodes(item.departmentCode).includes(photo.departmentCode)) {
      return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
    }
    const etag = `"fabric-photo-${id}"`;
    const headers = { 'Cache-Control': 'private, max-age=31536000, immutable', ETag: etag };
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
    const data = Buffer.from(photo.imageData);
    return new Response(data, {
      status: 200,
      headers: { ...headers, 'Content-Type': photo.mimeType, 'Content-Length': String(data.length), 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    if (error instanceof WorkRequestError) return errorResponse(error, 'Failed to load the photo.');
    return apiErrorResponse(error, 'Failed to load the photo.');
  }
}
