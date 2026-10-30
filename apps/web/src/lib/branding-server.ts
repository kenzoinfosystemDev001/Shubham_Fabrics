import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from './auth/require-user';
import { cloudinaryTransformUrl, destroyCloudinaryImage, uploadImageToCloudinary } from './cloudinary';
import { MAX_ALT_TEXT_LENGTH, MAX_DEPARTMENT_IMAGE_BYTES, validateDepartmentImage } from './department-images';
import { appearanceErrorResponse } from './department-images-server';

/** Every column except the image bytes, so metadata reads never load the blob. */
export const BRANDING_ASSET_META_SELECT = {
  id: true,
  key: true,
  storageProvider: true,
  storageKey: true,
  imageUrl: true,
  mimeType: true,
  fileName: true,
  fileSize: true,
  altText: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { fullName: true, username: true } },
} as const;

interface BrandingAssetMeta {
  id: string;
  storageProvider: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  altText: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: { fullName: string; username: string } | null;
}

/** Admin DTO: never exposes storage keys or raw bytes. */
export function toAdminBrandingAsset(row: BrandingAssetMeta | null) {
  if (!row) return null;
  return {
    id: row.id,
    storage: row.storageProvider,
    mimeType: row.mimeType,
    fileName: row.fileName,
    fileSize: row.fileSize,
    altText: row.altText,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    uploadedBy: row.uploadedBy?.fullName || row.uploadedBy?.username || null,
  };
}

export async function auditBrandingAsset(
  actorId: string,
  action: 'BRANDING_IMAGE_UPLOADED' | 'BRANDING_IMAGE_UPDATED' | 'BRANDING_IMAGE_RESET' | 'BRANDING_SETTING_UPDATED',
  entityId: string,
  before: unknown,
  after: unknown,
  request: Request,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: 'BrandingAsset',
        entityId,
        beforeState: before ? JSON.stringify(before) : null,
        afterState: after ? JSON.stringify(after) : null,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
        userAgent: request.headers.get('user-agent'),
      },
    });
  } catch (error) {
    // The change already succeeded; a missing audit row must not turn it into an error.
    console.warn('Failed to write branding audit log:', error);
  }
}

/** Reads a boolean AppSetting; `fallback` when it is unset or the table is not there yet. */
export async function readBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return typeof row?.value === 'boolean' ? row.value : fallback;
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== 'P2021') console.error(`Failed to read setting ${key}:`, error);
    return fallback;
  }
}

/**
 * Streams (DATABASE) or redirects to (CLOUDINARY) the active image for a branding key, or redirects
 * to `defaultUrl` when none is active or it cannot be loaded. Versioned requests (?v=) are cached
 * for good; unversioned ones for 5 minutes, then revalidated by ETag.
 */
export async function serveBrandingImage(
  request: Request,
  options: { key: string; defaultUrl: string; scope: 'public' | 'private'; cloudinaryTransform: string },
) {
  const versioned = new URL(request.url).searchParams.has('v');
  const cacheControl = versioned ? `${options.scope}, max-age=31536000, immutable` : `${options.scope}, max-age=300`;
  // Relative Location keeps the redirect on whatever host the browser used.
  const fallback = (cache = cacheControl) =>
    new Response(null, { status: 302, headers: { Location: options.defaultUrl, 'Cache-Control': cache } });

  try {
    const meta = await prisma.brandingAsset.findFirst({
      where: { key: options.key, isActive: true },
      select: { id: true, version: true, storageProvider: true, imageUrl: true, mimeType: true },
    });
    if (!meta) return fallback();

    const etag = `"brand-${meta.id}-${meta.version}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': cacheControl } });
    }

    if (meta.storageProvider === 'CLOUDINARY' && meta.imageUrl) {
      return new Response(null, {
        status: 302,
        headers: { Location: cloudinaryTransformUrl(meta.imageUrl, options.cloudinaryTransform), 'Cache-Control': cacheControl },
      });
    }

    const stored = await prisma.brandingAsset.findUnique({ where: { id: meta.id }, select: { imageData: true } });
    if (!stored?.imageData) return fallback();

    return new Response(stored.imageData, {
      status: 200,
      headers: {
        'Content-Type': meta.mimeType,
        'Content-Length': String(stored.imageData.length),
        'Cache-Control': cacheControl,
        ETag: etag,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error(`Failed to load branding image ${options.key}:`, error);
    return fallback('no-store');
  }
}

/** Version of the active image for a key, or 0 when the default image is in use. */
export async function activeBrandingVersion(key: string): Promise<number> {
  try {
    const row = await prisma.brandingAsset.findFirst({ where: { key, isActive: true }, select: { version: true } });
    return row?.version || 0;
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== 'P2021') console.error(`Failed to read branding ${key}:`, error);
    return 0;
  }
}

/**
 * Admin-only GET/POST/PATCH/DELETE handlers for one branding image slot. With `enabledSetting`,
 * GET also returns the slot's on/off switch and PATCH accepts `{ enabled: boolean }`.
 */
export function brandingAdminHandlers(options: {
  key: string;
  defaultAlt: string;
  folder: string;
  label: string;
  enabledSetting?: string;
}) {
  const where = { key: options.key };
  const cleanAltText = (value: unknown) => {
    const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    return (text || options.defaultAlt).slice(0, MAX_ALT_TEXT_LENGTH);
  };
  const withEnabled = async (body: Record<string, unknown>) =>
    options.enabledSetting ? { ...body, enabled: await readBooleanSetting(options.enabledSetting, true) } : body;

  async function GET(request: Request) {
    const { user, response } = await requireUser(request, { admin: true });
    if (!user) return response;
    try {
      const row = await prisma.brandingAsset.findUnique({ where, select: BRANDING_ASSET_META_SELECT });
      return NextResponse.json(await withEnabled({ image: toAdminBrandingAsset(row) }));
    } catch (error) {
      console.error(`Error loading ${options.label}:`, error);
      return appearanceErrorResponse(error, `Failed to load the ${options.label}.`);
    }
  }

  async function POST(request: Request) {
    const { user, response } = await requireUser(request, { admin: true });
    if (!user) return response;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    if (file.size > MAX_DEPARTMENT_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image must be 2 MB or smaller.' }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateDepartmentImage(bytes);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    let uploaded: { url: string; publicId: string } | null;
    try {
      const dataUri = `data:${check.mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
      uploaded = await uploadImageToCloudinary(dataUri, options.folder);
    } catch (error) {
      console.error(`${options.label} upload to Cloudinary failed:`, error);
      return NextResponse.json({ error: 'Image storage rejected the upload. Please try again.' }, { status: 502 });
    }

    const fields = {
      ...(uploaded
        ? { storageProvider: 'CLOUDINARY', storageKey: uploaded.publicId, imageUrl: uploaded.url, imageData: null }
        : { storageProvider: 'DATABASE', storageKey: null, imageUrl: null, imageData: bytes }),
      mimeType: check.mimeType,
      fileName: (file.name || options.key.toLowerCase()).slice(0, 200),
      fileSize: bytes.length,
      altText: cleanAltText(formData.get('altText')),
      uploadedById: user.id,
    };

    try {
      const previous = await prisma.brandingAsset.findUnique({ where, select: BRANDING_ASSET_META_SELECT });
      const saved = await prisma.brandingAsset.upsert({
        where,
        create: { key: options.key, ...fields },
        update: { ...fields, isActive: true, version: { increment: 1 } },
        select: BRANDING_ASSET_META_SELECT,
      });
      if (previous?.storageKey && previous.storageKey !== saved.storageKey) {
        await destroyCloudinaryImage(previous.storageKey);
      }
      const dto = toAdminBrandingAsset(saved);
      await auditBrandingAsset(
        user.id,
        previous ? 'BRANDING_IMAGE_UPDATED' : 'BRANDING_IMAGE_UPLOADED',
        saved.id,
        toAdminBrandingAsset(previous),
        { key: options.key, ...dto },
        request,
      );
      return NextResponse.json(await withEnabled({ image: dto }));
    } catch (error) {
      console.error(`Failed to save ${options.label}:`, error);
      await destroyCloudinaryImage(uploaded?.publicId);
      return appearanceErrorResponse(error, `Failed to save the ${options.label}.`);
    }
  }

  async function PATCH(request: Request) {
    const { user, response } = await requireUser(request, { admin: true });
    if (!user) return response;

    const body = await request.json().catch(() => null);
    const wantsEnabled = !!options.enabledSetting && typeof body?.enabled === 'boolean';
    if (!body || (!wantsEnabled && typeof body.isActive !== 'boolean' && typeof body.altText !== 'string')) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    try {
      if (wantsEnabled && options.enabledSetting) {
        const before = await readBooleanSetting(options.enabledSetting, true);
        await prisma.appSetting.upsert({
          where: { key: options.enabledSetting },
          create: { key: options.enabledSetting, value: body.enabled, updatedById: user.id },
          update: { value: body.enabled, updatedById: user.id },
        });
        await auditBrandingAsset(user.id, 'BRANDING_SETTING_UPDATED', options.enabledSetting, { enabled: before }, { enabled: body.enabled }, request);
      }

      let row = await prisma.brandingAsset.findUnique({ where, select: BRANDING_ASSET_META_SELECT });
      if (typeof body.isActive === 'boolean' || typeof body.altText === 'string') {
        if (!row) return NextResponse.json({ error: `No ${options.label} has been uploaded.` }, { status: 404 });
        const data: { isActive?: boolean; altText?: string; version: { increment: number } } = { version: { increment: 1 } };
        if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
        if (typeof body.altText === 'string') data.altText = cleanAltText(body.altText);
        const saved = await prisma.brandingAsset.update({ where, data, select: BRANDING_ASSET_META_SELECT });
        await auditBrandingAsset(user.id, 'BRANDING_IMAGE_UPDATED', saved.id, toAdminBrandingAsset(row), toAdminBrandingAsset(saved), request);
        row = saved;
      }
      return NextResponse.json(await withEnabled({ image: toAdminBrandingAsset(row) }));
    } catch (error) {
      console.error(`Failed to update ${options.label}:`, error);
      return appearanceErrorResponse(error, `Failed to update the ${options.label}.`);
    }
  }

  async function DELETE(request: Request) {
    const { user, response } = await requireUser(request, { admin: true });
    if (!user) return response;

    try {
      const current = await prisma.brandingAsset.findUnique({ where, select: BRANDING_ASSET_META_SELECT });
      if (current) {
        await prisma.brandingAsset.delete({ where });
        await destroyCloudinaryImage(current.storageKey);
        await auditBrandingAsset(user.id, 'BRANDING_IMAGE_RESET', current.id, toAdminBrandingAsset(current), null, request);
      }
      return NextResponse.json(await withEnabled({ image: null }));
    } catch (error) {
      console.error(`Failed to reset ${options.label}:`, error);
      return appearanceErrorResponse(error, `Failed to restore the default ${options.label}.`);
    }
  }

  return { GET, POST, PATCH, DELETE };
}
