// Typed entry point for the Fabric Store stock rules; the implementation lives in
// fabric-stock-rules.mjs so node:test scripts can load it without a TypeScript build.
export type FabricStockType = 'UNDYED' | 'DYED';
export type StockUnit = 'MTR' | 'PCS';

export {
  cleanFabricName,
  normalizeFabricStockType,
  getChallanItemFabricType,
  isFabricStoreDepartment,
  normalizeStockUnit,
} from './fabric-stock-rules.mjs';
