export type FabricStockType = 'UNDYED' | 'DYED';

export function cleanFabricName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .split('—')[0]
    .split('-')[0]
    .split('(')[0]
    .trim();
}

export function normalizeFabricStockType(entryType: string | null | undefined): FabricStockType {
  return entryType?.toUpperCase() === 'KORA' || entryType?.toUpperCase() === 'UNDYED'
    ? 'UNDYED'
    : 'DYED';
}

export function getChallanItemFabricType(
  item: { colour?: string | null; remarks?: string | null },
  toDepartment: string
): FabricStockType {
  const status = item.remarks?.match(/\bStatus:\s*(Undyed|Dyed)\b/i)?.[1]?.toUpperCase();
  if (status === 'UNDYED' || status === 'DYED') return status;

  const colour = item.colour?.trim().toUpperCase();
  if (colour === 'KORA' || colour === 'UNDYED') return 'UNDYED';
  if (colour === 'DYED') return 'DYED';

  return toDepartment.toUpperCase().includes('DYE') ? 'UNDYED' : 'DYED';
}

export function isFabricStoreDepartment(department: string): boolean {
  const normalized = department.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized === 'STORE' || normalized === 'FABRIC' || normalized.endsWith('FABRICSTORE');
}
