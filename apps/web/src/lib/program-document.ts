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
