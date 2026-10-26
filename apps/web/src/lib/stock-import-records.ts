import { prisma } from '@subham/database';

/** Full names of the given users, by id. */
export async function uploaderNames(ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map<string, string>();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, fullName: true } });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

interface ImportFields {
  id: string;
  source: string;
  fileName: string;
  fileSize: number;
  status: string;
  rowCount: number;
  engine: string | null;
  uploadedById: string;
  uploadedAt: Date;
  confirmedById: string | null;
  confirmedAt: Date | null;
  addedCount: number;
  skippedCount: number;
}

/** What the screens show about one import (never the file bytes). */
export function importSummary(i: ImportFields, names: Map<string, string>) {
  return {
    id: i.id,
    source: i.source,
    fileName: i.fileName,
    fileSize: i.fileSize,
    status: i.status,
    rowCount: i.rowCount,
    engine: i.engine,
    uploadedBy: names.get(i.uploadedById) || 'Unknown user',
    uploadedAt: i.uploadedAt,
    confirmedBy: i.confirmedById ? names.get(i.confirmedById) || 'Unknown user' : null,
    confirmedAt: i.confirmedAt,
    addedCount: i.addedCount,
    skippedCount: i.skippedCount,
    fileUrl: `/api/fabric-store/inward/import/${i.id}/file`,
  };
}
