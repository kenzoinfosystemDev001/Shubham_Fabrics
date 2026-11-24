export async function loadProgramDocument(program: any): Promise<any> {
  if (!program || (program.metadataJson !== undefined && program.metadataJson !== null)) {
    return program;
  }

  const identifier = program.id || program.programNumber || program.programSerialNo;
  if (!identifier) {
    return program;
  }

  const response = await fetch(`/api/programs/${encodeURIComponent(identifier)}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Unable to load the complete production sheet (${response.status}).`);
  }

  const fullProgram = await response.json();
  return { ...program, ...fullProgram };
}

/** A challan object is complete when it carries its line items and its production sheet link. */
export function isCompleteChallanDocument(challan: any): boolean {
  return Boolean(challan && Array.isArray(challan.items) && (challan.program?.id || challan.programId));
}

/**
 * Dashboards often hold a trimmed challan (number + status only). Documents must
 * be rendered from the actual record, so fetch it by id when anything is missing,
 * then attach the complete production sheet of *that* challan's program.
 */
export async function loadChallanDocument(challan: any): Promise<any> {
  if (!challan) return challan;

  let complete = challan;
  if (!isCompleteChallanDocument(challan) && challan.id) {
    const response = await fetch(`/api/challans/${encodeURIComponent(challan.id)}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load challan ${challan.challanNumber || challan.id} (${response.status}).`);
    }
    complete = { ...challan, ...(await response.json()) };
  }

  const programRef = complete.program || (complete.programId ? { id: complete.programId } : null);
  return {
    ...complete,
    program: programRef ? await loadProgramDocument(programRef) : complete.program,
  };
}
