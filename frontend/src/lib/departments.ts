/**
 * The MES production departments, in floor order. Single source for department names shown in
 * the UI (login station grid, sidebar images). `code` is the stable Department.code; `stationId`
 * is the department's sign-in username, and `stationAliases` are older usernames for the same station.
 */
export interface MesDepartment {
  code: string;
  name: string;
  shortName: string;
  stationId: string;
  stationAliases?: string[];
  /** The station incharge's designation, shown under a user's full name (never edited by hand). */
  designation: string;
}

export const MES_DEPARTMENTS: readonly MesDepartment[] = [
  { code: 'PROGRAMMING', name: 'Programming Department', shortName: 'Programming', stationId: 'program', stationAliases: ['programmer'], designation: 'Programming Incharge' },
  { code: 'STORE', name: 'Fabric Store Department', shortName: 'Fabric Store', stationId: 'store', designation: 'Fabric Store Incharge' },
  { code: 'DYEING', name: 'Dyeing Department', shortName: 'Dyeing', stationId: 'dyeing', designation: 'Dyeing Incharge' },
  { code: 'QC1', name: 'Dyeing QC', shortName: 'Dyeing QC', stationId: 'dyeingqc', stationAliases: ['qc1'], designation: 'Dyeing QC Incharge' },
  { code: 'EMBROIDERY', name: 'Embroidery Department', shortName: 'Embroidery', stationId: 'embroidery', designation: 'Embroidery Incharge' },
  { code: 'THREAD_CUTTING', name: 'Thread Cutting Department', shortName: 'Thread Cutting', stationId: 'threadcut', stationAliases: ['cutting'], designation: 'Thread Cutting Incharge' },
  { code: 'QC2', name: 'Threadcut QC', shortName: 'Threadcut QC', stationId: 'threadcutqc', stationAliases: ['qc2'], designation: 'Thread Cutting QC Incharge' },
  { code: 'WASHING', name: 'Washing Department', shortName: 'Washing', stationId: 'washing', designation: 'Washing Incharge' },
  { code: 'QC3', name: 'Washing QC', shortName: 'Washing QC', stationId: 'washingqc', stationAliases: ['qc3', 'qcwashing', 'qc_washing'], designation: 'Washing QC Incharge' },
  { code: 'RECUTTING', name: 'Recutting Department', shortName: 'Recutting', stationId: 'recutting', stationAliases: ['recutting_incharge', 'recutting_supervisor'], designation: 'Recutting Incharge' },
  { code: 'STITCHING', name: 'Stitching Department', shortName: 'Stitching', stationId: 'stitching', designation: 'Stitching Incharge' },
  { code: 'FINISHING', name: 'Finishing Department', shortName: 'Finishing', stationId: 'finishing', designation: 'Finishing Incharge' },
  { code: 'STEAM_PRESS', name: 'Steam Press Department', shortName: 'Steam Press', stationId: 'steampress', designation: 'Steam Press Incharge' },
  { code: 'FINAL_CHECK', name: 'Final QC', shortName: 'Final QC', stationId: 'finalqc', stationAliases: ['finalcheck'], designation: 'Final Check Incharge' },
  // Packing is a module of Inventory; "packing" is the earlier station name and still signs in.
  { code: 'INVENTORY', name: 'Inventory Department', shortName: 'Inventory', stationId: 'inventory', stationAliases: ['packing'], designation: 'Inventory Incharge' },
];

/**
 * Designation for a user's department (e.g. INVENTORY -> "Inventory Incharge"), derived from the
 * department, never from the login username. Null for an unknown department so no wrong label shows.
 */
export function departmentDesignation(code?: string | null): string | null {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  if (c === 'ADMIN') return 'System Administrator';
  if (c === 'FABRIC_STORE') return 'Fabric Store Incharge';
  return MES_DEPARTMENTS.find((d) => d.code === c)?.designation ?? null;
}

/** True when `username` signs in to this department's station (case-insensitive, aliases included). */
export function isStationUsername(department: Pick<MesDepartment, 'stationId' | 'stationAliases'>, username: string): boolean {
  const u = username.trim().toLowerCase();
  return !!u && (department.stationId === u || (department.stationAliases || []).includes(u));
}
