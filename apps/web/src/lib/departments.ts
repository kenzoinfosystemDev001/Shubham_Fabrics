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
}

export const MES_DEPARTMENTS: readonly MesDepartment[] = [
  { code: 'PROGRAMMING', name: 'Programming Department', shortName: 'Programming', stationId: 'program', stationAliases: ['programmer'] },
  { code: 'STORE', name: 'Fabric Store Department', shortName: 'Fabric Store', stationId: 'store' },
  { code: 'DYEING', name: 'Dyeing Department', shortName: 'Dyeing', stationId: 'dyeing' },
  { code: 'QC1', name: 'Dyeing QC', shortName: 'Dyeing QC', stationId: 'qc1' },
  { code: 'EMBROIDERY', name: 'Embroidery Department', shortName: 'Embroidery', stationId: 'embroidery' },
  { code: 'THREAD_CUTTING', name: 'Thread Cutting Department', shortName: 'Thread Cutting', stationId: 'cutting' },
  { code: 'QC2', name: 'Threadcut QC', shortName: 'Threadcut QC', stationId: 'qc2' },
  { code: 'WASHING', name: 'Washing Department', shortName: 'Washing', stationId: 'washing' },
  { code: 'QC3', name: 'Washing QC', shortName: 'Washing QC', stationId: 'qcwashing', stationAliases: ['qc3', 'qc_washing'] },
  { code: 'RECUTTING', name: 'Recutting Department', shortName: 'Recutting', stationId: 'recutting', stationAliases: ['recutting_incharge', 'recutting_supervisor'] },
  { code: 'STITCHING', name: 'Stitching Department', shortName: 'Stitching', stationId: 'stitching' },
  { code: 'FINISHING', name: 'Finishing Department', shortName: 'Finishing', stationId: 'finishing' },
  { code: 'STEAM_PRESS', name: 'Steam Press Department', shortName: 'Steam Press', stationId: 'steampress' },
  { code: 'FINAL_CHECK', name: 'Final QC', shortName: 'Final QC', stationId: 'finalcheck' },
  // Packing is a module of Inventory; "packing" is the earlier station name and still signs in.
  { code: 'INVENTORY', name: 'Inventory Department', shortName: 'Inventory', stationId: 'inventory', stationAliases: ['packing'] },
];

/** True when `username` signs in to this department's station (case-insensitive, aliases included). */
export function isStationUsername(department: Pick<MesDepartment, 'stationId' | 'stationAliases'>, username: string): boolean {
  const u = username.trim().toLowerCase();
  return !!u && (department.stationId === u || (department.stationAliases || []).includes(u));
}
