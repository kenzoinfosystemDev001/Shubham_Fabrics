import { canViewClientCode, type AuthenticatedUser } from '@/lib/auth/require-user';

/** Relations loaded for a full production sheet (the shape GET /api/programs/[id] returns). */
export const programSheetInclude = {
  customer: true,
  design: true,
  createdBy: { select: { id: true, username: true, fullName: true } },
  approvedBy: { select: { id: true, username: true, fullName: true } },
  fabrics: true,
  sizes: true,
  colours: true,
  challans: {
    include: {
      items: true,
      fromDeptRel: true,
      toDeptRel: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
};

/**
 * Expands a Program row into the production sheet created by Programming: the TOP/BOTTOM/DUPATTA
 * items, sub-styles, production grid and Wilcom entries stored in `metadataJson`. The client
 * code is only included for users allowed to see it.
 */
export function shapeProgramSheet(program: any, viewer: AuthenticatedUser | null) {
  let items: any[] = [];
  let subStyles: string[] = [];
  let subStylesWithAverages: any[] = [];
  let productionGrid: any[] = [];
  let topName = '';
  let serialNoCounter = '000';
  let note = '';
  let clientCode = '';
  let wilcomEntries: any[] = [];
  let wilcomDesignPhoto = program.wilcomDesignPhoto;

  try {
    if (program.metadataJson) {
      const parsed = JSON.parse(program.metadataJson);
      if (Array.isArray(parsed.items)) items = parsed.items;
      if (Array.isArray(parsed.subStyles)) subStyles = parsed.subStyles;
      if (Array.isArray(parsed.subStylesWithAverages)) subStylesWithAverages = parsed.subStylesWithAverages;
      if (Array.isArray(parsed.productionGrid)) productionGrid = parsed.productionGrid;
      if (parsed.topName) topName = parsed.topName;
      if (parsed.serialNoCounter) serialNoCounter = parsed.serialNoCounter;
      if (parsed.note) note = parsed.note;
      if (parsed.clientCode) clientCode = parsed.clientCode;
      if (Array.isArray(parsed.wilcomEntries)) wilcomEntries = parsed.wilcomEntries;
      if (!wilcomDesignPhoto) {
        wilcomDesignPhoto = parsed.wilcomDesignPhoto || wilcomEntries.find((e: any) => e?.photoUrl)?.photoUrl || null;
      }
    }
  } catch {}

  if (subStyles.length === 0 && program.subStyle) {
    subStyles = program.subStyle.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  // Role/department access restriction: ONLY Programming and Admin can see clientCode
  const isAuthorized = !!viewer && canViewClientCode(viewer);

  let metadataJson = program.metadataJson;
  if (!isAuthorized && clientCode && metadataJson) {
    try {
      const { clientCode: _hidden, ...rest } = JSON.parse(metadataJson);
      metadataJson = JSON.stringify(rest);
    } catch {}
  }

  return {
    ...program,
    metadataJson,
    wilcomDesignPhoto: wilcomDesignPhoto || program.wilcomDesignPhoto,
    wilcomEntries,
    items,
    subStyles,
    subStylesWithAverages,
    productionGrid,
    topName: topName || program.mainStyle || program.styleCode,
    serialNoCounter,
    note: note || program.comments || program.remarks || '',
    clientCode: isAuthorized ? clientCode : null,
  };
}
