// Finished garments (Finishing onward): challans from Finishing, Steam Press and Final QC carry finished
// clothes by name and image only, with the Production Sheet. No colour, fabric, measurement or quantity
// is asked for or printed; each garment sends all of its finished pieces, which are still counted on the
// work items so the next departments keep their piece counts.
// Plain JavaScript so node:test scripts can load it without a TypeScript build.
import { CATEGORY_LABEL } from './recutting.mjs';

/** Departments whose outgoing challans carry finished garments. */
export const FINISHED_GOODS_DEPARTMENTS = Object.freeze(['FINISHING', 'STEAM_PRESS', 'FINAL_CHECK']);

/** A challan of finished garments (issued by Finishing, Steam Press or Final QC). */
export function isFinishedGoodsChallan(challan) {
  return FINISHED_GOODS_DEPARTMENTS.includes(String(challan?.fromDepartment || '').toUpperCase());
}

/** The garment's name: its category and style ("Top · Kurta"); the cloth name when it has no category. */
export function garmentName(item) {
  const category = item?.garmentCategory ? CATEGORY_LABEL[item.garmentCategory] || item.garmentCategory : null;
  const name = [category, item?.styleRef].filter(Boolean).join(' · ');
  return name || item?.fabricName || item?.fabricCode || item?.itemDescription || 'Garment';
}

/** Which garment a line belongs to on its Production Sheet. */
export function garmentKey(item) {
  return `${item?.programId || ''}|${item?.garmentCategory || ''}|${item?.styleRef || ''}|${item?.garmentCategory ? '' : garmentName(item)}`;
}

/**
 * Lines grouped into garments, in first-seen order: one entry per garment with all of its lines
 * (each colour of the same garment is a line, but the challan shows the garment once).
 */
export function groupGarments(items) {
  const groups = new Map();
  for (const item of items || []) {
    const key = garmentKey(item);
    let group = groups.get(key);
    if (!group) {
      group = { key, name: garmentName(item), programId: item?.programId || null, garmentCategory: item?.garmentCategory || '', styleRef: item?.styleRef || '', items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return Array.from(groups.values());
}

/**
 * The garment image of a line: the one for its own style, else the one for its whole category on the
 * same Production Sheet. Never another sheet's or another category's image. `images` are
 * { id, programId, garmentCategory, styleRef, version } rows.
 */
export function imageFor(images, item) {
  if (!item?.programId) return null;
  const category = item.garmentCategory || '';
  const style = item.styleRef || '';
  const on = (s) => (images || []).find((i) => i.programId === item.programId && (i.garmentCategory || '') === category && (i.styleRef || '') === s);
  return on(style) || (style ? on('') : null) || null;
}

/** URL of a garment image (versioned, so it may be cached until replaced). */
export function garmentImageUrl(image) {
  return image ? `/api/garment-images/${image.id}?v=${image.version}` : null;
}
