/**
 * Wilcom designs belong to exactly one Production Sheet of a program: the sheet's key in
 * metadata.components (TOP, BOTTOM, DUPATTA, OTHER or an added style's CUSTOM_... key), stored on the
 * design as `sheetId`. That key, never the category label, a design number or a serial number, decides
 * which sheet shows, edits and removes a design. The category is only the label the sheet prints under.
 */

const BUILT_IN_SHEETS = ['TOP', 'BOTTOM', 'DUPATTA'];

type SheetComponents = Record<string, { styleName?: string | null } | null | undefined> | null | undefined;
type WilcomLike = { id?: string; sheetId?: string; category?: string };

const upper = (value: unknown) => String(value ?? '').trim().toUpperCase();

/** The label a sheet's designs print under: TOP / BOTTOM / DUPATTA, or an added style's name. */
export function wilcomSheetLabel(sheetId: string, components?: SheetComponents): string {
  if (BUILT_IN_SHEETS.includes(upper(sheetId))) return upper(sheetId);
  return upper(components?.[sheetId]?.styleName) || 'OTHER';
}

/** The sheet a design belongs to. Designs saved before sheetId existed are matched by their category. */
export function wilcomEntrySheetId(entry: WilcomLike, components?: SheetComponents): string | null {
  if (entry?.sheetId) return String(entry.sheetId);
  // A legacy design with no category was a TOP design.
  const category = upper(entry?.category) || 'TOP';
  if (BUILT_IN_SHEETS.includes(category)) return category;
  const keys = components ? Object.keys(components) : [];
  return (
    keys.find((key) => upper(key) === category) ||
    keys.find((key) => !BUILT_IN_SHEETS.includes(upper(key)) && upper(components?.[key]?.styleName) === category) ||
    null
  );
}

/** Only the designs of one Production Sheet. */
export function wilcomEntriesForSheet<T extends WilcomLike>(entries: T[], sheetId: string, components?: SheetComponents): T[] {
  return entries.filter((entry) => wilcomEntrySheetId(entry, components) === sheetId);
}

/**
 * Stamps each design with its sheet and a unique id, and labels it with that sheet's current name.
 * A design whose sheet cannot be found keeps no sheetId: it is preserved but shown on no sheet.
 */
export function assignWilcomSheets<T extends WilcomLike>(entries: T[], components?: SheetComponents): T[] {
  const seen = new Set<string>();
  return entries.map((entry, index) => {
    let id = String(entry?.id || '').trim();
    if (!id || seen.has(id)) id = `wilcom-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`;
    seen.add(id);
    const sheetId = wilcomEntrySheetId(entry, components);
    return sheetId ? { ...entry, id, sheetId, category: wilcomSheetLabel(sheetId, components) } : { ...entry, id };
  });
}

/** A design sent for a sheet that is not on this program is refused. */
export function wilcomSheetError(entries: WilcomLike[], components?: SheetComponents): string | null {
  if (!components) return null;
  const known = (sheetId: string) => BUILT_IN_SHEETS.includes(sheetId) || sheetId === 'OTHER' || sheetId in components;
  const stray = entries.find((entry) => entry?.sheetId && !known(String(entry.sheetId)));
  return stray ? `A Wilcom design is linked to a Production Sheet (${stray.sheetId}) that is not on this program.` : null;
}
