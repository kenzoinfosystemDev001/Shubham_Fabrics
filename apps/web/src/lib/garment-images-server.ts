import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import type { Prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { requireUser, type AuthenticatedUser } from '@/lib/auth/require-user';
import { apiErrorResponse } from '@/lib/api-errors';
import { cloudinaryTransformUrl, destroyCloudinaryImage } from '@/lib/cloudinary';
import { MAX_DEPARTMENT_IMAGE_BYTES, validateDepartmentImage } from '@/lib/department-images';
import { TX, WorkRequestError, errorResponse } from '@/lib/work-items-server';
import { GARMENT_CATEGORIES } from '@/lib/recutting.mjs';

/**
 * Complete-garment images, one per Production Sheet + garment category (+ style), stored in the database
 * (images saved to Cloudinary before that are still served from there until replaced). Finishing uploads them
 * when it sends finished garments on; Inventory can upload or replace them too. Every department that
 * receives finished garments shows them on its challans, so any signed-in user may view them.
 */

export interface GarmentImageFields {
  programId: string;
  garmentCategory: string;
  styleRef: string;
  file: File;
}

/** Reads and checks the multipart fields of an image upload. */
export async function readGarmentImageForm(request: Request): Promise<GarmentImageFields> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new WorkRequestError('Send the image as a file upload.');
  }
  const programId = String(form.get('programId') || '');
  const garmentCategory = String(form.get('garmentCategory') || '').toUpperCase();
  const styleRef = String(form.get('styleRef') || '').trim().slice(0, 120);
  if (!programId) throw new WorkRequestError('Choose the Production Sheet.');
  if (garmentCategory && !GARMENT_CATEGORIES.includes(garmentCategory as any)) throw new WorkRequestError('Unknown garment category.');
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new WorkRequestError('Choose an image to upload.');
  return { programId, garmentCategory, styleRef, file };
}

/**
 * Stores (or replaces) the image of one garment and writes the audit log. `inTransaction` may add
 * department records (e.g. Inventory's ledger) in the same transaction.
 */
export async function storeGarmentImage(
  user: AuthenticatedUser,
  fields: GarmentImageFields,
  audit: { action: string; department: string },
  inTransaction?: (tx: Prisma.TransactionClient, saved: { id: string; version: number }, replaced: boolean, fileName: string) => Promise<unknown>,
) {
  const { programId, garmentCategory, styleRef, file } = fields;
  if (file.size > MAX_DEPARTMENT_IMAGE_BYTES) throw new WorkRequestError(`Image must be ${MAX_DEPARTMENT_IMAGE_BYTES / (1024 * 1024)} MB or smaller.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateDepartmentImage(bytes);
  if (!check.ok) throw new WorkRequestError(check.error);

  // Always kept in the database (GarmentImage.imageData), never in an outside image service.
  const storage = { storageProvider: 'DATABASE', storageKey: null, imageUrl: null, imageData: Buffer.from(bytes) };
  const fileName = String(file.name || 'garment').slice(0, 200);
  const unique = { programId_garmentCategory_styleRef: { programId, garmentCategory, styleRef } };
  const previous = await prisma.garmentImage.findUnique({ where: unique, select: { id: true, version: true, storageKey: true } });
  const image = await prisma.$transaction(async (tx) => {
    const saved = await tx.garmentImage.upsert({
      where: unique,
      create: { programId, garmentCategory, styleRef, ...storage, mimeType: check.mimeType, fileName, fileSize: bytes.length, uploadedById: user.id },
      update: { ...storage, mimeType: check.mimeType, fileName, fileSize: bytes.length, uploadedById: user.id, version: { increment: 1 } },
      select: { id: true, version: true },
    });
    if (inTransaction) await inTransaction(tx, saved, Boolean(previous), fileName);
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: `${audit.action}_${previous ? 'REPLACED' : 'UPLOADED'}`,
        entity: 'GarmentImage',
        entityId: saved.id,
        beforeState: previous ? JSON.stringify({ version: previous.version }) : null,
        afterState: JSON.stringify({ programId, garmentCategory, styleRef, fileName, storage: storage.storageProvider, version: saved.version, department: audit.department }),
      },
    });
    return saved;
  }, TX);
  // An image stored in Cloudinary before images moved to the database is removed there once replaced.
  if (previous?.storageKey) await destroyCloudinaryImage(previous.storageKey);
  return image;
}

/** GET garment-images?programIds=a,b — the garment images of these Production Sheets (no image data). */
export async function listGarmentImages(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const ids = Array.from(new Set((new URL(request.url).searchParams.get('programIds') || '').split(',').map((s) => s.trim()).filter(Boolean))).slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ data: [] });
    let rows: Array<{ id: string; programId: string; garmentCategory: string; styleRef: string; version: number }> = [];
    try {
      rows = await prisma.garmentImage.findMany({
        where: { programId: { in: ids } },
        select: { id: true, programId: true, garmentCategory: true, styleRef: true, version: true },
      });
    } catch (error) {
      // Before the migration the table does not exist: garments simply show no image.
      if ((error as { code?: string } | null)?.code !== 'P2021') throw error;
    }
    return NextResponse.json({ data: rows });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load garment images.');
  }
}

/**
 * POST garment-images (multipart: programId, garmentCategory, styleRef?, file) — Finishing uploads the
 * image of a finished garment it holds, before sending it on. Replaces the earlier image of that garment.
 */
export async function uploadFinishingGarmentImage(request: Request) {
  const { user, response } = await requireDepartment(request, 'FINISHING');
  if (!user) return response;
  try {
    const fields = await readGarmentImageForm(request);
    const held = await prisma.departmentWorkItem.findFirst({
      where: { departmentCode: 'FINISHING', programId: fields.programId, garmentCategory: fields.garmentCategory || null, ...(fields.styleRef ? { styleRef: fields.styleRef } : {}) },
      select: { id: true },
    });
    if (!held) throw new WorkRequestError('This garment is not held in Finishing.', 404);
    const image = await storeGarmentImage(user, fields, { action: 'FINISHING_GARMENT_IMAGE', department: 'FINISHING' });
    return NextResponse.json({ data: image }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to save the garment image.');
  }
}

/** GET garment-images/:id — the image itself (any signed-in user). */
export async function serveGarmentImage(request: Request, id: string) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const meta = await prisma.garmentImage.findUnique({ where: { id }, select: { id: true, version: true, storageProvider: true, imageUrl: true, mimeType: true } });
    if (!meta) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    const cache = new URL(request.url).searchParams.has('v') ? 'private, max-age=31536000, immutable' : 'private, max-age=60';
    const etag = `"garment-${meta.id}-${meta.version}"`;
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': cache } });
    if (meta.storageProvider === 'CLOUDINARY' && meta.imageUrl) {
      return new Response(null, { status: 302, headers: { Location: cloudinaryTransformUrl(meta.imageUrl, 'c_limit,w_1200,h_1600,q_auto,f_auto'), 'Cache-Control': cache } });
    }
    const stored = await prisma.garmentImage.findUnique({ where: { id }, select: { imageData: true } });
    if (!stored?.imageData) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    return new Response(stored.imageData, {
      status: 200,
      headers: { 'Content-Type': meta.mimeType, 'Content-Length': String(stored.imageData.length), 'Cache-Control': cache, ETag: etag, 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load the garment image.');
  }
}
